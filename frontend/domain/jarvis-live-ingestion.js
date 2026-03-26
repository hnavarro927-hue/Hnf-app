/**
 * Ingesta unificada de la operación actual (ERP ya cargado en viewData).
 * No duplica backends; solo normaliza y deduplica referencias.
 */

import { otCanClose } from '../utils/ot-evidence.js';

const pad2 = (n) => String(n).padStart(2, '0');

export const JARVIS_LIVE_INGESTION_VERSION = '2026-03-23';

function countOperativeByChannel(events, maxAgeDays = 30) {
  const n = { correo: 0, whatsapp: 0, ot: 0, imagen: 0, vaultDoc: 0, comercial: 0 };
  const cutoff = Date.now() - maxAgeDays * 86400000;
  for (const e of events || []) {
    const t = new Date(e.at).getTime();
    if (!Number.isFinite(t) || t < cutoff) continue;
    const tc = e.tipoClasificado || '';
    const cs = e.canalSalida || '';
    if (tc === 'correo' || cs === 'correo') n.correo += 1;
    else if (tc === 'whatsapp' || cs === 'whatsapp') n.whatsapp += 1;
    else if (tc === 'ot' || cs === 'ot') n.ot += 1;
    else if (e.kind === 'imagen') n.imagen += 1;
    else if (tc === 'documento') n.vaultDoc += 1;
    if (tc === 'comercial') n.comercial += 1;
  }
  return n;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function mondayOf(d) {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  return c;
}

function addDays(d, delta) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const isOtClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

const economicsOk = (ot) => roundMoney(ot?.montoCobrado) > 0 && roundMoney(ot?.costoTotal) > 0;

const uniqById = (arr, idFn) => {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    const id = idFn(x);
    if (id == null || id === '') continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(x);
  }
  return out;
};

/**
 * @param {object} viewData - loadFullOperationalData
 */
export function buildJarvisCurrentIngestion(viewData = {}) {
  const vd = viewData || {};
  const planOts = vd.planOts ?? vd.ots?.data ?? (Array.isArray(vd.ots) ? vd.ots : []);
  const otsClima = uniqById(planOts.filter(isOtClima), (o) => o.id);
  const today = todayYmd();
  const weekStart = addDays(mondayOf(new Date()), 0);
  const weekEnd = addDays(mondayOf(new Date()), 6);

  const otAbiertas = otsClima.filter((o) => o.estado !== 'terminado');
  const otAbiertasHoy = otAbiertas.filter((o) => {
    const c = String(o.creadoEn || o.createdAt || o.fecha || '').slice(0, 10);
    return c === today;
  });
  const otListasCierre = otAbiertas.filter((o) => economicsOk(o) && otCanClose(o));
  const otIncompletas = otAbiertas.filter(
    (o) => !o.equipos?.length || !String(o.visitaTexto || '').trim()
  );

  const docs = uniqById(Array.isArray(vd.technicalDocuments) ? vd.technicalDocuments : [], (d) => d.id);
  const byEstado = (est) => docs.filter((d) => d.estadoDocumento === est);
  const docPorEstado = {
    en_revision: byEstado('en_revision').length,
    observado: byEstado('observado').length,
    aprobado: byEstado('aprobado').length,
    aprobado_sin_envio: docs.filter((d) => d.estadoDocumento === 'aprobado' && !d.enviadoClienteEn).length,
  };

  const opps = uniqById(Array.isArray(vd.commercialOpportunities) ? vd.commercialOpportunities : [], (o) => o.id);
  const opUrgentes = opps.filter((o) => String(o.prioridad) === 'alta' && String(o.estado) === 'pendiente');
  const opPotencial = opps.reduce((s, o) => s + roundMoney(o.estimacionMonto), 0);

  const entries = Array.isArray(vd.operationalCalendar?.entries) ? vd.operationalCalendar.entries : [];
  const visitasSemana = entries.filter((e) => {
    const f = String(e.fecha || '').slice(0, 10);
    return f >= weekStart && f <= weekEnd;
  });
  const mantenciones = Array.isArray(vd.planMantenciones) ? vd.planMantenciones : [];
  const mantSemana = mantenciones.filter((m) => {
    const f = String(m.fecha || m.fechaProgramada || '').slice(0, 10);
    return f >= weekStart && f <= weekEnd;
  });

  const outlook = vd.outlookFeed && typeof vd.outlookFeed === 'object' ? vd.outlookFeed : { messages: [] };
  const msgs = Array.isArray(outlook.messages) ? outlook.messages : [];
  const correosNuevos = msgs.filter((m) => m.status === 'nuevo');
  const sinDueno = msgs.filter((m) => !m.internalOwner && m.status !== 'cerrado');

  const wa = vd.whatsappFeed && typeof vd.whatsappFeed === 'object' ? vd.whatsappFeed : null;
  const waMsgs = Array.isArray(wa?.messages) ? wa.messages : [];

  const vault = vd.historicalVault?.records?.length
    ? vd.historicalVault
    : { records: [], computed: vd.historicalVault?.computed };
  const vaultN = vault.records?.length ?? 0;

  const calAlerts = Array.isArray(vd.operationalCalendarAlerts) ? vd.operationalCalendarAlerts : [];
  const calSinOt = calAlerts.filter((a) => a.code === 'CAL_SIN_OT' || a.code === 'CAL_OT_TERM_SIN_EJEC');

  const currentOps = {
    otAbiertas: otAbiertas.length,
    otAbiertasHoy: otAbiertasHoy.length,
    otListasCierre: otListasCierre.length,
    otIncompletas: otIncompletas.length,
    muestraOtIds: otAbiertas.slice(0, 8).map((o) => o.id),
  };

  const currentDocuments = {
    total: docs.length,
    porEstado: docPorEstado,
    muestraObservados: byEstado('observado')
      .slice(0, 5)
      .map((d) => ({ id: d.id, cliente: d.cliente, titulo: d.tituloDocumento || d.nombre })),
  };

  const currentCommercial = {
    oportunidades: opps.length,
    urgentesPendientes: opUrgentes.length,
    potencialEstimado: Math.round(opPotencial * 100) / 100,
    muestraUrgentes: opUrgentes.slice(0, 5).map((o) => ({
      id: o.id,
      cliente: o.cliente,
      monto: o.estimacionMonto,
    })),
  };

  const currentCalendar = {
    visitasSemana: visitasSemana.length,
    visitasHoy: entries.filter((e) => String(e.fecha || '').slice(0, 10) === today).length,
    mantencionesSemana: mantSemana.length,
    alertasCalendario: calAlerts.length,
    desconexionOtDoc: calSinOt.length,
  };

  const opEvents = Array.isArray(vd.jarvisOperativeEvents) ? vd.jarvisOperativeEvents : [];
  const operationalBumps = countOperativeByChannel(opEvents);

  const currentIntake = {
    correosTotal: msgs.length,
    correosNuevos: correosNuevos.length,
    seguimiento: msgs.filter((m) => m.status === 'seguimiento').length,
    sinDueno: sinDueno.length,
    whatsappMensajes: waMsgs.length,
    operationalBumps,
    operationalEventsTotal: opEvents.length,
  };

  const currentVault = {
    registros: vaultN,
    patrones: vd.historicalVault?.computed?.patterns?.length ?? 0,
    ultimaImportacion: vd.historicalVault?.computed?.summary?.lastImportAt || null,
  };

  const pendingByOwner = msgs.length > 0 ? aggregateOwners(msgs) : { Romina: 0, Gery: 0, Lyn: 0, sin_dueño: 0 };

  const currentFollowUps = {
    romina: pendingByOwner.Romina || 0,
    gery: pendingByOwner.Gery || 0,
    lyn: pendingByOwner.Lyn || 0,
    sinDueno: pendingByOwner.sin_dueño ?? sinDueno.length,
  };

  const currentRisks = [];
  if (docPorEstado.aprobado_sin_envio > 0) {
    currentRisks.push({
      code: 'RISK_DOC_NO_ENV',
      text: `${docPorEstado.aprobado_sin_envio} informe(s) aprobado(s) sin envío al cliente`,
    });
  }
  if (opUrgentes.length) {
    currentRisks.push({ code: 'RISK_OP_URG', text: `${opUrgentes.length} oportunidad(es) urgentes sin gestión` });
  }
  if (otIncompletas.length >= 3) {
    currentRisks.push({
      code: 'RISK_OT_INCOMP',
      text: `${otIncompletas.length} OT abiertas con ficha incompleta`,
    });
  }
  if (calSinOt.length) {
    currentRisks.push({
      code: 'RISK_CAL_DESC',
      text: `${calSinOt.length} alerta(s) de calendario sin continuidad OT/documento`,
    });
  }

  const currentSignals = buildSignalsList({
    currentOps,
    currentDocuments,
    currentCommercial,
    currentCalendar,
    currentIntake,
    currentVault,
    currentFollowUps,
  });

  const digestTimeline = buildDigestTimeline(viewData, {
    otAbiertasHoy: otAbiertasHoy.length,
    correosNuevos: correosNuevos.length,
    docRevision: docPorEstado.en_revision,
  });

  return {
    version: JARVIS_LIVE_INGESTION_VERSION,
    computedAt: new Date().toISOString(),
    currentOps,
    currentDocuments,
    currentCommercial,
    currentCalendar,
    currentIntake,
    currentVault,
    currentFollowUps,
    currentRisks,
    currentSignals,
    digestTimeline,
  };
}

function aggregateOwners(messages) {
  const m = { Romina: 0, Gery: 0, Lyn: 0, sin_dueño: 0 };
  for (const msg of messages) {
    if (msg.status === 'cerrado') continue;
    const o = msg.internalOwner;
    if (!o) m.sin_dueño += 1;
    else if (/romina/i.test(o)) m.Romina += 1;
    else if (/gery/i.test(o)) m.Gery += 1;
    else if (/lyn/i.test(o)) m.Lyn += 1;
    else m.sin_dueño += 1;
  }
  return m;
}

function buildSignalsList(ctx) {
  const lines = [];
  const o = ctx.currentOps;
  const d = ctx.currentDocuments;
  const c = ctx.currentCommercial;
  const cal = ctx.currentCalendar;
  const i = ctx.currentIntake;
  const v = ctx.currentVault;
  const f = ctx.currentFollowUps;

  lines.push(`OT Clima abiertas: ${o.otAbiertas} (${o.otAbiertasHoy} hoy, ${o.otListasCierre} listas cierre, ${o.otIncompletas} fichas incompletas).`);
  lines.push(
    `Documentos: ${d.total} total · ${d.porEstado.en_revision} en revisión · ${d.porEstado.observado} observados · ${d.porEstado.aprobado_sin_envio} aprobados sin envío.`
  );
  lines.push(
    `Comercial: ${c.oportunidades} oportunidades · ${c.urgentesPendientes} urgentes pendientes · potencial ~$${Math.round(c.potencialEstimado).toLocaleString('es-CL')}.`
  );
  lines.push(
    `Agenda: ${cal.visitasSemana} visitas programadas esta semana · ${cal.mantencionesSemana} mantenciones · ${cal.alertasCalendario} alertas de calendario.`
  );
  const ob = i.operationalBumps || {};
  const opSum = [ob.correo && `+${ob.correo} corr. manual`, ob.whatsapp && `+${ob.whatsapp} WA manual`, ob.ot && `+${ob.ot} OT manual`]
    .filter(Boolean)
    .join(' · ');
  lines.push(
    `Intake: ${i.correosNuevos} correo(s) nuevo(s) · ${i.seguimiento} en seguimiento · ${i.sinDueno} sin dueño · WhatsApp ${i.whatsappMensajes} mensaje(s) en feed${opSum ? ` · Ingesta operativa (30d): ${opSum}` : ''}.`
  );
  lines.push(
    `Vault: ${v.registros} registro(s) histórico(s)${v.ultimaImportacion ? ` · última carga ${String(v.ultimaImportacion).slice(0, 10)}` : ''}.`
  );
  lines.push(`Seguimiento interno (correo): Romina ${f.romina} · Gery ${f.gery} · Lyn ${f.lyn} · sin dueño ${f.sinDueno}.`);
  return lines;
}

function buildDigestTimeline(viewData, snap) {
  const t = new Date().toISOString();
  const items = [
    { at: t, kind: 'ingest', label: `Ingesta operativa: ${snap.otAbiertasHoy} OT nuevas hoy, ${snap.correosNuevos} correos nuevos` },
    { at: t, kind: 'docs', label: `${snap.docRevision} documento(s) en revisión en ERP` },
  ];
  const hv = viewData.historicalVault?.computed?.summary;
  if (hv?.totalRecords) {
    items.push({
      at: hv.lastImportAt || t,
      kind: 'vault',
      label: `Historical Vault: ${hv.totalRecords} registro(s) en archivo`,
    });
  }
  return items.slice(0, 12);
}

/**
 * Capa de sostenibilidad / cobertura (sin inflar si faltan datos).
 */
export function computeJarvisSustainabilityMetrics(unifiedBase, liveIngestion, controlState) {
  const toggles = controlState?.jarvisToggles || {};
  const srcOn = Object.values(toggles).filter((v) => v === true).length;
  const srcTotal = Object.keys(toggles).length;
  const sourceCoverage = srcTotal ? Math.round((srcOn / srcTotal) * 100) : 0;

  const blindSpots = [];
  if ((liveIngestion?.currentVault?.registros || 0) < 3) {
    blindSpots.push('Poco o ningún histórico en Vault — cargar enero/febrero mejora contexto.');
  }
  if ((liveIngestion?.currentIntake?.correosTotal || 0) === 0 && toggles.ingestOutlook) {
    blindSpots.push('Outlook intake vacío — sin señal de buzón en este corte.');
  }
  if ((liveIngestion?.currentIntake?.whatsappMensajes || 0) === 0 && toggles.ingestWhatsapp) {
    blindSpots.push('WhatsApp feed sin mensajes — normal si el módulo no se usa hoy.');
  }
  if ((liveIngestion?.currentCalendar?.visitasSemana || 0) === 0) {
    blindSpots.push('Calendario sin visitas esta semana — validar planificación o datos.');
  }
  if (liveIngestion?.currentCalendar?.desconexionOtDoc > 0) {
    blindSpots.push(
      `${liveIngestion.currentCalendar.desconexionOtDoc} alerta(s) de calendario sin enlace claro a OT/ejecución.`
    );
  }

  let memoryCoverage = 30;
  if (liveIngestion?.currentVault?.registros > 20) memoryCoverage += 25;
  if (liveIngestion?.currentVault?.registros > 100) memoryCoverage += 20;
  if ((liveIngestion?.currentIntake?.correosTotal || 0) > 5) memoryCoverage += 15;
  memoryCoverage = Math.min(100, memoryCoverage);

  const learningLevel = Math.min(
    100,
    (unifiedBase?.memoryHints ? 15 : 0) +
      (liveIngestion?.currentVault?.registros > 0 ? 20 : 0) +
      (liveIngestion?.currentRisks?.length ? 10 : 0) +
      35
  );

  return {
    version: JARVIS_LIVE_INGESTION_VERSION,
    systemHealth: unifiedBase?.systemHealth ?? unifiedBase?.autonomicState?.systemHealth ?? null,
    learningLevel,
    memoryCoverage,
    sourceCoverage,
    blindSpots,
  };
}

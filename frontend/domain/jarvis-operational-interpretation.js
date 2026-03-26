/**
 * Fuente única de interpretación operativa: ingesta persistida → lectura ejecutiva → cronología → ventanas temporales.
 */

import { detectClienteFromText, mapIntakeToPrioridad } from './jarvis-active-intake-engine.js';
import {
  computeImpactoDineroReferencia,
  enrichInterpretationWithDecisions,
} from './jarvis-decision-adn.js';
import { buildInboundMeaning } from './jarvis-unified-intake-engine.js';

const FALLBACK = 'Pendiente de completar — requiere validación humana.';

function nz(s, fb = FALLBACK) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t || fb;
}

/** "En Puma Alerce / ..." → marca + sitio */
export function parseIntakeUbicacion(raw) {
  const t = String(raw || '');
  const m = t.match(/\bEn\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s-]{1,36})/i);
  if (!m) {
    return {
      marca: '',
      sucursal_o_tienda: '',
      tienda_detectada: nz(null, 'Pendiente de completar'),
      sucursal_detectada: nz(null, 'Pendiente de completar'),
    };
  }
  return {
    marca: m[1].trim(),
    sucursal_o_tienda: m[2].trim(),
    tienda_detectada: `${m[1].trim()} ${m[2].trim()}`.trim(),
    sucursal_detectada: m[2].trim(),
  };
}

function nombreDesdeInicio(raw) {
  const t = String(raw || '').trim();
  const m = t.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s*[\/.|]/);
  return m ? m[1].trim() : '';
}

function areaDesde(canal, tipoSalida, flags) {
  if (flags.flota) return 'flota';
  if (tipoSalida === 'oportunidad' || flags.comercial) return 'comercial';
  if (canal === 'whatsapp' || flags.clima) return 'clima';
  return 'operaciones';
}

function flagsDesde(raw, c, ev) {
  const lower = String(raw || '').toLowerCase();
  const evidencia_faltante = /\bsin\s+evidencia|falta\s+evidencia|hueco\s+evidencia/i.test(lower);
  const cierre_pendiente = /\bsin\s+cierre|sin\s+cerrar|cierre\s+ot|no\s+cerr/i.test(lower);
  const comercial = c?.tipoSalida === 'oportunidad' || c?.generaOportunidad || ev?.generaOportunidad;
  const flota = /\btraslado|flota|camión|camion\b/i.test(lower);
  const clima = /\bclima|hvac|enfría|calienta|equipo\b/i.test(lower) || c?.canalSalida === 'whatsapp';
  return { evidencia_faltante, cierre_pendiente, comercial, flota, clima };
}

function estadoOperativoPersistido(ev, prioridad, flags) {
  const reciente = ev?.at && Date.now() - new Date(ev.at).getTime() < 15 * 60 * 1000;
  if (reciente && (ev?.persistencia === 'local' || ev?.persistencia === 'servidor')) return 'nuevo_ingreso';
  if (prioridad === 'CRITICO' || prioridad === 'ALTO') return 'requiere_accion';
  if (flags.evidencia_faltante || flags.cierre_pendiente) return 'requiere_accion';
  if (prioridad === 'CRITICO') return 'escalado';
  return 'interpretado';
}

function semaforo(prioridad, generaRiesgo) {
  if (prioridad === 'CRITICO' || (prioridad === 'ALTO' && generaRiesgo)) return 'rojo';
  if (prioridad === 'ALTO' || generaRiesgo) return 'ambar';
  return 'verde';
}

function accionesDesde(interp) {
  const out = [];
  const f = interp.flags || {};
  if (f.evidencia_faltante) out.push('Solicitar evidencia (Clima)');
  if (f.cierre_pendiente) out.push('Cerrar OT / visita (Clima)');
  if (interp.area_sugerida === 'comercial') out.push('Preparar propuesta (Oportunidades)');
  if (interp.prioridad === 'CRITICO' || interp.prioridad === 'ALTO') out.push('Escalar (Control operación)');
  out.push('Abrir cliente filtrado (Clima)');
  out.push('Registrar en panel del día');
  return [...new Set(out)].slice(0, 6);
}

/**
 * Interpreta un resultado de processIntakeFile / texto pegado.
 */
export function interpretProcessResult(processResult, unified) {
  const pr = processResult || {};
  const m = buildInboundMeaning(pr, unified);
  const c = pr.classification || {};
  const raw = String(m.resumen || c.excerpt || pr.name || '').trim();
  const loc = parseIntakeUbicacion(raw);
  const nom = nombreDesdeInicio(raw);
  const fromDetect = detectClienteFromText(raw);
  const clienteGuess = nz(
    m.cliente !== '—' ? m.cliente : null,
    nz(fromDetect, nz(loc.marca || null, nz(nom, FALLBACK)))
  );
  const flags = flagsDesde(raw, c, c);
  const priorRaw = mapIntakeToPrioridad(c);
  const priorLabel = priorRaw === 'CRITICO' ? 'Crítica' : priorRaw === 'ALTO' ? 'Alta' : 'Media';
  const area = areaDesde(m.canal, c.tipoSalida, flags);

  const que_entro = nz(raw.slice(0, 320), m.queEntro);
  const jarvis_detecto = nz(
    `${c.tipoSalida || c.tipo || 'contexto'} · canal ${m.canal} · ${String(m.significa || '').slice(0, 120)}`,
    m.significa
  );

  const interp = {
    que_entro,
    jarvis_detecto,
    area_sugerida: area,
    prioridad: priorLabel,
    prioridad_raw: priorRaw,
    prioridad_lectura: mapPrioridadLectura(priorRaw),
    responsable_sugerido: nz(m.responsable, 'Operación'),
    acciones_disponibles: [],
    cliente_detectado: clienteGuess,
    sucursal_detectada: loc.sucursal_detectada,
    tienda_detectada: loc.tienda_detectada,
    tipo_evento: nz(c.tipoSalida || c.tipo, 'ingesta'),
    estado_operativo:
      priorRaw === 'CRITICO' || priorRaw === 'ALTO' || flags.evidencia_faltante || flags.cierre_pendiente
        ? 'requiere_accion'
        : 'interpretado',
    impacto_caja: c.generaRiesgo || flags.cierre_pendiente ? 'Cobro puede demorarse si no se cierra evidencia/OT.' : 'Acotado si hay dueño y fecha.',
    impacto_cierre: flags.cierre_pendiente ? 'Cierre de OT en riesgo — falta evidencia o acta.' : 'Sin bloqueo explícito de cierre en texto.',
    impacto_comercial: c.generaOportunidad ? 'Palanca comercial o recurrente posible.' : 'Comercial latente hasta anclar cliente.',
    siguiente_paso: nz(m.accionSugerida, c.accionInmediata),
    timestamp_operativo: new Date().toISOString(),
    flags: {
      ...flags,
      fresh: true,
      atraso: false,
    },
    semaforo: semaforo(priorRaw, Boolean(c.generaRiesgo)),
    _meaning: m,
  };
  interp.acciones_disponibles = accionesDesde(interp);
  return enrichInterpretationWithDecisions(interp, {
    generaOportunidad: c.generaOportunidad,
    generaRiesgo: c.generaRiesgo,
    tecnicoAsignado: c.tecnicoAsignado,
    impactoEconomicoHeuristico: c.impactoEconomicoEstimado,
  });
}

/**
 * Interpreta un evento persistido (centro / servidor).
 */
export function interpretOperativeEvent(ev) {
  const e = ev || {};
  const raw = String(e.rawExcerpt || e.excerpt || '').trim();
  const c = {
    tipoSalida: e.tipoSalida,
    tipo: e.tipo,
    canalSalida: e.canalSalida,
    canal: e.canal,
    urgencia: e.urgencia,
    generaRiesgo: e.generaRiesgo,
    generaOportunidad: e.generaOportunidad,
    excerpt: raw.slice(0, 280),
    accionInmediata: e.accionInmediata,
    responsable: e.responsableSugerido || e.responsable,
  };
  const loc = parseIntakeUbicacion(raw);
  const nom = nombreDesdeInicio(raw);
  const cliente = nz(
    e.clienteDetectado,
    nz(detectClienteFromText(raw), nz(loc.marca || null, nom || FALLBACK))
  );
  const flags = flagsDesde(raw, c, e);
  const priorRaw = String(e.prioridad || mapPrioridadFromEv(e) || 'NORMAL');
  const priorLabel = priorRaw === 'CRITICO' ? 'Crítica' : priorRaw === 'ALTO' ? 'Alta' : 'Media';
  const area = areaDesde(e.canalSalida || e.canal, e.tipoSalida, flags);

  const que_entro = nz(raw.slice(0, 400), 'Entrada operativa registrada en centro de ingesta.');
  const jarvis_detecto = nz(
    `${e.tipoClasificado || e.tipoSalida || 'evento'} · ${e.canalSalida || e.canal || 'manual'} · ${e.accionInmediata?.slice(0, 100) || 'clasificado'}`,
    'Evento indexado — revisar detalle.'
  );

  const interp = {
    que_entro,
    jarvis_detecto,
    area_sugerida: area,
    prioridad: priorLabel,
    prioridad_raw: priorRaw,
    prioridad_lectura: mapPrioridadLectura(priorRaw),
    responsable_sugerido: nz(e.responsableSugerido || e.responsable, 'Operación'),
    acciones_disponibles: [],
    cliente_detectado: cliente,
    sucursal_detectada: loc.sucursal_detectada,
    tienda_detectada: loc.tienda_detectada,
    tipo_evento: nz(e.tipoClasificado || e.tipoSalida, 'operativo'),
    estado_operativo: estadoOperativoPersistido(e, priorRaw, flags),
    impacto_caja:
      Number(e.impactoEconomicoHeuristico) > 0
        ? `Referencia económica ~$${Number(e.impactoEconomicoHeuristico).toLocaleString('es-CL')}.`
        : flags.cierre_pendiente
          ? 'Caja puede quedar trabada sin cierre formal.'
          : 'Sin monto explícito en ingesta.',
    impacto_cierre: flags.cierre_pendiente ? 'Cierre pendiente explícito en texto.' : 'Sin señal de cierre roto en texto.',
    impacto_comercial: e.generaOportunidad ? 'Oportunidad marcada en clasificación.' : 'Sin oportunidad explícita.',
    siguiente_paso: nz(e.accionInmediata, 'Asignar dueño y fecha en panel operativo.'),
    timestamp_operativo: e.at || e.createdAt || new Date().toISOString(),
    flags: {
      ...flags,
      fresh: false,
      atraso: e.at ? Date.now() - new Date(e.at).getTime() > 48 * 3600000 : false,
    },
    semaforo: semaforo(priorRaw, Boolean(e.generaRiesgo)),
  };
  interp.acciones_disponibles = accionesDesde(interp);
  return enrichInterpretationWithDecisions(interp, e);
}

function mapPrioridadFromEv(e) {
  const p = String(e.prioridad || '').toUpperCase();
  if (p.includes('CRIT')) return 'CRITICO';
  if (p.includes('ALT')) return 'ALTO';
  return 'NORMAL';
}

/** Lectura humana: alta | media | baja */
export function mapPrioridadLectura(priorRaw) {
  const p = String(priorRaw || '').toUpperCase();
  if (p === 'CRITICO' || p === 'ALTO') return 'alta';
  if (p === 'NORMAL') return 'media';
  return 'baja';
}

/** OT | evidencia | cliente | comercial */
export function mapTipoEventoLectura(interp) {
  const flags = interp?.flags || {};
  if (flags.comercial) return 'comercial';
  const t = String(interp?.tipo_evento || '').toLowerCase();
  if (t.includes('comercial') || t.includes('oportun')) return 'comercial';
  if (flags.evidencia_faltante) return 'evidencia';
  if (t.includes('ot') || t.includes('incidente') || t.includes('whatsapp') || t.includes('documento')) {
    return 'OT';
  }
  return 'cliente';
}

/** nuevo | en_curso | crítico | resuelto */
export function mapEstadoLectura(interp) {
  const st = String(interp?.estado_operativo || '').toLowerCase();
  const pr = String(interp?.prioridad_raw || '').toUpperCase();
  if (st.includes('nuevo')) return 'nuevo';
  if (pr === 'CRITICO' || st.includes('escalado')) return 'crítico';
  if (st.includes('requiere') || st.includes('interpretado')) return 'en_curso';
  return 'en_curso';
}

/**
 * Snapshot cerebral persistido en cliente (merge local) — no requiere cambios de API.
 * @param {object} payload - salida de buildJarvisOperativePayload o evento servidor parcial
 */
export function buildJarvisOperativeBrainSnapshot(payload) {
  const ev = {
    ...payload,
    rawExcerpt: String(payload?.rawExcerpt || payload?.excerpt || '').slice(0, 2000),
    at: payload?.at || new Date().toISOString(),
  };
  const interp = interpretOperativeEvent(ev);
  const ubic =
    interp.tienda_detectada && !String(interp.tienda_detectada).includes('Pendiente')
      ? interp.tienda_detectada
      : interp.sucursal_detectada;
  return {
    jarvisOperativoBrain: {
      que_entro: interp.que_entro,
      jarvis_detecto: interp.jarvis_detecto,
      cliente_detectado: interp.cliente_detectado,
      ubicacion: ubic,
      tipo_evento: mapTipoEventoLectura(interp),
      prioridad: mapPrioridadLectura(interp.prioridad_raw),
      accion_obligatoria: interp.accion_obligatoria,
      responsable_asignado: interp.responsable_asignado,
      impacto_dinero_referencia: interp.impacto_dinero_referencia,
      impacto: {
        caja: interp.impacto_caja,
        cierre: interp.impacto_cierre,
        operativo: interp.area_sugerida || 'operaciones',
        comercial: interp.impacto_comercial,
        estado: interp.impacto_estado,
        flujo: interp.impacto_flujo,
      },
      responsable_sugerido: interp.responsable_sugerido,
      siguiente_paso: interp.siguiente_paso,
      timestamp: interp.timestamp_operativo,
      estado: mapEstadoLectura(interp),
      semaforo: interp.semaforo,
      flags: interp.flags,
      acciones_disponibles: interp.acciones_disponibles,
    },
  };
}

function jarvisEventsInTimeRange(jarvis, t0, t1) {
  const out = [];
  for (const e of jarvis || []) {
    const t = e?.at ? new Date(e.at).getTime() : NaN;
    if (Number.isFinite(t) && t >= t0 && t <= t1) out.push(e);
  }
  return out;
}

function interpretJarvisWindowStats(jarvisSubset) {
  let pendientes = 0;
  let criticos = 0;
  let cierresSenal = 0;
  let oportunidades = 0;
  let riesgoDinero = 0;
  for (const e of jarvisSubset) {
    const i = interpretOperativeEvent(e);
    if (i.estado_operativo === 'requiere_accion' || i.flags?.evidencia_faltante || i.flags?.cierre_pendiente) {
      pendientes += 1;
    }
    if (i.prioridad_raw === 'CRITICO' || i.semaforo === 'rojo') criticos += 1;
    if (i.flags?.cierre_pendiente) cierresSenal += 1;
    if (e.generaOportunidad || i.flags?.comercial) oportunidades += 1;
    riesgoDinero += Number(e.impactoEconomicoHeuristico) || 0;
  }
  return {
    jarvisTotal: jarvisSubset.length,
    pendientes,
    criticos,
    cierresSenal,
    oportunidades,
    riesgoDinero,
  };
}

/**
 * Memoria viva: agrupaciones y señales (cliente / técnico / sucursal / tipo).
 */
export function buildLiveMemoryGrid(jarvisEvents, limit = 5) {
  const byTecnico = new Map();
  const bySucursal = new Map();
  const byTipo = new Map();
  let repeticionClientes = 0;
  let atrasoN = 0;
  let evidenciaN = 0;
  let oportunidadN = 0;
  const clienteCount = new Map();

  for (const e of jarvisEvents || []) {
    const i = interpretOperativeEvent(e);
    const ck = String(i.cliente_detectado || '').toLowerCase();
    if (ck && !ck.includes('pendiente')) {
      clienteCount.set(ck, (clienteCount.get(ck) || 0) + 1);
    }
    const tech = String(i.responsable_sugerido || 'sin dueño').trim();
    byTecnico.set(tech, (byTecnico.get(tech) || 0) + 1);
    const suc = String(i.sucursal_detectada || '').trim();
    if (suc && !suc.includes('Pendiente')) {
      bySucursal.set(suc, (bySucursal.get(suc) || 0) + 1);
    }
    const tipo = mapTipoEventoLectura(i);
    byTipo.set(tipo, (byTipo.get(tipo) || 0) + 1);
    if (i.flags?.atraso) atrasoN += 1;
    if (i.flags?.evidencia_faltante) evidenciaN += 1;
    if (e.generaOportunidad || i.flags?.comercial) oportunidadN += 1;
  }
  for (const n of clienteCount.values()) {
    if (n >= 2) repeticionClientes += 1;
  }

  const topMap = (m, n) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));

  return {
    topTecnicos: topMap(byTecnico, limit),
    topSucursales: topMap(bySucursal, limit),
    porTipo: topMap(byTipo, 8),
    senales: {
      clientesConRepeticion: repeticionClientes,
      eventosConAtraso: atrasoN,
      evidenciaFaltante: evidenciaN,
      oportunidades: oportunidadN,
    },
  };
}

/**
 * DOM ejecutivo para “Qué entendió Jarvis”.
 */
export function renderJarvisExecutiveUnderstand(element, processResult, unified) {
  if (!element) return null;
  const interp = interpretProcessResult(processResult, unified);
  element.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'jarvis-exec-understand';
  root.setAttribute('data-semaforo', interp.semaforo);

  const mkRow = (label, value) => {
    const row = document.createElement('div');
    row.className = 'jarvis-exec-understand__row';
    const lb = document.createElement('span');
    lb.className = 'jarvis-exec-understand__k';
    lb.textContent = label;
    const val = document.createElement('p');
    val.className = 'jarvis-exec-understand__v';
    val.textContent = value;
    row.append(lb, val);
    return row;
  };

  root.append(
    mkRow('Qué entró', interp.que_entro),
    mkRow('Qué detectó Jarvis', interp.jarvis_detecto),
    mkRow('Área sugerida', interp.area_sugerida),
    mkRow('Prioridad', interp.prioridad),
    mkRow('Responsable sugerido', interp.responsable_sugerido),
    mkRow('Cliente / sitio', `${interp.cliente_detectado} · ${interp.tienda_detectada}`),
    mkRow('Acciones disponibles', interp.acciones_disponibles.join(' · ')),
    mkRow('Siguiente paso', interp.siguiente_paso)
  );

  element.append(root);
  return interp;
}

export function renderJarvisExecutiveUnderstandFromEvent(element, ev) {
  if (!element) return null;
  const interp = interpretOperativeEvent(ev);
  element.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'jarvis-exec-understand';
  root.setAttribute('data-semaforo', interp.semaforo);
  const mkRow = (label, value) => {
    const row = document.createElement('div');
    row.className = 'jarvis-exec-understand__row';
    const lb = document.createElement('span');
    lb.className = 'jarvis-exec-understand__k';
    lb.textContent = label;
    const val = document.createElement('p');
    val.className = 'jarvis-exec-understand__v';
    val.textContent = value;
    row.append(lb, val);
    return row;
  };
  const impactLine = [
    interp.impacto_caja && `Caja: ${interp.impacto_caja}`,
    interp.impacto_cierre && `Cierre: ${interp.impacto_cierre}`,
    interp.impacto_comercial && `Comercial: ${interp.impacto_comercial}`,
  ]
    .filter(Boolean)
    .join(' · ');
  root.append(
    mkRow('Qué entró', interp.que_entro),
    mkRow('Qué detectó Jarvis', interp.jarvis_detecto),
    mkRow('Ubicación / sitio', `${interp.tienda_detectada} · ${interp.sucursal_detectada}`),
    mkRow('Tipo evento', mapTipoEventoLectura(interp)),
    mkRow('Área sugerida', interp.area_display || interp.area_sugerida),
    mkRow('Prioridad', `${interp.prioridad} (${interp.prioridad_lectura || mapPrioridadLectura(interp.prioridad_raw)})`),
    mkRow('Estado', mapEstadoLectura(interp)),
    mkRow('Impacto texto', impactLine || nz(null, 'Impacto operativo acotado con datos cargados.')),
    mkRow('Responsable asignado', interp.responsable_asignado || interp.responsable_sugerido),
    mkRow('ACCIÓN RECOMENDADA', interp.accion_obligatoria),
    mkRow('Impacto $ (ref.)', `$${Number(interp.impacto_dinero_referencia || 0).toLocaleString('es-CL')}`),
    mkRow('Impacto estado', interp.impacto_estado),
    mkRow('Impacto flujo', interp.impacto_flujo),
    mkRow('Cliente', interp.cliente_detectado),
    mkRow('Acciones disponibles', (interp.acciones_disponibles || []).join(' · ')),
    mkRow('Siguiente paso', interp.siguiente_paso)
  );
  element.append(root);
  return interp;
}

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function startOfLocalMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * @param {object} ctx
 * @param {object[]} ctx.jarvisEvents
 * @param {object[]} ctx.opEvents
 * @param {object[]} ctx.entradasDia
 * @param {object} [ctx.panel] - operationalPanelDaily (cierres_listos, etc.)
 */
export function buildTemporalOperationalWindows(ctx) {
  const now = Date.now();
  const jarvis = Array.isArray(ctx.jarvisEvents) ? ctx.jarvisEvents : [];
  const op = Array.isArray(ctx.opEvents) ? ctx.opEvents : [];
  const ent = Array.isArray(ctx.entradasDia) ? ctx.entradasDia : [];
  const panel = ctx.panel || {};
  const cierresListosN = Array.isArray(panel.cierres_listos) ? panel.cierres_listos.length : 0;

  const allTs = [];
  const pushTs = (iso) => {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (Number.isFinite(t)) allTs.push({ t, iso });
  };
  for (const e of jarvis) pushTs(e.at);
  for (const e of op) pushTs(e.updatedAt || e.createdAt);
  for (const e of ent) pushTs(e.updatedAt || e.createdAt);

  const inRange = (t0, t1) => allTs.filter((x) => x.t >= t0 && x.t <= t1).length;

  const t0d = startOfLocalDay();
  const t0w = now - 7 * 86400000;
  const t0m = startOfLocalMonth();
  const t030 = now - 30 * 86400000;

  const byCliente = new Map();
  for (const e of jarvis) {
    const interp = interpretOperativeEvent(e);
    const k = String(interp.cliente_detectado || '').toLowerCase();
    if (!k || k.includes('pendiente')) continue;
    byCliente.set(k, (byCliente.get(k) || 0) + 1);
  }

  let topFriccion = '—';
  let topN = 0;
  for (const [k, n] of byCliente) {
    if (n > topN) {
      topN = n;
      topFriccion = k;
    }
  }

  const digest = (label, tStart) => {
    const n = inRange(tStart, now);
    const jw = jarvisEventsInTimeRange(jarvis, tStart, now);
    const st = interpretJarvisWindowStats(jw);
    const moneyLine =
      st.riesgoDinero > 0
        ? `Riesgo referido ~$${Math.round(st.riesgoDinero).toLocaleString('es-CL')}`
        : 'Sin monto agregado en ingresos Jarvis.';
    return {
      label,
      ingresos: n,
      jarvisEnVentana: st.jarvisTotal,
      pendientes: st.pendientes,
      criticos: st.criticos,
      cierresSenal: st.cierresSenal,
      oportunidades: st.oportunidades,
      riesgoDinero: st.riesgoDinero,
      cierresListosPanel: cierresListosN,
      linea: `${n} eventos · ${st.pendientes} pendientes · ${st.criticos} críticos · ${st.oportunidades} opp. · ${moneyLine}`,
    };
  };

  return {
    today: digest('Hoy', t0d),
    week: digest('7 días', t0w),
    month: digest('Mes calendario', t0m),
    d30: digest('30 días', t030),
    topClienteFriccion: topFriccion,
    topClienteN: topN,
  };
}

/**
 * Memoria corta por cliente desde eventos Jarvis + OT abiertas.
 */
export function buildClientOperationalMemory(jarvisEvents, planOts, limit = 6) {
  const by = new Map();
  for (const e of jarvisEvents || []) {
    const i = interpretOperativeEvent(e);
    const k = String(i.cliente_detectado || '').toLowerCase();
    if (!k || k.includes('pendiente')) continue;
    const arr = by.get(k) || [];
    arr.push({ at: e.at, interp: i, raw: e });
    by.set(k, arr);
  }
  for (const [k, arr] of by) {
    arr.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  const otsByCliente = new Map();
  for (const o of planOts || []) {
    const ck = String(o.cliente || '').toLowerCase().trim();
    if (!ck) continue;
    otsByCliente.set(ck, (otsByCliente.get(ck) || 0) + 1);
  }

  const out = [];
  for (const [k, arr] of by) {
    const last = arr[0];
    if (!last) continue;
    const patron = arr.length >= 2 ? 'Patrón recurrente detectado' : null;
    out.push({
      clienteKey: k,
      display: last.interp.cliente_detectado,
      ultimoContacto: last.at,
      ultimoEstado: last.interp.estado_operativo,
      ultimoResponsable: last.interp.responsable_sugerido,
      ultimoRiesgo: last.interp.semaforo,
      eventos7d: arr.filter((x) => Date.now() - new Date(x.at).getTime() < 7 * 86400000).length,
      otRelacionadas: otsByCliente.get(k) || 0,
      patron,
    });
  }
  out.sort((a, b) => String(b.ultimoContacto).localeCompare(String(a.ultimoContacto)));
  return out.slice(0, limit);
}

/**
 * Modelo para el bloque “JARVIS DECIDE” (HQ): prioriza último evento persistido.
 */
export function buildJarvisDecideCommandModel(data, friction) {
  const events = Array.isArray(data?.jarvisOperativeEvents) ? data.jarvisOperativeEvents : [];
  const sorted = [...events].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const latest = sorted[0];
  const crOp = friction?.capaRealidad || {};
  const bloqueado = Math.round(Number(crOp.ingresoBloqueado) || 0);

  if (!latest) {
    return {
      accion: 'Registrar ingreso en núcleo vivo (texto, archivo o canal)',
      responsable: 'Romina',
      impactoPesos: bloqueado > 0 ? bloqueado : 95_000,
      impactoLinea:
        bloqueado > 0
          ? `Caja referida bloqueada ~$${bloqueado.toLocaleString('es-CL')} — decisión: cerrar evidencia y OT.`
          : 'Impacto referencia $95.000 hasta registrar el primer caso del día.',
      impactoEstado: 'Estado: sin evento Jarvis en cola — la acción obligatoria es alimentar ingesta real.',
      impactoFlujo: 'Flujo: recepción → clasificación → responsable asignado → ejecución.',
      queEntro: 'Sin evento operativo reciente en servidor.',
      detecto: 'Jarvis en espera de entrada clasificable.',
      area: 'Operación',
      prioridad: 'media',
      accionObligatoria: 'Registrar ingreso en núcleo vivo (texto, archivo o canal)',
    };
  }

  const interp = interpretOperativeEvent(latest);
  const ref = interp.impacto_dinero_referencia ?? computeImpactoDineroReferencia(interp, latest);
  const money = Math.max(ref, bloqueado);
  return {
    accion: interp.accion_obligatoria,
    responsable: interp.responsable_asignado,
    impactoPesos: money,
    impactoLinea: `~$${money.toLocaleString('es-CL')} · ${String(interp.impacto_caja || '').slice(0, 80)}`,
    impactoEstado: interp.impacto_estado,
    impactoFlujo: interp.impacto_flujo,
    queEntro: interp.que_entro,
    detecto: interp.jarvis_detecto,
    area: interp.area_display,
    prioridad: interp.prioridad_lectura || 'media',
    accionObligatoria: interp.accion_obligatoria,
  };
}

export function relativeAgeBadge(iso) {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return '—';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'hace instantes';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'hace 1 h' : `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hace 1 d' : `hace ${d} d`;
}

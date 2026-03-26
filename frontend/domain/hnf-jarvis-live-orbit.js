/**
 * Jarvis Live Orbit — doble anillo (origen + flujo) y núcleo ejecutivo desde datos reales.
 * Consumido vía `hnfAdn.jarvisLiveOrbit` (buildHnfAdnSnapshot).
 */

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function ts(x) {
  const t = new Date(x?.updatedAt || x?.createdAt || x?.fechaCreacion || x?.at || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isToday(x) {
  return ts(x) >= startOfTodayMs();
}

/** @param {number} s 0–100 */
function stressToEstado(s) {
  if (s >= 70) return 'rojo';
  if (s >= 38) return 'amarillo';
  return 'verde';
}

/**
 * @param {object} data - viewData
 * @param {object} ctx - campos ya calculados en buildHnfAdnSnapshot
 * @param {string} [ctx.principalProblema]
 */
export function buildJarvisLiveOrbitModel(data, ctx) {
  const d = data && typeof data === 'object' ? data : {};
  const planOts = Array.isArray(d.planOts) ? d.planOts : d.ots?.data ?? [];
  const ots = Array.isArray(planOts) ? planOts : [];

  const eventosUnificados = Array.isArray(ctx.eventosUnificados) ? ctx.eventosUnificados : [];
  const cards = Array.isArray(ctx.cards) ? ctx.cards : [];
  const alertas = ctx.alertas || {};
  const traffic = ctx.traffic || { bloqueos: 0, pendientes: 0, ok: 0, totalOt: 0 };
  const bottleneck = ctx.bottleneck || null;
  const whatsappHoy = Number(ctx.whatsappHoy) || 0;
  const dineroEnRiesgo = Number(ctx.dineroEnRiesgo) || 0;

  const wa = Array.isArray(d.whatsappFeed?.messages) ? d.whatsappFeed.messages : [];
  const outlook = Array.isArray(d.outlookFeed?.messages) ? d.outlookFeed.messages : [];
  const jarvisEv = Array.isArray(d.jarvisOperativeEvents) ? d.jarvisOperativeEvents : [];
  const opps = Array.isArray(d.commercialOpportunities) ? d.commercialOpportunities : [];
  const sol = Array.isArray(d.flotaSolicitudes) ? d.flotaSolicitudes : [];

  const outlookHoy = outlook.filter(isToday).length;
  const jarvisHoy = jarvisEv.filter(isToday).length;
  const oppsHoy = opps.filter(isToday).length;

  const evComercial = eventosUnificados.filter((e) => e.tipo === 'comercial').length;
  const evCorreo = eventosUnificados.filter((e) => e.tipo === 'correo').length;
  const evDocumento = eventosUnificados.filter((e) => e.tipo === 'documento').length;
  const evNuevo = eventosUnificados.filter((e) => e.estado === 'nuevo').length;
  const evClasif = eventosUnificados.filter((e) => e.estado === 'clasificado').length;
  const evProceso = eventosUnificados.filter((e) => e.estado === 'en_proceso').length;
  const evBloq = eventosUnificados.filter((e) => e.estado === 'bloqueado').length;

  const solAbiertas = sol.filter((s) => String(s?.estado || '').toLowerCase() !== 'cerrada').length;
  const solHoy = sol.filter((s) => isToday(s)).length;

  const sinTecnico = ots.filter(
    (o) =>
      String(o?.estado || '').toLowerCase() === 'en proceso' &&
      !String(o?.tecnicoAsignado || '').trim()
  ).length;

  const enProceso = ots.filter((o) => String(o?.estado || '').toLowerCase() === 'en proceso').length;

  const cotizados = opps.filter((o) => String(o?.estado || '').toLowerCase() === 'cotizado').length;
  const pendOpp = opps.filter((o) => String(o?.estado || '').toLowerCase() === 'pendiente').length;

  const cliOt = {};
  for (const ot of ots) {
    const c = String(ot?.cliente || '')
      .trim()
      .toLowerCase();
    if (c) cliOt[c] = (cliOt[c] || 0) + 1;
  }
  const clientesRepetidos = Object.values(cliOt).filter((n) => n >= 2).length;

  const tipoServicioCount = {};
  for (const ot of ots) {
    const t = String(ot?.tipoServicio || ot?.tipo || 'servicio')
      .trim()
      .toLowerCase();
    if (t) tipoServicioCount[t] = (tipoServicioCount[t] || 0) + 1;
  }
  const upsellPotencial = Object.values(tipoServicioCount).filter((n) => n >= 2).length;

  /** Anillo origen v3: WhatsApp · Correo · Manual · Comercial */
  const entradaRaw = [
    ['whatsapp', Math.min(1, whatsappHoy / 10 + wa.length * 0.018)],
    ['correo', Math.min(1, outlookHoy / 7 + evCorreo * 0.12 + jarvisHoy * 0.08)],
    ['manual', Math.min(1, (evDocumento * 0.18 + jarvisHoy * 0.35) / 7)],
    ['comercial', Math.min(1, (oppsHoy + evComercial * 0.28 + pendOpp * 0.06) / 7)],
  ];
  const entradaIntensities = entradaRaw.map(([, v]) => v);
  const entradaLabels = ['WhatsApp', 'Correo', 'Manual', 'Comercial'];

  const waConOt = wa.filter((m) => String(m?.otIdRelacionado || '').trim()).length;

  const totalEv = Math.max(1, eventosUnificados.length);
  const nOt = Math.max(1, ots.length);

  const et1Rojo = cards.filter((c) => c.etapa1?.semaforo === 'rojo' || c.etapa1?.semaforo === 'naranja').length;
  const et2Mal = cards.filter((c) => c.etapa2?.semaforo === 'rojo' || c.etapa2?.semaforo === 'naranja').length;
  const et3Mal = cards.filter((c) => c.etapa3?.semaforo === 'rojo' || c.etapa3?.semaforo === 'naranja').length;

  const bloqueos = Number(traffic.bloqueos) || 0;
  const pendientes = Number(traffic.pendientes) || 0;

  const fIngreso = Math.min(100, (evNuevo / totalEv) * 100 + whatsappHoy * 8);
  const fClasif = Math.min(100, (evClasif / totalEv) * 85 + evNuevo * 6);
  const fAsign = Math.min(100, sinTecnico ? 55 + sinTecnico * 12 : solAbiertas * 5);
  const fEjec = Math.min(100, enProceso ? (bloqueos / Math.max(1, cards.length)) * 100 + evBloq * 10 : 15);
  const fEvid = Math.min(100, ((alertas.sinInformeTecnico || 0) / nOt) * 100 + et1Rojo * 9);
  const fCierreAdm = Math.min(100, ((alertas.pendientesAdmin || 0) / nOt) * 100 + et2Mal * 8);
  const fCobro = Math.min(100, Math.min(100, dineroEnRiesgo / 25_000) + et3Mal * 7);

  const flujoKeys = [
    'ingreso',
    'clasificacion',
    'asignacion',
    'ejecucion',
    'evidencia',
    'cierre',
    'cobro',
  ];
  const flujoStress = [fIngreso, fClasif, fAsign, fEjec, fEvid, fCierreAdm, fCobro];
  const flujoEstados = flujoStress.map(stressToEstado);
  const flujoLabels = [
    'Ingreso',
    'Clasificación',
    'Asignación',
    'Ejecución',
    'Evidencia',
    'Cierre',
    'Cobro',
  ];

  let siguienteAccion = 'REVISAR COLA OPERATIVA';
  if (sinTecnico > 0) siguienteAccion = 'ASIGNAR TÉCNICO';
  else if (alertas.sinInformeTecnico > 0) siguienteAccion = 'COMPLETAR EVIDENCIA TÉCNICA';
  else if (alertas.pendientesAdmin > 0) siguienteAccion = 'DESPACHAR ADMIN / INFORME';
  else if (alertas.noEnviadasCliente > 0) siguienteAccion = 'ENVIAR AL CLIENTE';
  else if (cotizados > 0) siguienteAccion = 'EMPUJAR CIERRE COMERCIAL';
  else if (bottleneck?.otId) siguienteAccion = `FOCO OT ${bottleneck.otId}`;

  const firstEv = eventosUnificados.find((e) => e.requiere_accion && e.accion_sugerida);
  if (firstEv?.accion_sugerida && bloqueos + pendientes < 2) {
    const short = String(firstEv.accion_sugerida)
      .slice(0, 44)
      .toUpperCase();
    if (short.length > 8) siguienteAccion = short;
  }

  let responsable = 'COORDINACIÓN';
  const bt = String(bottleneck?.tecnico || '').trim();
  if (bt && bt !== '—') responsable = bt.toUpperCase();
  else if (alertas.sinInformeTecnico > 0) responsable = 'TÉCNICO DE CAMPO';
  else if (alertas.pendientesAdmin > 0 || alertas.noEnviadasCliente > 0) responsable = 'ADMINISTRACIÓN';
  else if (cotizados + pendOpp > 0) responsable = 'COMERCIAL';

  const presionParts = [];
  if (whatsappHoy > 0) presionParts.push(`WA ${whatsappHoy} HOY`);
  if (solHoy > 0) presionParts.push(`${solHoy} SOL. HOY`);
  if (bloqueos > 0) presionParts.push(`${bloqueos} OT CRÍT.`);
  if (pendientes > 0) presionParts.push(`${pendientes} OT ALERTA`);
  if (!presionParts.length) presionParts.push('OPERACIÓN EN RITMO');

  const headlineOperativa = presionParts.join(' · ');
  const cantidadReal = `${ots.length} OT · ${solAbiertas} sol. abiertas · ${eventosUnificados.length} eventos`;
  const impactoLine = `$${Math.round(dineroEnRiesgo).toLocaleString('es-CL')} riesgo · ${bloqueos + pendientes} fricción`;

  const principalRaw = String(ctx.principalProblema || '').trim();
  const problemaPrincipal =
    principalRaw.slice(0, 96) || 'SIN FOCO CRÍTICO — MANTENER RITMO OPERATIVO.';

  const dineroRiesgoFmt = `$${Math.round(dineroEnRiesgo).toLocaleString('es-CL')}`;
  const comercialIntegrado = `COM. ${pendOpp} ABIERTAS · ${cotizados} COTIZ. · ${clientesRepetidos} CLI. REP.`;
  const cruceOperativo =
    waConOt > 0 || evCorreo > 0
      ? `UNIF. ${waConOt} WA↔OT · ${evCorreo} MAIL EN COLA`
      : `UNIF. COLA ${eventosUnificados.length} EVT.`;

  const commercialPressure = Math.min(
    99,
    pendOpp + cotizados * 2 + opps.filter((o) => o.prioridad === 'alta').length * 2 + clientesRepetidos + upsellPotencial
  );

  const accionesComercial = [];
  if (pendOpp) accionesComercial.push(`Cotizar ${pendOpp} oportunidad(es)`);
  if (cotizados) accionesComercial.push(`Cerrar ${cotizados} cotización(es)`);
  if (clientesRepetidos) accionesComercial.push(`${clientesRepetidos} cliente(s) con OT repetidas`);
  if (upsellPotencial) accionesComercial.push(`${upsellPotencial} servicio(s) con recurrencia`);
  if (whatsappHoy && pendOpp) accionesComercial.push('Cruzar WA del día con pipeline');

  return {
    version: 3,
    ringEntrada: {
      labels: entradaLabels,
      keys: entradaRaw.map(([k]) => k),
      intensities: entradaIntensities,
    },
    ringFlujo: {
      labels: flujoLabels,
      keys: flujoKeys,
      estados: flujoEstados,
      stress: flujoStress,
    },
    nucleo: {
      problemaPrincipal,
      dineroRiesgoFmt,
      otBloqueadas: bloqueos,
      otBloqueadasLine: `${bloqueos} OT BLOQUEADAS`,
      comercialIntegrado,
      cruceOperativo,
      operacionHoy: `${ots.length} OT ACTIVAS · ${bloqueos} ROJAS · ${pendientes} ÁMBAR`,
      solicitudesHoy: `${solHoy} ingresos flota hoy · ${solAbiertas} abiertas`,
      otActivas: ots.length,
      solicitudesAbiertas: solAbiertas,
      whatsappHoy,
      riesgoMonto: dineroEnRiesgo,
      lineaPresion: headlineOperativa,
      cantidadReal,
      impactoLine,
      siguienteAccion,
      responsableSugerido: responsable,
      accionLabel: `ACCIÓN: ${siguienteAccion}`,
    },
    commercialLive: {
      oportunidadesDetectadas: opps.length,
      oportunidadesPrioritarias: opps.filter((o) => o.prioridad === 'alta').length,
      clientesRepetidos,
      upsellPotencial,
      cotizacionesPendientes: cotizados,
      oportunidadesAbiertas: pendOpp,
      cierresPosibles: cotizados + pendOpp,
      accionesSugeridas: accionesComercial.slice(0, 6),
      pressureScore: commercialPressure,
      whatsappCrucesHoy: whatsappHoy,
    },
  };
}

/**
 * Conic gradient string — N segments from -90deg.
 * @param {number[]} intensities 0–1
 * @param {string[]} rgbList "r,g,b" per segment
 */
export function buildConicEntradaGradient(intensities, rgbList) {
  const n = intensities.length;
  const slice = 360 / n;
  const parts = [];
  for (let i = 0; i < n; i += 1) {
    const a = 0.22 + Math.min(1, Math.max(0, intensities[i] ?? 0)) * 0.78;
    const rgb = rgbList[i] || '0,194,168';
    const start = -90 + i * slice;
    const end = -90 + (i + 1) * slice;
    parts.push(`rgba(${rgb},${a.toFixed(3)}) ${start}deg ${end}deg`);
  }
  return `conic-gradient(from -90deg, ${parts.join(', ')})`;
}

/**
 * @param {{ estados: string[], stress: number[] }} ringFlujo
 */
export function buildConicFlujoGradient(ringFlujo) {
  const { estados = [], stress = [] } = ringFlujo || {};
  const n = Math.max(estados.length, 1);
  const slice = 360 / n;
  const parts = [];
  for (let i = 0; i < n; i += 1) {
    const st = estados[i] || 'verde';
    const s = Math.min(1, (stress[i] || 0) / 100);
    const a = 0.28 + s * 0.62;
    let rgb = '34,197,94';
    if (st === 'amarillo') rgb = '234,179,8';
    if (st === 'rojo') rgb = '248,113,113';
    const start = -90 + i * slice;
    const end = -90 + (i + 1) * slice;
    parts.push(`rgba(${rgb},${a.toFixed(3)}) ${start}deg ${end}deg`);
  }
  return `conic-gradient(from -90deg, ${parts.join(', ')})`;
}

/**
 * Franja "Sistema vivo" — cinco lecturas instantáneas con inferencia si falta data.
 */

export const JARVIS_SISTEMA_VIVO_VERSION = '2026-03-24';

/**
 * @param {object} unified
 * @param {{ centroLast?: object|null, feedLastIngestAt?: string|null, fmtAt?: (iso: string) => string }} ctx
 */
export function buildJarvisSistemaVivoStrip(unified, ctx = {}) {
  const u = unified || {};
  const ad = u.jarvisAlienDecisionCore || {};
  const cr = u.jarvisFrictionPressure?.capaRealidad || {};
  const mp = u.jarvisFrictionPressure?.modoPresion || {};
  const hq = u.jarvisFlowIntelligence?.hqNarrative || {};
  const msgs = Array.isArray(u.outlookFeed?.messages) ? u.outlookFeed.messages.length : 0;
  const waArr = u.whatsappFeed?.messages;
  const waN = Array.isArray(waArr) ? waArr.length : u.whatsappFeed && typeof u.whatsappFeed === 'object' ? 1 : 0;
  const ots = Array.isArray(u.planOts) ? u.planOts.length : 0;
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities : [];
  const vaultN = Array.isArray(u.historicalVault?.records) ? u.historicalVault.records.length : 0;
  const fmt = ctx.fmtAt || ((iso) => (iso ? String(iso).slice(0, 16) : '—'));
  const lc = ctx.centroLast || null;
  const feedAt = ctx.feedLastIngestAt || null;

  let nucleo = 'ESTABLE · observación activa.';
  if (ad.estadoGlobal === 'critico') nucleo = 'CRÍTICO · caja y cierres primero.';
  else if (ad.estadoGlobal === 'tension') nucleo = 'EN PRESIÓN · acotar foco y dueños.';
  else if (mp.nivel === 'alta') nucleo = 'EN PRESIÓN · tensión de modo alta.';
  else if (mp.nivel === 'media') nucleo = 'ESTABLE con tensión media · vigilancia.';

  let ultima = '';
  if (lc?.at) {
    ultima = `${fmt(lc.at)} · ${lc.canalSalida || lc.canal || 'canal'} · ${lc.tipoSalida || lc.tipo || 'tipo'}`;
  } else if (feedAt) {
    ultima = `Sync ${fmt(feedAt)}. Sin evento manual en este equipo.`;
  } else if (msgs > 0) {
    ultima = `${msgs} correo(s) en vista. Sin registro manual en ingesta.`;
  } else if (ots > 0) {
    ultima = `Sin correo nuevo. ${ots} OT en plan — opero por obra cargada.`;
  } else {
    ultima = 'Sin ingesta local ni datos densos. Cargá señal o sincronizá.';
  }

  const bloq = Math.round(Number(cr.ingresoBloqueado) || 0);
  const fuga = Math.round(Number(cr.fugaDinero) || 0);
  let dinero = '';
  if (bloq > 0 || fuga > 0) {
    dinero = `Bloqueado ~$${bloq.toLocaleString('es-CL')}. Fuga estimada ~$${fuga.toLocaleString('es-CL')}.`;
  } else {
    dinero = 'Sin bloqueo fuerte en cifras. Mantengo observación de cobro.';
  }

  let oportunidad = '';
  if (opps.length) {
    const o0 = opps[0];
    const cli = o0.cliente || o0.clienteNombre || o0.cuenta || o0.nombreCuenta || 'Cliente';
    const tit = (o0.titulo || o0.nombre || o0.estado || 'Oportunidad').toString().slice(0, 72);
    oportunidad = `${cli}: ${tit}`;
    if (/puma/i.test(JSON.stringify(o0)) && !/upsell|contrato/i.test(JSON.stringify(o0).toLowerCase())) {
      oportunidad += ' · revisar upsell / contrato.';
    }
  } else {
    oportunidad = 'Pipeline comercial no visible. Expansión limitada hasta cargar oportunidades.';
  }

  let accion =
    (ad.focoDelDia && String(ad.focoDelDia).slice(0, 140)) ||
    (hq.accionImpactoInmediato && String(hq.accionImpactoInmediato).slice(0, 140)) ||
    '';
  if (!accion) accion = 'Primero: despejar cobro o cierre con evidencia.';
  else if (accion.length > 140) accion = accion.slice(0, 137) + '…';

  const inferencias = [];
  if (!msgs) inferencias.push('Sin correo nuevo. Mantengo observación por OT activas.');
  if (!waN) inferencias.push('Canal WhatsApp sin eventos recientes.');
  if (!opps.length) inferencias.push('Sin pipeline visible.');
  if (vaultN < 20) inferencias.push('Memoria baja. Sugiero cargar enero/febrero en Vault.');

  return {
    version: JARVIS_SISTEMA_VIVO_VERSION,
    columns: [
      { key: 'nucleo', label: 'Estado del núcleo', value: nucleo },
      { key: 'ingesta', label: 'Última ingesta', value: ultima },
      { key: 'dinero', label: 'Dinero detectado', value: dinero },
      { key: 'oportunidad', label: 'Oportunidad detectada', value: oportunidad },
      { key: 'accion', label: 'Acción inmediata', value: accion },
    ],
    inferencias: inferencias.slice(0, 4),
  };
}

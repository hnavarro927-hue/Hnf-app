/**
 * Métricas agregadas para portada / centro de mando (solo lectura de datos ya cargados).
 */

import { getEvidenceGaps, otCanClose } from '../utils/ot-evidence.js';
import { computeJarvisOtKpis } from './jarvis-ot-kpis.js';

const isClosedEstado = (e) => {
  const s = String(e || '')
    .trim()
    .toLowerCase();
  return ['terminado', 'cerrada', 'cerrado', 'cancelado'].includes(s);
};

const todayLocalIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const planOts = (raw) => {
  const o = raw?.planOts ?? raw?.ots?.data ?? [];
  return Array.isArray(o) ? o : [];
};

/**
 * @param {object} raw viewData
 * @param {object} [opts]
 * @param {object} [opts.hnfAdn]
 */
export function computeCommandCenterMetrics(raw, opts = {}) {
  const ots = planOts(raw);
  const today = todayLocalIso();
  const adn = opts.hnfAdn && typeof opts.hnfAdn === 'object' ? opts.hnfAdn : raw?.hnfAdn;
  const cards = Array.isArray(adn?.cards) ? adn.cards : [];

  let activas = 0;
  let climaActivas = 0;
  let flotaTipoActivas = 0;
  let enRiesgoTarjetas = cards.filter((c) => c.global === 'rojo').length;
  let pendienteValidacion = 0;
  let sinEvidenciaCompleta = 0;
  let listasParaCerrar = 0;
  let atrasadas = 0;

  for (const o of ots) {
    if (isClosedEstado(o.estado)) continue;
    activas += 1;
    const tipo = String(o.tipoServicio || 'clima').toLowerCase();
    if (tipo === 'flota') flotaTipoActivas += 1;
    else climaActivas += 1;

    const st = String(o.estado || '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (st === 'pendiente_validacion') pendienteValidacion += 1;

    if (getEvidenceGaps(o).length > 0) sinEvidenciaCompleta += 1;
    if (otCanClose(o)) listasParaCerrar += 1;

    const fv = String(o.fecha || '').slice(0, 10);
    if (fv && fv < today) atrasadas += 1;
  }

  const riesgoOperativo = Math.max(enRiesgoTarjetas, atrasadas);

  const flota = Array.isArray(raw?.flotaSolicitudes) ? raw.flotaSolicitudes : [];
  let solicitudesNuevasHoy = 0;
  for (const s of flota) {
    const creado = String(s.createdAt || s.fecha || '').slice(0, 10);
    const est = String(s.estado || '').toLowerCase();
    if (creado === today && (est === 'recibida' || est === '')) solicitudesNuevasHoy += 1;
  }

  const traffic = adn?.traffic || {};
  const alertas = Number(adn?.alertas?.total) || Number(adn?.alertas?.count) || 0;
  const alertasOps =
    alertas ||
    (Array.isArray(adn?.alertasEjecutivas) ? adn.alertasEjecutivas.length : 0) ||
    enRiesgoTarjetas;

  const kpi = computeJarvisOtKpis(raw);

  return {
    otActivas: activas,
    otEnRiesgo: riesgoOperativo,
    otPendientesCierre: pendienteValidacion,
    otSinEvidenciaCompleta: sinEvidenciaCompleta,
    otListasParaCerrar: listasParaCerrar,
    solicitudesNuevasHoy,
    climaEstadoLabel: climaActivas ? `${climaActivas} OT abiertas` : 'Sin OT Clima abiertas',
    flotaEstadoLabel: flotaTipoActivas ? `${flotaTipoActivas} OT tipo flota` : 'Sin OT flota abiertas',
    flotaPipelineAbiertas: flota.filter((s) => !['cerrada', 'cancelada'].includes(String(s.estado || '').toLowerCase()))
      .length,
    alertasOperativas: alertasOps || traffic.bloqueos || 0,
    traficoPendientes: Number(traffic.pendientes) || 0,
    jarvisOtKpis: kpi,
  };
}

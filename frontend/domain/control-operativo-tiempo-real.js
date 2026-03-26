/**
 * Control operativo en tiempo real — 3 etapas por OT (técnico / admin / cliente)
 * + señales WhatsApp: retirada, fotos, informe listo.
 */

import { getEvidenceGaps, getQualityCloseGaps } from '../utils/ot-evidence.js';

/** @typedef {'verde'|'amarillo'|'naranja'|'rojo'} Semaforo */

const MS = 60_000;

function parseTs(m) {
  const t = new Date(m?.updatedAt || m?.createdAt || m?.rawOriginal?.timestamp || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function bodyOf(m) {
  const b = m?.rawOriginal?.body ?? m?.descripcion ?? m?.observaciones ?? '';
  return String(b).toLowerCase();
}

/**
 * Mensajes del feed asociados a una OT (por id o cliente).
 * @param {object} ot
 * @param {object[]} messages
 */
export function whatsappMessagesForOt(ot, messages) {
  const list = Array.isArray(messages) ? messages : [];
  const oid = String(ot?.id || '');
  const cli = String(ot?.cliente || '')
    .toLowerCase()
    .trim();
  return list.filter((m) => {
    if (oid && String(m?.otIdRelacionado || '') === oid) return true;
    const mc = String(m?.cliente || '')
      .toLowerCase()
      .trim();
    if (cli && mc && (cli.includes(mc) || mc.includes(cli))) return true;
    return false;
  });
}

/**
 * @param {object[]} forOt
 */
export function extractWhatsappOperationalSignals(forOt) {
  let salidaAt = 0;
  let fotosMencion = false;
  let informeListoAt = 0;

  const sorted = [...forOt].sort((a, b) => parseTs(a) - parseTs(b));
  for (const m of sorted) {
    const t = parseTs(m);
    if (!t) continue;
    const b = bodyOf(m);
    if (/\bnos\s+retiramos\b|\bretiramos\b|\bya\s+salimos\b|\bsaliendo\s+de\b|\bterminamos\s+visita\b/i.test(b)) {
      salidaAt = t;
    }
    if (/\bfotos?\b|\bevidencias?\b|\bantes\s+y\s+despu[eé]s\b|\badjunt(o|é)\s+fotos?\b/i.test(b)) {
      fotosMencion = true;
    }
    if (/\binforme\s+listo\b|\blisto\s+para\s+admin\b|\binforme\s+terminado\b|\blisto\s+el\s+informe\b/i.test(b)) {
      informeListoAt = t;
    }
  }

  return { salidaAt, fotosMencion, informeListoAt };
}

function semaforoRank(s) {
  const o = { rojo: 4, naranja: 3, amarillo: 2, verde: 1 };
  return o[s] || 0;
}

function worstOf(a, b, c) {
  return [a, b, c].reduce((w, x) => (semaforoRank(x) > semaforoRank(w) ? x : w), 'verde');
}

function fmtHora(isoOrMs) {
  if (!isoOrMs) return '—';
  try {
    const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '—';
  }
}

/**
 * @param {object} ot
 * @param {object} signals
 * @param {number} nowMs
 */
function computeEtapa1(ot, signals, nowMs) {
  const gaps = getEvidenceGaps(ot);
  const pdfOk = Boolean(String(ot?.pdfUrl || '').trim());
  const terminado = String(ot?.estado || '').toLowerCase() === 'terminado';

  const salidaMs = signals.salidaAt || 0;
  const salidaLabel = salidaMs ? fmtHora(salidaMs) : '—';

  let minSinInforme = null;
  if (!pdfOk && salidaMs > 0) {
    minSinInforme = Math.max(0, Math.floor((nowMs - salidaMs) / MS));
  } else if (!pdfOk && String(ot?.estado || '') === 'en proceso') {
    const visitMs = (() => {
      try {
        const f = String(ot?.fecha || '');
        const h = String(ot?.hora || '12:00');
        const d = new Date(`${f}T${h}:00`);
        const x = d.getTime();
        return Number.isFinite(x) ? x : 0;
      } catch {
        return 0;
      }
    })();
    if (visitMs > 0) minSinInforme = Math.max(0, Math.floor((nowMs - visitMs) / MS));
  }

  /** @type {Semaforo} */
  let semaforo = 'amarillo';
  if (terminado && pdfOk) semaforo = 'verde';
  else if (gaps.length > 0) {
    if (minSinInforme != null && minSinInforme > 90) semaforo = 'rojo';
    else if (minSinInforme != null && minSinInforme > 45) semaforo = 'naranja';
    else semaforo = 'amarillo';
  } else if (!pdfOk) {
    if (minSinInforme != null && minSinInforme > 60) semaforo = 'rojo';
    else if (minSinInforme != null && minSinInforme > 30) semaforo = 'naranja';
    else semaforo = 'amarillo';
  }

  if (signals.fotosMencion && gaps.length > 0) {
    semaforo = semaforoRank(semaforo) < semaforoRank('amarillo') ? semaforo : 'amarillo';
  }

  return {
    semaforo,
    salidaLabel,
    minSinInforme,
    lineaTecnica: gaps.length === 0 ? 'Evidencia equipo OK' : `${gaps.length} hueco(s) evidencia`,
    pdfOk,
    gapsCount: gaps.length,
  };
}

/**
 * @param {object} ot
 * @param {object} signals
 * @param {object} et1
 * @param {number} nowMs
 */
function computeEtapa2(ot, signals, et1, nowMs) {
  const terminado = String(ot?.estado || '').toLowerCase() === 'terminado';
  const pdfOk = et1.pdfOk;
  const mc = Number(ot?.montoCobrado) || 0;
  const ct = Number(ot?.costoTotal) || 0;
  const econOk = mc > 0 && ct > 0;

  const updatedMs = (() => {
    try {
      const u = new Date(ot?.updatedAt || ot?.createdAt || 0).getTime();
      return Number.isFinite(u) ? u : 0;
    } catch {
      return 0;
    }
  })();

  let estado = 'pendiente';
  if (terminado && pdfOk && econOk) estado = 'completo';
  else if (terminado || (et1.gapsCount === 0 && String(ot?.estado || '') === 'en proceso')) estado = 'en proceso';

  const refMs = signals.informeListoAt || updatedMs || nowMs;
  const minutos = Math.max(0, Math.floor((nowMs - refMs) / MS));

  /** @type {Semaforo} */
  let semaforo = 'amarillo';
  if (estado === 'completo') semaforo = 'verde';
  else if (estado === 'en proceso') {
    if (minutos > 120) semaforo = 'naranja';
    if (!terminado && et1.gapsCount === 0 && minutos > 180) semaforo = 'rojo';
  } else {
    const qg = getQualityCloseGaps(ot);
    if (qg.length && et1.gapsCount === 0) semaforo = 'naranja';
    if (et1.gapsCount === 0 && !terminado && minutos > 240) semaforo = 'rojo';
  }

  return {
    semaforo,
    admin: 'Romina',
    estado,
    minutos,
  };
}

/**
 * @param {object} ot
 * @param {object} et1
 */
function computeEtapa3(ot, et1) {
  const terminado = String(ot?.estado || '').toLowerCase() === 'terminado';
  const pdfOk = et1.pdfOk;
  const enviado = terminado && pdfOk;
  const estadoCliente = enviado ? 'Informe archivado / listo envío' : 'NO enviado';

  /** @type {Semaforo} */
  let semaforo = enviado ? 'verde' : 'rojo';
  if (!enviado && terminado && !pdfOk) semaforo = 'naranja';

  return { semaforo, estadoCliente, enviado };
}

/**
 * @param {object} viewData
 * @param {number} [nowMs]
 */
export function buildControlOperativoCards(viewData, nowMs = Date.now()) {
  const ots = viewData?.planOts ?? viewData?.ots?.data ?? [];
  const list = Array.isArray(ots) ? ots : [];
  const messages = viewData?.whatsappFeed?.messages ?? [];

  const cards = list.map((ot) => {
    const waOt = whatsappMessagesForOt(ot, messages);
    const signals = extractWhatsappOperationalSignals(waOt);
    const et1 = computeEtapa1(ot, signals, nowMs);
    const et2 = computeEtapa2(ot, signals, et1, nowMs);
    const et3 = computeEtapa3(ot, et1);
    const global = worstOf(et1.semaforo, et2.semaforo, et3.semaforo);

    return {
      otId: ot.id,
      cliente: String(ot.cliente || '—'),
      tecnico: String(ot.tecnicoAsignado || '—'),
      etapa1: et1,
      etapa2: et2,
      etapa3: et3,
      global,
      waSignals: signals,
    };
  });

  cards.sort((a, b) => {
    const d = semaforoRank(b.global) - semaforoRank(a.global);
    if (d !== 0) return d;
    const ma = a.etapa1.minSinInforme ?? 0;
    const mb = b.etapa1.minSinInforme ?? 0;
    return mb - ma;
  });

  return cards;
}

/**
 * @param {ReturnType<typeof buildControlOperativoCards>} cards
 */
export function buildControlOperativoAlertas(cards) {
  let sinInformeTecnico = 0;
  let pendientesAdmin = 0;
  let noEnviadasCliente = 0;

  for (const c of cards) {
    if (!c.etapa1.pdfOk && (c.etapa1.gapsCount > 0 || (c.etapa1.minSinInforme ?? 0) > 25)) {
      sinInformeTecnico += 1;
    }
    if (c.etapa1.gapsCount === 0 && c.etapa2.estado !== 'completo') pendientesAdmin += 1;
    if (!c.etapa3.enviado) noEnviadasCliente += 1;
  }

  return { sinInformeTecnico, pendientesAdmin, noEnviadasCliente };
}

export const SEMAFORO_EMOJI = {
  verde: '🟢',
  amarillo: '🟡',
  naranja: '🟠',
  rojo: '🔴',
};

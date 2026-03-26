/**
 * Motor operacional WhatsApp: identidad, cliente, impacto, matching OT.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TECNICOS_PATH = path.resolve(__dirname, '../../data/tecnicos_whatsapp.json');

const EMOJI_TERMINADO = /[✅✔️☑️]/u;
const EMOJI_LISTO = /\b(listo|terminad[oa]|finalizado)\b/i;

const TEL_REGEX = /(\+?56\s?)?([29]\d{8})\b/g;

export const normalizeText = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length >= 9) return d.slice(-9);
  return d;
}

export function loadTecnicosRoster() {
  try {
    const raw = readFileSync(TECNOS_PATH, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * @param {object} normalized - salida de normalizeWhatsAppInput
 * @param {string} fullText
 * @param {Array<{ tecnicoId, nombre, telefono, alias? }>} roster
 */
export function resolveTechnician(normalized, fullText, roster = []) {
  const text = fullText || '';
  const errors = [];
  const textNorm = normalizeText(text);
  const metaPhone = normalized?.metadata?.from ? normalizePhone(String(normalized.metadata.from)) : '';

  for (const t of roster) {
    const tn = normalizePhone(t.telefono);
    if (!tn) continue;
    let m;
    TEL_REGEX.lastIndex = 0;
    while ((m = TEL_REGEX.exec(text)) !== null) {
      if (normalizePhone(m[0]) === tn || normalizePhone(m[2]) === tn) {
        return { tecnicoId: t.tecnicoId, nombre: t.nombre, telefono: t.telefono, via: 'telefono', errors };
      }
    }
    if (metaPhone && metaPhone === tn) {
      return { tecnicoId: t.tecnicoId, nombre: t.nombre, telefono: t.telefono, via: 'metadata_telefono', errors };
    }
  }

  const labelMatch = text.match(
    /(?:tec|técnico|tecnico)\s*[:\-]\s*([^·\n]+?)(?=\s+(?:limpieza|filtro|split|revisi[oó]n|instalaci[oó]n|patente|veh[ií]culo|cliente)\b|[·•]|\s*$)/i
  );
  if (labelMatch) {
    const frag = normalizeText(labelMatch[1].trim());
    for (const t of roster) {
      const n = normalizeText(t.nombre);
      if (frag.includes(n) || n.includes(frag)) {
        return { tecnicoId: t.tecnicoId, nombre: t.nombre, telefono: t.telefono, via: 'nombre_mensaje', errors };
      }
      for (const a of t.alias || []) {
        const an = normalizeText(a);
        if (an.length >= 2 && (frag.includes(an) || textNorm.includes(an))) {
          return { tecnicoId: t.tecnicoId, nombre: t.nombre, telefono: t.telefono, via: 'alias', errors };
        }
      }
    }
    for (const t of roster) {
      const n = normalizeText(t.nombre);
      const parts = n.split(' ').filter((p) => p.length > 2);
      if (parts.length && parts.every((p) => frag.includes(p))) {
        return { tecnicoId: t.tecnicoId, nombre: t.nombre, telefono: t.telefono, via: 'nombre_parcial', errors };
      }
    }
  }

  for (const t of roster) {
    const n = normalizeText(t.nombre);
    if (n.length >= 4 && textNorm.includes(n)) {
      return { tecnicoId: t.tecnicoId, nombre: t.nombre, telefono: t.telefono, via: 'nombre_libre', errors };
    }
    for (const a of t.alias || []) {
      const an = normalizeText(a);
      if (an.length >= 2 && textNorm.includes(an)) {
        return { tecnicoId: t.tecnicoId, nombre: t.nombre, telefono: t.telefono, via: 'alias_libre', errors };
      }
    }
  }

  errors.push('tecnico_no_identificado');
  return {
    tecnicoId: 'tecnico_no_identificado',
    nombre: 'Técnico no identificado',
    telefono: null,
    via: null,
    errors,
  };
}

/**
 * @param {string} text
 * @param {Array<string | { name?: string, nombre?: string, aliases?: string[] }>} clientList
 */
export function resolveClient(text, clientList = []) {
  const errors = [];
  const tn = normalizeText(text);
  const entries = clientList.map((c) => {
    if (typeof c === 'string') return { canon: c, aliases: [] };
    const canon = c.name || c.nombre || '';
    const aliases = Array.isArray(c.aliases) ? c.aliases : [];
    return { canon, aliases };
  }).filter((e) => e.canon);

  for (const { canon, aliases } of entries) {
    const lc = normalizeText(canon);
    if (lc.length >= 3 && tn.includes(lc)) {
      return { cliente: canon, canonico: canon, errors };
    }
    for (const al of aliases) {
      const an = normalizeText(al);
      if (an.length >= 2 && tn.includes(an)) {
        return { cliente: canon, canonico: canon, errors };
      }
    }
  }

  const m = text.match(/cliente\s*[:\-]\s*([^\n,]+)/i);
  if (m) {
    const frag = normalizeText(m[1].trim());
    for (const { canon, aliases } of entries) {
      const lc = normalizeText(canon);
      if (lc.includes(frag) || frag.includes(lc)) {
        return { cliente: canon, canonico: canon, errors };
      }
      const tokens = lc.split(' ').filter((x) => x.length > 1);
      if (tokens.length && tokens.every((tok) => frag.includes(tok))) {
        return { cliente: canon, canonico: canon, errors };
      }
      for (const al of aliases) {
        if (normalizeText(al) === frag) return { cliente: canon, canonico: canon, errors };
      }
    }
  }

  let best = null;
  let bestScore = 0;
  for (const { canon, aliases } of entries) {
    const tokens = normalizeText(canon)
      .split(' ')
      .filter((x) => x.length > 2);
    if (!tokens.length) continue;
    const hit = tokens.filter((tok) => tn.includes(tok)).length;
    const score = hit / tokens.length;
    if (hit >= Math.min(2, tokens.length) && score > bestScore) {
      bestScore = score;
      best = canon;
    }
    for (const al of aliases) {
      const an = normalizeText(al);
      if (an.length >= 3 && tn.includes(an)) {
        best = canon;
        bestScore = 1;
        break;
      }
    }
  }
  if (best) {
    return { cliente: best, canonico: best, errors };
  }

  errors.push('cliente_desconocido');
  return { cliente: 'desconocido', canonico: null, errors };
}

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

function otHasEvidence(ot) {
  if (!ot) return false;
  const eqs = ot.equipos || [];
  if (eqs.length) {
    return eqs.some((e) => {
      const ev = e?.evidencias || {};
      const blocks = [ev.antes, ev.durante, ev.despues, e.fotografiasAntes, e.fotografiasDurante, e.fotografiasDespues];
      return blocks.some((arr) => Array.isArray(arr) && arr.some((x) => x?.url && String(x.url).trim()));
    });
  }
  return (
    [ot.fotografiasAntes, ot.fotografiasDurante, ot.fotografiasDespues].some(
      (arr) => Array.isArray(arr) && arr.some((x) => x?.url && String(x.url).trim())
    )
  );
}

/**
 * Impacto respecto a cierre ERP (misma lógica de negocio que reglas de cierre).
 */
export function calculateOperationalImpact(waRecord, ot) {
  const tieneEvidencia =
    (waRecord?.evidencias || []).length > 0 || (ot ? otHasEvidence(ot) : false);
  const tieneCosto = ot ? roundMoney(ot.costoTotal) > 0 : false;
  const tieneIngreso = ot ? roundMoney(ot.montoCobrado) > 0 : false;
  const tienePdf = ot ? Boolean(ot.pdfUrl && String(ot.pdfUrl).trim()) : false;
  const terminadoOt = ot?.estado === 'terminado';

  let problema = null;
  if (terminadoOt && !tieneCosto) problema = 'sin_costo';
  else if (terminadoOt && tieneCosto && !tienePdf) problema = 'sin_pdf';
  else if (terminadoOt && tienePdf && !tieneIngreso) problema = 'sin_cobro';

  const puedeCerrar =
    terminadoOt && tieneCosto && tieneIngreso && tienePdf && tieneEvidencia;

  return {
    puedeCerrar,
    problema,
    tieneEvidencia,
    tieneCosto,
    tieneIngreso,
    tienePdf,
    terminadoOt,
  };
}

/**
 * @param {object} impact - salida de calculateOperationalImpact
 * @param {{ mensajeCierre?: boolean }} [ctx]
 */
export function nivelImpacto(impact, ctx = {}) {
  if (!impact) return 'atencion';
  if (impact.puedeCerrar) return 'correcto';
  if (impact.problema === 'sin_costo') return 'critico';
  if (impact.terminadoOt && !impact.tieneEvidencia) return 'critico';
  if (ctx.mensajeCierre && !impact.tieneEvidencia) return 'critico';
  return 'atencion';
}

/**
 * Mensaje: listo → terminado_tecnico; cruzado con OT para admin/cobro.
 */
export function computeEstadoOperacional(parsed, ot, evidenciasCount) {
  const msgListo =
    EMOJI_TERMINADO.test(parsed.descripcion || '') ||
    EMOJI_LISTO.test(parsed.descripcion || '') ||
    parsed.estado === 'terminado';

  if (!ot) {
    if (msgListo) return 'terminado_tecnico';
    if (evidenciasCount > 0 || (parsed.descripcion || '').trim().length > 8) return 'en_proceso';
    return 'capturado';
  }

  if (ot.estado !== 'terminado') {
    if (msgListo) return 'terminado_tecnico';
    return 'en_proceso';
  }

  const ct = roundMoney(ot.costoTotal);
  const mc = roundMoney(ot.montoCobrado);
  const pdf = Boolean(ot.pdfUrl && String(ot.pdfUrl).trim());

  if (ct <= 0) return 'pendiente_cierre_admin';
  if (ct > 0 && !pdf) return 'pendiente_cierre_admin';
  if (ct > 0 && pdf && mc <= 0) return 'pendiente_cobro';
  if (ct > 0 && mc > 0 && pdf) return 'cerrado';
  return 'pendiente_cobro';
}

function parseHoraToMinutes(h) {
  const m = String(h || '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function sameDay(fechaOt, fechaMsg) {
  return String(fechaOt || '').slice(0, 10) === String(fechaMsg || '').slice(0, 10);
}

function techMatches(otTec, resolvedNombre) {
  if (!resolvedNombre) return true;
  const a = normalizeText(otTec);
  const b = normalizeText(resolvedNombre);
  return a.includes(b) || b.includes(a) || a.slice(0, 10) === b.slice(0, 10);
}

function horaWithinRange(otHora, msgTimestamp, windowMin = 120) {
  const om = parseHoraToMinutes(otHora);
  if (om == null) return true;
  const d = new Date(msgTimestamp);
  const mm = d.getHours() * 60 + d.getMinutes();
  return Math.abs(om - mm) <= windowMin;
}

/**
 * @returns {{ ot: object|null, matches: object[], code: string|null }}
 */
export function findMatchingOtsAmbiguous(ots, parsed, normalized, tecnicoNombre) {
  if (!Array.isArray(ots)) return { ot: null, matches: [], code: null };

  const found = new Map();

  if (parsed.patente) {
    const p = parsed.patente.toUpperCase();
    for (const ot of ots) {
      if (String(ot.observaciones || '').toUpperCase().includes(p)) found.set(ot.id, ot);
      if (String(ot.subtipoServicio || '').toUpperCase().includes(p)) found.set(ot.id, ot);
    }
  }

  if (parsed.cliente && parsed.cliente !== 'desconocido') {
    const cn = normalizeText(parsed.cliente);
    for (const ot of ots) {
      if (normalizeText(ot.cliente) !== cn) continue;
      if (!sameDay(ot.fecha, parsed.fecha)) continue;
      found.set(ot.id, ot);
    }
  }

  if (tecnicoNombre) {
    for (const ot of ots) {
      if (!sameDay(ot.fecha, parsed.fecha)) continue;
      if (!techMatches(ot.tecnicoAsignado, tecnicoNombre)) continue;
      if (!horaWithinRange(ot.hora, normalized.timestamp)) continue;
      found.set(ot.id, ot);
    }
  }

  const matches = [...found.values()];
  if (matches.length > 1) {
    return { ot: null, matches, code: 'multiple_match' };
  }
  if (matches.length === 1) {
    return { ot: matches[0], matches, code: null };
  }
  return { ot: null, matches: [], code: null };
}

export function buildWhatsappOperationalSummary(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  let criticos = 0;
  let atencion = 0;
  let conIdentidad = 0;
  for (const m of list) {
    const niv =
      m.impactoNivel ||
      nivelImpacto(m.impactoOperacional, { mensajeCierre: m.parsedData?.estado === 'terminado' });
    if (niv === 'critico') criticos += 1;
    else if (niv === 'atencion') atencion += 1;
    if (m.tecnicoId && m.tecnicoId !== 'tecnico_no_identificado') conIdentidad += 1;
  }
  return {
    mensajesRegistrados: list.length,
    impactoCritico: criticos,
    impactoAtencion: atencion,
    tecnicosIdentificados: conIdentidad,
    ultimaActualizacion: new Date().toISOString(),
  };
}

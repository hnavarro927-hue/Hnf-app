/**
 * Subsistema de ingesta WhatsApp → ERP HNF (normalización, parseo, hash).
 * Sin API externa: mensajes simulados como objetos JS.
 */

import { createHash } from 'node:crypto';
import { resolveClient } from './whatsapp-operational.js';

const EMOJI_TERMINADO = /[✅✔️☑️]/u;
const EMOJI_LISTO = /\b(listo|terminad[oa]|finalizado)\b/i;

const KW_CLIMA =
  /\b(filtro|split|aire\s+acondicionado|hvac|climatizaci[oó]n|mantenci[oó]n|evaporadora|conducto|recarga|r410|instalaci[oó]n\s+clima)\b/i;
const KW_FLOTA = /\b(revisi[oó]n\s+t[eé]cnica|veh[ií]culo|flota|traslado|camioneta|cami[oó]n|rtm|padr[oó]n)\b/i;

const normalizeName = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * @param {object} raw
 */
export function normalizeWhatsAppInput(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const textParts = [r.body, r.text, r.caption].filter(Boolean).map((t) => String(t).trim());
  const texto = textParts.join('\n').trim();
  const attachments = Array.isArray(r.attachments) ? r.attachments : [];
  const archivos = attachments.map((a, i) => ({
    name: a.name || `adjunto-${i + 1}`,
    url: typeof a.url === 'string' ? a.url : '',
    mime: a.type || a.mime || '',
    kind: inferAttachmentKind(a),
  }));
  let ts = r.timestamp ?? r.ts ?? Date.now();
  if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = Number(ts);
  if (typeof ts !== 'number' || !Number.isFinite(ts)) ts = Date.now();

  const textoLimpio = texto
    .replace(/\r\n/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    texto: textoLimpio,
    textoNormalizado: normalizeName(textoLimpio),
    archivos,
    timestamp: ts,
    fechaAproximada: new Date(ts).toISOString().slice(0, 10),
    horaAproximada: new Date(ts).toISOString().slice(11, 16),
    externalId: r.id != null ? String(r.id) : r.messageId != null ? String(r.messageId) : '',
    metadata: {
      from: r.from || r.sender || null,
      chatId: r.chatId || null,
    },
  };
}

function inferAttachmentKind(a) {
  const m = String(a.type || a.mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'foto';
  if (m.startsWith('video/')) return 'video';
  if (m.includes('pdf') || m.includes('document')) return 'documento';
  if (a.lat != null || a.location) return 'ubicacion';
  return 'documento';
}

/**
 * @param {ReturnType<typeof normalizeWhatsAppInput>} normalized
 * @param {Array<string | { name?: string, nombre?: string }>} clientList
 */
export function parseWhatsAppMessage(normalized, clientList = []) {
  const text = normalized.texto || '';
  const err = [];

  const cr = resolveClient(text, clientList);
  const cliente = cr.cliente;
  err.push(...(cr.errors || []));

  const patente = extractPatente(text);
  const tipoTrabajo = extractTipoTrabajo(text);

  let tipo = 'desconocido';
  if (KW_CLIMA.test(text)) tipo = 'clima';
  if (patente || KW_FLOTA.test(text)) tipo = 'flota';
  if (KW_CLIMA.test(text) && !patente && !KW_FLOTA.test(text)) tipo = 'clima';
  if (patente && KW_FLOTA.test(text)) tipo = 'flota';

  let estado = 'en_proceso';
  if (EMOJI_TERMINADO.test(text) || EMOJI_LISTO.test(text) || /\b(aprobado|cerrado|ok\s+cliente)\b/i.test(text)) {
    estado = 'terminado';
  }

  const ubicacion = extractUbicacion(text);

  return {
    cliente: cliente || null,
    clienteCanonico: cr.canonico || cliente,
    fecha: normalized.fechaAproximada,
    hora: normalized.horaAproximada,
    ubicacion,
    patente,
    descripcion: text.slice(0, 2000),
    tipoTrabajo,
    tipo,
    estado,
    erroresParseo: err,
  };
}

function extractPatente(text) {
  const u = text.toUpperCase().replace(/\s/g, ' ');
  const m1 = u.match(/\b([A-Z]{4}\d{2})\b/);
  if (m1) return m1[1];
  const m2 = u.match(/\b([A-Z]{2}[A-Z0-9]{2}\d{2})\b/);
  if (m2) return m2[1];
  const m3 = u.match(/\b([A-Z]{2}-[A-Z]{2}-\d{2})\b/);
  if (m3) return m3[1].replace(/-/g, '');
  return null;
}

function extractTipoTrabajo(text) {
  if (/\blimpieza\b/i.test(text)) return 'limpieza';
  if (/\brevis(i[oó]n|ión)\b/i.test(text)) return 'revision';
  if (/\binstalaci[oó]n\b/i.test(text)) return 'instalacion';
  return null;
}

function extractUbicacion(text) {
  const m = text.match(/(?:dir|direcci[oó]n|ubicaci[oó]n)\s*[:\-]\s*([^\n]+)/i);
  return m ? m[1].trim().slice(0, 240) : null;
}

export function generateContentHashFromParts({ textoNormalizado, fechaAproximada, tecnicoId, tecnicoNombre }) {
  const id = String(tecnicoId || '').trim();
  const tech = id || normalizeName(tecnicoNombre || '');
  const day = String(fechaAproximada || '').slice(0, 10);
  const raw = `${textoNormalizado || ''}|${day}|${tech}`;
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

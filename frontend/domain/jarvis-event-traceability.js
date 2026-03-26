/**
 * Identidad operativa de eventos — origen, contacto, enlaces.
 */
import { getContactByEmail, getContactByPhone, normalizePhone } from './jarvis-contact-memory.js';
import { enrichChannelOperationalLayer } from './jarvis-channel-intelligence.js';
import { enrichMultiSourceLayer } from './jarvis-multi-source-intelligence.js';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function extractPhonesFromText(text) {
  const s = String(text || '');
  const out = new Set();
  const patterns = [/\+569\s*\d{8}/gi, /\+56\s*9\s*\d{8}/gi, /\b9\s*\d{4}\s*\d{4}\b/g, /\b9\d{8}\b/g];
  for (const re of patterns) {
    let m;
    const r = new RegExp(re.source, 'gi');
    while ((m = r.exec(s)) !== null) {
      const n = normalizePhone(m[0]);
      if (n.replace(/\D/g, '').length >= 11) out.add(n);
    }
  }
  return [...out];
}

export function extractEmailsFromText(text) {
  const s = String(text || '');
  const out = new Set();
  let m;
  while ((m = EMAIL_RE.exec(s)) !== null) {
    out.add(m[0].trim().toLowerCase());
  }
  return [...out];
}

/**
 * @param {string} stableKey
 * @param {string} origen
 */
export function inferSourceMeta(stableKey, origen) {
  const k = String(stableKey || '');
  const o = String(origen || '');
  let source_type = 'sistema';
  if (k.includes('ot') || o === 'OT') source_type = 'ot';
  else if (k.includes('outlook') || o === 'Correo') source_type = 'correo';
  else if (k.includes('whatsapp') || o === 'WhatsApp') source_type = 'whatsapp';
  else if (k === 'data_vacuum') source_type = 'sistema';
  else if (/Comercial|Calendario|Documentos/.test(o)) source_type = 'manual';

  const icons = { ot: '🧾', correo: '📧', whatsapp: '💬', manual: '📋', sistema: '⚙️' };
  const tipoLabel = o || source_type;
  const source_label = `${icons[source_type] || icons.sistema} ${tipoLabel}`;

  const paths = {
    ot: 'clima',
    correo: 'jarvis-intake',
    whatsapp: 'whatsapp',
    manual: 'jarvis',
    sistema: 'jarvis',
  };
  const source_url = paths[source_type] || 'jarvis';

  return {
    source_type,
    source_ref: k,
    source_label,
    source_url,
  };
}

/**
 * Enriquece evento Infinity / operativo para UI.
 * @param {object} e
 * @param {{ friction?: object, controlVivo?: object }} [opts]
 */
export function enrichOperationalEvent(e, opts = {}) {
  const text = `${e.descripcion || ''} ${e.accion || ''} ${e.headline || ''} ${e.impacto || ''}`;
  const phones = extractPhonesFromText(text);
  const emails = extractEmailsFromText(text);
  const contact_phone = phones[0] || e.contact_phone || '';
  const contact_email = emails[0] || e.contact_email || '';
  const mem = contact_phone
    ? getContactByPhone(contact_phone)
    : contact_email
      ? getContactByEmail(contact_email)
      : null;
  const src = inferSourceMeta(e.stableKey, e.origen);
  const ts = e.detectedAt ? new Date(e.detectedAt).getTime() : Date.now();
  const merged = { ...e, ...src };
  const ch = enrichChannelOperationalLayer(merged);
  const display_source_label = ch.source_label_enriched
    ? `${ch.operational_line_icon || ''} ${ch.source_label_enriched}`.trim()
    : e.source_label || src.source_label;

  const contact_name_final = mem?.name || ch.contact_name_hint || e.contact_name || '';
  const responsible_final = String(e.assignee || '').trim() || ch.responsible || '—';

  const baseForMsi = {
    ...e,
    ...src,
    ...ch,
    contact_phone,
    contact_email,
    contact_name: contact_name_final,
    contact_company: mem?.company || e.contact_company || '',
    contact_note: mem?.note || e.contact_note || '',
    display_source_label,
    responsible: responsible_final,
    source_type: src.source_type,
  };
  const msi = enrichMultiSourceLayer(e, baseForMsi, {
    friction: opts.friction,
    controlVivo: opts.controlVivo,
  });

  return {
    ...e,
    ...src,
    ...ch,
    ...msi,
    contact_phone,
    contact_email,
    contact_name: contact_name_final,
    contact_company: mem?.company || e.contact_company || '',
    contact_note: mem?.note || e.contact_note || '',
    timestamp: ts,
    responsible: responsible_final,
    display_source_label,
  };
}

export function timeAgoShort(ts) {
  const t = Number(ts) || 0;
  if (!t) return '—';
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/**
 * Texto compacto para listas (dinero/presión, qué hacer).
 */
export function formatContactIdentityLine(ext) {
  if (ext.contact_name && String(ext.contact_name).trim() && ext.contact_name !== '—') {
    const co = ext.contact_company ? ` (${ext.contact_company})` : '';
    return `${ext.contact_name}${co}`;
  }
  if (ext.contact_phone) return ext.contact_phone;
  if (ext.contact_email) return ext.contact_email;
  return '';
}

/**
 * Título de evento con tipo y problema (sin anónimo si hay identidad).
 */
export function formatTraceableHeadline(ext) {
  const prob = String(ext.descripcion || ext.headline || ext.titulo || '—').slice(0, 120);
  const typeBit = ext.display_source_label || ext.source_label || ext.origen || 'Evento';
  const id = formatContactIdentityLine(ext);
  const badge = ext.operational_badge && ext.operational_badge !== 'Evento operativo' ? ` · ${ext.operational_badge}` : '';
  const suffix = id ? ` · ${id}` : '';
  return `${typeBit} — ${prob}${badge}${suffix}`;
}

export function waMeUrl(phone) {
  const n = normalizePhone(phone).replace(/\D/g, '');
  if (n.length < 10) return '';
  return `https://wa.me/${n}`;
}

/** Enriquece una línea de texto plano (tareas SEA, listas) con identidad si hay tel/correo. */
export function formatLineWithContactIdentity(text) {
  const ext = enrichOperationalEvent({
    descripcion: String(text || ''),
    stableKey: '',
    origen: 'Sistema',
    accion: '',
    assignee: '—',
    detectedAt: new Date().toISOString(),
  });
  const id = formatContactIdentityLine(ext);
  return id ? `${String(text || '').trim()} · ${id}` : String(text || '');
}

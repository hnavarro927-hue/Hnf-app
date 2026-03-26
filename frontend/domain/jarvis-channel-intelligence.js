/**
 * Interpretación operativa por canal — event_kind, badges, responsables, terreno.
 */
import { getChannelById, listChannels, resolveChannelIdFromHint } from './jarvis-channel-memory.js';
import { appendTerrenoRow } from './jarvis-terreno-trace.js';
import { appendFlujoVivoEntry } from './jarvis-multi-source-intelligence.js';

/** @typedef {{ id: string, channel_name: string, channel_kind: string, channel_function: string, channel_client: string, aliases?: string[] }} JarvisChannelDef */

const LS_INTAKE_CH = 'HNF_JARVIS_INTAKE_CHANNEL_V1';

export function getSelectedIntakeChannelId() {
  try {
    const v = localStorage.getItem(LS_INTAKE_CH);
    return v && getChannelById(v) ? v : 'wa_reportes_clima';
  } catch {
    return 'wa_reportes_clima';
  }
}

export function setSelectedIntakeChannelId(id) {
  const ch = getChannelById(id);
  if (!ch) return;
  try {
    localStorage.setItem(LS_INTAKE_CH, ch.id);
  } catch {
    /* ignore */
  }
}

const STABLE_DEFAULT_CHANNEL = {
  whatsapp_feed_vacio: 'wa_reportes_clima',
  outlook_feed_vacio: 'mail_granleasing',
  documentos_vacio: 'doc_tecnico_hnf',
  oportunidades_vacio: 'wa_granleasing',
  ot_evidencia: null,
  calendario_vacio: null,
  calendario_alertas: null,
  data_vacuum: null,
};

export function defaultChannelIdForStableKey(stableKey) {
  const k = String(stableKey || '');
  return STABLE_DEFAULT_CHANNEL[k] ?? null;
}

export function suggestedResponsible(channelId, eventKind, prioridad) {
  const p = String(prioridad || '').toUpperCase();
  if (p === 'CRITICO') return 'Hernan';
  const ch = channelId ? getChannelById(channelId) : null;
  if (ch?.default_responsable) return String(ch.default_responsable).trim();
  const id = channelId || '';
  if (id === 'wa_reportes_clima') return 'Romina';
  if (id === 'wa_central_ops') return 'Romina · Gery';
  if (id === 'wa_granleasing' || id === 'wa_west') return 'Gery';
  if (id === 'mail_granleasing') return 'Gery';
  if (id === 'doc_tecnico_hnf') return 'Lyn';
  if (id === 'otro_canal') return 'Hernan';
  return null;
}

function detectEventKind(text, channelId) {
  const t = String(text || '').toLowerCase();
  const id = channelId || '';

  if (id === 'wa_reportes_clima') {
    if (/salida\s+(?:de\s+)?(?:la\s+)?tienda|retiro|término\s+en\s+tienda|termino\s+en\s+tienda/.test(t)) return 'salida';
    if (/ingreso\s+(?:a\s+)?(?:la\s+)?tienda|llegada\s+(?:a\s+)?tienda|entrada\s+(?:a\s+)?tienda|inicio\s+en\s+tienda/.test(t))
      return 'llegada';
  }

  if (id === 'wa_central_ops') {
    if (/aprobado|ok\s+para\s+env|enviar\s+a\s+cliente/.test(t)) return 'aprobacion';
    if (/pendiente\s+aprob|revisar\s+informe|informe\s+en\s+revisi[oó]n|revisi[oó]n/.test(t)) return 'revision';
    if (/informe\s+enviado|env[ií]o\s+de\s+informe/.test(t)) return 'seguimiento';
  }

  if (id === 'wa_granleasing' || id === 'wa_west' || id === 'mail_granleasing') {
    if (/solicitud|requerimiento|traslado|coordinaci[oó]n|seguimiento/.test(t)) return 'solicitud';
  }

  if (/incidencia|urgencia|problema\s+grave/.test(t)) return 'incidencia';
  return 'otro';
}

function operationalBadge(eventKind, channelId, text = '') {
  const ek = eventKind || 'otro';
  const t = String(text || '').toLowerCase();
  if (ek === 'llegada') return 'Llegada tienda';
  if (ek === 'salida') return 'Salida tienda';
  if (ek === 'solicitud') return 'Solicitud cliente';
  if (ek === 'revision') return 'Informe en revisión';
  if (ek === 'aprobacion') {
    if (channelId === 'wa_central_ops' && /aprobado|ok\s+para/.test(t)) return 'Aprobado para envío';
    return 'Aprobación pendiente';
  }
  if (ek === 'seguimiento') return 'Seguimiento interno';
  return 'Evento operativo';
}

function lineIconFor(channelKind, eventKind, sourceType) {
  if (eventKind === 'llegada' || eventKind === 'salida') return '🕒';
  if (eventKind === 'aprobacion' || eventKind === 'revision') return '✅';
  if (sourceType === 'correo') return '📧';
  if (sourceType === 'whatsapp') {
    if (channelKind === 'cliente') return '💬';
    return '💬';
  }
  if (sourceType === 'ot') return '🧾';
  return '⚙️';
}

function parseTerrenoFromText(text, canalLabel) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  let tipo_marca = null;
  if (/ingreso\s+(?:a\s+)?(?:la\s+)?tienda|entrada\s+(?:a\s+)?(?:la\s+)?tienda|llegada\s+(?:a\s+)?(?:la\s+)?tienda|inicio\s+en\s+tienda/i.test(raw))
    tipo_marca = 'ingreso';
  else if (/salida\s+(?:de\s+)?(?:la\s+)?tienda|salida\s+tienda|retiro|término\s+en\s+tienda|termino\s+en\s+tienda/i.test(raw))
    tipo_marca = 'salida';
  if (!tipo_marca) return null;

  let tecnico = '';
  const mNom = raw.match(
    /^([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+)?)\s+(?=ingreso|entrada|llegada|salida|retiro|inicio|término|termino)/i
  );
  if (mNom) tecnico = mNom[1].trim();

  let tienda = '';
  const mTienda = raw.match(/tienda\s+(.+?)(?:\.|,|$|\s+—)/i);
  if (mTienda) tienda = mTienda[1].trim();
  if (!tienda) {
    const mAlt = raw.match(/(?:en|en la)\s+((?:Puma|Jumbo|L[ií]der|Parque|Granleasing|West|Walmart|Tottus|Sodimac)[^.,\n]{0,60})/i);
    if (mAlt) tienda = mAlt[1].trim();
  }

  const brands = /(Puma|Jumbo|L[ií]der|Parque Arauco|Granleasing|West|Walmart|Tottus|Sodimac)/i;
  const cm = raw.match(brands);
  const channel_client = cm ? cm[1] : tienda.split(/\s+/)[0] || '';

  return {
    tecnico: tecnico || '—',
    tienda: tienda || channel_client || '—',
    tipo_marca,
    hora_detectada: Date.now(),
    canal: canalLabel || 'WhatsApp Reportes Clima',
    channel_client: channel_client || '',
  };
}

/**
 * Interpreta texto y opcionalmente persiste marca terreno (solo canal Reportes Clima).
 * @param {object} opts
 * @param {boolean} [opts.persistTerreno]
 * @param {boolean} [opts.appendFlujo]
 */
export function interpretTextForChannel(text, channelId, opts = {}) {
  const ch = channelId ? getChannelById(channelId) : null;
  const full = String(text || '');
  const event_kind = detectEventKind(full, channelId);
  const operational_badge = operationalBadge(event_kind, channelId, full);
  let contact_name = '';
  let channel_client = ch?.channel_client || '';
  let source_label_line = '';
  let terParsed = null;

  if (ch?.id === 'wa_reportes_clima') {
    terParsed = parseTerrenoFromText(full, ch.channel_name);
    if (terParsed) {
      contact_name = terParsed.tecnico !== '—' ? terParsed.tecnico : contact_name;
      if (terParsed.channel_client) channel_client = terParsed.channel_client;
      source_label_line = `${terParsed.tipo_marca === 'salida' ? 'Salida' : 'Ingreso'} tienda ${terParsed.tienda}`;
      if (opts.persistTerreno) {
        appendTerrenoRow({
          tecnico: terParsed.tecnico,
          tienda: terParsed.tienda,
          tipo_marca: terParsed.tipo_marca,
          hora_detectada: terParsed.hora_detectada,
          canal: terParsed.canal,
        });
      }
    }
  }

  if (ch?.id === 'wa_central_ops') {
    if (/informe|aprob|revis|env[ií]o/.test(full.toLowerCase())) {
      source_label_line = source_label_line || 'Flujo revisión / aprobación interna';
    }
  }

  if ((ch?.id === 'wa_granleasing' || ch?.id === 'wa_west') && /solicitud|traslado|coordinaci[oó]n/.test(full.toLowerCase())) {
    source_label_line = source_label_line || `Solicitud / coordinación · ${ch.channel_client}`;
  }

  if (ch?.id === 'mail_granleasing') {
    source_label_line = source_label_line || 'Canal formal Granleasing';
  }

  const hint = resolveChannelIdFromHint(full);
  const resolvedChannelId = ch?.id || hint || channelId || null;

  return {
    channel_id: resolvedChannelId || '',
    channel_name: ch?.channel_name || (resolvedChannelId ? getChannelById(resolvedChannelId)?.channel_name : '') || '',
    channel_kind: ch?.channel_kind || (resolvedChannelId ? getChannelById(resolvedChannelId)?.channel_kind : '') || 'interno',
    channel_function: ch?.channel_function || (resolvedChannelId ? getChannelById(resolvedChannelId)?.channel_function : '') || '',
    channel_client: channel_client || (resolvedChannelId ? getChannelById(resolvedChannelId)?.channel_client : '') || '',
    event_kind,
    operational_badge,
    contact_name_suggested: contact_name,
    source_label_line,
    line_icon: lineIconFor(ch?.channel_kind, event_kind, ''),
  };
}

/**
 * Enriquece un evento ya parcialmente construido (Infinity / brain).
 * @param {object} e
 */
export function enrichChannelOperationalLayer(e) {
  const text = `${e.descripcion || ''} ${e.accion || ''} ${e.headline || ''} ${e.impacto || ''}`;
  let channelId = e.channel_id || defaultChannelIdForStableKey(e.stableKey);
  const fromText = resolveChannelIdFromHint(text);
  if (fromText) channelId = fromText;

  const ch = channelId ? getChannelById(channelId) : null;
  const inter = interpretTextForChannel(text, channelId, { persistTerreno: false, appendFlujo: false });

  const source_type = e.source_type || (String(e.origen || '').toLowerCase().includes('correo') ? 'correo' : String(e.stableKey || '').includes('whatsapp') ? 'whatsapp' : 'sistema');

  const line_icon = lineIconFor(inter.channel_kind || ch?.channel_kind, inter.event_kind, source_type);

  let responsible = e.assignee || e.responsible || '—';
  const sug = suggestedResponsible(channelId || inter.channel_id, inter.event_kind, e.prioridad);
  if (sug && (!String(e.assignee || '').trim() || e.sinResponsable)) {
    responsible = sug.includes('·') ? sug.split('·')[0].trim() : sug;
  }

  return {
    channel_id: channelId || inter.channel_id || '',
    channel_name: ch?.channel_name || inter.channel_name || '',
    channel_kind: ch?.channel_kind || inter.channel_kind || '',
    channel_function: ch?.channel_function || inter.channel_function || '',
    channel_client: inter.channel_client || ch?.channel_client || '',
    event_kind: inter.event_kind,
    operational_badge: inter.operational_badge,
    operational_line_icon: line_icon,
    source_label_enriched: inter.source_label_line || '',
    contact_name_hint: inter.contact_name_suggested || e.contact_name || '',
    responsible_suggested: sug || '',
    responsible,
  };
}

export function vacuumCopyForStableKey(stableKey) {
  const k = String(stableKey || '');
  if (k === 'whatsapp_feed_vacio') {
    return {
      headline:
        'No hay registros recientes en WhatsApp Reportes Clima, Central Operaciones, Granleasing ni West Rent a Car',
      channel_id: 'wa_reportes_clima',
      impacto: 'Impacto: control de terreno, clientes y revisión interna sin visibilidad en feed.',
      accion: 'Acción: sincronizar feed o pegar conversación en ingesta (selector de canal en Núcleo).',
    };
  }
  if (k === 'outlook_feed_vacio') {
    return {
      headline: 'No se detectan correos formales recientes de Granleasing en la bandeja cargada',
      channel_id: 'mail_granleasing',
      impacto: 'Impacto: respaldo formal y solicitudes cliente no visibles.',
      accion: 'Acción: cargar correos o activar intake Outlook (canal Correos Granleasing).',
    };
  }
  if (k === 'documentos_vacio') {
    return {
      headline: 'No hay documentos técnicos visibles para aprobación / trazabilidad (Lyn)',
      channel_id: 'doc_tecnico_hnf',
      impacto: 'Impacto: aprobación documental y respaldo formal detenidos.',
      accion: 'Acción: subir informes PDF en documentos técnicos o escalar a Lyn.',
    };
  }
  return null;
}

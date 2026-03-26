/**
 * Multi-source intelligence — interpretación estructurada, flujo vivo, memoria operativa.
 */
import { getChannelById } from './jarvis-channel-memory.js';

const LS_FLUJO = 'JARVIS_FLUJO_VIVO_V1';
const LS_MEM = 'JARVIS_MEMORIA_OPERATIVA_V1';
const MAX_FLUJO = 48;
const MAX_MEM = 10;

const readJson = (key, fallback) => {
  try {
    const r = localStorage.getItem(key);
    const j = r ? JSON.parse(r) : null;
    return Array.isArray(j) ? j : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, arr) => {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
};

/**
 * Parsea frases tipo: "Bernabé ingreso tienda Puma Parque Arauco 09:10"
 */
export function parseStructuredUtterance(raw) {
  let text = String(raw || '').trim();
  const faltantes = [];

  let horaTexto = '';
  const tm = text.match(/\b(\d{1,2}:\d{2})\s*$/);
  if (tm) {
    horaTexto = tm[1];
    text = text.slice(0, tm.index).trim();
  } else if (/ingreso|salida|tienda|llegada|entrada/i.test(text)) {
    faltantes.push('hora');
  }

  let tipo_evento = null;
  if (/ingreso\s+(?:a\s+)?tienda|llegada\s+(?:a\s+)?tienda|entrada\s+(?:a\s+)?tienda|ingresa\s+(?:a\s+)?tienda/i.test(text))
    tipo_evento = 'ingreso tienda';
  else if (/salida\s+(?:de\s+)?(?:la\s+)?tienda|salida\s+tienda|sale\s+(?:de\s+)?tienda|retiro/i.test(text))
    tipo_evento = 'salida tienda';
  else if (/evidencia|fotos?|imagen|pdf\s+informe/i.test(text)) tipo_evento = 'evidencia';
  else if (/solicitud|cliente\s+solicita|requerimiento/i.test(text)) tipo_evento = 'solicitud cliente';
  else if (/aprob|aprobación|aprobado|ok\s+para\s+env/i.test(text)) tipo_evento = 'aprobación';

  if (!tipo_evento) {
    if (/tienda|ot-|ot\s/i.test(text)) faltantes.push('tipo_evento');
    tipo_evento = '—';
  }

  let tecnico = '';
  const mNom = text.match(
    /^([A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+)?)\s+(?=ingreso|ingresa|salida|sale|llegada|entrada|evidencia|solicitud|aprob)/i
  );
  if (mNom) tecnico = mNom[1].trim();
  if (!tecnico && /ingreso|salida|tienda/i.test(raw) && tipo_evento !== '—') faltantes.push('técnico');

  let cliente = '';
  let ubicacion = '';
  const mTienda = text.match(/tienda\s+(.+)$/i);
  if (mTienda) {
    const tail = mTienda[1].trim().replace(/\s+\d{1,2}:\d{2}$/, '').trim();
    const parts = tail.split(/\s+/).filter(Boolean);
    cliente = parts[0] || '';
    ubicacion = parts.slice(1).join(' ') || '';
  }

  if (/tienda/i.test(text) && !cliente) faltantes.push('cliente/tienda');

  const alerta =
    faltantes.length > 0 && /ingreso|salida|llegada|entrada|tienda/i.test(String(raw || ''));

  let horaMs = null;
  if (horaTexto) {
    const [hh, mm] = horaTexto.split(':').map((x) => parseInt(x, 10));
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      const d = new Date();
      d.setHours(hh, mm, 0, 0);
      horaMs = d.getTime();
    }
  }

  return {
    tipo_evento,
    tecnico: tecnico || '—',
    cliente: cliente || '—',
    ubicacion: ubicacion || '—',
    horaTexto: horaTexto || '—',
    horaMs,
    faltantes,
    alerta,
  };
}

export function computeMoneyImpact(evento, { controlVivo, friction } = {}) {
  const cr = friction?.capaRealidad || {};
  const det = Math.round(Number(controlVivo?.dineroRiesgo) || Number(cr.ingresoBloqueado) || 0);
  let riesgo = 'Control operativo';
  const sk = String(evento?.stableKey || '');
  if (sk === 'ot_evidencia') riesgo = 'Falta evidencia — riesgo de cobro';
  if (sk === 'data_vacuum') riesgo = 'Datos incompletos — decisión ciega';
  let oportunidad = 'Mantener pipeline';
  if (sk.includes('oportunidad')) oportunidad = 'Abrir / actualizar oportunidad';
  if (sk.includes('whatsapp') || sk.includes('outlook')) oportunidad = 'Convertir señal en OT o seguimiento';
  return {
    money_detenido: det,
    money_riesgo_label: riesgo,
    money_oportunidad_label: oportunidad,
  };
}

function displayOrigenNombre(ch, origenField) {
  if (ch?.origen_alias?.trim()) return ch.origen_alias.trim();
  const n = String(ch?.channel_name || origenField || 'Sistema');
  return n
    .replace(/^WhatsApp\s+/i, '')
    .replace(/^Correos?\s+/i, '')
    .trim() || 'Sistema';
}

/**
 * @param {object} evento — evento crudo Infinity
 * @param {object} enriched — salida parcial de enrichOperationalEvent (sin MSI aún)
 * @param {object} moneyCtx
 */
export function enrichMultiSourceLayer(evento, enriched, moneyCtx = {}) {
  const st = enriched.source_type || 'sistema';
  const origen_tipo = st === 'whatsapp' ? 'whatsapp' : st === 'correo' ? 'correo' : 'sistema';
  const ch = enriched.channel_id ? getChannelById(enriched.channel_id) : null;

  const origen_nombre = displayOrigenNombre(ch, evento.origen);
  const origen_contacto = enriched.contact_phone || enriched.contact_email || '—';
  const origen_alias = ch?.origen_alias?.trim() || origen_nombre;

  const text = `${evento.descripcion || ''} ${evento.accion || ''} ${evento.headline || ''}`;
  const interpretacion_struct = parseStructuredUtterance(text);

  let ejecucion_rol = 'operaciones';
  const te = interpretacion_struct.tipo_evento || '';
  if (te.includes('tienda') || te === 'evidencia') ejecucion_rol = 'técnico';
  if (te === 'solicitud cliente') ejecucion_rol = 'comercial';
  if (te === 'aprobación') ejecucion_rol = 'operaciones';

  const responsable = String(enriched.responsible || evento.assignee || '').trim();
  let estado_tarjeta = 'OK';
  if (!responsable || responsable === '—') estado_tarjeta = 'CRITICO';
  else if (interpretacion_struct.alerta) estado_tarjeta = 'ALERTA';

  const money = computeMoneyImpact(evento, moneyCtx);

  return {
    origen_tipo,
    origen_nombre,
    origen_contacto,
    origen_alias,
    interpretacion_struct,
    ejecucion_rol,
    estado_tarjeta,
    ...money,
  };
}

export function appendFlujoVivoEntry(entry) {
  const row = {
    id: `fv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    at: entry.at || new Date().toISOString(),
    canal_label: String(entry.canal_label || '—'),
    origen_tipo: entry.origen_tipo || 'sistema',
    linea: String(entry.linea || '').slice(0, 280),
  };
  const prev = readJson(LS_FLUJO, []);
  writeJson(LS_FLUJO, [row, ...prev].slice(0, MAX_FLUJO));
  try {
    window.dispatchEvent(new CustomEvent('hnf-jarvis-flujo-vivo-updated'));
  } catch {
    /* ignore */
  }
  return row;
}

export function listFlujoVivoEntries(limit = 24) {
  return readJson(LS_FLUJO, []).slice(0, limit);
}

/** Agrupa por canal_label conservando orden temporal global */
export function groupFlujoVivoForTimeline(limit = 24) {
  const all = listFlujoVivoEntries(limit);
  const map = new Map();
  for (const e of all) {
    const k = e.canal_label || '—';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return [...map.entries()].map(([canal_label, items]) => ({
    canal_label,
    items: items.sort((a, b) => String(b.at).localeCompare(String(a.at))),
  }));
}

export function appendMemoriaOperativa({ origen, accion_tomada, resultado }) {
  const row = {
    id: `mo_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    origen: String(origen || '—').slice(0, 120),
    accion_tomada: String(accion_tomada || '—').slice(0, 160),
    resultado: String(resultado || 'registrado').slice(0, 160),
  };
  const prev = readJson(LS_MEM, []);
  writeJson(LS_MEM, [row, ...prev].slice(0, MAX_MEM));
  return row;
}

export function listMemoriaOperativa() {
  return readJson(LS_MEM, []);
}

export function iconForOrigenTipo(origen_tipo) {
  if (origen_tipo === 'whatsapp') return { emoji: '🟢', label: 'WhatsApp' };
  if (origen_tipo === 'correo') return { emoji: '🔵', label: 'Correo' };
  return { emoji: '🟣', label: 'Sistema' };
}

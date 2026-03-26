/**
 * Ingresos operativos del día (Romina / Gery) — persistencia local hasta integrar API.
 */

const LS_KEY = 'hnf_ingreso_operativo_v1';
const MAX = 200;

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameLocalDay(iso, ymd) {
  if (!iso) return false;
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}` === ymd;
  } catch {
    return false;
  }
}

export const INGRESO_ESTADOS = ['pendiente', 'en_proceso', 'completo'];
export const INGRESO_TIPOS = ['clima', 'flota'];
export const INGRESO_ORIGENES = ['whatsapp', 'manual'];
/** manual | whatsapp_ingesta */
export const INGRESO_SOURCE_KINDS = ['manual', 'whatsapp_ingesta'];

export function loadIngresosOperativosRaw() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function saveAll(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX)));
}

/**
 * @returns {object[]}
 */
export function listIngresosOperativosDelDia() {
  const ymd = todayYmd();
  return loadIngresosOperativosRaw()
    .filter((r) => isSameLocalDay(r.createdAt, ymd))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/**
 * @param {object} row
 */
function normalizeIngresoItem(base) {
  return {
    ...base,
    cliente: String(base.cliente || '').trim(),
    direccion: String(base.direccion || '').trim(),
    comuna: String(base.comuna || '').trim(),
    contacto: String(base.contacto || '').trim(),
    telefono: String(base.telefono || '').trim(),
    tipo: INGRESO_TIPOS.includes(base.tipo) ? base.tipo : 'clima',
    origen: INGRESO_ORIGENES.includes(base.origen) ? base.origen : 'manual',
    estado: INGRESO_ESTADOS.includes(base.estado) ? base.estado : 'pendiente',
    sourceKind: INGRESO_SOURCE_KINDS.includes(base.sourceKind) ? base.sourceKind : 'manual',
  };
}

export function appendIngresoOperativo(row) {
  const id = `ing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();
  const item = normalizeIngresoItem({
    id,
    createdAt,
    cliente: row.cliente,
    direccion: row.direccion,
    comuna: row.comuna,
    contacto: row.contacto,
    telefono: row.telefono,
    tipo: row.tipo,
    origen: row.origen,
    estado: row.estado,
    sourceKind: 'manual',
    whatsappMessageId: null,
    casoTipo: row.casoTipo || null,
    textoInterpretado: row.textoInterpretado || null,
    accionSugerida: row.accionSugerida || null,
    urgencia: row.urgencia || null,
    otIdRelacionado: row.otIdRelacionado || null,
    validadoPorUsuario: Boolean(row.validadoPorUsuario),
  });
  const prev = loadIngresosOperativosRaw();
  saveAll([item, ...prev]);
  return item;
}

/**
 * Sincroniza mensajes del feed como filas de ingesta (idempotente por mensaje).
 * @param {object[]} messages
 * @param {{ classify: (m: object) => object, mapEstado: (s: string) => string }} [helpers]
 */
export function syncWhatsappFeedToIngresosOperativos(messages, helpers) {
  const classify = helpers?.classify;
  const mapEstado = helpers?.mapEstado;
  if (typeof classify !== 'function' || typeof mapEstado !== 'function') return { added: 0, updated: 0 };

  const list = Array.isArray(messages) ? messages : [];
  let added = 0;
  let updated = 0;
  const prev = loadIngresosOperativosRaw();

  for (const msg of list) {
    const waId = String(msg?.id || '').trim();
    if (!waId) continue;
    const cls = classify(msg);
    const id = `fwa-${waId}`;
    const createdAt = msg.createdAt || new Date().toISOString();
    const estado = mapEstado(msg.estado);
    const nextBase = normalizeIngresoItem({
      id,
      createdAt,
      updatedAt: msg.updatedAt || createdAt,
      cliente: cls.clienteDetectado || msg.cliente || '—',
      direccion: String(msg.ubicacion || '').trim(),
      comuna: '',
      contacto: String(msg.tecnico || '').trim(),
      telefono: '',
      tipo: msg.tipo === 'flota' ? 'flota' : 'clima',
      origen: 'whatsapp',
      estado,
      sourceKind: 'whatsapp_ingesta',
      whatsappMessageId: waId,
      casoTipo: cls.casoTipo,
      textoInterpretado: cls.textoInterpretado,
      accionSugerida: cls.accionSugerida,
      urgencia: cls.urgencia,
      otIdRelacionado: msg.otIdRelacionado || null,
      jarvisClasificadoEn: new Date().toISOString(),
      validadoPorUsuario: false,
    });

    const idx = prev.findIndex((x) => x.id === id || x.whatsappMessageId === waId);
    if (idx === -1) {
      prev.unshift(nextBase);
      added += 1;
      continue;
    }
    const ex = prev[idx];
    const msgT = new Date(msg.updatedAt || msg.createdAt || 0).getTime();
    const exT = new Date(ex.updatedAt || ex.createdAt || 0).getTime();
    if (msgT < exT && ex.whatsappMessageId === waId) continue;

    if (ex.validadoPorUsuario) {
      prev[idx] = {
        ...ex,
        textoInterpretado: cls.textoInterpretado,
        casoTipo: cls.casoTipo,
        urgencia: cls.urgencia,
        accionSugerida: cls.accionSugerida,
        estado,
        otIdRelacionado: msg.otIdRelacionado ?? ex.otIdRelacionado,
        updatedAt: msg.updatedAt || ex.updatedAt,
        jarvisClasificadoEn: new Date().toISOString(),
      };
    } else {
      prev[idx] = { ...nextBase, id: ex.id };
    }
    updated += 1;
  }

  saveAll(prev);
  return { added, updated };
}

export function patchIngresoOperativo(id, partial) {
  const prev = loadIngresosOperativosRaw();
  const idx = prev.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const cur = prev[idx];
  const p = partial || {};
  const next = {
    ...cur,
    ...('cliente' in p ? { cliente: String(p.cliente || '').trim() } : {}),
    ...('direccion' in p ? { direccion: String(p.direccion || '').trim() } : {}),
    ...('comuna' in p ? { comuna: String(p.comuna || '').trim() } : {}),
    ...('contacto' in p ? { contacto: String(p.contacto || '').trim() } : {}),
    ...('telefono' in p ? { telefono: String(p.telefono || '').trim() } : {}),
    ...('estado' in p && INGRESO_ESTADOS.includes(p.estado) ? { estado: p.estado } : {}),
    ...('validadoPorUsuario' in p ? { validadoPorUsuario: Boolean(p.validadoPorUsuario) } : {}),
    updatedAt: new Date().toISOString(),
  };
  const copy = [...prev];
  copy[idx] = normalizeIngresoItem(next);
  saveAll(copy);
  return copy[idx];
}

export function setIngresoOperativoEstado(id, estado) {
  if (!INGRESO_ESTADOS.includes(estado)) return null;
  const prev = loadIngresosOperativosRaw();
  const idx = prev.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const next = { ...prev[idx], estado, updatedAt: new Date().toISOString() };
  const copy = [...prev];
  copy[idx] = normalizeIngresoItem(next);
  saveAll(copy);
  return copy[idx];
}

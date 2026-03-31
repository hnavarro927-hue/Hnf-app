/**
 * JarvisDocumentRouter — clasificación y enrutado de ingesta documental (texto + metadatos de archivo).
 * Compartido con el backend (`jarvisStarkDocuments.service`): misma lógica tras subida multipart.
 * En UI, `fileStub` puede venir solo de metadatos locales antes de enviar el archivo.
 */

/** @typedef {'whatsapp'|'correo'|'orden_compra'|'cotizacion'|'factura'|'guia_despacho'|'informe_tecnico'|'evidencia'|'otro'} JarvisDocumentEntryType */

/** @typedef {'ot'|'compras'|'finanzas'|'documentos_cliente'|'evidencia'|'bandeja_revision'} JarvisDocumentDestination */

/** @typedef {{ name?: string|null, mimeType?: string|null, size?: number|null }} JarvisFileStub */

/** @typedef {{ entryType: JarvisDocumentEntryType, confidence: 'alta'|'media'|'baja', client: string|null, ocNumber: string|null, otNumber: string|null, amount: number|null, dateIso: string|null, area: 'clima'|'flota'|'indefinido', destination: JarvisDocumentDestination, revision_jarvis_pendiente: boolean, rationale: string }} JarvisRouteResult */

export const JARVIS_DOCUMENT_ENTRY_TYPES = [
  'whatsapp',
  'correo',
  'orden_compra',
  'cotizacion',
  'factura',
  'guia_despacho',
  'informe_tecnico',
  'evidencia',
  'otro',
];

const norm = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

/**
 * @param {File|null|undefined} file
 * @returns {JarvisFileStub}
 */
export function buildFileDescriptorStub(file) {
  if (!file || typeof file !== 'object') {
    return { name: null, mimeType: null, size: null };
  }
  return {
    name: file.name || null,
    mimeType: file.type || null,
    size: typeof file.size === 'number' ? file.size : null,
  };
}

function extractCliente(text) {
  const t = String(text ?? '');
  const lineas = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const linea of lineas) {
    const m =
      linea.match(/^\s*cliente\s*[:\-]\s*(.+)$/i) ||
      linea.match(/^\s*empresa\s*[:\-]\s*(.+)$/i) ||
      linea.match(/^\s*raz[oó]n\s*social\s*[:\-]\s*(.+)$/i);
    if (m?.[1]) {
      const v = String(m[1]).trim().slice(0, 200);
      if (v.length >= 2) return v;
    }
  }
  return null;
}

function extractOcNumber(text) {
  const t = String(text ?? '');
  const m =
    t.match(/\bOC[\s\-]*([A-Z0-9]{4,20})\b/i) ||
    t.match(/\borden\s+de\s+compra\s*(?:N°|#|:)?\s*([A-Z0-9\-]{4,24})/i) ||
    t.match(/\bO\.?\s*C\.?\s*(?:N°|#)?\s*([A-Z0-9\-]{4,24})/i);
  return m?.[1] ? String(m[1]).trim().slice(0, 40) : null;
}

function extractOtNumber(text) {
  const t = String(text ?? '');
  const m = t.match(/\bOT[\s\-]*([A-Z0-9]{2,24})\b/i) || t.match(/\bOT[-\s]?(\d{3,10})\b/i);
  return m?.[1] ? String(m[1]).trim().slice(0, 40) : null;
}

function extractMonto(text) {
  const t = String(text ?? '');
  const m = t.match(/\$\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/) || t.match(/([\d]{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*clp/i);
  if (!m?.[1]) return null;
  const raw = String(m[1]).replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function extractFechaIso(text) {
  const t = String(text ?? '');
  const m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/) || t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!m) return null;
  if (m[0].includes('-')) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function detectArea(text) {
  const n = norm(text);
  const clima = /\b(aire|clima|hvac|split|refriger|calefac|mantenc|mantenim)\b/.test(n);
  const flota = /\b(vehicul|flota|traslado|camion|patente|conductor|ruta|flete)\b/.test(n);
  if (clima && !flota) return 'clima';
  if (flota && !clima) return 'flota';
  return 'indefinido';
}

/**
 * @param {{
 *   text: string,
 *   declaredSource?: string|null,
 *   fileStub?: JarvisFileStub|null,
 *   forcedEntryType?: JarvisDocumentEntryType|null,
 * }} input
 * @returns {JarvisRouteResult}
 */
export function routeDocument(input) {
  const text = String(input?.text ?? '').trim();
  const declared = norm(input?.declaredSource);
  const fileStub = input?.fileStub || null;
  const fname = norm(fileStub?.name || '');
  const mime = norm(fileStub?.mimeType || '');
  const combined = `${text} ${fname} ${mime}`;

  let entryType = /** @type {JarvisDocumentEntryType} */ ('otro');
  let confidence = /** @type {'alta'|'media'|'baja'} */ ('baja');

  if (input?.forcedEntryType && JARVIS_DOCUMENT_ENTRY_TYPES.includes(input.forcedEntryType)) {
    entryType = input.forcedEntryType;
    confidence = 'alta';
  } else if (declared === 'whatsapp' || /\bwhatsapp\b/.test(norm(text))) {
    entryType = 'whatsapp';
    confidence = declared === 'whatsapp' ? 'alta' : 'media';
  } else if (declared === 'correo' || declared === 'email' || /\b(correo|email|outlook)\b/.test(norm(text))) {
    entryType = 'correo';
    confidence = 'alta';
  } else if (
    /\borden\s+de\s+compra\b/.test(norm(text)) ||
    /\boc[\s\-]*[0-9]/i.test(text) ||
    /oc|orden_compra/.test(fname)
  ) {
    entryType = 'orden_compra';
    confidence = 'media';
  } else if (/\bcotiz/.test(norm(text)) || /cotiz/.test(fname)) {
    entryType = 'cotizacion';
    confidence = 'media';
  } else if (/\bfactura\b/.test(norm(text)) || /\.pdf$/i.test(fname) && /\bfact/.test(fname)) {
    entryType = 'factura';
    confidence = fname ? 'media' : 'baja';
  } else if (/\bguia\s+de\s*despacho\b/.test(norm(text)) || /\bguia\b.*\bdespacho\b/.test(norm(text))) {
    entryType = 'guia_despacho';
    confidence = 'media';
  } else if (/\binforme\s+tecnico\b/.test(norm(text)) || /\binforme\b/.test(norm(text))) {
    entryType = 'informe_tecnico';
    confidence = 'baja';
  } else if (
    /\bevidencia\b/.test(norm(text)) ||
    /\b(foto|imagen|antes|despues|durante)\b/.test(norm(text)) ||
    /^image\//.test(String(fileStub?.mimeType || ''))
  ) {
    entryType = 'evidencia';
    confidence = /^image\//.test(String(fileStub?.mimeType || '')) ? 'alta' : 'media';
  }

  const client = extractCliente(text);
  const ocNumber = extractOcNumber(text);
  const otNumber = extractOtNumber(text);
  const amount = extractMonto(text);
  const dateIso = extractFechaIso(text);
  const area = detectArea(combined);

  /** @type {JarvisDocumentDestination} */
  let destination = 'bandeja_revision';
  let revision_jarvis_pendiente = true;
  let rationale = 'Clasificación por defecto: revisión humana.';

  if (entryType === 'orden_compra' || entryType === 'cotizacion') {
    destination = 'compras';
    revision_jarvis_pendiente = confidence === 'baja' || !ocNumber;
    rationale = 'Documento de compra / cotización → módulo compras.';
  } else if (entryType === 'factura') {
    destination = 'finanzas';
    revision_jarvis_pendiente = confidence !== 'alta';
    rationale = 'Factura → finanzas.';
  } else if (entryType === 'guia_despacho') {
    destination = 'documentos_cliente';
    revision_jarvis_pendiente = false;
    rationale = 'Guía de despacho → documentación cliente / logística.';
  } else if (entryType === 'informe_tecnico') {
    destination = 'documentos_cliente';
    revision_jarvis_pendiente = confidence === 'baja';
    rationale = 'Informe técnico → documentos de cliente / expediente.';
  } else if (entryType === 'evidencia') {
    destination = 'evidencia';
    revision_jarvis_pendiente = !otNumber && !client;
    rationale = 'Evidencia → cola de evidencia OT (vincular manualmente si falta OT).';
  } else if (entryType === 'whatsapp' || entryType === 'correo') {
    destination = 'ot';
    revision_jarvis_pendiente = area === 'indefinido' || !client;
    rationale = 'Canal operativo → crear o vincular OT.';
  } else if (entryType === 'otro' && otNumber) {
    destination = 'ot';
    revision_jarvis_pendiente = false;
    rationale = 'Referencia OT explícita → módulo OT.';
  } else if (entryType === 'otro' && ocNumber) {
    destination = 'compras';
    revision_jarvis_pendiente = false;
    rationale = 'Referencia OC explícita → compras.';
  }

  if (!text && !fname) {
    revision_jarvis_pendiente = true;
    destination = 'bandeja_revision';
    rationale = 'sin dato: añadir texto o archivo para clasificar.';
  }

  if (confidence === 'baja' && entryType !== 'evidencia') {
    revision_jarvis_pendiente = true;
  }

  return {
    entryType,
    confidence,
    client,
    ocNumber,
    otNumber,
    amount,
    dateIso,
    area,
    destination,
    revision_jarvis_pendiente,
    rationale,
  };
}

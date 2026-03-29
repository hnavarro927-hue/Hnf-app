/**
 * Clasificación asistida de documentos (heurística local, sin IA externa).
 * Extrae señales de nombre de archivo y texto legible del buffer.
 */

export const JARVIS_DOC_ENGINE_VERSION = '1.1.0';

/** RUT Chile: 12.345.678-9 o 12345678-9 */
const RUT_RE = /\b(\d{1,2}\.\d{3}\.\d{3}-[\dkK]|\d{7,9}-[\dkK])\b/gi;
const EMAIL_RE = /\b[A-Za-z0-9][A-Za-z0-9._%+-]{0,64}@[A-Za-z0-9][A-Za-z0-9.-]{1,}\.[A-Za-z]{2,}\b/g;
const PHONE_RE =
  /\b(?:\+?56[\s.-]*)?(?:9[\s.-]?\d{4}[\s.-]?\d{4}|2[\s.-]?\d{4}[\s.-]?\d{4}|[4-9]\d{8})\b/g;
const OT_RE = /\bOT[-_]?\d{3,}\b/gi;
const FACTURA_RE = /\b(?:factura|folio|n[°º]|nro\.?|comprobante)\s*[:#]?\s*([A-Za-z0-9\-]{4,})\b/gi;
/** Patentes Chile: antiguas XX1234, nuevas BBBB22, BBBB12, etc. */
const PATENTE_RE =
  /\b(?:[BCDFGHJKLPRSTVWXYZ]{2}\d{4}|[BCDFGHJKLPRSTVWXYZ]{4}\d{2}|[BCDFGHJKLPRSTVWXYZ]{3}\d{3})\b/gi;

const RX_NOMBRE_CLIENTE = new RegExp(
  '(?:raz[oó]n social|r\\.?\\s*s\\.?|cliente|empresa|mandante|proveedor)\\s*[:#\\-]?\\s*([^\\n\\r]{3,120})',
  'gi'
);
const RX_NOMBRE_CONTACTO = /(?:contacto|atenci[oó]n|se[nñ]or(?:ita)?|sr\\.?|sra\\.?)\s*[:#\-]?\s*([^\n\r]{3,80})/gi;

export function extractTextSnippetsFromBuffer(buffer, maxLen = 120000) {
  if (!buffer || !buffer.length) return '';
  const slice = buffer.subarray(0, Math.min(buffer.length, maxLen));
  let s = '';
  try {
    s = slice.toString('utf8');
  } catch {
    s = '';
  }
  if (s.length < 40 || /[\x00-\x08\x0e-\x1f]/.test(s.slice(0, 200))) {
    s = slice.toString('latin1');
  }
  const printable = s.replace(/[^\x09\x0a\x0d\x20-\x7eáéíóúñÁÉÍÓÚÑüÜ]/g, ' ');
  return printable.replace(/\s+/g, ' ').trim();
}

/** Secuencias largas tipo PDF (palabras consecutivas) para mejorar aciertos */
export function extractPdfLikeRuns(buffer, maxRuns = 80, minLen = 12) {
  if (!buffer || buffer.length < 100) return '';
  const slice = buffer.subarray(0, Math.min(buffer.length, 400000));
  const raw = slice.toString('latin1');
  const chunks = raw.split(/[\x00-\x1f]{2,}/);
  const out = [];
  for (const ch of chunks) {
    const t = ch.replace(/[^\x20-\x7eáéíóúñüÁÉÍÓÚÑÜ]/gi, ' ').replace(/\s+/g, ' ').trim();
    if (t.length >= minLen && /[a-zA-Záéíóúñ]{3}/.test(t)) out.push(t.slice(0, 200));
    if (out.length >= maxRuns) break;
  }
  return out.join(' · ').slice(0, 25000);
}

/**
 * Pistas tipo Excel/CSV: primeras filas con separador tab, ; o ,
 */
export function extractTabularHints(text, maxLines = 45) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .slice(0, maxLines)
    .map((l) => l.trim())
    .filter(Boolean);
  const extra = [];
  for (const line of lines) {
    const parts = line.split(/\t|;|,/).map((c) => c.trim()).filter(Boolean);
    if (parts.length >= 2) {
      extra.push(parts.join(' | '));
    }
  }
  return extra.join('\n').slice(0, 12000);
}

function inferNombreFromPatterns(blob) {
  const names = [];
  let m;
  const r1 = new RegExp(RX_NOMBRE_CLIENTE.source, 'gi');
  while ((m = r1.exec(blob)) && names.length < 3) {
    const t = m[1].trim().replace(/\s+/g, ' ');
    if (t.length > 3) names.push(t);
  }
  const r2 = new RegExp(RX_NOMBRE_CONTACTO.source, 'gi');
  const contactos = [];
  while ((m = r2.exec(blob)) && contactos.length < 3) {
    const t = m[1].trim().replace(/\s+/g, ' ');
    if (t.length > 3) contactos.push(t);
  }
  return { nombre_cliente_inferido: names[0] || '', nombres_cliente_alt: names, nombre_contacto_inferido: contactos[0] || '' };
}

export function detectEntitiesInText(text, filename = '') {
  const blob = `${filename} ${text}`.slice(0, 220000);
  const ruts = [...new Set((blob.match(RUT_RE) || []).map((x) => String(x).trim()))].slice(0, 8);
  const emails = [...new Set((blob.match(EMAIL_RE) || []).map((x) => x.toLowerCase()))].slice(0, 8);
  const phonesRaw = blob.match(PHONE_RE) || [];
  const phones = [...new Set(phonesRaw.map((x) => x.replace(/[\s.-]/g, '')))].slice(0, 8);
  const ots = [...new Set((blob.match(OT_RE) || []).map((x) => String(x).toUpperCase()))].slice(0, 5);
  const patentes = [...new Set((blob.match(PATENTE_RE) || []).map((x) => x.toUpperCase().replace(/\s/g, '')))].slice(
    0,
    8
  );
  const facturas = [];
  let m;
  const re = new RegExp(FACTURA_RE.source, 'gi');
  while ((m = re.exec(blob)) && facturas.length < 5) {
    if (m[1]) facturas.push(m[1]);
  }
  const inferred = inferNombreFromPatterns(blob);
  return {
    ruts,
    emails,
    telefonos: phones,
    whatsapp_sugerido: phones.find((p) => p.replace(/\D/g, '').length >= 9) || null,
    patentes,
    ots,
    facturas_o_comprobantes: facturas,
    nombre_cliente_inferido: inferred.nombre_cliente_inferido,
    nombres_cliente_alt: inferred.nombres_cliente_alt,
    nombre_contacto_inferido: inferred.nombre_contacto_inferido,
  };
}

function inferModuleFromSignals(datos, filenameLower, mimeLower) {
  const t = `${filenameLower} ${mimeLower}`;
  if (/gasto|rendicion|honorario|boleta|factura|sii/i.test(t) || datos.facturas_o_comprobantes.length)
    return 'finanzas';
  if (datos.patentes.length || /flota|traslado|vehiculo|patente/i.test(t)) return 'flota';
  if (/cotizacion|propuesta|comercial|oc/i.test(t)) return 'comercial';
  if (/rrhh|contrato|admin|personal|interno/i.test(t)) return 'administrativo';
  if (/hvac|clima|frio|equipo|mantencion/i.test(t)) return 'clima';
  return 'general';
}

function inferCategory(filenameLower, mimeLower) {
  if (/\.pdf$/i.test(filenameLower) || mimeLower.includes('pdf')) return 'pdf';
  if (/\.xlsx?$/i.test(filenameLower) || mimeLower.includes('spreadsheet') || mimeLower.includes('excel'))
    return 'hoja_de_calculo';
  if (/\.csv$/i.test(filenameLower) || mimeLower === 'text/csv') return 'csv';
  if (/\.docx?$/i.test(filenameLower) || mimeLower.includes('word')) return 'documento_word';
  if (mimeLower.startsWith('image/')) return 'imagen';
  return 'otro';
}

function buildEnrichedTextSnippet(buffer, filename, mimeLower, baseSnippet) {
  let t = baseSnippet;
  const tab = extractTabularHints(baseSnippet);
  if (tab) t = `${t}\n${tab}`;
  if (/\.pdf$/i.test(filename) || mimeLower.includes('pdf')) {
    const runs = extractPdfLikeRuns(buffer);
    if (runs) t = `${t}\n${runs}`;
  }
  if (/\.xlsx?$/i.test(filename) || mimeLower.includes('spreadsheet') || mimeLower.includes('excel')) {
    const runs = extractPdfLikeRuns(buffer, 120, 8);
    if (runs) t = `${t}\n${runs}`;
  }
  return t.slice(0, 150000);
}

/**
 * @param {object} ctx - { clientes?, contactos?, personal? }
 */
export function classifyDocumentBuffer({ filename, mimeType, buffer }, ctx = {}) {
  const fn = String(filename || 'sin_nombre');
  const fnLower = fn.toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  const rawSnippet = extractTextSnippetsFromBuffer(buffer);
  const snippet = buildEnrichedTextSnippet(buffer, fn, mime, rawSnippet);
  const datos = detectEntitiesInText(snippet, fn);

  const moduloDestino = inferModuleFromSignals(datos, fnLower, mime);
  const categoria = inferCategory(fnLower, mime);

  let clienteProbable = null;
  let contactoProbable = null;
  let tecnicoProbable = null;
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  const blobN = norm(`${fn} ${snippet.slice(0, 12000)}`);
  for (const c of ctx.clientes || []) {
    const n = norm(c.nombre || c.nombre_cliente || c.name);
    if (n.length > 3 && blobN.includes(n)) {
      clienteProbable = { id: c.id || null, nombre: c.nombre || c.nombre_cliente || c.name, coincidencia: 'probable' };
      break;
    }
  }
  for (const c of ctx.contactos || []) {
    const n = norm(c.nombre_contacto);
    if (n.length > 3 && blobN.includes(n)) {
      contactoProbable = { id: c.id || null, nombre: c.nombre_contacto, coincidencia: 'probable' };
      break;
    }
  }
  for (const p of ctx.personal || []) {
    const n = norm(p.nombreCompleto || p.nombre);
    if (n.length > 3 && blobN.includes(n)) {
      tecnicoProbable = { id: p.id || null, nombre: p.nombreCompleto || p.nombre, coincidencia: 'probable' };
      break;
    }
  }

  let confianza = 38;
  if (datos.ruts.length) confianza += 12;
  if (datos.emails.length) confianza += 10;
  if (datos.ots.length) confianza += 14;
  if (datos.patentes.length) confianza += 12;
  if (clienteProbable) confianza += 15;
  if (datos.nombre_cliente_inferido) confianza += 6;
  if (snippet.length > 200) confianza += 8;
  confianza = Math.max(15, Math.min(92, Math.round(confianza)));

  const advertencias = [];
  if (confianza < 45) advertencias.push('revisar manualmente: confianza baja');
  if (!clienteProbable && !datos.ruts.length && !datos.nombre_cliente_inferido)
    advertencias.push('sin cliente ni RUT claro en el texto detectado');
  if (snippet.length < 30 && !mime.includes('image')) advertencias.push('poco texto legible (PDF/binario sin extracción profunda)');

  const resumen = [
    categoria !== 'otro' ? `Tipo: ${categoria}` : null,
    datos.ots[0] ? `OT: ${datos.ots[0]}` : null,
    datos.patentes[0] ? `Patente: ${datos.patentes[0]}` : null,
    datos.ruts[0] ? `RUT: ${datos.ruts[0]}` : null,
    clienteProbable ? `Cliente: ${clienteProbable.nombre}` : null,
    datos.nombre_cliente_inferido ? `Nombre (inferido): ${datos.nombre_cliente_inferido}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 400);

  return {
    version: JARVIS_DOC_ENGINE_VERSION,
    categoria_detectada: categoria,
    tipo_archivo: mime || 'application/octet-stream',
    modulo_destino_sugerido: moduloDestino,
    cliente_probable: clienteProbable,
    contacto_probable: contactoProbable,
    tecnico_probable: tecnicoProbable,
    patente_probable: datos.patentes[0] || null,
    ot_probable: datos.ots[0] || null,
    confianza_clasificacion: confianza,
    resumen_breve: resumen || 'Sin señales fuertes: revisión manual recomendada.',
    datos_detectados: datos,
    advertencias,
    clasificado_por_jarvis: true,
    texto_match_sample: snippet.slice(0, 14000),
  };
}

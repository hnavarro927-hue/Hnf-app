/**
 * Extracción heurística de órdenes de compra (PDF tipo retail / Puma Chile y similares).
 * Sin IA externa: regex + patrones sobre texto extraído del PDF.
 */

import { extractPdfLikeRuns, extractTextSnippetsFromBuffer } from './jarvis-document-intake.engine.js';

export const OC_PDF_ENGINE_VERSION = '1.0.0';

const RX_OC_NUM = /(?:OC|O\.?\s*C\.?|orden\s+de\s+compra|n[°º]?\s*(?:oc|orden))\s*[:\.]?\s*([A-Z0-9][A-Z0-9\-\/]{2,24})/gi;
const RX_CLIENTE = /(?:raz[oó]n\s+social|cliente|empresa|proveedor\s+servicios|mandante)\s*[:\.]?\s*([^\n\r]{3,120})/gi;
const RX_TOTAL = /(?:total\s*(?:general|a?\s*pagar)?|importe\s*total|monto\s*total)\s*[:\.]?\s*\$?\s*([\d\.\s]{3,16})/gi;

function parseChileMoney(raw) {
  if (raw == null) return null;
  const s = String(raw)
    .replace(/\s/g, '')
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/**
 * Intenta extraer texto legible de un PDF usando pdf-parse si está instalado.
 */
export async function extractPdfText(buffer) {
  if (!buffer || buffer.length < 50) return '';
  try {
    const mod = await import('pdf-parse');
    const fn = mod.default || mod;
    const res = await fn(buffer);
    const t = String(res?.text || '').replace(/\s+/g, ' ').trim();
    if (t.length > 80) return t.slice(0, 200000);
  } catch {
    /* pdf-parse ausente o PDF no parseable */
  }
  const snip = extractTextSnippetsFromBuffer(buffer, 200000);
  if (snip.length > 80) return snip;
  return extractPdfLikeRuns(buffer, 120, 10).slice(0, 200000);
}

/**
 * Líneas candidatas: descripción corta + monto CLP al final de línea o separado por tab.
 */
function extractLineItems(text) {
  const blob = String(text || '');
  const lines = blob.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const items = [];
  const seen = new Set();

  for (const line of lines) {
    if (line.length < 8 || line.length > 220) continue;
    const lower = line.toLowerCase();
    if (/^(total|subtotal|iva|neto|fecha|p[aá]gina|orden)/i.test(line)) continue;

    const moneyAtEnd = line.match(/(.{4,120}?)\s+(\$?\s*[\d][\d\.\s]{2,14})$/);
    if (moneyAtEnd) {
      const costo = parseChileMoney(moneyAtEnd[2]);
      if (costo != null && costo > 0 && costo < 1e11) {
        const desc = moneyAtEnd[1].trim();
        if (desc.length >= 3) {
          const key = `${desc.slice(0, 40)}|${costo}`;
          if (!seen.has(key)) {
            seen.add(key);
            const isTienda =
              /tienda|local|sucursal|punto|puma|mall|cc\s|centro\s+comercial/i.test(desc) ||
              /^\d{3,6}\s+/.test(desc);
            items.push({
              tiendaCodigo: /^\d{3,6}\b/.test(desc) ? desc.match(/^\d{3,6}/)[0] : null,
              tiendaNombre: desc.slice(0, 200),
              servicioDescripcion: isTienda ? 'Servicio OC (detectado)' : desc.slice(0, 200),
              costo,
              confianza: isTienda ? 0.72 : 0.45,
              needsReview: !isTienda || costo > 5e8,
            });
          }
        }
      }
    }
  }

  /* Tab-separados */
  for (const line of lines) {
    if (!line.includes('\t')) continue;
    const parts = line.split('\t').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const last = parts[parts.length - 1];
    const costo = parseChileMoney(last);
    if (costo == null || costo <= 0) continue;
    const desc = parts.slice(0, -1).join(' ').slice(0, 200);
    if (desc.length < 3) continue;
    const key = `${desc.slice(0, 40)}|${costo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      tiendaCodigo: null,
      tiendaNombre: desc,
      servicioDescripcion: 'Ítem tabular OC',
      costo,
      confianza: 0.55,
      needsReview: true,
    });
  }

  return items.slice(0, 80);
}

function pickCliente(text) {
  let m;
  const r = new RegExp(RX_CLIENTE.source, 'gi');
  while ((m = r.exec(text)) && m[1]) {
    const t = m[1].trim().replace(/\s+/g, ' ');
    if (t.length > 3 && t.length < 121) return t;
  }
  return '';
}

function pickNumeroOc(text, filename) {
  const pool = `${filename} ${text}`;
  let m;
  const r = new RegExp(RX_OC_NUM.source, 'gi');
  while ((m = r.exec(pool)) && m[1]) {
    const t = m[1].trim().toUpperCase();
    if (t.length > 2) return t;
  }
  const alt = pool.match(/\b(OC[-\s]?[A-Z0-9]{4,})\b/i);
  return alt ? alt[1].replace(/\s/g, '').toUpperCase() : '';
}

function pickFecha(text) {
  const m = text.match(/\b(20\d{2}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]20\d{2})\b/);
  return m ? m[1] : '';
}

function pickPeriodo(text, fecha) {
  const m = fecha && fecha.match(/(20\d{2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  let p;
  const r = /\b(20\d{2})\s*[-\/]\s*(0?[1-9]|1[0-2])\b/;
  const x = text.match(r);
  if (x) return `${x[1]}-${x[2].padStart(2, '0')}`;
  return '';
}

function pickTotalGeneral(text, lineItems) {
  let best = null;
  let m;
  const r = new RegExp(RX_TOTAL.source, 'gi');
  while ((m = r.exec(text)) && m[1]) {
    const v = parseChileMoney(m[1]);
    if (v != null && v > 0) best = v;
  }
  if (best != null) return best;
  if (lineItems.length) {
    const sum = lineItems.reduce((a, x) => a + (Number(x.costo) || 0), 0);
    return Math.round(sum * 100) / 100;
  }
  return null;
}

export function buildExtractionSummary(cabecera, detalles) {
  const d = Array.isArray(detalles) ? detalles : [];
  const tiendasDetectadas = d.length;
  const pendientesRevision = d.filter((x) => x.needsReview || x.fromExtraction === false).length;
  const costosDetectados = d.map((x) => ({ id: x.id, tiendaNombre: x.tiendaNombre, costo: x.costo }));
  const totalValidado = d
    .filter((x) => !x.needsReview && x.costoValidado != null)
    .reduce((a, x) => a + Number(x.costoValidado || 0), 0);
  return {
    tiendasDetectadas,
    pendientesRevision,
    costosDetectados,
    totalValidado: Math.round(totalValidado * 100) / 100,
    totalCabecera: cabecera?.totalGeneral ?? null,
    estadoExtraccion: cabecera?.estadoExtraccion || null,
  };
}

/**
 * @param {string} text
 * @param {string} filename
 */
export function parseOrdenCompraFromText(text, filename = '') {
  const cliente = pickCliente(text);
  const numeroOc = pickNumeroOc(text, filename);
  const fechaOc = pickFecha(text);
  const periodo = pickPeriodo(text, fechaOc);
  const lineItems = extractLineItems(text);
  const totalGeneral = pickTotalGeneral(text, lineItems);

  const camposFaltantes = [];
  if (!cliente) camposFaltantes.push('cliente');
  if (!numeroOc) camposFaltantes.push('numeroOc');
  if (!fechaOc) camposFaltantes.push('fechaOc');
  if (!periodo) camposFaltantes.push('periodo');
  if (!lineItems.length) camposFaltantes.push('detalle_tiendas');
  if (totalGeneral == null) camposFaltantes.push('totalGeneral');

  const extractionCompleta = camposFaltantes.length === 0;
  const confianzaGlobal = extractionCompleta
    ? 0.85
    : Math.max(0.25, 1 - camposFaltantes.length * 0.12);

  return {
    engineVersion: OC_PDF_ENGINE_VERSION,
    cliente,
    numeroOc,
    fechaOc,
    periodo,
    totalGeneral,
    lineItems,
    camposFaltantes,
    extractionCompleta,
    confianzaGlobal,
    textoExtraidoSnippet: String(text || '').slice(0, 4000),
  };
}

export async function parseOrdenCompraPdfBuffer(buffer, filename = '') {
  const text = await extractPdfText(buffer);
  const parsed = parseOrdenCompraFromText(text, filename);
  return { ...parsed, rawTextLength: text.length };
}

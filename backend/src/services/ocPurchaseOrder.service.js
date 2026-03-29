import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtractionSummary, parseOrdenCompraPdfBuffer } from '../domain/oc-purchase-order-pdf.engine.js';
import { ocCabeceraRepository } from '../repositories/ocCabecera.repository.js';
import { ocDetalleTiendaRepository } from '../repositories/ocDetalleTienda.repository.js';
import { planTiendaRepository } from '../repositories/planTienda.repository.js';
import { tiendaFinancieraRepository } from '../repositories/tiendaFinanciera.repository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '../../data');
const UPLOAD_OC = 'uploads/oc-pdf';

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function bestPlanTiendaMatch(nombreTienda, _clienteCabecera) {
  const n = norm(nombreTienda);
  if (n.length < 3) return null;
  const tiendas = await planTiendaRepository.findAll(null);
  let best = null;
  let score = 0;
  for (const t of tiendas) {
    const tn = norm(t.nombre || '');
    if (!tn) continue;
    if (tn.includes(n) || n.includes(tn)) {
      const s = Math.min(tn.length, n.length) / Math.max(tn.length, n.length);
      if (s > score) {
        score = s;
        best = t;
      }
    }
  }
  return score > 0.35 ? best : null;
}

async function bestFinanzaTiendaId(nombreTienda) {
  const n = norm(nombreTienda);
  if (n.length < 3) return null;
  const list = await tiendaFinancieraRepository.findAll();
  for (const t of list) {
    const tn = norm(t.nombre || '');
    if (tn && (tn.includes(n) || n.includes(tn))) return t.id;
  }
  return null;
}

async function enrichDetalleLinks(detalleRows, clienteCabecera) {
  const out = [];
  for (const row of detalleRows) {
    const planHit = await bestPlanTiendaMatch(row.tiendaNombre, clienteCabecera);
    const finId = await bestFinanzaTiendaId(row.tiendaNombre);
    out.push({
      ...row,
      planTiendaId: planHit?.id || null,
      tiendaFinancieraId: finId,
      otId: row.otId || null,
    });
  }
  return out;
}

export const ocPurchaseOrderService = {
  async listCabeceras() {
    const list = await ocCabeceraRepository.findAll();
    return [...list].sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    );
  },

  async getCabeceraConDetalle(id) {
    const cab = await ocCabeceraRepository.findById(id);
    if (!cab) return { error: 'No encontrado' };
    const detalles = await ocDetalleTiendaRepository.findByCabeceraId(id);
    const resumen = buildExtractionSummary(cab, detalles);
    return { cabecera: cab, detalles, resumen };
  },

  async uploadPdfBase64(body, actor) {
    const name = String(body?.nombre_archivo || body?.nombreArchivo || 'orden-compra.pdf').slice(0, 220);
    const b64 = String(body?.dataBase64 || body?.base64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!b64) return { errors: ['dataBase64 obligatorio'] };
    let buffer;
    try {
      buffer = Buffer.from(b64, 'base64');
    } catch {
      return { errors: ['Base64 inválido'] };
    }
    if (buffer.length < 80) return { errors: ['Archivo demasiado pequeño'] };
    if (buffer.length > 25 * 1024 * 1024) return { errors: ['PDF máximo 25 MB'] };

    const hash = createHash('sha256').update(buffer).digest('hex');
    const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
    const rel = path.join(UPLOAD_OC, `${hash.slice(0, 16)}_${safe}`).replace(/\\/g, '/');
    const abs = path.join(DATA_ROOT, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buffer);

    const parsed = await parseOrdenCompraPdfBuffer(buffer, name);
    const needsManual =
      !parsed.extractionCompleta ||
      (parsed.lineItems || []).some((x) => x.needsReview) ||
      !(parsed.lineItems || []).length;

    const estadoExtraccion = needsManual ? 'revision_manual' : 'pendiente_validacion';

    const cab = await ocCabeceraRepository.create(
      {
        cliente: parsed.cliente || '',
        numeroOc: parsed.numeroOc || '',
        fechaOc: parsed.fechaOc || '',
        periodo: parsed.periodo || '',
        totalGeneral: parsed.totalGeneral,
        totalValidado: null,
        moneda: 'CLP',
        rutaArchivoPdf: rel,
        hashArchivo: hash,
        estadoExtraccion,
        extractionMeta: {
          engineVersion: parsed.engineVersion,
          camposFaltantes: parsed.camposFaltantes || [],
          confianzaGlobal: parsed.confianzaGlobal,
          extractionCompleta: parsed.extractionCompleta,
        },
        textoExtraidoSnippet: parsed.textoExtraidoSnippet || '',
        rawTextLength: parsed.rawTextLength || 0,
      },
      actor
    );

    const lineRows = (parsed.lineItems || []).map((li) => ({
      tiendaCodigo: li.tiendaCodigo,
      tiendaNombre: li.tiendaNombre,
      servicioDescripcion: li.servicioDescripcion,
      costo: li.costo,
      costoValidado: li.needsReview ? null : li.costo,
      confianza: li.confianza,
      needsReview: Boolean(li.needsReview),
      fromExtraction: true,
      planTiendaId: null,
      otId: null,
      tiendaFinancieraId: null,
    }));

    const enriched = await enrichDetalleLinks(lineRows, cab.cliente);
    const detalles = await ocDetalleTiendaRepository.insertManyForCabecera(cab.id, enriched, actor);

    const resumen = buildExtractionSummary(cab, detalles);
    return { cabecera: cab, detalles, resumen, parsedHints: { camposFaltantes: parsed.camposFaltantes } };
  },

  async patchCabecera(id, body, actor) {
    const cur = await ocCabeceraRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    const patch = {};
    for (const k of ['cliente', 'numeroOc', 'fechaOc', 'periodo', 'totalGeneral', 'estadoExtraccion']) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (body.totalGeneral != null) {
      const n = Number.parseFloat(String(body.totalGeneral).replace(',', '.'));
      patch.totalGeneral = Number.isFinite(n) ? Math.round(n * 100) / 100 : cur.totalGeneral;
    }
    const u = await ocCabeceraRepository.update(id, patch, actor, 'Patch cabecera OC');
    const detalles = await ocDetalleTiendaRepository.findByCabeceraId(id);
    return { cabecera: u, resumen: buildExtractionSummary(u, detalles) };
  },

  async patchDetalle(id, body, actor) {
    const cur = await ocDetalleTiendaRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    const patch = {};
    if (body.tiendaNombre != null) patch.tiendaNombre = String(body.tiendaNombre).slice(0, 200);
    if (body.tiendaCodigo != null) patch.tiendaCodigo = body.tiendaCodigo ? String(body.tiendaCodigo).slice(0, 32) : null;
    if (body.servicioDescripcion != null) patch.servicioDescripcion = String(body.servicioDescripcion).slice(0, 400);
    if (body.costo != null) {
      const n = Number.parseFloat(String(body.costo).replace(',', '.'));
      patch.costo = Number.isFinite(n) ? Math.round(n * 100) / 100 : cur.costo;
    }
    if (body.costoValidado != null) {
      const n = Number.parseFloat(String(body.costoValidado).replace(',', '.'));
      patch.costoValidado = Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
    }
    if (body.needsReview != null) patch.needsReview = Boolean(body.needsReview);
    if (body.planTiendaId !== undefined) patch.planTiendaId = body.planTiendaId ? String(body.planTiendaId).trim() : null;
    if (body.otId !== undefined) patch.otId = body.otId ? String(body.otId).trim() : null;
    if (body.tiendaFinancieraId !== undefined)
      patch.tiendaFinancieraId = body.tiendaFinancieraId ? String(body.tiendaFinancieraId).trim() : null;

    const u = await ocDetalleTiendaRepository.update(id, patch, actor, 'Patch detalle OC tienda');
    const cab = await ocCabeceraRepository.findById(cur.cabeceraId);
    const detalles = await ocDetalleTiendaRepository.findByCabeceraId(cur.cabeceraId);
    const totalValidado = detalles
      .filter((x) => !x.needsReview && x.costoValidado != null)
      .reduce((a, x) => a + Number(x.costoValidado || 0), 0);
    await ocCabeceraRepository.update(
      cur.cabeceraId,
      { totalValidado: Math.round(totalValidado * 100) / 100 },
      actor,
      'Recalcula total validado'
    );
    const cab2 = await ocCabeceraRepository.findById(cur.cabeceraId);
    return { detalle: u, cabecera: cab2, resumen: buildExtractionSummary(cab2, detalles) };
  },

  async validarCabecera(id, actor) {
    const cur = await ocCabeceraRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    const detalles = await ocDetalleTiendaRepository.findByCabeceraId(id);
    const pend = detalles.filter((x) => x.needsReview);
    if (pend.length) return { errors: [`${pend.length} línea(s) aún marcadas para revisión`] };
    const u = await ocCabeceraRepository.update(
      id,
      { estadoExtraccion: 'validada' },
      actor,
      'OC validada operativamente'
    );
    return { cabecera: u, resumen: buildExtractionSummary(u, detalles) };
  },
};

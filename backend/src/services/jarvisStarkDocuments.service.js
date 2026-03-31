import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  JARVIS_DOCUMENT_ENTRY_TYPES,
  routeDocument,
} from '../../../frontend/domain/jarvis-document-router.js';
import { mapDestinationToStarkApi } from '../domain/jarvis-stark-destination-map.js';
import { extractPdfText } from '../domain/oc-purchase-order-pdf.engine.js';
import { jarvisStarkDocumentsRepository } from '../repositories/jarvisStarkDocuments.repository.js';
import { auditService } from './audit.service.js';
import { parseStarkMultipart } from '../utils/starkMultipart.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(__dirname, '../../data');

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function uploadsDir() {
  const raw = process.env.HNF_STARK_UPLOADS_DIR;
  if (raw && String(raw).trim()) return path.resolve(String(raw).trim());
  return path.join(dataRoot, 'stark-uploads');
}

function sanitizeOriginalName(name) {
  const base = path.basename(String(name || 'archivo')).replace(/[^\w.\-()\sáéíóúñÁÉÍÓÚÑ]+/gi, '_');
  return base.slice(0, 200) || 'archivo';
}

function pickExtension(mime, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext && ext.length <= 12 && /^\.[a-z0-9]+$/i.test(ext)) return ext;
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '.bin';
}

async function tryExtractText(mime, buffer) {
  if (mime === 'application/pdf' && buffer?.length) {
    const t = await extractPdfText(buffer);
    return String(t || '').trim().slice(0, 100000);
  }
  return '';
}

function publicRecord(r) {
  if (!r || typeof r !== 'object') return r;
  const { extractedText, ...rest } = r;
  const t = extractedText != null ? String(extractedText) : '';
  return {
    ...rest,
    extractedText: undefined,
    extractedTextPreview: t ? `${t.slice(0, 500)}${t.length > 500 ? '…' : ''}` : null,
    extractedTextLength: t.length,
  };
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {{ actor: string }} ctx
 */
export async function starkUploadFromRequest(request, ctx) {
  const parsed = await parseStarkMultipart(request);
  const file = parsed.file;
  if (!file || !file.buffer?.length) {
    return { errors: ['Se requiere un archivo en el campo multipart `file`.'] };
  }

  const mime = String(file.mimeType || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return {
      errors: [
        `Tipo MIME no permitido: ${mime}. Permitidos: PDF e imágenes (jpeg, png, webp, gif). Las OC, facturas y guías suelen llegar como PDF o imagen escaneada.`,
      ],
    };
  }

  const originalName = sanitizeOriginalName(file.filename);
  const id = `STARK-${Date.now().toString(36)}-${randomBytes(5).toString('hex')}`;
  const ext = pickExtension(mime, originalName);
  const storedName = `${id}${ext}`;
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  const absolutePath = path.join(dir, storedName);
  await writeFile(absolutePath, file.buffer);

  const relativeToData = path.relative(dataRoot, absolutePath).split(path.sep).join('/');

  let extractedText = await tryExtractText(mime, file.buffer);
  const notas = String(parsed.fields.notas || '').trim();
  const origen = String(parsed.fields.origen || '').trim().slice(0, 200);
  const clienteField = String(parsed.fields.cliente || '').trim().slice(0, 200);
  const otField = String(parsed.fields.otId || parsed.fields.ot || '').trim().slice(0, 80);
  const forcedRaw = String(parsed.fields.declaredDocType || parsed.fields.tipoDocumental || '').trim();
  const forcedEntryType = JARVIS_DOCUMENT_ENTRY_TYPES.includes(forcedRaw) ? forcedRaw : null;

  const textForRoute = [notas, extractedText].filter(Boolean).join('\n').trim();

  const route = routeDocument({
    text: textForRoute,
    declaredSource: origen || null,
    fileStub: { name: originalName, mimeType: mime, size: file.buffer.length },
    forcedEntryType,
  });

  const cliente = clienteField || route.client || null;
  const otRef = otField || route.otNumber || null;

  const ocrStatus =
    mime === 'application/pdf' && extractedText.length >= 40
      ? 'texto_extraido_basico'
      : mime.startsWith('image/')
        ? 'pendiente_ocr'
        : extractedText.length >= 40
          ? 'texto_extraido_basico'
          : 'pendiente';

  const record = {
    id,
    creadoEn: new Date().toISOString(),
    actor: String(ctx.actor || 'sistema').slice(0, 120),
    nombreOriginal: originalName,
    mimeType: mime,
    tamanoBytes: file.buffer.length,
    origen: origen || null,
    cliente,
    otRef,
    rutaAlmacenamiento: relativeToData,
    ocrStatus,
    extractedText: extractedText || null,
    router: {
      entryType: route.entryType,
      confidence: route.confidence,
      destinationInternal: route.destination,
      destination: mapDestinationToStarkApi(route.destination),
      revision_jarvis_pendiente: route.revision_jarvis_pendiente,
      rationale: route.rationale,
      client: route.client,
      ocNumber: route.ocNumber,
      otNumber: route.otNumber,
      amount: route.amount,
      dateIso: route.dateIso,
      area: route.area,
    },
    auditTrail: [
      {
        at: new Date().toISOString(),
        actor: String(ctx.actor || 'sistema').slice(0, 120),
        action: 'stark_upload',
        detail: 'Archivo recibido, clasificado y persistido (Stark Integrity).',
      },
    ],
  };

  await jarvisStarkDocumentsRepository.append(record);

  await auditService.logCritical({
    actor: ctx.actor,
    action: 'jarvis.stark.upload',
    resource: 'jarvis-stark-documents',
    resourceId: id,
    meta: {
      mime,
      entryType: route.entryType,
      destination: record.router.destination,
      revisionPendiente: route.revision_jarvis_pendiente,
    },
    result: 'ok',
  });

  return {
    record: publicRecord(record),
    router: record.router,
  };
}

export async function starkListRecent(limit) {
  const rows = await jarvisStarkDocumentsRepository.listRecent(limit);
  return rows.map(publicRecord);
}

export async function starkSummary() {
  const list = await jarvisStarkDocumentsRepository.listRecent(800);
  const pendingClassification = list.filter((r) => r.router?.revision_jarvis_pendiente).length;
  const last = list[0] || null;
  const lastOcEnRevision = Boolean(
    last?.router?.entryType === 'orden_compra' && last?.router?.revision_jarvis_pendiente
  );
  return {
    totalRegistros: list.length,
    pendingClassification,
    lastDocumentAt: last?.creadoEn || null,
    lastOcEnRevision,
    lastDocumentId: last?.id || null,
  };
}

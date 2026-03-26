import { createHash } from 'node:crypto';
import {
  applyClassificationToMessage,
  buildHistoricalImportSummary,
  classifyOutlookMessage,
} from '../../domain/outlook-intelligence.js';
import { outlookIntakeRepository } from './outlookIntake.repository.js';

function normText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

const normMonth = (name) => {
  const n = normText(name);
  if (/enero|jan/i.test(n)) return 'enero';
  if (/febrero|feb/i.test(n)) return 'febrero';
  if (/marzo|mar\b/i.test(n)) return 'marzo';
  return null;
};

export function computeMessageContentHash(partial) {
  const h = createHash('sha256');
  h.update(
    JSON.stringify({
      subject: partial.subject || '',
      fromEmail: partial.fromEmail || '',
      receivedAt: partial.receivedAt || '',
      body: (partial.bodyText || '').slice(0, 2400),
    })
  );
  return h.digest('hex').slice(0, 48);
}

function normalizeAttachments(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr.map((a, i) => ({
    id: a.id || `att-${i}-${Date.now().toString(36)}`,
    name: a.name || 'adjunto',
    type: a.type || 'application/octet-stream',
    size: Number(a.size) || 0,
    sourcePath: a.sourcePath,
    extractedText: a.extractedText,
    extractedMeta: a.extractedMeta,
    linkedEntityType: a.linkedEntityType,
    linkedEntityId: a.linkedEntityId,
  }));
}

/**
 * @param {object} raw - mensaje entrante (puede omitir id)
 * @param {object} [context]
 */
export async function ingestOutlookMessage(raw, context = {}) {
  const store = await outlookIntakeRepository.getAll();
  const id = raw.id || outlookIntakeRepository.nextId(store.messages);
  const receivedAt = raw.receivedAt || new Date().toISOString();
  const base = {
    id,
    source: raw.source || 'outlook',
    folder: raw.folder || 'simulated',
    threadId: raw.threadId || id,
    subject: raw.subject || '(sin asunto)',
    fromName: raw.fromName || '',
    fromEmail: raw.fromEmail || '',
    to: Array.isArray(raw.to) ? raw.to : [],
    cc: Array.isArray(raw.cc) ? raw.cc : [],
    receivedAt,
    bodyText: raw.bodyText || '',
    bodyHtml: raw.bodyHtml || '',
    attachments: normalizeAttachments(raw.attachments),
    status: raw.status || 'nuevo',
    clientHint: raw.clientHint,
    moduleHint: raw.moduleHint,
    priorityHint: raw.priorityHint,
    requiresInternalAction: raw.requiresInternalAction,
    internalOwner: raw.internalOwner,
    internalFollowers: Array.isArray(raw.internalFollowers) ? raw.internalFollowers : [],
    pendingReason: raw.pendingReason,
    dueAt: raw.dueAt,
    lastActivityAt: raw.lastActivityAt || receivedAt,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    linkedOtId: raw.linkedOtId,
    linkedTechnicalDocumentId: raw.linkedTechnicalDocumentId,
    linkedCommercialOpportunityIds: Array.isArray(raw.linkedCommercialOpportunityIds)
      ? raw.linkedCommercialOpportunityIds
      : [],
    linkedCalendarRefs: Array.isArray(raw.linkedCalendarRefs) ? raw.linkedCalendarRefs : [],
    extractedData: raw.extractedData && typeof raw.extractedData === 'object' ? raw.extractedData : {},
    auditTrail: Array.isArray(raw.auditTrail) ? raw.auditTrail : [],
  };

  const contentHash = raw.contentHash || computeMessageContentHash(base);
  base.contentHash = contentHash;

  const existing = await outlookIntakeRepository.findByContentHash(contentHash);
  if (existing) {
    return {
      ok: false,
      duplicateOf: existing.id,
      message: 'Mismo hash de contenido; no se duplicó.',
    };
  }

  const classification = classifyOutlookMessage(base, context);
  const enriched = applyClassificationToMessage(base, classification);
  enriched.auditTrail.push({
    at: new Date().toISOString(),
    action: 'ingested',
    source: enriched.source,
  });

  await outlookIntakeRepository.appendMessage(enriched);
  return { ok: true, message: enriched, classification };
}

export async function ingestOutlookBatch(messages, context = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const results = [];
  for (const m of list) {
    /* eslint-disable no-await-in-loop */
    results.push(await ingestOutlookMessage(m, context));
  }
  return { ok: true, count: results.length, results };
}

function detectFileKind(name, type) {
  const low = `${name} ${type}`.toLowerCase();
  if (/\.(ics|ical)|text\/calendar/i.test(low)) return 'calendar';
  if (/calendario|schedule|programaci/i.test(low)) return 'calendar';
  if (/\.pdf|pdf/i.test(low)) return 'pdf';
  if (/\.(xlsx|xls|csv)/i.test(low)) return 'spreadsheet';
  if (/correo|email|outlook|fwd|re:/i.test(low)) return 'email_paste';
  return 'other';
}

function detectClienteFromText(text) {
  const t = normText(text);
  const m = t.match(/\b(puma|nike|falabella|cencosud)\b/);
  return m ? m[1].replace(/^\w/, (c) => c.toUpperCase()) : null;
}

function detectMonthFromText(text, monthHint, name) {
  const fromHint = monthHint ? normMonth(monthHint) : null;
  if (fromHint) return fromHint;
  const blob = `${text} ${name}`;
  if (/2026-01|enero|jan/i.test(blob)) return 'enero';
  if (/2026-02|febrero|feb/i.test(blob)) return 'febrero';
  return normMonth(blob);
}

/**
 * @param {object} payload - { folderName, monthHint, files: [] }
 */
export async function ingestFolderDocuments(payload) {
  const folderName = payload?.folderName || 'import';
  const monthHint = payload?.monthHint || '';
  const filesIn = Array.isArray(payload?.files) ? payload.files : [];
  const store = await outlookIntakeRepository.getAll();
  const fileHashesSeen = new Set();
  for (const hi of store.historicalImports || []) {
    for (const fi of hi.files || []) {
      if (fi.hash) fileHashesSeen.add(fi.hash);
    }
  }

  const processedFiles = [];
  let correosFromFiles = 0;

  for (let i = 0; i < filesIn.length; i += 1) {
    const f = filesIn[i] || {};
    const name = f.name || `file-${i}`;
    const type = f.type || 'application/octet-stream';
    const text = f.contentText || f.extractedText || f.metadata?.preview || '';
    const rel = f.relativePath || '';
    const h = createHash('sha256');
    h.update(JSON.stringify({ name, rel, t: text.slice(0, 4000), b64l: (f.base64 || '').length }));
    const fileHash = h.digest('hex').slice(0, 48);

    if (fileHashesSeen.has(fileHash)) {
      processedFiles.push({
        name,
        type,
        hash: fileHash,
        status: 'duplicate',
        note: 'Ya absorbido (hash archivo)',
        detectedKind: detectFileKind(name, type),
      });
      continue;
    }
    fileHashesSeen.add(fileHash);

    const detectedKind = detectFileKind(name, type);
    const detectedCliente = detectClienteFromText(`${name} ${text}`);
    const detectedMonth = detectMonthFromText(text, monthHint, name);

    let status = 'ok';
    let note = null;
    if (!text && !f.base64 && detectedKind === 'pdf') {
      note = 'PDF sin texto extraído: pendiente OCR futuro o pegar texto.';
    }

    processedFiles.push({
      name,
      type,
      hash: fileHash,
      status,
      relativePath: rel,
      detectedKind,
      detectedCliente,
      detectedMonth,
      extractedPreview: text ? text.slice(0, 280) : null,
      note,
    });

    if (detectedKind === 'email_paste' || /asunto:|from:/i.test(text)) {
      const synthetic = {
        subject: name,
        bodyText: text.slice(0, 12000),
        fromEmail: 'historico@import.local',
        receivedAt: new Date().toISOString(),
        folder: folderName,
        source: 'folder_import',
        status: 'nuevo',
        extractedData: { fromHistoricalFolder: true, fileHash, relativePath: rel },
      };
      const ing = await ingestOutlookMessage(synthetic, {});
      if (ing.ok) correosFromFiles += 1;
    }
  }

  const importResult = {
    id: `HIST-${Date.now().toString(36)}`,
    folderName,
    monthHint,
    processedAt: new Date().toISOString(),
    files: processedFiles,
    documentosTecnicosCreados: 0,
    correosClasificadosFromFolder: correosFromFiles,
  };
  importResult.summary = buildHistoricalImportSummary(importResult);

  await outlookIntakeRepository.appendHistoricalImport(importResult);
  return { ok: true, import: importResult };
}

/** Siempre expuesto en API: recepción únicamente; sin envío ni hooks de salida. */
const OUTLOOK_READ_ONLY_HOOKS = {
  inboxSync: false,
  replyDraft: false,
  threadSync: false,
  sendMail: false,
  autoReply: false,
  outboundSync: false,
  note: 'MODO RECEPCIÓN — solo lectura, ingesta y clasificación. Sin envío, borradores de respuesta ni sincronización de salida.',
};

export async function listOutlookFeed() {
  const store = await outlookIntakeRepository.getAll();
  return {
    ...store,
    outlookIntakeMode: 'recepcion_solo_lectura',
    futureOutlookHooks: { ...OUTLOOK_READ_ONLY_HOOKS },
  };
}

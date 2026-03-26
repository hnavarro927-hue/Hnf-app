import { normalizeHistoricalRecord } from '../../domain/historical-vault-intelligence.js';
import { historicalVaultRepository } from './historicalVault.repository.js';

function normMonthFromText(text, name, monthHint) {
  const blob = `${text} ${name} ${monthHint || ''}`;
  if (/enero|2026-01|jan/i.test(blob)) return '2026-01';
  if (/febrero|2026-02|feb/i.test(blob)) return '2026-02';
  if (/marzo|2026-03|mar\b/i.test(blob)) return '2026-03';
  return monthHint && /^\d{4}-\d{2}$/.test(monthHint) ? monthHint : '';
}

function detectEntityTypes(name, type, text) {
  const low = `${name} ${type} ${text.slice(0, 200)}`.toLowerCase();
  const t = [];
  if (/\.pdf|pdf/i.test(low)) t.push('technical_document');
  if (/calendar|ics|visita|programa/i.test(low)) t.push('calendar_visit');
  if (/asunto:|from:|outlook|correo/i.test(low)) t.push('outlook_message');
  if (/oportunidad|cotiz/i.test(low)) t.push('commercial_opportunity');
  if (/\bOT[\s:-]*[A-Z0-9]/i.test(text)) t.push('ot');
  if (!t.length) t.push('monthly_import');
  return t;
}

export async function ingestHistoricalVaultBatch(payload) {
  const folderName = payload?.folderName || 'vault_import';
  const monthHint = payload?.monthHint || '';
  const filesIn = Array.isArray(payload?.files) ? payload.files : [];
  const batchId = `VAULT-${Date.now().toString(36)}`;

  const store = await historicalVaultRepository.getAll();
  const existingHashes = new Set(store.records.map((r) => r.hash).filter(Boolean));

  const fileResults = [];
  const newRecords = [];

  for (let i = 0; i < filesIn.length; i += 1) {
    const f = filesIn[i] || {};
    const name = f.name || `file-${i}`;
    const type = f.type || 'application/octet-stream';
    const text = f.contentText || f.extractedText || (f.metadata && f.metadata.preview) || '';
    const rel = f.relativePath || '';

    const pm = normMonthFromText(text, name, monthHint);
    const eventDate = pm ? `${pm}-15` : new Date().toISOString().slice(0, 10);
    const entityTypes = detectEntityTypes(name, type, text);
    let entityType = 'monthly_import';
    if (entityTypes.includes('technical_document')) entityType = 'technical_document';
    else if (entityTypes.includes('calendar_visit')) entityType = 'calendar_visit';
    else if (entityTypes.includes('outlook_message')) entityType = 'outlook_message';

    const raw = {
      entityType,
      sourceType: /\.pdf/i.test(name) ? 'pdf' : /ics/i.test(name) ? 'calendar' : 'text',
      sourceModule: 'historical_vault',
      sourceId: `${batchId}:${name}`,
      title: name,
      summary: text.slice(0, 280) || `Archivo histórico · ${folderName}`,
      detailedText: text.slice(0, 12000),
      eventDate,
      periodMonth: pm || String(eventDate).slice(0, 7),
      tags: ['import_batch', folderName.slice(0, 40)].filter(Boolean),
      attachments: [{ name, type, relativePath: rel }],
    };

    const rec = normalizeHistoricalRecord(raw, { batchId });
    if (existingHashes.has(rec.hash)) {
      fileResults.push({ name, type, status: 'duplicate', entityTypes });
      continue;
    }
    existingHashes.add(rec.hash);
    newRecords.push(rec);

    const plateM = text.match(/\b([A-Z]{2,4}\d{2,4})\b/i);
    fileResults.push({
      name,
      type,
      status: 'ok',
      entityTypes,
      detectedMonth: pm || null,
      detectedCliente: /\bpuma\b/i.test(text) ? 'Puma' : /\bnike\b/i.test(text) ? 'Nike' : null,
      detectedPlate: plateM ? plateM[1].toUpperCase() : null,
    });
  }

  const { added } = await historicalVaultRepository.appendRecords(newRecords);

  const summary = {
    version: '2026-03-23',
    totalFiles: filesIn.length,
    procesados: fileResults.filter((x) => x.status === 'ok').length,
    duplicados: fileResults.filter((x) => x.status === 'duplicate').length,
    errores: fileResults.filter((x) => x.status === 'error').length,
    technicalDocuments: fileResults.filter((x) => x.entityTypes?.includes('technical_document')).length,
    ots: fileResults.filter((x) => x.entityTypes?.includes('ot')).length,
    calendarEntries: fileResults.filter((x) => x.entityTypes?.includes('calendar_visit')).length,
    outlookMessages: fileResults.filter((x) => x.entityTypes?.includes('outlook_message')).length,
    opportunities: fileResults.filter((x) => x.entityTypes?.includes('commercial_opportunity')).length,
    unresolvedFiles: [],
    monthsDetected: [...new Set(fileResults.map((x) => x.detectedMonth).filter(Boolean))].sort(),
    clientsDetected: new Set(fileResults.map((x) => x.detectedCliente).filter(Boolean)).size,
    assetsDetected: new Set(fileResults.map((x) => x.detectedPlate).filter(Boolean)).size,
    suggestions: [],
    recordsCreated: added,
  };

  const batchEntry = {
    id: batchId,
    folderName,
    monthHint,
    processedAt: new Date().toISOString(),
    files: fileResults,
    summary,
  };
  await historicalVaultRepository.appendBatch(batchEntry);

  return { ok: true, batch: batchEntry, recordsCreated: added };
}

export async function getHistoricalVaultState() {
  return historicalVaultRepository.getAll();
}

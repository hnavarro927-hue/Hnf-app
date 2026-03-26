/**
 * Backend mirror: normalización y hash (misma semántica que frontend).
 */

export const HISTORICAL_VAULT_VERSION = '2026-03-23';

export function recordContentHash(partial) {
  const key = JSON.stringify({
    t: partial.title,
    c: partial.client,
    b: partial.branch,
    d: partial.eventDate,
    e: partial.entityType,
    s: (partial.detailedText || partial.summary || '').slice(0, 600),
  });
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return `hv-${Math.abs(h).toString(16)}-${key.length}`;
}

export function normalizeHistoricalRecord(raw, context = {}) {
  const r = raw || {};
  const now = new Date().toISOString();
  const text = `${r.title || ''} ${r.summary || ''} ${r.detailedText || ''}`;
  const eventDate = r.eventDate || r.date || r.fecha || now.slice(0, 10);
  const y = String(eventDate).slice(0, 4);
  const m = String(eventDate).slice(5, 7);
  const periodMonth = r.periodMonth || (m ? `${y}-${m}` : '');
  const periodYear = r.periodYear || (y ? Number(y) : new Date().getFullYear());

  let client = r.client || r.cliente || null;
  if (!client && /\b(puma|nike|falabella|cencosud|walmart|adidas)\b/i.test(text)) {
    const mm = text.match(/\b(puma|nike|falabella|cencosud|walmart|adidas)\b/i);
    client = mm ? mm[1].replace(/^\w/, (c) => c.toUpperCase()) : null;
  }

  const plateM = text.match(/\b([A-Z]{2,4}\d{2,4})\b/i);
  const plate = r.plate || (plateM ? plateM[1].toUpperCase() : '');

  const otM = text.match(/\b(OT|O\.T\.)[\s:-]*([A-Z0-9][A-Z0-9-]{4,})\b/i);
  const otId = r.otId || (otM ? otM[2].toUpperCase() : '');

  const rec = {
    id: r.id || `HV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    entityType: r.entityType || 'manual_note',
    sourceType: r.sourceType || 'manual',
    sourceModule: r.sourceModule || 'historical_vault',
    sourceId: r.sourceId || '',
    client,
    clientId: r.clientId ?? null,
    branch: r.branch || r.tienda || r.sucursal || '',
    storeType: r.storeType ?? null,
    zone: r.zone ?? null,
    region: r.region ?? null,
    city: r.city || '',
    otId: otId || null,
    technicalDocumentId: r.technicalDocumentId ?? null,
    outlookMessageId: r.outlookMessageId ?? null,
    calendarEntryId: r.calendarEntryId ?? null,
    commercialOpportunityIds: Array.isArray(r.commercialOpportunityIds) ? r.commercialOpportunityIds : [],
    assetType: r.assetType || (plate ? 'vehicle' : 'hvac_unit'),
    assetName: r.assetName || '',
    assetCode: r.assetCode || '',
    plate: plate || null,
    vehicleType: r.vehicleType ?? null,
    equipmentType: r.equipmentType || '',
    equipmentCount: r.equipmentCount ?? null,
    technicians: Array.isArray(r.technicians) ? r.technicians : [],
    internalOwners: Array.isArray(r.internalOwners) ? r.internalOwners : [],
    eventDate: String(eventDate).slice(0, 10),
    periodMonth,
    periodYear,
    title: r.title || '(sin título)',
    summary: r.summary || text.slice(0, 240) || '',
    detailedText: r.detailedText || '',
    findings: Array.isArray(r.findings) ? r.findings : [],
    recommendations: Array.isArray(r.recommendations) ? r.recommendations : [],
    risks: Array.isArray(r.risks) ? r.risks : [],
    metrics: r.metrics && typeof r.metrics === 'object' ? r.metrics : {},
    tags: Array.isArray(r.tags) ? r.tags : [],
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    timelineRefs: Array.isArray(r.timelineRefs) ? r.timelineRefs : [],
    hash: r.hash || '',
    createdAt: r.createdAt || now,
    updatedAt: r.updatedAt || now,
    auditTrail: Array.isArray(r.auditTrail) ? r.auditTrail : [],
  };
  if (!rec.hash) rec.hash = recordContentHash(rec);
  if (context.batchId) {
    rec.auditTrail = [...rec.auditTrail, { at: now, action: 'ingested', batchId: context.batchId }];
  }
  return rec;
}

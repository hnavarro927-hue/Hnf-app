/**
 * HNF Jarvis Historical Vault — memoria histórica unificada, timeline, búsqueda y patrones.
 * Sin motor pesado: heurísticas y agregaciones sobre registros normalizados.
 */

export const HISTORICAL_VAULT_VERSION = '2026-03-23';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const pad2 = (n) => String(n).padStart(2, '0');

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

/**
 * @param {object} raw
 * @param {object} [context]
 */
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

  const plateM = text.match(/\b([A-Z]{2,4}\d{2,4})\b/i) || text.match(/\b([A-Z]{2}\s?\d{3}\s?[A-Z]{2})\b/i);
  const plate = r.plate || (plateM ? plateM[1].replace(/\s/g, '').toUpperCase() : '');

  const otM = text.match(/\b(OT|O\.T\.)[\s:-]*([A-Z0-9][A-Z0-9-]{4,})\b/i);
  const otId = r.otId || (otM ? otM[2].toUpperCase() : '');

  const rec = {
    id: r.id || `HV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    entityType: r.entityType || 'manual_note',
    sourceType: r.sourceType || 'manual',
    sourceModule: r.sourceModule || 'historical_vault',
    sourceId: r.sourceId || r.id || '',
    client,
    clientId: r.clientId ?? null,
    branch: r.branch || r.tienda || r.sucursal || '',
    storeType: r.storeType ?? null,
    zone: r.zone ?? null,
    region: r.region ?? null,
    city: r.city || r.ciudad || '',
    otId: otId || null,
    technicalDocumentId: r.technicalDocumentId ?? null,
    outlookMessageId: r.outlookMessageId ?? null,
    calendarEntryId: r.calendarEntryId ?? null,
    commercialOpportunityIds: Array.isArray(r.commercialOpportunityIds) ? r.commercialOpportunityIds : [],
    assetType: r.assetType || (plate ? 'vehicle' : r.assetType) || 'hvac_unit',
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
    detailedText: r.detailedText || r.bodyText || '',
    findings: Array.isArray(r.findings) ? r.findings : extractFindings(text),
    recommendations: Array.isArray(r.recommendations) ? r.recommendations : [],
    risks: Array.isArray(r.risks) ? r.risks : extractRisks(text),
    metrics: r.metrics && typeof r.metrics === 'object' ? r.metrics : {},
    tags: Array.isArray(r.tags) ? [...new Set(r.tags)] : [],
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    timelineRefs: Array.isArray(r.timelineRefs) ? r.timelineRefs : [],
    hash: r.hash || '',
    createdAt: r.createdAt || now,
    updatedAt: r.updatedAt || now,
    auditTrail: Array.isArray(r.auditTrail) ? r.auditTrail : [],
  };
  if (!rec.hash) rec.hash = recordContentHash(rec);
  if (context.batchId) {
    rec.auditTrail = [...rec.auditTrail, { at: now, action: 'normalized', batchId: context.batchId }];
  }
  return rec;
}

function extractFindings(text) {
  const t = String(text);
  const out = [];
  const rx = /\b(filtraci[oó]n|fuga|refrigerante|pérdida|presi[oó]n baja|v[aá]lvula|compresor)\b/gi;
  let m;
  const seen = new Set();
  while ((m = rx.exec(t)) !== null) {
    const k = norm(m[0]);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m[0]);
    if (out.length >= 8) break;
  }
  return out;
}

function extractRisks(text) {
  const t = norm(text);
  const r = [];
  if (t.includes('critico') || t.includes('crítico') || t.includes('urgente')) r.push('severidad_elevada');
  if (t.includes('filtra') || t.includes('fuga')) r.push('fuga_riesgo');
  if (t.includes('garantia') || t.includes('garantía')) r.push('garantia');
  return r;
}

export function buildHistoricalTimeline(records, filters = {}) {
  let list = Array.isArray(records) ? [...records] : [];
  if (filters.client) {
    const nc = norm(filters.client);
    list = list.filter((r) => norm(r.client).includes(nc) || nc.includes(norm(r.client)));
  }
  if (filters.branch) {
    const nb = norm(filters.branch);
    list = list.filter((r) => norm(r.branch).includes(nb));
  }
  if (filters.plate) {
    const p = String(filters.plate).replace(/\s/g, '').toUpperCase();
    list = list.filter((r) => String(r.plate || '').replace(/\s/g, '').toUpperCase().includes(p));
  }
  if (filters.technician) {
    const nt = norm(filters.technician);
    list = list.filter((r) => (r.technicians || []).some((x) => norm(x).includes(nt)));
  }
  if (filters.month) {
    const pm = filters.month;
    list = list.filter((r) => r.periodMonth === pm || String(r.eventDate).slice(0, 7) === pm);
  }
  if (filters.entityType) {
    list = list.filter((r) => r.entityType === filters.entityType);
  }
  list.sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  return { version: HISTORICAL_VAULT_VERSION, count: list.length, events: list };
}

export function groupHistoricalByClient(records) {
  const m = new Map();
  for (const r of records || []) {
    const k = String(r.client || '—').trim() || '—';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return Object.fromEntries(m);
}

export function groupHistoricalByStore(records) {
  const m = new Map();
  for (const r of records || []) {
    const k = `${r.client || '—'}|${r.branch || '—'}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return Object.fromEntries(m);
}

export function groupHistoricalByAsset(records) {
  const m = new Map();
  for (const r of records || []) {
    const k = r.plate || r.assetCode || r.assetName || `${r.client}|equipo`;
    const key = String(k).trim() || '—';
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(r);
  }
  return Object.fromEntries(m);
}

export function groupHistoricalByTechnician(records) {
  const m = new Map();
  for (const r of records || []) {
    const techs = r.technicians?.length ? r.technicians : ['—'];
    for (const t of techs) {
      if (!m.has(t)) m.set(t, []);
      m.get(t).push(r);
    }
  }
  return Object.fromEntries(m);
}

export function groupHistoricalByMonth(records) {
  const m = new Map();
  for (const r of records || []) {
    const k = r.periodMonth || String(r.eventDate).slice(0, 7) || '—';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return Object.fromEntries(m);
}

export function detectHistoricalPatterns(records) {
  const list = Array.isArray(records) ? records : [];
  const patterns = [];

  const byClient = groupHistoricalByClient(list);
  for (const [cli, arr] of Object.entries(byClient)) {
    if (cli === '—' || arr.length < 3) continue;
    const findings = arr.flatMap((r) => r.findings || []);
    const fc = {};
    for (const f of findings) {
      const n = norm(f);
      fc[n] = (fc[n] || 0) + 1;
    }
    const top = Object.entries(fc).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) {
      patterns.push({
        code: 'HV_FALLA_REPETIDA_CLIENTE',
        severity: 'warning',
        title: `Hallazgos repetidos en ${cli}`,
        detail: `${top[0]} · ${top[1]} menciones en ${arr.length} registro(s).`,
        client: cli,
      });
    }
    if (arr.length >= 5) {
      patterns.push({
        code: 'HV_ALTO_VOLUMEN_INCIDENCIAS',
        severity: 'info',
        title: `Cliente con alto volumen histórico`,
        detail: `${cli}: ${arr.length} evento(s) en vault.`,
        client: cli,
      });
    }
  }

  const byStore = groupHistoricalByStore(list);
  for (const [key, arr] of Object.entries(byStore)) {
    if (arr.length < 3) continue;
    const obs = arr.filter((r) => /observad|revisi[oó]n|pendiente/i.test(`${r.title} ${r.summary}`));
    if (obs.length >= 2) {
      patterns.push({
        code: 'HV_TIENDA_OBS_REITERADA',
        severity: 'warning',
        title: 'Sucursal con observaciones reiteradas',
        detail: `${key.replace('|', ' · ')} · ${obs.length} registro(s) con contexto observación/pendiente.`,
      });
    }
  }

  const perm = list.filter((r) => /permiso|mall|demora/i.test(`${r.title} ${r.summary} ${r.detailedText}`));
  if (perm.length >= 3) {
    patterns.push({
      code: 'HV_PERMISO_RECURRENTE',
      severity: 'info',
      title: 'Patrón permisos / coordinación',
      detail: `${perm.length} evento(s) históricos ligados a permisos o demoras.`,
    });
  }

  const opLat = list.filter((r) => r.entityType === 'commercial_opportunity' || (r.tags || []).includes('oportunidad'));
  if (opLat.length >= 2) {
    patterns.push({
      code: 'HV_OPORTUNIDAD_HISTORICA',
      severity: 'info',
      title: 'Oportunidades comerciales en archivo histórico',
      detail: `${opLat.length} registro(s); validar acción en módulo comercial.`,
    });
  }

  const sinOt = list.filter((r) => r.entityType === 'technical_document' && !r.otId);
  if (sinOt.length >= 2) {
    patterns.push({
      code: 'HV_DOC_SIN_OT',
      severity: 'info',
      title: 'Informes históricos sin OT vinculada',
      detail: `${sinOt.length} registro(s) documentales sin otId.`,
    });
  }

  return { version: HISTORICAL_VAULT_VERSION, patterns };
}

export function searchHistoricalVault(query, context = {}) {
  const records = Array.isArray(context.records) ? context.records : [];
  const q = norm(query);
  if (!q.trim()) {
    return { version: HISTORICAL_VAULT_VERSION, query, matches: [] };
  }
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);

  const scored = [];
  for (const r of records) {
    const blob = norm(
      `${r.title} ${r.summary} ${r.detailedText} ${r.client} ${r.branch} ${r.otId} ${r.plate} ${(r.findings || []).join(' ')} ${(r.technicians || []).join(' ')}`
    );
    let score = 0;
    if (blob.includes(q)) score += 12;
    for (const t of tokens) {
      if (blob.includes(t)) score += 4;
    }
    if (r.plate && q.includes(norm(r.plate))) score += 15;
    if (r.otId && q.includes(norm(r.otId))) score += 15;
    if (score > 0) {
      scored.push({
        record: r,
        score,
        nav: buildNavForRecord(r),
        snippet: (r.summary || r.title || '').slice(0, 120),
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return {
    version: HISTORICAL_VAULT_VERSION,
    query,
    matches: scored.slice(0, 40),
  };
}

function buildNavForRecord(r) {
  if (r.otId) return { view: 'clima', otId: r.otId };
  if (r.technicalDocumentId) return { view: 'technical-documents' };
  if (r.commercialOpportunityIds?.length) return { view: 'oportunidades' };
  if (r.outlookMessageId) return { view: 'jarvis-intake' };
  if (r.entityType === 'calendar_visit') return { view: 'planificacion' };
  return { view: 'jarvis-vault' };
}

export function buildHistoricalVaultImportSummary(result) {
  const files = Array.isArray(result?.files) ? result.files : [];
  let procesados = 0;
  let duplicados = 0;
  let errores = 0;
  let technicalDocuments = 0;
  let ots = 0;
  let calendarEntries = 0;
  let outlookMessages = 0;
  let opportunities = 0;
  const months = new Set();
  const clients = new Set();
  const assets = new Set();
  const unresolvedFiles = [];
  const suggestions = [];

  for (const f of files) {
    if (f.status === 'duplicate') duplicados += 1;
    else if (f.status === 'error') {
      errores += 1;
      unresolvedFiles.push(f.name || '—');
    } else procesados += 1;
    if (f.entityTypes) {
      if (f.entityTypes.includes('technical_document')) technicalDocuments += 1;
      if (f.entityTypes.includes('ot')) ots += 1;
      if (f.entityTypes.includes('calendar_visit')) calendarEntries += 1;
      if (f.entityTypes.includes('outlook_message')) outlookMessages += 1;
      if (f.entityTypes.includes('commercial_opportunity')) opportunities += 1;
    }
    if (f.detectedMonth) months.add(f.detectedMonth);
    if (f.detectedCliente) clients.add(f.detectedCliente);
    if (f.detectedPlate) assets.add(f.detectedPlate);
  }
  if (result?.recordsCreated) {
    /* recuento alterno */
  }
  if (errores) suggestions.push('Revisar archivos con error; puede faltar texto extraído.');
  if (!procesados && !duplicados) suggestions.push('Nada nuevo procesado.');

  return {
    version: HISTORICAL_VAULT_VERSION,
    totalFiles: files.length,
    procesados,
    duplicados,
    errores,
    technicalDocuments,
    ots,
    calendarEntries,
    outlookMessages,
    opportunities,
    unresolvedFiles: unresolvedFiles.slice(0, 30),
    monthsDetected: [...months].sort(),
    clientsDetected: clients.size,
    assetsDetected: assets.size,
    suggestions,
    recordsCreated: result?.recordsCreated ?? 0,
  };
}

export function computeAssetHistoricalSummary(records) {
  const byPlate = groupHistoricalByAsset(records.filter((r) => r.plate));
  const top = Object.entries(byPlate)
    .filter(([k]) => k && k !== '—')
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([assetKey, arr]) => ({
      assetKey,
      eventCount: arr.length,
      lastEvent: arr.sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)))[0]?.eventDate,
      clients: [...new Set(arr.map((x) => x.client).filter(Boolean))].slice(0, 4),
    }));
  return { version: HISTORICAL_VAULT_VERSION, topAssets: top };
}

export function computeAssetRiskSignals(records) {
  const signals = [];
  const byAsset = groupHistoricalByAsset(records);
  for (const [key, arr] of Object.entries(byAsset)) {
    if (key === '—' || arr.length < 2) continue;
    const riskCount = arr.reduce((n, r) => n + (r.risks?.length || 0), 0);
    if (riskCount >= 3) {
      signals.push({ asset: key, level: 'alto', text: `${key}: ${riskCount} marca(s) de riesgo acumuladas en ${arr.length} evento(s).` });
    }
  }
  return { version: HISTORICAL_VAULT_VERSION, signals: signals.slice(0, 15) };
}

export function computeAssetOpportunitySignals(records) {
  const signals = [];
  const byClient = groupHistoricalByClient(records);
  for (const [cli, arr] of Object.entries(byClient)) {
    if (cli === '—') continue;
    const n = arr.filter((r) => (r.tags || []).includes('oportunidad') || r.entityType === 'commercial_opportunity').length;
    if (n >= 1) signals.push({ client: cli, text: `${n} referencia(s) comercial(es) en vault para ${cli}.` });
  }
  return { version: HISTORICAL_VAULT_VERSION, signals: signals.slice(0, 20) };
}

export function computeHistoricalExecutiveAlerts(vaultState) {
  const records = vaultState?.records || [];
  const alerts = [];
  const { patterns } = detectHistoricalPatterns(records);
  for (const p of patterns) {
    if (p.severity === 'warning' || p.code === 'HV_ALTO_VOLUMEN_INCIDENCIAS') {
      alerts.push({
        code: p.code,
        severity: p.severity === 'warning' ? 'warning' : 'info',
        title: p.title,
        detail: p.detail,
        nav: { view: 'jarvis-vault' },
      });
    }
  }

  const months = groupHistoricalByMonth(records);
  const now = new Date();
  const last3 = [];
  for (let i = 0; i < 3; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last3.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }
  const emptyMonths = last3.filter((pm) => !months[pm] || months[pm].length === 0);
  if (emptyMonths.length >= 2) {
    alerts.push({
      code: 'HV_MESES_SIN_CARGA',
      severity: 'info',
      title: 'Meses recientes con poca o nula carga en Historical Vault',
      detail: `Sin eventos o muy pocos en: ${emptyMonths.join(', ')}.`,
      nav: { view: 'jarvis-vault' },
    });
  }

  const sinRel = records.filter((r) => !r.otId && !r.technicalDocumentId && r.entityType === 'monthly_import');
  if (sinRel.length >= 3) {
    alerts.push({
      code: 'HV_IMPORT_SIN_RELACIONAR',
      severity: 'info',
      title: 'Lotes importados con pocos vínculos a OT/documento',
      detail: 'Conviene enriquecer metadatos al absorber.',
      nav: { view: 'jarvis-vault' },
    });
  }

  return { version: HISTORICAL_VAULT_VERSION, alerts };
}

export function buildHistoricalVaultSummary(records, importBatches = []) {
  const list = Array.isArray(records) ? records : [];
  const clients = new Set(list.map((r) => r.client).filter(Boolean));
  const critical = list.filter((r) => (r.risks || []).includes('severidad_elevada') || (r.tags || []).includes('critico'));
  const opps = list.filter((r) => r.entityType === 'commercial_opportunity' || (r.tags || []).includes('oportunidad'));
  const plates = new Set(list.map((r) => r.plate).filter(Boolean));
  const lastBatch = importBatches.length ? importBatches[importBatches.length - 1] : null;

  return {
    version: HISTORICAL_VAULT_VERSION,
    totalRecords: list.length,
    uniqueClients: clients.size,
    uniqueAssetsTracked: plates.size + list.filter((r) => r.assetCode).length,
    criticalEvents: critical.length,
    opportunityRefs: opps.length,
    lastImportAt: lastBatch?.processedAt || null,
    lastBatchName: lastBatch?.folderName || null,
  };
}

/** Índice liviano para Jarvis (tokens por registro, sin índice invertido pesado). */
export function buildHistoricalSearchIndex(records, maxEntries = 400) {
  const list = (Array.isArray(records) ? records : []).slice(-maxEntries);
  return list.map((r) => ({
    id: r.id,
    t: norm(`${r.title} ${r.client} ${r.branch} ${r.otId} ${r.plate}`).slice(0, 200),
  }));
}

export function buildMonthArchiveStatus(records) {
  const byM = groupHistoricalByMonth(records);
  const out = {};
  for (const [k, arr] of Object.entries(byM)) {
    out[k] = { count: arr.length, entityTypes: [...new Set(arr.map((r) => r.entityType))].slice(0, 8) };
  }
  return out;
}

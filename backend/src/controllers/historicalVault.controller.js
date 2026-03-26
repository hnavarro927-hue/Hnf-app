import { sendSuccess } from '../utils/http.js';
import {
  getHistoricalVaultState,
  ingestHistoricalVaultBatch,
} from '../modules/historicalVault/historicalVault.service.js';
import {
  buildHistoricalTimeline,
  buildHistoricalVaultSummary,
  computeAssetHistoricalSummary,
  computeHistoricalExecutiveAlerts,
  detectHistoricalPatterns,
  searchHistoricalVault,
} from '../../../frontend/domain/historical-vault-intelligence.js';

export const getHistoricalVault = async (_request, response) => {
  const store = await getHistoricalVaultState();
  const records = store.records || [];
  const summary = buildHistoricalVaultSummary(records, store.importBatches || []);
  const patterns = detectHistoricalPatterns(records);
  const alerts = computeHistoricalExecutiveAlerts({ records });
  const searchIndex = { note: 'use POST /historical-vault/search', approxSize: records.length };
  const monthArchive = Object.fromEntries(
    Object.entries(
      records.reduce((acc, r) => {
        const k = r.periodMonth || String(r.eventDate).slice(0, 7) || '—';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {})
    ).map(([k, count]) => [k, { count, filled: count > 0 }])
  );

  sendSuccess(
    response,
    200,
    {
      ...store,
      computed: {
        summary,
        patterns: patterns.patterns,
        historicalAlerts: alerts.alerts,
        historicalSearchIndex: searchIndex,
        monthArchiveStatus: monthArchive,
      },
    },
    { resource: 'historical_vault' }
  );
};

export const postHistoricalVaultIngest = async (request, response) => {
  const body = request.body || {};
  const out = await ingestHistoricalVaultBatch(body.payload || body);
  sendSuccess(response, 200, out, { resource: 'historical_vault_ingest' });
};

export const postHistoricalVaultSearch = async (request, response) => {
  const store = await getHistoricalVaultState();
  const body = request.body || {};
  const q = body.query || body.q || '';
  const result = searchHistoricalVault(q, { records: store.records || [] });
  sendSuccess(response, 200, result, { resource: 'historical_vault_search' });
};

export const getHistoricalVaultTimeline = async (request, response) => {
  const store = await getHistoricalVaultState();
  const url = new URL(request.url || '', 'http://localhost');
  const filters = {
    client: url.searchParams.get('client') || '',
    branch: url.searchParams.get('branch') || '',
    plate: url.searchParams.get('plate') || '',
    technician: url.searchParams.get('technician') || '',
    month: url.searchParams.get('month') || '',
    entityType: url.searchParams.get('entityType') || '',
  };
  const tl = buildHistoricalTimeline(store.records || [], filters);
  sendSuccess(response, 200, tl, { resource: 'historical_vault_timeline' });
};

export const getHistoricalVaultPatterns = async (_request, response) => {
  const store = await getHistoricalVaultState();
  const out = detectHistoricalPatterns(store.records || []);
  sendSuccess(response, 200, out, { resource: 'historical_vault_patterns' });
};

export const getHistoricalVaultAssets = async (_request, response) => {
  const store = await getHistoricalVaultState();
  const summary = computeAssetHistoricalSummary(store.records || []);
  sendSuccess(response, 200, summary, { resource: 'historical_vault_assets' });
};

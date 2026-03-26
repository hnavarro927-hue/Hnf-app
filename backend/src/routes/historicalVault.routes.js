import {
  getHistoricalVault,
  getHistoricalVaultAssets,
  getHistoricalVaultPatterns,
  getHistoricalVaultTimeline,
  postHistoricalVaultIngest,
  postHistoricalVaultSearch,
} from '../controllers/historicalVault.controller.js';

export const historicalVaultRoutes = [
  { method: 'GET', path: '/historical-vault', handler: getHistoricalVault },
  { method: 'POST', path: '/historical-vault/ingest', handler: postHistoricalVaultIngest },
  { method: 'POST', path: '/historical-vault/search', handler: postHistoricalVaultSearch },
  { method: 'GET', path: '/historical-vault/timeline', handler: getHistoricalVaultTimeline },
  { method: 'GET', path: '/historical-vault/patterns', handler: getHistoricalVaultPatterns },
  { method: 'GET', path: '/historical-vault/assets', handler: getHistoricalVaultAssets },
];

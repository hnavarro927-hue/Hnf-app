import {
  buildHistoricalTimeline,
  computeAssetHistoricalSummary,
  computeAssetOpportunitySignals,
  computeAssetRiskSignals,
  searchHistoricalVault,
} from '../domain/historical-vault-intelligence.js';
import { historicalVaultService } from '../services/historical-vault.service.js';
import {
  JarvisAssetPanel,
  JarvisHeroPanel,
  JarvisHudRing,
  JarvisMonthArchivePanel,
  JarvisPatternRadar,
  JarvisSearchCommand,
  JarvisSignalCard,
  JarvisTimelineBoard,
} from '../components/jarvis-vault/ui.js';
import { getHistoricalVaultMemorySummary, rememberHistoricalVaultImport } from '../domain/jarvis-memory.js';

const fmtAt = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
};

export const jarvisVaultView = ({
  data,
  integrationStatus,
  reloadApp,
  intelNavigate,
} = {}) => {
  const root = document.createElement('section');
  root.className = 'jv-vault';

  const header = document.createElement('header');
  header.className = 'jv-vault__header';
  const ringWrap = document.createElement('div');
  ringWrap.className = 'jv-vault__ring';
  const records = data?.historicalVault?.records || [];
  const fillPct = records.length ? Math.min(100, 35 + Math.min(records.length, 200) / 4) : 12;
  ringWrap.append(JarvisHudRing({ pct: fillPct, label: 'Archive' }));
  const headText = document.createElement('div');
  headText.className = 'jv-vault__headtext';
  headText.innerHTML = `
    <p class="jv-vault__kicker">JARVIS · HISTORICAL VAULT</p>
    <h1 class="jv-vault__title">Archive Command</h1>
    <p class="muted jv-vault__lead">Memoria histórica operativa: timeline, patrones, activos y absorción de lotes. Sin ruido visual — lectura clara en notebook e iPad.</p>
  `;
  header.append(ringWrap, headText);
  root.append(header);

  if (integrationStatus === 'sin conexión') {
    const off = document.createElement('div');
    off.className = 'integration-banner integration-banner--offline';
    off.textContent = 'Sin conexión: el vault requiere API /historical-vault.';
    root.append(off);
    return root;
  }

  const comp = data?.historicalVault?.computed || {};
  const summary = comp.summary || {};
  const patterns = comp.patterns || [];
  const monthStatus = comp.monthArchiveStatus || {};
  const assetSummary = computeAssetHistoricalSummary(records);
  const riskSig = computeAssetRiskSignals(records);
  const oppSig = computeAssetOpportunitySignals(records);

  const subtitle = `Última carga: ${fmtAt(summary.lastImportAt)} · Lote: ${summary.lastBatchName || '—'}`;
  root.append(JarvisHeroPanel({ summary, subtitle }));

  const layout = document.createElement('div');
  layout.className = 'jv-vault__layout';

  const main = document.createElement('div');
  main.className = 'jv-vault__main';

  const searchWrap = document.createElement('div');
  searchWrap.className = 'jv-panel jv-panel--search';
  const hSearch = document.createElement('h3');
  hSearch.className = 'jv-panel__title';
  hSearch.textContent = 'Buscador operativo';
  const resultsHost = document.createElement('div');
  resultsHost.className = 'jv-results';

  const navForRecord = (r) => {
    if (!r) return { view: 'jarvis-vault' };
    if (r.otId) return { view: 'clima', otId: r.otId };
    if (r.technicalDocumentId) return { view: 'technical-documents' };
    if (r.commercialOpportunityIds?.length) return { view: 'oportunidades' };
    if (r.outlookMessageId) return { view: 'jarvis-intake' };
    if (r.entityType === 'calendar_visit') return { view: 'planificacion' };
    return { view: 'jarvis-vault' };
  };

  const runSearch = async (q) => {
    resultsHost.innerHTML = '';
    if (!q) return;
    let matches = [];
    try {
      const api = await historicalVaultService.search(q);
      matches = api.matches || [];
    } catch {
      const local = searchHistoricalVault(q, { records });
      matches = local.matches || [];
    }
    if (!matches.length) {
      resultsHost.innerHTML = '<p class="muted">Sin coincidencias en este corte.</p>';
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'jv-results__grid';
    for (const m of matches.slice(0, 12)) {
      const r = m.record || m;
      const nav = m.nav || navForRecord(r);
      const card = document.createElement('div');
      card.className = 'jv-entity-card';
      card.innerHTML = `
        <p class="jv-entity-card__type">${r.entityType} · score ${m.score ?? '—'}</p>
        <strong>${r.title || '—'}</strong>
        <p class="muted small">${r.eventDate || '—'} · ${r.client || '—'} · ${r.branch || ''}</p>
        <p>${(m.snippet || r.summary || '').slice(0, 140)}</p>`;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'primary-button small';
      b.textContent = 'Navegar';
      b.addEventListener('click', () => intelNavigate?.(nav));
      card.append(b);
      grid.append(card);
    }
    resultsHost.append(grid);
  };

  const suggestions = [
    'Puma Bio Bio filtraciones',
    'Puerto Montt marzo',
    'SSKY85',
    'tiendas con fuga refrigerante',
    'enero puma sur',
  ];
  searchWrap.append(hSearch, JarvisSearchCommand({ onSearch: runSearch, suggestions }), resultsHost);

  const tl = buildHistoricalTimeline(records, {});
  const freshBoard = JarvisTimelineBoard({
    title: 'Línea de tiempo reciente',
    events: tl.events,
    onNavigate: (ev) => intelNavigate?.(navForRecord(ev)),
  });

  main.append(searchWrap, freshBoard);

  const side = document.createElement('aside');
  side.className = 'jv-vault__side';
  side.append(
    JarvisPatternRadar({ patterns }),
    JarvisAssetPanel({ assetSummary }),
    JarvisMonthArchivePanel({ monthStatus })
  );

  const signals = document.createElement('section');
  signals.className = 'jv-panel';
  signals.innerHTML = '<h3 class="jv-panel__title">Señales por activo</h3>';
  const sigGrid = document.createElement('div');
  sigGrid.className = 'jv-signal-grid';
  for (const s of (riskSig.signals || []).slice(0, 4)) {
    sigGrid.append(JarvisSignalCard({ title: 'Riesgo', lines: [s.text] }));
  }
  for (const s of (oppSig.signals || []).slice(0, 3)) {
    sigGrid.append(JarvisSignalCard({ title: 'Oportunidad', lines: [s.text] }));
  }
  if (!sigGrid.childElementCount) {
    sigGrid.innerHTML = '<p class="muted">Sin señales fuertes en este archivo.</p>';
  }
  signals.append(sigGrid);
  side.append(signals);

  const cross = document.createElement('section');
  cross.className = 'jv-panel jv-cross';
  const docs = data?.technicalDocuments || [];
  const ots = data?.planOts || data?.ots?.data || [];
  const opps = data?.commercialOpportunities || [];
  const ofeed = data?.outlookFeed || {};
  cross.innerHTML = `<h3 class="jv-panel__title">Cruce ejecutivo (operación viva)</h3>`;
  const ul = document.createElement('ul');
  ul.className = 'jv-cross__list muted';
  ul.innerHTML = `
    <li>Documentos técnicos en sistema: <strong>${docs.length}</strong></li>
    <li>OT plan / clima (corte): <strong>${Array.isArray(ots) ? ots.length : 0}</strong></li>
    <li>Oportunidades cargadas: <strong>${opps.length}</strong></li>
    <li>Correos en intake: <strong>${(ofeed.messages || []).length}</strong></li>
    <li>Vault histórico: <strong>${records.length}</strong> registro(s) persistido(s)</li>
  `;
  cross.append(ul);
  side.append(cross);

  const mem = getHistoricalVaultMemorySummary();
  if (mem.importsRecientes?.length) {
    const memEl = document.createElement('div');
    memEl.className = 'jv-panel muted small';
    memEl.innerHTML = `<strong>Memoria Jarvis (vault)</strong><p>${mem.importsRecientes.length} ingestas recientes recordadas.</p>`;
    side.append(memEl);
  }

  layout.append(main, side);
  root.append(layout);

  const ingest = document.createElement('section');
  ingest.className = 'jv-panel jv-ingest';
  ingest.innerHTML = `
    <h3 class="jv-panel__title">Cargar históricos (Hernán / Lyn)</h3>
    <p class="muted small">Pegá un JSON de lote: <code>folderName</code>, <code>monthHint</code> (ej. 2026-01), <code>files[]</code> con <code>name</code>, <code>type</code>, <code>contentText</code> o <code>extractedText</code>. El servidor deduplica por hash.</p>
  `;
  const ta = document.createElement('textarea');
  ta.className = 'jv-ingest__ta';
  ta.rows = 6;
  ta.placeholder = '{"folderName":"Enero Puma Sur","monthHint":"2026-01","files":[{"name":"informe.pdf","type":"application/pdf","contentText":"..."}]}';
  const ingestRow = document.createElement('div');
  ingestRow.className = 'jv-ingest__row';
  const btnIngest = document.createElement('button');
  btnIngest.type = 'button';
  btnIngest.className = 'primary-button';
  btnIngest.textContent = 'Absorber lote';
  const ingestOut = document.createElement('pre');
  ingestOut.className = 'jv-ingest__out muted small';
  btnIngest.addEventListener('click', async () => {
    ingestOut.textContent = '';
    let payload;
    try {
      payload = JSON.parse(ta.value || '{}');
    } catch (e) {
      ingestOut.textContent = `JSON inválido: ${e.message}`;
      return;
    }
    btnIngest.disabled = true;
    try {
      const res = await historicalVaultService.ingestBatch(payload);
      const sum = res.batch?.summary || res.summary || {};
      ingestOut.textContent = JSON.stringify(sum, null, 2);
      rememberHistoricalVaultImport({
        folderName: payload.folderName,
        summary: sum,
        batchId: res.batch?.id,
      });
      await reloadApp?.();
    } catch (e) {
      ingestOut.textContent = e.message || 'Error en ingestión';
    } finally {
      btnIngest.disabled = false;
    }
  });
  ingestRow.append(btnIngest);
  ingest.append(ta, ingestRow, ingestOut);
  root.append(ingest);

  return root;
};

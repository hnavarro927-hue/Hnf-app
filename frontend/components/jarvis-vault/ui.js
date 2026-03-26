/**
 * Componentes livianos Historical Vault — DOM nativo, táctil, sin animaciones pesadas.
 */

export function JarvisHeroPanel({ summary, subtitle }) {
  const el = document.createElement('div');
  el.className = 'jv-hero';
  const s = summary || {};
  el.innerHTML = `
    <div class="jv-hero__grid">
      <div class="jv-hero__stat"><span class="jv-hero__n">${s.totalRecords ?? 0}</span><span class="jv-hero__l">Registros</span></div>
      <div class="jv-hero__stat"><span class="jv-hero__n">${s.uniqueClients ?? 0}</span><span class="jv-hero__l">Clientes</span></div>
      <div class="jv-hero__stat"><span class="jv-hero__n">${s.uniqueAssetsTracked ?? 0}</span><span class="jv-hero__l">Activos</span></div>
      <div class="jv-hero__stat jv-hero__stat--amber"><span class="jv-hero__n">${s.criticalEvents ?? 0}</span><span class="jv-hero__l">Críticos</span></div>
      <div class="jv-hero__stat jv-hero__stat--cyan"><span class="jv-hero__n">${s.opportunityRefs ?? 0}</span><span class="jv-hero__l">Oportunidades</span></div>
    </div>
    <p class="jv-hero__sub muted">${subtitle || ''}</p>
  `;
  return el;
}

export function JarvisSearchCommand({ placeholder, onSearch, suggestions = [] }) {
  const wrap = document.createElement('div');
  wrap.className = 'jv-search';
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'jv-search__input';
  input.placeholder = placeholder || 'Consulta operativa: cliente, OT, patente, hallazgo, mes…';
  input.setAttribute('enterkeyhint', 'search');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'primary-button jv-search__btn';
  btn.textContent = 'Buscar';
  const chips = document.createElement('div');
  chips.className = 'jv-chips';
  suggestions.forEach((t) => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'jv-chip';
    c.textContent = t;
    c.addEventListener('click', () => {
      input.value = t;
      onSearch?.(t);
    });
    chips.append(c);
  });
  const run = () => onSearch?.(input.value.trim());
  btn.addEventListener('click', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') run();
  });
  wrap.append(input, btn, chips);
  return wrap;
}

export function JarvisTimelineBoard({ title, events, onNavigate }) {
  const sec = document.createElement('section');
  sec.className = 'jv-panel';
  const h = document.createElement('h3');
  h.className = 'jv-panel__title';
  h.textContent = title || 'Línea de tiempo';
  const ul = document.createElement('ul');
  ul.className = 'jv-timeline';
  (events || []).slice(0, 25).forEach((ev) => {
    const li = document.createElement('li');
    li.className = 'jv-timeline__item';
    const sev = (ev.risks || []).includes('severidad_elevada') ? 'jv-timeline__dot--red' : 'jv-timeline__dot--cyan';
    li.innerHTML = `<span class="jv-timeline__dot ${sev}" aria-hidden="true"></span>
      <div class="jv-timeline__body">
        <time class="jv-timeline__time">${ev.eventDate || '—'}</time>
        <strong class="jv-timeline__head">${ev.title || ev.entityType}</strong>
        <p class="muted small">${ev.client || '—'} · ${ev.branch || '—'} · ${ev.entityType}</p>
        <p class="jv-timeline__sum">${(ev.summary || '').slice(0, 160)}</p>
      </div>`;
    const navBtn = document.createElement('button');
    navBtn.type = 'button';
    navBtn.className = 'secondary-button small jv-timeline__go';
    navBtn.textContent = 'Ir';
    navBtn.addEventListener('click', () => onNavigate?.(ev));
    li.append(navBtn);
    ul.append(li);
  });
  sec.append(h, ul);
  return sec;
}

export function JarvisPatternRadar({ patterns }) {
  const sec = document.createElement('section');
  sec.className = 'jv-panel';
  sec.innerHTML = '<h3 class="jv-panel__title">Patrones detectados</h3>';
  const ul = document.createElement('ul');
  ul.className = 'jv-pattern-list';
  (patterns || []).slice(0, 12).forEach((p) => {
    const li = document.createElement('li');
    li.className = `jv-pattern jv-pattern--${p.severity || 'info'}`;
    li.innerHTML = `<strong>${p.title}</strong><p class="muted small">${p.detail || ''}</p>`;
    ul.append(li);
  });
  if (!ul.childElementCount) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin patrones fuertes en el corte actual.';
    ul.append(li);
  }
  sec.append(ul);
  return sec;
}

export function JarvisAssetPanel({ assetSummary }) {
  const sec = document.createElement('section');
  sec.className = 'jv-panel';
  sec.innerHTML = '<h3 class="jv-panel__title">Radar por activos</h3>';
  const ul = document.createElement('ul');
  ul.className = 'jv-asset-list';
  (assetSummary?.topAssets || []).slice(0, 8).forEach((a) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${a.assetKey}</strong> <span class="muted">${a.eventCount} eventos · último ${a.lastEvent || '—'}</span>`;
    ul.append(li);
  });
  if (!ul.childElementCount) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin activos agrupados aún.';
    ul.append(li);
  }
  sec.append(ul);
  return sec;
}

export function JarvisMonthArchivePanel({ monthStatus }) {
  const sec = document.createElement('section');
  sec.className = 'jv-panel';
  sec.innerHTML = '<h3 class="jv-panel__title">Archivo por mes</h3>';
  const grid = document.createElement('div');
  grid.className = 'jv-month-grid';
  const keys = Object.keys(monthStatus || {}).sort().reverse().slice(0, 18);
  keys.forEach((k) => {
    const cell = document.createElement('div');
    cell.className = 'jv-month-cell';
    const st = monthStatus[k];
    cell.innerHTML = `<span class="jv-month-cell__m">${k}</span><span class="jv-month-cell__n">${st?.count ?? 0}</span>`;
    grid.append(cell);
  });
  if (!keys.length) {
    grid.innerHTML = '<p class="muted">Sin datos por mes.</p>';
  }
  sec.append(grid);
  return sec;
}

export function JarvisSignalCard({ title, lines }) {
  const d = document.createElement('div');
  d.className = 'jv-signal-card';
  d.innerHTML = `<h4>${title}</h4><ul>${(lines || []).map((l) => `<li>${l}</li>`).join('')}</ul>`;
  return d;
}

export function JarvisEntityLinkCard({ record, onOpen }) {
  const d = document.createElement('div');
  d.className = 'jv-entity-card';
  d.innerHTML = `<p class="jv-entity-card__type">${record.entityType}</p><strong>${record.title}</strong><p class="muted small">${record.eventDate} · ${record.client || '—'}</p><p>${(record.summary || '').slice(0, 100)}</p>`;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'secondary-button small';
  b.textContent = 'Abrir';
  b.addEventListener('click', () => onOpen?.(record));
  d.append(b);
  return d;
}

/** Indicador circular liviano (SVG). */
export function JarvisHudRing({ pct = 72, label = 'Sync' }) {
  const wrap = document.createElement('div');
  wrap.className = 'jv-hud-ring';
  const p = Math.min(100, Math.max(0, pct));
  const deg = (p / 100) * 360;
  wrap.innerHTML = `
    <svg class="jv-hud-ring__svg" viewBox="0 0 64 64" aria-hidden="true">
      <circle class="jv-hud-ring__bg" cx="32" cy="32" r="28" fill="none" stroke-width="4" />
      <circle class="jv-hud-ring__fg" cx="32" cy="32" r="28" fill="none" stroke-width="4"
        stroke-dasharray="${(deg / 360) * 175.9} 176" transform="rotate(-90 32 32)" />
    </svg>
    <span class="jv-hud-ring__lab">${label}</span>
  `;
  return wrap;
}

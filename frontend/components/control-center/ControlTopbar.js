import { HNF_COMMAND_NAV_FULL } from '../../domain/hnf-operator-role.js';
import { formatLastSyncLabel, statusCopy } from './control-shell-utils.js';

function labelForView(activeView, navItems) {
  const items =
    Array.isArray(navItems) && navItems.length > 0 ? navItems : HNF_COMMAND_NAV_FULL;
  const hit = items.find((x) => x.id === activeView);
  return hit?.label || activeView || '—';
}

/**
 * Barra superior del cockpit — contexto de vista + estado en vivo.
 */
export function createControlTopbar({
  activeView,
  navItems,
  integrationStatus,
  lastDataRefreshAt,
} = {}) {
  const bar = document.createElement('header');
  bar.className = 'hnf-cc-topbar';
  bar.setAttribute('aria-label', 'Contexto operativo');

  const left = document.createElement('div');
  left.className = 'hnf-cc-topbar__left';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'hnf-cc-topbar__eyebrow';
  eyebrow.textContent = 'Centro de Control Operativo HNF';
  const title = document.createElement('h1');
  title.className = 'hnf-cc-topbar__title';
  title.textContent = labelForView(activeView, navItems);
  left.append(eyebrow, title);

  const right = document.createElement('div');
  right.className = 'hnf-cc-topbar__right';

  const pill = document.createElement('span');
  const pillMod = String(integrationStatus || 'idle')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  pill.className = `hnf-cc-topbar__pill hnf-cc-topbar__pill--${pillMod || 'idle'}`;
  pill.textContent = statusCopy(integrationStatus);

  const meta = document.createElement('div');
  meta.className = 'hnf-cc-topbar__meta';
  const syncK = document.createElement('span');
  syncK.className = 'hnf-cc-topbar__meta-k';
  syncK.textContent = 'Datos';
  const syncV = document.createElement('span');
  syncV.className = 'hnf-cc-topbar__meta-v';
  syncV.textContent = formatLastSyncLabel(lastDataRefreshAt);
  meta.append(syncK, syncV);

  right.append(pill, meta);
  bar.append(left, right);
  return bar;
}

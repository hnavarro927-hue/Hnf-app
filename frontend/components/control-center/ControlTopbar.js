import { HNF_COMMAND_NAV_FULL } from '../../domain/hnf-operator-role.js';
import { subtitleForView } from './control-nav-meta.js';
import { formatLastSyncLabel, statusCopy } from './control-shell-utils.js';

function labelForView(activeView, navItems) {
  const items =
    Array.isArray(navItems) && navItems.length > 0 ? navItems : HNF_COMMAND_NAV_FULL;
  const hit = items.find((x) => x.id === activeView);
  return hit?.label || activeView || '—';
}

function formatTopbarClock() {
  try {
    return new Date().toLocaleString('es-CL', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Header cockpit — título, subtítulo operativo, reloj en vivo, estado y sync.
 */
export function createControlTopbar({
  activeView,
  navItems,
  integrationStatus,
  lastDataRefreshAt,
  onNavigate,
} = {}) {
  const bar = document.createElement('header');
  bar.className = 'hnf-cc-topbar hnf-cc-topbar--cockpit';
  bar.setAttribute('aria-label', 'Contexto operativo');

  const left = document.createElement('div');
  left.className = 'hnf-cc-topbar__left';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'hnf-cc-topbar__eyebrow';
  eyebrow.textContent = 'Centro de Control · HNF';
  const title = document.createElement('h1');
  title.className = 'hnf-cc-topbar__title';
  title.textContent = labelForView(activeView, navItems);
  const sub = document.createElement('p');
  sub.className = 'hnf-cc-topbar__subtitle';
  sub.textContent = subtitleForView(activeView, navItems);
  left.append(eyebrow, title, sub);

  const center = document.createElement('div');
  center.className = 'hnf-cc-topbar__center';
  const live = document.createElement('div');
  live.className = 'hnf-cc-topbar__live';
  const liveDot = document.createElement('span');
  liveDot.className = 'hnf-cc-topbar__live-dot';
  liveDot.setAttribute('aria-hidden', 'true');
  const liveLab = document.createElement('span');
  liveLab.className = 'hnf-cc-topbar__live-label';
  liveLab.textContent = 'En línea';
  live.append(liveDot, liveLab);
  const clock = document.createElement('time');
  clock.className = 'hnf-cc-topbar__clock';
  clock.setAttribute('datetime', new Date().toISOString());
  clock.textContent = formatTopbarClock();
  center.append(live, clock);

  const tick = () => {
    clock.textContent = formatTopbarClock();
    clock.setAttribute('datetime', new Date().toISOString());
  };
  tick();
  const iv = setInterval(tick, 30000);
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => clearInterval(iv), { once: true });
  }

  const right = document.createElement('div');
  right.className = 'hnf-cc-topbar__right';

  const quickSlot = document.createElement('div');
  quickSlot.className = 'hnf-cc-topbar__quick-slot';
  quickSlot.setAttribute('aria-hidden', 'true');
  quickSlot.title = 'Acciones rápidas';

  const jarvisCtl = document.createElement('button');
  jarvisCtl.type = 'button';
  jarvisCtl.className = `hnf-cc-topbar__jarvis${activeView === 'jarvis' ? ' hnf-cc-topbar__jarvis--on' : ''}`;
  jarvisCtl.setAttribute('aria-label', 'Jarvis HQ');
  jarvisCtl.textContent = activeView === 'jarvis' ? 'Jarvis · activo' : 'Jarvis';
  if (activeView === 'jarvis') {
    jarvisCtl.disabled = true;
  } else {
    jarvisCtl.addEventListener('click', () => onNavigate?.('jarvis'));
  }

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
  syncK.textContent = 'Última sincronización';
  const syncV = document.createElement('span');
  syncV.className = 'hnf-cc-topbar__meta-v';
  syncV.textContent = formatLastSyncLabel(lastDataRefreshAt);
  meta.append(syncK, syncV);

  right.append(quickSlot, jarvisCtl, pill, meta);
  bar.append(left, center, right);
  return bar;
}

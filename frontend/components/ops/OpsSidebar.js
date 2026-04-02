import { isViewAllowedForModules } from '../../domain/hnf-access-nav.js';
import { formatLastSyncLabel, statusCopy, statusModifiers } from '../control-center/control-shell-utils.js';

const OPS_RAIL = [
  { id: 'centro-control', label: 'Mando', icon: '◉' },
  { id: 'clima', label: 'Clima', icon: '◎' },
  { id: 'flota', label: 'Flota', icon: '▣' },
  { id: 'gestion-ot', label: 'OT', icon: '▦' },
  { id: 'oportunidades', label: 'Clientes', icon: '◇' },
  { id: 'auditoria', label: 'Reportes', icon: '▤' },
];

function el(className, tag = 'div') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

/**
 * @param {{
 *   layoutRoot: HTMLElement,
 *   activeView: string,
 *   onNavigate: (id: string) => void,
 *   allowedModules?: string[],
 *   onLogout?: () => void,
 *   sessionUserLabel?: string,
 *   deployStatusElement?: HTMLElement | null,
 *   integrationStatus?: string,
 *   lastDataRefreshAt?: string | null,
 *   onSync?: () => void,
 *   apiBaseLabel?: string,
 * }} p
 */
export function createOpsSidebar(p) {
  const mods = Array.isArray(p.allowedModules) && p.allowedModules.length ? p.allowedModules : ['*'];

  const aside = el('hnf-ops-rail', 'aside');
  aside.setAttribute('aria-label', 'Navegación operativa HNF');

  const toggle = el('hnf-ops-rail__collapse', 'button');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Colapsar menú');
  toggle.setAttribute('aria-expanded', 'true');
  toggle.textContent = '⟨';
  toggle.addEventListener('click', () => {
    const collapsed = p.layoutRoot.classList.toggle('hnf-ops-layout--collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.textContent = collapsed ? '⟩' : '⟨';
  });

  const brand = el('hnf-ops-rail__brand');
  const mark = el('hnf-ops-rail__mark', 'span');
  mark.textContent = 'HNF';
  const brandText = el('hnf-ops-rail__brand-name', 'span');
  brandText.textContent = 'Operaciones';
  brand.append(mark, brandText);

  const nav = el('hnf-ops-rail__nav', 'nav');
  nav.setAttribute('aria-label', 'Módulos');

  for (const item of OPS_RAIL) {
    if (!isViewAllowedForModules(mods, item.id)) continue;
    const btn = el('hnf-ops-rail__item', 'button');
    btn.type = 'button';
    btn.dataset.view = item.id;
    if (item.id === p.activeView) {
      btn.classList.add('hnf-ops-rail__item--active');
      btn.setAttribute('aria-current', 'page');
    }
    const ic = el('hnf-ops-rail__ico', 'span');
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = item.icon;
    const lab = el('hnf-ops-rail__label', 'span');
    lab.textContent = item.label;
    btn.append(ic, lab);
    btn.addEventListener('click', () => p.onNavigate?.(item.id));
    nav.append(btn);
  }

  const foot = el('hnf-ops-rail__foot');
  const status = el(`hnf-ops-rail__sync ${statusModifiers(p.integrationStatus)}`);
  status.setAttribute('role', 'status');
  const dot = el('hnf-ops-rail__dot');
  const stx = el('hnf-ops-rail__sync-txt', 'span');
  stx.textContent = statusCopy(p.integrationStatus);
  status.append(dot, stx);

  const syncRow = el('hnf-ops-rail__meta');
  const syncK = el('hnf-ops-rail__meta-k', 'span');
  syncK.textContent = 'Última sync';
  const syncV = el('hnf-ops-rail__meta-v', 'span');
  syncV.textContent = formatLastSyncLabel(p.lastDataRefreshAt);
  syncRow.append(syncK, syncV);

  const apiRow = el('hnf-ops-rail__meta');
  const ak = el('hnf-ops-rail__meta-k', 'span');
  ak.textContent = 'API';
  const av = el('hnf-ops-rail__meta-v', 'span');
  av.textContent = p.apiBaseLabel || '—';
  apiRow.append(ak, av);

  foot.append(status, syncRow, apiRow);

  if (typeof p.onSync === 'function') {
    const syncBtn = el('hnf-ops-btn hnf-ops-btn--ghost hnf-ops-btn--block', 'button');
    syncBtn.type = 'button';
    syncBtn.textContent = 'Sincronizar datos';
    syncBtn.addEventListener('click', () => p.onSync());
    foot.append(syncBtn);
  }

  if (p.deployStatusElement) {
    p.deployStatusElement.classList.add('hnf-ops-rail__deploy');
    foot.append(p.deployStatusElement);
  }

  if (typeof p.onLogout === 'function') {
    const userRow = el('hnf-ops-rail__user');
    if (p.sessionUserLabel) {
      const u = el('hnf-ops-rail__user-name', 'span');
      u.textContent = p.sessionUserLabel;
      userRow.append(u);
    }
    const out = el('hnf-ops-btn hnf-ops-btn--ghost hnf-ops-btn--block', 'button');
    out.type = 'button';
    out.textContent = 'Cerrar sesión';
    out.addEventListener('click', () => p.onLogout());
    userRow.append(out);
    foot.append(userRow);
  }

  aside.append(toggle, brand, nav, foot);
  return { element: aside };
}

import { HNF_COMMAND_NAV_FULL } from '../../domain/hnf-operator-role.js';
import { isTabletMode } from '../../domain/jarvis-ui.js';
import {
  COCKPIT_GROUP_LABEL,
  COCKPIT_GROUP_ORDER,
  COCKPIT_NAV_GROUP,
  NAV_TECH_ACCENT,
} from './control-nav-meta.js';
import { formatLastSyncLabel, statusCopy, statusModifiers } from './control-shell-utils.js';

const NAV_GROUP_STATE_KEY = 'hnf-cc-cockpit-nav-groups';

function readNavGroupState() {
  try {
    const raw = sessionStorage.getItem(NAV_GROUP_STATE_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function writeNavGroupState(next) {
  try {
    sessionStorage.setItem(NAV_GROUP_STATE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * Sidebar cockpit — grupos colapsables; solo el rail hace scroll; el panel principal no se empuja.
 */
export function createControlSidebar({
  layoutRoot,
  activeView,
  onNavigate,
  onLogout = null,
  sessionUserLabel = '',
  apiBaseLabel,
  integrationStatus,
  deployStatusElement = null,
  navItems = null,
  lastDataRefreshAt = null,
} = {}) {
  let items =
    Array.isArray(navItems) && navItems.length > 0 ? navItems : HNF_COMMAND_NAV_FULL;
  items = (Array.isArray(items) ? items : []).filter(
    (x) => x && typeof x === 'object' && String(x.id ?? '').length > 0
  );
  if (!items.length) items = HNF_COMMAND_NAV_FULL;

  const aside = document.createElement('aside');
  aside.className = 'hnf-cc-sidebar hnf-cc-rail';
  aside.setAttribute('aria-label', 'Panel de mando HNF');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'hnf-cc-sidebar__toggle';
  toggle.setAttribute('aria-label', 'Menú');
  toggle.setAttribute('aria-expanded', 'true');
  toggle.textContent = '☰';
  toggle.addEventListener('click', () => {
    if (!layoutRoot?.classList) return;
    const collapsed = layoutRoot.classList.toggle('hnf-cc-layout--collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });

  const brand = document.createElement('div');
  brand.className = 'hnf-cc-sidebar__brand';
  const mark = document.createElement('span');
  mark.className = 'hnf-cc-sidebar__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = 'HNF';
  const brandCol = document.createElement('div');
  brandCol.className = 'hnf-cc-sidebar__brand-text';
  const brandTitle = document.createElement('span');
  brandTitle.className = 'hnf-cc-sidebar__brand-name';
  brandTitle.textContent = 'Centro de Control';
  const brandSub = document.createElement('span');
  brandSub.className = 'hnf-cc-sidebar__brand-tag';
  brandSub.textContent = 'Cockpit operativo';
  brandCol.append(brandTitle, brandSub);
  brand.append(mark, brandCol);

  const statusRow = document.createElement('div');
  statusRow.className = `hnf-cc-sidebar__status ${statusModifiers(integrationStatus)}`;
  statusRow.setAttribute('role', 'status');
  const dot = document.createElement('span');
  dot.className = 'hnf-cc-sidebar__status-dot';
  const statusText = document.createElement('span');
  statusText.className = 'hnf-cc-sidebar__status-text';
  statusText.textContent = statusCopy(integrationStatus);
  statusRow.append(dot, statusText);

  const syncLive = document.createElement('div');
  syncLive.className = 'hnf-cc-sidebar__sync';
  syncLive.setAttribute('aria-live', 'polite');
  const syncLab = document.createElement('span');
  syncLab.className = 'hnf-cc-sidebar__sync-k';
  syncLab.textContent = 'Última sync';
  const syncVal = document.createElement('span');
  syncVal.className = 'hnf-cc-sidebar__sync-v';
  syncVal.textContent = formatLastSyncLabel(lastDataRefreshAt);
  syncLive.append(syncLab, syncVal);

  const apiRow = document.createElement('p');
  apiRow.className = 'hnf-cc-sidebar__api';
  const apiLab = document.createElement('span');
  apiLab.className = 'hnf-cc-sidebar__api-k';
  apiLab.textContent = 'API';
  apiRow.append(apiLab, document.createTextNode(` ${apiBaseLabel || '—'}`));

  let sessionEl = null;
  if (typeof onLogout === 'function') {
    const sess = document.createElement('div');
    sess.className = 'hnf-cc-sidebar__session';
    if (sessionUserLabel) {
      const who = document.createElement('span');
      who.className = 'hnf-cc-sidebar__user';
      who.textContent = sessionUserLabel;
      sess.append(who);
    }
    const out = document.createElement('button');
    out.type = 'button';
    out.className = 'hnf-cc-sidebar__btn hnf-cc-sidebar__btn--logout';
    out.textContent = 'Cerrar sesión';
    out.addEventListener('click', () => onLogout());
    sess.append(out);
    sessionEl = sess;
  }

  const slaStrip = document.createElement('div');
  slaStrip.className = 'hnf-cc-sidebar__sla';
  slaStrip.setAttribute('role', 'region');
  slaStrip.setAttribute('aria-label', 'Compromisos de respuesta HNF');
  slaStrip.innerHTML = `
    <div class="hnf-cc-sla-chip" title="RM · primera respuesta">
      <span class="hnf-cc-sla-chip__k">RM</span><span class="hnf-cc-sla-chip__v">4h</span>
    </div>
    <div class="hnf-cc-sla-chip" title="Regiones">
      <span class="hnf-cc-sla-chip__k">Reg.</span><span class="hnf-cc-sla-chip__v">12h</span>
    </div>
    <div class="hnf-cc-sla-chip" title="Informes">
      <span class="hnf-cc-sla-chip__k">Inf.</span><span class="hnf-cc-sla-chip__v">2d háb.</span>
    </div>
  `;

  const telemetry = document.createElement('div');
  telemetry.className = 'hnf-cc-rail__telemetry';
  telemetry.setAttribute('aria-label', 'Telemetría de conexión');
  telemetry.append(statusRow, syncLive, apiRow);

  const headBlock = document.createElement('div');
  headBlock.className = 'hnf-cc-sidebar__head hnf-cc-rail__mast';
  headBlock.append(brand, telemetry, slaStrip);
  if (sessionEl) headBlock.append(sessionEl);
  if (deployStatusElement) {
    deployStatusElement.classList.add('hnf-cc-sidebar__deploy');
    headBlock.append(deployStatusElement);
  }

  const nav = document.createElement('nav');
  nav.className = 'hnf-cc-nav hnf-cc-rail__modules';
  nav.setAttribute('aria-label', 'Módulos del sistema');

  const byGroup = {};
  for (const g of COCKPIT_GROUP_ORDER) byGroup[g] = [];
  for (const item of items) {
    const g = COCKPIT_NAV_GROUP[item.id] ?? 'sistema';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(item);
  }

  const persisted = readNavGroupState();

  const appendNavButton = (parent, item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hnf-cc-nav__btn';
    btn.dataset.accent = NAV_TECH_ACCENT[item.id] || 'neutral';
    if (item.id === activeView) {
      btn.classList.add('hnf-cc-nav__btn--active');
      btn.setAttribute('aria-current', 'page');
    }
    const ic = document.createElement('span');
    ic.className = 'hnf-cc-nav__btn-ico';
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = item.icon;
    const lab = document.createElement('span');
    lab.className = 'hnf-cc-nav__btn-label';
    lab.textContent = item.label;
    btn.append(ic, lab);
    btn.addEventListener('click', () => onNavigate?.(item?.id));
    parent.append(btn);
  };

  for (const groupId of COCKPIT_GROUP_ORDER) {
    const groupItems = byGroup[groupId];
    if (!groupItems?.length) continue;

    const hasActive = groupItems.some((it) => it.id === activeView);
    let expanded;
    if (Object.prototype.hasOwnProperty.call(persisted, groupId)) {
      expanded = Boolean(persisted[groupId]);
    } else {
      expanded = hasActive;
    }

    const block = document.createElement('div');
    block.className = 'hnf-cc-nav-group';

    const panelId = `hnf-cc-nav-grp-${groupId}`;

    const headerBtn = document.createElement('button');
    headerBtn.type = 'button';
    headerBtn.className = 'hnf-cc-nav-group__toggle';
    headerBtn.setAttribute('aria-expanded', String(expanded));
    headerBtn.setAttribute('aria-controls', panelId);

    const chev = document.createElement('span');
    chev.className = 'hnf-cc-nav-group__chev';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = expanded ? '▾' : '▸';

    const groupLab = document.createElement('span');
    groupLab.className = 'hnf-cc-nav-group__label';
    groupLab.textContent = COCKPIT_GROUP_LABEL[groupId] || groupId;

    const count = document.createElement('span');
    count.className = 'hnf-cc-nav-group__count';
    count.textContent = String(groupItems.length);

    headerBtn.append(chev, groupLab, count);

    const panel = document.createElement('div');
    panel.className = 'hnf-cc-nav-group__panel';
    panel.id = panelId;
    panel.hidden = !expanded;

    for (const item of groupItems) {
      appendNavButton(panel, item);
    }

    headerBtn.addEventListener('click', () => {
      const isOpen = !panel.hidden;
      const nextOpen = !isOpen;
      panel.hidden = !nextOpen;
      headerBtn.setAttribute('aria-expanded', String(nextOpen));
      chev.textContent = nextOpen ? '▾' : '▸';
      const st = readNavGroupState();
      st[groupId] = nextOpen;
      writeNavGroupState(st);
    });

    block.append(headerBtn, panel);
    nav.append(block);
  }

  aside.append(toggle, headBlock, nav);

  if (typeof window !== 'undefined' && isTabletMode()) {
    toggle.classList.add('hnf-cc-sidebar__toggle--visible');
  }

  return { element: aside, navToggle: toggle };
}

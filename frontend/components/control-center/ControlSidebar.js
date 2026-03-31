import { HNF_COMMAND_NAV_FULL } from '../../domain/hnf-operator-role.js';
import { isTabletMode } from '../../domain/jarvis-ui.js';
import { NAV_SECTION_LABEL, NAV_TECH_ACCENT, VIEW_NAV_SECTION } from './control-nav-meta.js';
import { formatLastSyncLabel, statusCopy, statusModifiers } from './control-shell-utils.js';

/**
 * Sidebar cockpit — no usa clases .sidebar / .nav-item legacy.
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
  const items =
    Array.isArray(navItems) && navItems.length > 0 ? navItems : HNF_COMMAND_NAV_FULL;

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
  brandSub.textContent = 'Operativo · Mando unificado';
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

  let lastNavSection = null;
  let currentDeck = null;
  for (const item of items) {
    const secKey = VIEW_NAV_SECTION[item.id] ?? 'otros';
    if (secKey !== lastNavSection) {
      lastNavSection = secKey;
      const secEl = document.createElement('div');
      secEl.className = 'hnf-v2-nav-rail-title';
      secEl.textContent = NAV_SECTION_LABEL[secKey] || secKey;
      nav.append(secEl);
      currentDeck = document.createElement('div');
      currentDeck.className = 'hnf-v2-nav-deck';
      nav.append(currentDeck);
    }

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
    btn.addEventListener('click', () => onNavigate(item.id));
    (currentDeck || nav).append(btn);
  }

  aside.append(toggle, headBlock, nav);

  if (typeof window !== 'undefined' && isTabletMode()) {
    toggle.classList.add('hnf-cc-sidebar__toggle--visible');
  }

  return { element: aside, navToggle: toggle };
}

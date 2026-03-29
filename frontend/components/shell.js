/**
 * Shell HNF — menú mando reducido (iPad): icono + texto corto, alto contraste.
 * `navItems` filtra por rol (hnf-operator-role).
 */

import { HNF_COMMAND_NAV_FULL } from '../domain/hnf-operator-role.js';

const statusCopy = (integrationStatus) => {
  const map = {
    conectado: 'En línea',
    'sin conexión': 'Sin conexión',
    cargando: 'Actualizando…',
    pendiente: 'Esperando datos',
  };
  return map[integrationStatus] || integrationStatus || '—';
};

import { isTabletMode } from '../domain/jarvis-ui.js';

/** Gancho visual Tech-Rebirth: acento lateral / glow en nav (sin lógica de negocio). */
const NAV_TECH_ACCENT = {
  jarvis: 'jarvis',
  'ingreso-operativo': 'matrix',
  'bandeja-canal': 'matrix',
  clima: 'clima',
  planificacion: 'clima',
  flota: 'flota',
  oportunidades: 'flota',
  'control-gerencial': 'matrix',
  finanzas: 'matrix',
  equipo: 'matrix',
  'hnf-core': 'neutral',
  'documentos-tecnicos': 'jarvis',
};

const statusModifiers = (integrationStatus) => {
  if (integrationStatus === 'conectado') return 'shell-status--ok';
  if (integrationStatus === 'sin conexión') return 'shell-status--bad';
  if (integrationStatus === 'cargando') return 'shell-status--pending';
  return 'shell-status--idle';
};

const formatLastSyncLabel = (lastDataRefreshAt) => {
  if (lastDataRefreshAt == null || lastDataRefreshAt === '') return 'Sin sincronizar aún';
  const t = Number(lastDataRefreshAt);
  const d = Number.isFinite(t) ? new Date(t) : new Date(lastDataRefreshAt);
  const ms = d.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'Sin sincronizar aún';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export const createShell = ({
  activeView,
  onNavigate,
  apiBaseLabel,
  integrationStatus,
  deployStatusElement = null,
  navItems = null,
  lastDataRefreshAt = null,
} = {}) => {
  const items =
    Array.isArray(navItems) && navItems.length > 0 ? navItems : HNF_COMMAND_NAV_FULL;
  const element = document.createElement('div');
  element.className = 'shell shell--command-center hnf-tech-rebirth';
  if (typeof window !== 'undefined' && isTabletMode()) {
    element.classList.add('shell--tablet');
  }

  const navToggle = document.createElement('button');
  navToggle.type = 'button';
  navToggle.className = 'shell-nav-toggle';
  navToggle.setAttribute('aria-label', 'Menú');
  navToggle.setAttribute('aria-expanded', 'true');
  navToggle.textContent = '☰';
  navToggle.addEventListener('click', () => {
    const collapsed = element.classList.toggle('shell--sidebar-collapsed');
    navToggle.setAttribute('aria-expanded', String(!collapsed));
  });

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';

  const header = document.createElement('header');
  header.className = 'shell-header';

  const brand = document.createElement('div');
  brand.className = 'shell-brand';
  const mark = document.createElement('span');
  mark.className = 'shell-brand__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = 'HNF';
  const brandText = document.createElement('div');
  brandText.className = 'shell-brand__text';
  const brandName = document.createElement('span');
  brandName.className = 'shell-brand__name';
  brandName.textContent = 'HNF Servicios Integrales';
  const brandProduct = document.createElement('span');
  brandProduct.className = 'shell-brand__product';
  brandProduct.textContent = 'HNF SISTEMAS — Gestión de Activos V1.0';
  brandText.append(brandName, brandProduct);
  brand.append(mark, brandText);

  const statusRow = document.createElement('div');
  statusRow.className = `shell-status ${statusModifiers(integrationStatus)}`;
  statusRow.setAttribute('role', 'status');
  const dot = document.createElement('span');
  dot.className = 'shell-status__dot';
  const statusText = document.createElement('span');
  statusText.className = 'shell-status__text';
  statusText.textContent = statusCopy(integrationStatus);
  statusRow.append(dot, statusText);

  const syncLive = document.createElement('div');
  syncLive.className = 'shell-sync-live';
  syncLive.setAttribute('aria-live', 'polite');
  const syncLab = document.createElement('span');
  syncLab.className = 'shell-sync-live__label';
  syncLab.textContent = 'Última sincronización';
  const syncVal = document.createElement('span');
  syncVal.className = 'shell-sync-live__value';
  syncVal.textContent = formatLastSyncLabel(lastDataRefreshAt);
  syncLive.append(syncLab, syncVal);

  const apiRow = document.createElement('p');
  apiRow.className = 'shell-api shell-api--compact';
  const apiLab = document.createElement('span');
  apiLab.className = 'shell-api__label';
  apiLab.textContent = 'API';
  apiRow.append(apiLab, document.createTextNode(` ${apiBaseLabel || '—'}`));

  const slaStrip = document.createElement('div');
  slaStrip.className = 'hnf-sla-commitment-strip';
  slaStrip.setAttribute('role', 'region');
  slaStrip.setAttribute('aria-label', 'Compromisos de respuesta regional HNF');
  slaStrip.innerHTML = `
    <div class="hnf-sla-chip hnf-sla-chip--rm" title="Compromiso de primera respuesta en Región Metropolitana">
      <span class="hnf-sla-chip__label">RM</span>
      <div class="hnf-sla-chip__body">
        <span class="hnf-sla-chip__time">4 h</span>
        <span class="hnf-sla-chip__hint">respuesta</span>
      </div>
    </div>
    <div class="hnf-sla-chip hnf-sla-chip--regions" title="Compromiso de primera respuesta en regiones">
      <span class="hnf-sla-chip__label">Reg.</span>
      <div class="hnf-sla-chip__body">
        <span class="hnf-sla-chip__time">12 h</span>
        <span class="hnf-sla-chip__hint">respuesta</span>
      </div>
    </div>
    <div class="hnf-sla-chip hnf-sla-chip--reports" title="Meta operativa de informes">
      <span class="hnf-sla-chip__label">Inf.</span>
      <div class="hnf-sla-chip__body">
        <span class="hnf-sla-chip__time">2 d. háb.</span>
        <span class="hnf-sla-chip__hint">meta</span>
      </div>
    </div>
  `;

  header.append(brand, slaStrip, statusRow, syncLive, apiRow);
  if (deployStatusElement) {
    deployStatusElement.classList.add('shell-deploy-status');
    header.append(deployStatusElement);
  }
  sidebar.append(navToggle, header);

  const nav = document.createElement('nav');
  nav.className = 'nav nav--mando';
  nav.setAttribute('aria-label', 'Navegación principal');

  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item nav-item--mando';
    const icon = document.createElement('span');
    icon.className = 'nav-item__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;
    const main = document.createElement('span');
    main.className = 'nav-item__label';
    main.textContent = item.label;
    button.append(icon, main);
    button.dataset.techAccent = NAV_TECH_ACCENT[item.id] || 'neutral';
    if (item.id === activeView) {
      button.classList.add('active');
      button.setAttribute('aria-current', 'page');
    }
    button.addEventListener('click', () => onNavigate(item.id));
    nav.append(button);
  });

  sidebar.append(nav);

  const content = document.createElement('main');
  content.className = 'content';
  content.setAttribute('role', 'main');

  const viewport = document.createElement('div');
  viewport.className = 'content__viewport';
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-label', 'Contenido principal');

  content.append(viewport);
  element.append(sidebar, content);

  return { element, content, viewport };
};

/**
 * Shell HNF — menú mando reducido (iPad): icono + texto corto, alto contraste.
 * Rutas secundarias (admin, docs, etc.) siguen en main.js vía hash manual.
 */
const navCommandItems = [
  { id: 'jarvis', icon: '◉', label: 'Jarvis' },
  { id: 'ingreso-operativo', icon: '⬊', label: 'Ingreso' },
  { id: 'clima', icon: '◎', label: 'Clima' },
  { id: 'flota', icon: '⛟', label: 'Flota' },
  { id: 'oportunidades', icon: '◈', label: 'Comercial' },
  { id: 'control-gerencial', icon: '⊞', label: 'Control' },
];

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

const statusModifiers = (integrationStatus) => {
  if (integrationStatus === 'conectado') return 'shell-status--ok';
  if (integrationStatus === 'sin conexión') return 'shell-status--bad';
  if (integrationStatus === 'cargando') return 'shell-status--pending';
  return 'shell-status--idle';
};

export const createShell = ({
  activeView,
  onNavigate,
  apiBaseLabel,
  integrationStatus,
  deployStatusElement = null,
}) => {
  const element = document.createElement('div');
  element.className = 'shell';
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
  brandName.textContent = 'Mando operativo';
  const brandProduct = document.createElement('span');
  brandProduct.className = 'shell-brand__product';
  brandProduct.textContent = 'Centro de control';
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

  const apiRow = document.createElement('p');
  apiRow.className = 'shell-api shell-api--compact';
  const apiLab = document.createElement('span');
  apiLab.className = 'shell-api__label';
  apiLab.textContent = 'API';
  apiRow.append(apiLab, document.createTextNode(` ${apiBaseLabel || '—'}`));

  header.append(brand, statusRow, apiRow);
  if (deployStatusElement) {
    deployStatusElement.classList.add('shell-deploy-status');
    header.append(deployStatusElement);
  }
  sidebar.append(navToggle, header);

  const nav = document.createElement('nav');
  nav.className = 'nav nav--mando';
  nav.setAttribute('aria-label', 'Navegación principal');

  navCommandItems.forEach((item) => {
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
    if (item.id === activeView) button.classList.add('active');
    button.addEventListener('click', () => onNavigate(item.id));
    nav.append(button);
  });

  sidebar.append(nav);

  const content = document.createElement('main');
  content.className = 'content';
  content.setAttribute('role', 'main');

  element.append(sidebar, content);

  return { element, content };
};

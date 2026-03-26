const groups = [
  {
    label: '1 · Ingreso de datos',
    items: [
      {
        id: 'ingreso-operativo',
        label: 'Ingreso operativo',
        hint: 'WhatsApp → ingestas automáticas para validar; ingreso manual como respaldo',
      },
    ],
  },
  {
    label: '2 · Núcleo (Jarvis + ADN)',
    items: [
      {
        id: 'jarvis',
        label: 'Jarvis — cerebro operativo',
        hint: 'Problema del día, cuello de botella, acciones y órbitas conectadas al ADN HNF',
      },
      {
        id: 'jarvis-intake',
        label: 'Intake histórico',
        hint: 'Correos y lotes (avanzado)',
      },
      {
        id: 'jarvis-vault',
        label: 'Historical Vault',
        hint: 'Memoria histórica y lotes',
      },
    ],
  },
  {
    label: '3 · Órbitas operativas',
    items: [
      {
        id: 'clima',
        label: 'Clima (OT / visitas)',
        hint: 'Conecta al ADN: evidencias, cierre, economía',
      },
      { id: 'flota', label: 'Flota', hint: 'Solicitudes y traslados → estado en órbita' },
      { id: 'planificacion', label: 'Planificación', hint: 'Clientes, tiendas, calendario' },
      {
        id: 'technical-documents',
        label: 'Documentos técnicos',
        hint: 'PDF, Lyn y aprobación',
      },
      {
        id: 'oportunidades',
        label: 'Comercial',
        hint: 'Pipeline y oportunidades',
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        hint: 'Canales y mensajes (contacto cliente)',
      },
    ],
  },
  {
    label: '4 · Control gerencial',
    items: [
      {
        id: 'control-gerencial',
        label: 'Panel de control',
        hint: 'Hernan: OT abiertas, riesgo, WhatsApp y responsables — sin entrar al detalle',
      },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      {
        id: 'asistente',
        label: 'Asistente IA HNF',
        hint: 'Diagnóstico y colas sobre datos',
      },
      {
        id: 'operacion-control',
        label: 'Operación y canales',
        hint: 'Vista técnica combinada (opcional)',
      },
      { id: 'admin', label: 'Administración', hint: 'Datos, exportación y respaldos' },
    ],
  },
];

const statusCopy = (integrationStatus) => {
  const map = {
    conectado: 'Sincronizado con el servidor',
    'sin conexión': 'Sin conexión al servidor',
    cargando: 'Actualizando datos…',
    pendiente: 'Esperando primera carga',
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
  navToggle.setAttribute('aria-label', 'Mostrar u ocultar menú');
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
  brandName.textContent = 'Servicios Integrales';
  const brandProduct = document.createElement('span');
  brandProduct.className = 'shell-brand__product';
  brandProduct.textContent = 'Plataforma operativa';
  brandText.append(brandName, brandProduct);
  brand.append(mark, brandText);

  const pilot = document.createElement('p');
  pilot.className = 'shell-pilot muted';
  const pill = document.createElement('span');
  pill.className = 'shell-pill';
  pill.textContent = 'Piloto interno';
  pilot.append(pill, document.createTextNode(' · Jarvis (cerebro) → ADN → órbitas → control'));

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
  apiRow.className = 'shell-api muted';
  const apiLab = document.createElement('span');
  apiLab.className = 'shell-api__label';
  apiLab.textContent = 'API';
  apiRow.append(apiLab, document.createTextNode(` ${apiBaseLabel || '—'}`));

  header.append(brand, pilot, statusRow, apiRow);
  if (deployStatusElement) {
    deployStatusElement.classList.add('shell-deploy-status');
    header.append(deployStatusElement);
  }
  sidebar.append(navToggle, header);

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.setAttribute('aria-label', 'Módulos principales');

  groups.forEach((group) => {
    const wrap = document.createElement('div');
    wrap.className = 'nav-group';

    const gl = document.createElement('p');
    gl.className = 'nav-group__label';
    gl.textContent = group.label;
    wrap.append(gl);

    group.items.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-item';
      const main = document.createElement('span');
      main.className = 'nav-item__label';
      main.textContent = item.label;
      const sub = document.createElement('span');
      sub.className = 'nav-item__hint muted';
      sub.textContent = item.hint || '';
      button.append(main, sub);
      if (item.id === activeView) button.classList.add('active');
      button.addEventListener('click', () => onNavigate(item.id));
      wrap.append(button);
    });

    nav.append(wrap);
  });

  sidebar.append(nav);

  const content = document.createElement('main');
  content.className = 'content';
  content.setAttribute('role', 'main');

  element.append(sidebar, content);

  return { element, content };
};


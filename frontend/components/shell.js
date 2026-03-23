const groups = [
  {
    label: 'Panel',
    items: [
      { id: 'dashboard', label: 'Inicio', hint: 'Resumen, alertas y números del mes' },
      {
        id: 'asistente',
        label: 'Asistente IA HNF',
        hint: 'Pendientes, cierres, cobros y diagnóstico sobre datos reales',
      },
    ],
  },
  {
    label: 'Clima (HVAC)',
    items: [
      { id: 'clima', label: 'Visitas y OT', hint: 'Equipos, evidencias, cierre e informe' },
      { id: 'planificacion', label: 'Planificación', hint: 'Clientes, tiendas y mantenciones' },
    ],
  },
  {
    label: 'Flota',
    items: [{ id: 'flota', label: 'Solicitudes', hint: 'Traslados y seguimiento por estado' }],
  },
  {
    label: 'Administración',
    items: [{ id: 'admin', label: 'Datos y respaldos', hint: 'Operador, clientes y exportación JSON' }],
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

const statusModifiers = (integrationStatus) => {
  if (integrationStatus === 'conectado') return 'shell-status--ok';
  if (integrationStatus === 'sin conexión') return 'shell-status--bad';
  if (integrationStatus === 'cargando') return 'shell-status--pending';
  return 'shell-status--idle';
};

export const createShell = ({ activeView, onNavigate, apiBaseLabel, integrationStatus }) => {
  const element = document.createElement('div');
  element.className = 'shell';

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
  pilot.append(pill, document.createTextNode(' · Operación HNF'));

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
  sidebar.append(header);

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

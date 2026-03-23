const groups = [
  {
    label: 'Panel',
    items: [{ id: 'dashboard', label: 'Inicio', hint: 'Resumen del mes, rentabilidad y alertas' }],
  },
  {
    label: 'Clima (HVAC)',
    items: [
      { id: 'clima', label: 'Visitas y OT', hint: 'Registrar visitas, fotos e informe' },
      { id: 'planificacion', label: 'Planificación', hint: 'Mantenciones por cliente y tienda' },
    ],
  },
  {
    label: 'Flota',
    items: [{ id: 'flota', label: 'Solicitudes', hint: 'Traslados y servicios a clientes' }],
  },
  {
    label: 'Administración',
    items: [{ id: 'admin', label: 'Datos y respaldos', hint: 'Clientes, gastos y copias JSON' }],
  },
];

const statusCopy = (integrationStatus) => {
  const map = {
    conectado: 'Servidor conectado',
    'sin conexión': 'Sin conexión con el servidor',
    cargando: 'Cargando datos…',
    pendiente: 'Listo',
  };
  return map[integrationStatus] || integrationStatus || '—';
};

export const createShell = ({ activeView, onNavigate, apiBaseLabel, integrationStatus }) => {
  const element = document.createElement('div');
  element.className = 'shell';

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div>
      <p class="muted">HNF Servicios Integrales</p>
      <h1>Panel operativo</h1>
      <p class="shell-pilot muted"><strong>Versión piloto interna</strong> · Clima · Flota · Administración</p>
      <p class="muted"><strong>Estado:</strong> ${statusCopy(integrationStatus)}</p>
      <p class="muted shell-api-hint"><strong>Conexión:</strong> ${apiBaseLabel || '—'}</p>
    </div>
  `;

  const nav = document.createElement('nav');
  nav.className = 'nav';

  groups.forEach((group) => {
    const gl = document.createElement('p');
    gl.className = 'nav-group__label';
    gl.textContent = group.label;
    nav.append(gl);

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
      nav.append(button);
    });
  });

  sidebar.append(nav);

  const content = document.createElement('main');
  content.className = 'content';

  element.append(sidebar, content);

  return { element, content };
};

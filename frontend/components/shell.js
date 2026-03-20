const menu = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clima', label: 'Clima' },
  { id: 'flota', label: 'Flota' },
  { id: 'admin', label: 'Administración' },
];

export const createShell = ({ activeView, onNavigate, apiBaseUrl, integrationStatus }) => {
  const element = document.createElement('div');
  element.className = 'shell';

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div>
      <p class="muted">HNF Servicios Integrales</p>
      <h1>Base de aplicación</h1>
      <p class="muted">Frontend preparado para integración limpia con backend.</p>
      <p class="muted"><strong>API:</strong> ${apiBaseUrl || 'No configurada'}</p>
      <p class="muted"><strong>Health:</strong> ${integrationStatus}</p>
    </div>
  `;

  const nav = document.createElement('nav');
  nav.className = 'nav';

  menu.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.label;
    if (item.id === activeView) button.classList.add('active');
    button.addEventListener('click', () => onNavigate(item.id));
    nav.append(button);
  });

  sidebar.append(nav);

  const content = document.createElement('main');
  content.className = 'content';

  element.append(sidebar, content);

  return { element, content };
};

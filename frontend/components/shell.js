const menu = [
  { id: 'home', label: 'Inicio' },
  { id: 'inbox', label: 'Inbox (Gery)' },
  { id: 'approval', label: 'Approval (Lyn)' },
  { id: 'manager', label: 'Manager (Hernan)' },
];

export const createShell = ({ activeView, onNavigate, apiBaseUrl, integrationStatus }) => {
  const element = document.createElement('div');
  element.className = 'shell';

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div>
      <p class="muted">HNF Servicios Integrales</p>
      <h1>Centralized ERP Control</h1>
      <p class="muted">Roles activos: Gery · Lyn · Hernan</p>
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

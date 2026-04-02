import { createOpsHeader } from '../ops/OpsHeader.js';
import { createOpsSidebar } from '../ops/OpsSidebar.js';
import { countMandoJarvisAlertsFromViewData } from '../../domain/mando-ops-jarvis-alerts.js';

/**
 * Shell operativo HNF — sidebar oscuro + topbar + workspace.
 * Backend y rutas sin cambios; solo presentación.
 */
export function createControlLayout({
  activeView,
  onNavigate,
  onLogout = null,
  sessionUserLabel = '',
  apiBaseLabel,
  integrationStatus,
  sessionWarning = '',
  deployStatusElement = null,
  navItems = null,
  lastDataRefreshAt = null,
  viewData = null,
  allowedModules = null,
  onSync = null,
} = {}) {
  const root = document.createElement('div');
  root.className = 'hnf-ops-layout';

  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.add('hnf-ops-app');
    document.body.classList.remove('hnf-cc-shell-active', 'hnf-cc-unified');
  }

  const jarvisCount = countMandoJarvisAlertsFromViewData(viewData || {});

  const { element: sidebarEl } = createOpsSidebar({
    layoutRoot: root,
    activeView,
    onNavigate,
    onLogout,
    sessionUserLabel,
    apiBaseLabel,
    integrationStatus,
    deployStatusElement,
    lastDataRefreshAt,
    onSync,
    allowedModules: Array.isArray(allowedModules) && allowedModules.length ? allowedModules : ['*'],
  });

  const { element: headerEl } = createOpsHeader({
    activeView,
    authLabel: sessionUserLabel,
    jarvisAlertCount: jarvisCount,
    onJarvisAlerts: () => onNavigate?.('jarvis'),
    onSearchSubmit: () => {
      /* reservado: filtros por vista */
    },
  });

  const main = document.createElement('main');
  main.className = 'hnf-ops-main';
  main.setAttribute('role', 'main');

  if (String(sessionWarning || '').trim()) {
    const warn = document.createElement('div');
    warn.className = 'hnf-ops-session-warn';
    warn.setAttribute('role', 'status');
    warn.textContent = String(sessionWarning).trim();
    main.append(warn);
  }

  const viewportShell = document.createElement('div');
  viewportShell.className = 'hnf-ops-viewport';
  viewportShell.setAttribute('role', 'region');
  viewportShell.setAttribute('aria-label', 'Contenido');

  const workspace = document.createElement('div');
  workspace.className = 'hnf-ops-workspace';
  workspace.setAttribute('aria-label', 'Vista activa');
  viewportShell.append(workspace);

  main.append(headerEl, viewportShell);
  root.append(sidebarEl, main);

  return {
    element: root,
    content: main,
    viewport: workspace,
    viewportShell,
    topbar: headerEl,
    contextStrip: null,
  };
}

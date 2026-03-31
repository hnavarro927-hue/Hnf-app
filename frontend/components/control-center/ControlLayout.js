import { isTabletMode } from '../../domain/jarvis-ui.js';
import '../../styles/hnf-control-center-layout.css';
import '../../styles/hnf-cockpit-unified.css';
import { createControlSidebar } from './ControlSidebar.js';
import { createControlTopbar } from './ControlTopbar.js';

/**
 * Layout raíz del Centro de Control Operativo HNF.
 * Reemplaza el shell legacy (.shell / .sidebar); no es un parche CSS.
 */
export function createControlLayout({
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
  const root = document.createElement('div');
  root.className = 'hnf-cc-layout';
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.add('hnf-cc-shell-active', 'hnf-cc-unified');
  }
  if (typeof window !== 'undefined' && isTabletMode()) {
    root.classList.add('hnf-cc-layout--tablet');
  }

  const { element: sidebarEl } = createControlSidebar({
    layoutRoot: root,
    activeView,
    onNavigate,
    onLogout,
    sessionUserLabel,
    apiBaseLabel,
    integrationStatus,
    deployStatusElement,
    navItems,
    lastDataRefreshAt,
  });

  const main = document.createElement('main');
  main.className = 'hnf-cc-main content content--command-layout';
  main.setAttribute('role', 'main');

  const topbar = createControlTopbar({
    activeView,
    navItems,
    integrationStatus,
    lastDataRefreshAt,
  });

  const viewport = document.createElement('div');
  viewport.className = 'hnf-cc-viewport content__viewport';
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-label', 'Área de trabajo operativo');

  main.append(topbar, viewport);
  root.append(sidebarEl, main);

  return { element: root, content: main, viewport, topbar };
}

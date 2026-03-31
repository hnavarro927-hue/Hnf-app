import { isTabletMode } from '../../domain/jarvis-ui.js';
import { buildOperationalJarvisLine } from '../../domain/hnf-operational-context.js';
import '../../styles/hnf-control-center-layout.css';
import '../../styles/hnf-cockpit-unified.css';
import { createOperationalContextStrip } from './control-operational-context-strip.js';
import { createControlSidebar } from './ControlSidebar.js';
import { createControlTopbar } from './ControlTopbar.js';

/**
 * Layout raíz del Centro de Control Operativo HNF.
 * Viewport único: topbar + strip Jarvis + workspace (scroll interno).
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
  viewData = null,
} = {}) {
  const root = document.createElement('div');
  root.className = 'hnf-cc-layout hnf-cc-master-shell';
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
    onNavigate,
  });

  let jarvisLine = '—';
  try {
    jarvisLine = buildOperationalJarvisLine(activeView, viewData) || '—';
  } catch {
    jarvisLine = '—';
  }
  const contextStrip = createOperationalContextStrip({
    jarvisLine,
    activeView,
    onNavigate,
  });

  const viewportShell = document.createElement('div');
  viewportShell.className = 'hnf-cc-viewport hnf-cc-viewport--shell content__viewport';
  viewportShell.setAttribute('role', 'region');
  viewportShell.setAttribute('aria-label', 'Área de trabajo operativo');

  const workspace = document.createElement('div');
  workspace.className = 'hnf-cc-workspace';
  workspace.setAttribute('aria-label', 'Módulo activo');
  viewportShell.append(workspace);

  main.append(topbar, contextStrip, viewportShell);
  root.append(sidebarEl, main);

  return {
    element: root,
    content: main,
    viewport: workspace,
    viewportShell,
    topbar,
    contextStrip,
  };
}

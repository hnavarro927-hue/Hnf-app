const VIEW_TITLES = {
  'centro-control': 'Mando',
  clima: 'Clima',
  flota: 'Flota',
  'gestion-ot': 'Órdenes de trabajo',
  oportunidades: 'Clientes',
  auditoria: 'Reportes',
  jarvis: 'Jarvis HQ',
  'ingreso-operativo': 'Ingesta',
  'matriz-hnf': 'Matriz',
  'control-gerencial': 'Control gerencial',
  finanzas: 'Finanzas',
  planificacion: 'Planificación',
  'operacion-control': 'Operación',
  'hnf-core': 'HNF Core',
  'base-maestra': 'Base maestra',
  usuarios: 'Usuarios',
};

function el(className, tag = 'div') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

/**
 * @param {{
 *   activeView: string,
 *   onJarvisAlerts?: () => void,
 *   jarvisAlertCount?: number,
 *   authLabel?: string,
 *   onSearchSubmit?: (q: string) => void,
 * }} p
 */
export function createOpsHeader(p) {
  const header = el('hnf-ops-topbar', 'header');
  header.setAttribute('aria-label', 'Barra superior');

  const left = el('hnf-ops-topbar__left');
  const title = el('hnf-ops-topbar__title', 'h1');
  title.textContent = VIEW_TITLES[p.activeView] || 'HNF';
  left.append(title);

  const center = el('hnf-ops-topbar__center');
  const search = el('hnf-ops-input hnf-ops-topbar__search', 'input');
  search.type = 'search';
  search.placeholder = 'Buscar en vista…';
  search.setAttribute('aria-label', 'Buscar');
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      p.onSearchSubmit?.(String(search.value || '').trim());
    }
  });
  center.append(search);

  const right = el('hnf-ops-topbar__right');
  const jarvisBtn = el('hnf-ops-topbar__jarvis', 'button');
  jarvisBtn.type = 'button';
  jarvisBtn.setAttribute('aria-label', 'Alertas Jarvis');
  const jLab = el('hnf-ops-topbar__jarvis-lab', 'span');
  jLab.textContent = 'Jarvis';
  const jBadge = el('hnf-ops-topbar__jarvis-badge', 'span');
  const n = Math.min(99, Number(p.jarvisAlertCount) || 0);
  jBadge.textContent = n > 0 ? String(n) : '';
  jBadge.hidden = n === 0;
  jarvisBtn.append(jLab, jBadge);
  jarvisBtn.addEventListener('click', () => p.onJarvisAlerts?.());

  const user = el('hnf-ops-topbar__user', 'span');
  user.textContent = String(p.authLabel || '').trim() || 'Usuario';

  right.append(jarvisBtn, user);

  header.append(left, center, right);
  return { element: header };
}

function el(className, tag = 'div') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

/**
 * @param {{ integrationStatus?: string, onSync?: () => void }} p
 */
export function createMandoHeaderV2(p) {
  const wrap = el('hnf-mv2-header');
  const left = el('hnf-mv2-header__left');
  const h1 = document.createElement('h1');
  h1.className = 'hnf-mv2-header__title';
  h1.textContent = 'Centro de Control HNF';

  const statusRow = el('hnf-mv2-header__status');
  const dot = el('hnf-mv2-header__dot');
  const ok = String(p?.integrationStatus || '').toLowerCase().includes('conect');
  dot.classList.add(ok ? 'hnf-mv2-header__dot--ok' : 'hnf-mv2-header__dot--off');
  const st = el('hnf-mv2-header__status-text');
  st.textContent = ok ? 'En línea' : 'Sin conexión';
  statusRow.append(dot, st);

  const timeEl = el('hnf-mv2-header__time');
  const tick = () => {
    timeEl.textContent = new Date().toLocaleString('es-CL', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  tick();
  const tid = window.setInterval(tick, 60000);

  left.append(h1, statusRow, timeEl);

  const sync = el('hnf-mv2-btn hnf-mv2-btn--primary', 'button');
  sync.type = 'button';
  sync.textContent = 'Sincronizar';
  sync.addEventListener('click', () => p?.onSync?.());

  wrap.append(left, sync);
  wrap.dataset.hnfMv2Clock = String(tid);
  return wrap;
}

export function disposeMandoHeaderV2(headerEl) {
  const id = headerEl?.dataset?.hnfMv2Clock;
  if (id) window.clearInterval(Number(id));
}

/**
 * @param {{ activas: number, riesgo: number, pendLyn: number, ingresoProcesoLabel: string }} p
 */
export function createMandoKpisV2(p) {
  const row = el('hnf-mv2-kpis');
  const mk = (label, value, variant) => {
    const c = el(`hnf-mv2-kpi${variant ? ` hnf-mv2-kpi--${variant}` : ''}`);
    const v = el('hnf-mv2-kpi__value');
    v.textContent = value;
    const k = el('hnf-mv2-kpi__label');
    k.textContent = label;
    c.append(v, k);
    return c;
  };
  row.append(
    mk('OT activas', String(p.activas ?? 0)),
    mk('OT en riesgo', String(p.riesgo ?? 0), p.riesgo > 0 ? 'danger' : ''),
    mk('Pendientes aprobación (Lyn)', String(p.pendLyn ?? 0), p.pendLyn > 0 ? 'warn' : ''),
    mk('$ Ingreso en proceso', p.ingresoProcesoLabel || '$0')
  );
  return row;
}

/**
 * @param {{ headline: string, subline: string, cta: string, onCta?: () => void }} p
 */
export function createMandoJarvisHero(p) {
  const box = el('hnf-mv2-jarvis-hero');
  const badge = el('hnf-mv2-jarvis-hero__badge');
  badge.textContent = 'Jarvis';
  const h = el('hnf-mv2-jarvis-hero__headline');
  h.textContent = p.headline || '—';
  const s = el('hnf-mv2-jarvis-hero__sub');
  s.textContent = p.subline || '';
  const btn = el('hnf-mv2-btn hnf-mv2-btn--secondary', 'button');
  btn.type = 'button';
  btn.textContent = p.cta || 'Ver detalle';
  btn.addEventListener('click', () => p.onCta?.());
  box.append(badge, h, s, btn);
  return box;
}

/**
 * @param {{
 *   onNuevaOt?: () => void,
 *   onDocumento?: () => void,
 *   onMapa?: () => void,
 *   onAprobarPend?: () => void,
 * }} p
 */
export function createMandoQuickBar(p) {
  const bar = el('hnf-mv2-quick');
  const mk = (label, fn) => {
    const b = el('hnf-mv2-quick__btn', 'button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => fn?.());
    return b;
  };
  bar.append(
    mk('Nueva OT', p.onNuevaOt),
    mk('Subir documento', p.onDocumento),
    mk('Ver mapa', p.onMapa),
    mk('Aprobar pendientes', p.onAprobarPend)
  );
  return bar;
}

/**
 * Asistente flotante siempre visible.
 * @param {{ line: string, onOpen?: () => void }} p
 */
export function createJarvisFloatingAssistant(p) {
  const fab = el('hnf-mv2-fab', 'button');
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Jarvis asistente');
  const icon = el('hnf-mv2-fab__icon');
  icon.textContent = '◆';
  const text = el('hnf-mv2-fab__text');
  text.textContent = p.line || 'Jarvis';
  fab.append(icon, text);
  fab.addEventListener('click', () => p.onOpen?.());
  return fab;
}

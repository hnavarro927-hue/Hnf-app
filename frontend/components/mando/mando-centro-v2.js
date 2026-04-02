function el(className, tag = 'div') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

/**
 * @param {{ integrationStatus?: string, onSync?: () => void }} p
 */
export function createMandoHeaderV2(p) {
  const wrap = el('hnf-ctl-header');
  const left = el('hnf-ctl-header__left');
  const h1 = document.createElement('h1');
  h1.className = 'hnf-ctl-header__brand';
  h1.textContent = 'HNF CONTROL';

  const statusRow = el('hnf-ctl-header__status');
  const dot = el('hnf-ctl-header__dot');
  const ok = String(p?.integrationStatus || '').toLowerCase().includes('conect');
  dot.classList.add(ok ? 'hnf-ctl-header__dot--ok' : 'hnf-ctl-header__dot--off');
  const st = el('hnf-ctl-header__status-text');
  st.textContent = ok ? 'Online' : 'Offline';
  statusRow.append(dot, st);

  left.append(h1, statusRow);

  const sync = el('hnf-ctl-btn hnf-ctl-btn--sync', 'button');
  sync.type = 'button';
  sync.textContent = 'Sincronizar';
  sync.addEventListener('click', () => p?.onSync?.());

  wrap.append(left, sync);
  return wrap;
}

export function disposeMandoHeaderV2() {
  /* reservado si en el futuro el header usa timers */
}

/**
 * @param {{ activas: number, riesgo: number, pendLyn: number, enProcesoLabel: string }} p
 */
export function createMandoKpisV2(p) {
  const row = el('hnf-ctl-kpis');
  const mk = (label, value, variant) => {
    const c = el(`hnf-ctl-kpi${variant ? ` hnf-ctl-kpi--${variant}` : ''}`);
    const v = el('hnf-ctl-kpi__value');
    v.textContent = value;
    const k = el('hnf-ctl-kpi__label');
    k.textContent = label;
    c.append(v, k);
    return c;
  };
  row.append(
    mk('OT activas', String(p.activas ?? 0)),
    mk('OT en riesgo', String(p.riesgo ?? 0), p.riesgo > 0 ? 'danger' : ''),
    mk('Pendientes aprobación', String(p.pendLyn ?? 0), p.pendLyn > 0 ? 'warn' : ''),
    mk('$ en proceso', p.enProcesoLabel || '$0')
  );
  return row;
}

/**
 * Un solo bloque protagonista: mensaje + CTA.
 * @param {{ message: string, severity?: string, ctaLabel?: string, ctaDisabled?: boolean, onCta?: () => void }} p
 */
export function createMandoJarvisPrime(p) {
  const sev = p.severity || 'ok';
  const box = el(`hnf-ctl-jarvis hnf-ctl-jarvis--${sev}`);
  const inner = el('hnf-ctl-jarvis__inner');
  const msg = el('hnf-ctl-jarvis__message');
  msg.textContent = p.message || '—';
  const btn = el('hnf-ctl-btn hnf-ctl-btn--resolve', 'button');
  btn.type = 'button';
  btn.textContent = p.ctaLabel || 'Ir a resolver';
  btn.disabled = Boolean(p.ctaDisabled);
  btn.addEventListener('click', () => {
    if (!btn.disabled) p.onCta?.();
  });
  inner.append(msg, btn);
  box.append(inner);
  return box;
}

/**
 * @param {{
 *   onNuevaOt?: () => void,
 *   onDocumento?: () => void,
 *   onMapa?: () => void,
 *   onAprobar?: () => void,
 * }} p
 */
export function createMandoQuickBar(p) {
  const bar = el('hnf-ctl-dock');
  const mk = (label, fn) => {
    const b = el('hnf-ctl-dock__btn', 'button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => fn?.());
    return b;
  };
  bar.append(
    mk('Nueva OT', p.onNuevaOt),
    mk('Subir documento', p.onDocumento),
    mk('Ver mapa', p.onMapa),
    mk('Aprobar', p.onAprobar)
  );
  return bar;
}

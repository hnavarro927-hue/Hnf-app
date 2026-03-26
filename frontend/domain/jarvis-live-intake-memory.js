const LS = 'hnf_jarvis_live_entries_v1';
const MAX = 5;

const read = () => {
  try {
    const r = localStorage.getItem(LS);
    const a = r ? JSON.parse(r) : [];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

const write = (arr) => {
  try {
    localStorage.setItem(LS, JSON.stringify(arr.slice(0, MAX)));
  } catch {
    /* ignore */
  }
};

/**
 * @param {object} row
 */
export function appendLiveIntakeEntry(row) {
  const cur = read();
  cur.unshift({
    at: new Date().toISOString(),
    tipo: row.tipo || '—',
    resumen: String(row.resumen || '').slice(0, 200),
    interpretacion: String(row.interpretacion || '').slice(0, 200),
    responsable: row.responsable || '—',
    estado: row.estado || 'recibido',
    accion_tomada: row.accion_tomada || '—',
    classificationSnapshot: row.classificationSnapshot || null,
  });
  write(cur);
}

export function getLiveIntakeEntries() {
  return read();
}

/**
 * @param {object} [opts]
 * @param {(entry: object) => void} [opts.onSelectEntry]
 */
export function createLiveIntakeEntriesPanel(opts = {}) {
  const onSelect = typeof opts.onSelectEntry === 'function' ? opts.onSelectEntry : null;
  const sec = document.createElement('div');
  sec.className = 'jarvis-live-entries';
  const h = document.createElement('h3');
  h.className = 'jarvis-live-entries__title';
  h.textContent = 'ÚLTIMAS ENTRADAS VIVAS';
  const hint = document.createElement('p');
  hint.className = 'jarvis-live-entries__hint muted small';
  hint.textContent = onSelect
    ? 'Tocá una entrada para cargarla en el núcleo (misma lectura que JARVIS DECIDE).'
    : '';
  const ul = document.createElement('ul');
  ul.className = 'jarvis-live-entries__ul';
  const items = getLiveIntakeEntries();
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'muted jarvis-live-entries__empty';
    li.textContent = 'Aún no hay entradas registradas desde el núcleo de ingreso.';
    ul.append(li);
  } else {
    for (const it of items) {
      const li = document.createElement('li');
      li.className = 'jarvis-live-entries__li';
      if (onSelect) {
        li.classList.add('jarvis-live-entries__li--selectable');
        li.setAttribute('role', 'button');
        li.tabIndex = 0;
        li.addEventListener('click', () => onSelect(it));
        li.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            onSelect(it);
          }
        });
      }
      const t = new Date(it.at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
      li.innerHTML = `<span class="jarvis-live-entries__meta">${t} · ${it.tipo}</span><span class="jarvis-live-entries__sum">${it.resumen || '—'}</span><span class="jarvis-live-entries__sub muted small">${it.interpretacion || ''} · ${it.responsable} · ${it.estado}</span>`;
      ul.append(li);
    }
  }
  sec.append(h, hint, ul);
  return sec;
}

export function refreshLiveIntakeEntriesPanel(container, opts = {}) {
  if (!container || !container.isConnected) return;
  const next = createLiveIntakeEntriesPanel(opts);
  container.replaceWith(next);
  return next;
}

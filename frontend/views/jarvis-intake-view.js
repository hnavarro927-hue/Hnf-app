/**
 * Bandeja UI Jarvis Intake (DOM): analiza texto con parsearEntradaOperativa y delega el volcado al formulario de ingreso.
 * No crea OT ni llama al servidor.
 */
/* jarvis-intake-view.css vía app.css */
import { parsearEntradaOperativa } from '../domain/jarvis-intake.js';

const ORIGEN_LABEL = {
  whatsapp: 'WhatsApp',
  correo: 'Correo',
  manual: 'Manual',
};

function fmtShort(texto, n = 48) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function rowPreview(dl, dt, dd) {
  const ddt = document.createElement('dt');
  ddt.className = 'hnf-jarvis-intake__preview-dt';
  ddt.textContent = dt;
  const ddd = document.createElement('dd');
  ddd.className = 'hnf-jarvis-intake__preview-dd';
  ddd.textContent = dd;
  dl.append(ddt, ddd);
}

/**
 * @param {{
 *   onApply: (item: { id: string, origen: string, texto: string, parse: ReturnType<typeof parsearEntradaOperativa> }, opts: { directo: boolean }) => void,
 * }} options
 * @returns {{ root: HTMLElement, setOpen: (open: boolean) => void, isOpen: () => boolean }}
 */
export function createJarvisIntakeBandeja(options) {
  const onApply = typeof options?.onApply === 'function' ? options.onApply : () => {};

  /** @type {Array<{ id: string, origen: string, texto: string, parse: ReturnType<typeof parsearEntradaOperativa>, at: number }>} */
  let items = [];
  let selectedId = null;

  const root = document.createElement('div');
  root.className = 'hnf-jarvis-intake';
  root.setAttribute('aria-label', 'Bandeja Jarvis Intake');

  const head = document.createElement('div');
  head.className = 'hnf-jarvis-intake__head';
  const title = document.createElement('h3');
  title.className = 'hnf-jarvis-intake__title';
  title.textContent = 'Jarvis Intake · interpretación local';
  const btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.className = 'secondary-button hnf-jarvis-intake__close';
  btnClose.textContent = 'Cerrar bandeja';
  head.append(title, btnClose);

  const grid = document.createElement('div');
  grid.className = 'hnf-jarvis-intake__grid';

  const wrapOrigen = document.createElement('div');
  const lbO = document.createElement('span');
  lbO.className = 'hnf-jarvis-intake__label';
  lbO.textContent = 'Origen del texto';
  const selOrigen = document.createElement('select');
  selOrigen.className = 'hnf-jarvis-intake__select';
  selOrigen.setAttribute('aria-label', 'Origen del mensaje');
  [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'correo', label: 'Correo' },
    { value: 'manual', label: 'Manual' },
  ].forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    selOrigen.append(opt);
  });
  wrapOrigen.append(lbO, selOrigen);

  const wrapTa = document.createElement('div');
  const lbT = document.createElement('span');
  lbT.className = 'hnf-jarvis-intake__label';
  lbT.textContent = 'Texto del pedido (pegar mensaje)';
  const ta = document.createElement('textarea');
  ta.className = 'hnf-jarvis-intake__textarea';
  ta.setAttribute('aria-label', 'Texto a analizar');
  ta.placeholder =
    'Ej.: Cliente: Puma Maipú — mantención aire split sala 2 no enfría, urgente.';
  wrapTa.append(lbT, ta);

  grid.append(wrapOrigen, wrapTa);

  const actionsTop = document.createElement('div');
  actionsTop.className = 'hnf-jarvis-intake__actions';
  const btnAnalizar = document.createElement('button');
  btnAnalizar.type = 'button';
  btnAnalizar.className = 'secondary-button';
  btnAnalizar.textContent = 'Analizar texto';
  actionsTop.append(btnAnalizar);

  const list = document.createElement('ul');
  list.className = 'hnf-jarvis-intake__list';
  list.setAttribute('aria-label', 'Entradas analizadas');

  const preview = document.createElement('div');
  preview.className = 'hnf-jarvis-intake__preview';
  const dl = document.createElement('dl');
  dl.className = 'hnf-jarvis-intake__preview-dl';
  preview.append(dl);

  const foot = document.createElement('div');
  foot.className = 'hnf-jarvis-intake__foot';
  const btnCrear = document.createElement('button');
  btnCrear.type = 'button';
  btnCrear.className = 'primary-button';
  btnCrear.textContent = 'Crear OT';
  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'secondary-button';
  btnEditar.textContent = 'Editar antes de crear';
  foot.append(btnCrear, btnEditar);

  const hint = document.createElement('p');
  hint.className = 'hnf-jarvis-intake__hint';
  hint.textContent =
    'Nada se guarda hasta que completes el formulario y pulses «Guardar solicitud». Con confianza baja no se permite volcar en modo directo: usá «Editar antes de crear».';

  root.append(head, grid, actionsTop, list, preview, foot, hint);

  const selectedItem = () => items.find((x) => x.id === selectedId) || null;

  const renderList = () => {
    list.replaceChildren();
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'muted small';
      li.style.listStyle = 'none';
      li.textContent = 'Todavía no hay entradas. Pegá un mensaje y pulsá «Analizar texto».';
      list.append(li);
      return;
    }
    for (const it of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `hnf-jarvis-intake__item${it.id === selectedId ? ' hnf-jarvis-intake__item--on' : ''}`;
      const left = document.createElement('span');
      left.textContent = `${ORIGEN_LABEL[it.origen] || it.origen} · ${it.parse.confianza}`;
      const meta = document.createElement('span');
      meta.className = 'hnf-jarvis-intake__item-meta';
      meta.textContent = fmtShort(it.texto, 56);
      btn.append(left, meta);
      btn.addEventListener('click', () => {
        selectedId = it.id;
        renderList();
        renderPreview();
        syncFoot();
      });
      const li = document.createElement('li');
      li.append(btn);
      list.append(li);
    }
  };

  const renderPreview = () => {
    dl.replaceChildren();
    const it = selectedItem();
    if (!it) {
      rowPreview(dl, 'Vista previa', 'Seleccioná una entrada de la lista.');
      return;
    }
    const p = it.parse;
    rowPreview(dl, 'Cliente (detectado)', p.cliente || '— (completar en el formulario)');
    rowPreview(dl, 'Tipo', p.tipo || '— (definir en el formulario)');
    rowPreview(dl, 'Prioridad sugerida', p.prioridadSugerida);
    rowPreview(dl, 'Responsable sugerido', p.responsableSugerido || '—');
    rowPreview(dl, 'Confianza', p.confianza);
    rowPreview(dl, 'Descripción', fmtShort(p.descripcion, 400));
  };

  const syncFoot = () => {
    const it = selectedItem();
    const baja = !it || it.parse.confianza === 'baja';
    btnCrear.disabled = baja;
    btnCrear.title = baja
      ? 'Confianza baja: completá datos en el formulario con «Editar antes de crear».'
      : 'Rellena el formulario y llevá al paso final; revisá y guardá manualmente.';
    hint.classList.toggle('hnf-jarvis-intake__hint--warn', Boolean(it && it.parse.confianza === 'baja'));
  };

  btnAnalizar.addEventListener('click', () => {
    const texto = ta.value;
    const origen = selOrigen.value;
    const parse = parsearEntradaOperativa({ origen, texto });
    const id = `ji-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    items = [{ id, origen, texto, parse, at: Date.now() }, ...items].slice(0, 30);
    selectedId = id;
    renderList();
    renderPreview();
    syncFoot();
  });

  btnCrear.addEventListener('click', () => {
    const it = selectedItem();
    if (!it || it.parse.confianza === 'baja') return;
    onApply(it, { directo: true });
  });

  btnEditar.addEventListener('click', () => {
    const it = selectedItem();
    if (!it) return;
    onApply(it, { directo: false });
  });

  btnClose.addEventListener('click', () => setOpen(false));

  const setOpen = (open) => {
    root.classList.toggle('hnf-jarvis-intake--open', Boolean(open));
  };

  const isOpen = () => root.classList.contains('hnf-jarvis-intake--open');

  renderList();
  renderPreview();
  syncFoot();

  return { root, setOpen, isOpen };
}

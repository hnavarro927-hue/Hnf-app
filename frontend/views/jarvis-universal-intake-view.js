import '../styles/jarvis-universal-intake.css';
import {
  JARVIS_DOCUMENT_ENTRY_TYPES,
  buildFileDescriptorStub,
  routeDocument,
} from '../domain/jarvis-document-router.js';
import {
  appendUniversalIntakeItem,
  listUniversalIntakeItems,
} from '../domain/jarvis-universal-intake-storage.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';

const DEST_LABEL = {
  ot: 'OT / operaciones',
  compras: 'Compras',
  finanzas: 'Finanzas',
  documentos_cliente: 'Documentos cliente',
  evidencia: 'Evidencia OT',
  bandeja_revision: 'Bandeja por revisar',
};

const ENTRY_LABEL = {
  whatsapp: 'WhatsApp',
  correo: 'Correo',
  orden_compra: 'Orden de compra',
  cotizacion: 'Cotización',
  factura: 'Factura',
  guia_despacho: 'Guía de despacho',
  informe_tecnico: 'Informe técnico',
  evidencia: 'Evidencia',
  otro: 'Otro',
};

const SOURCE_OPTIONS = [
  { value: '', label: 'Detectar automáticamente' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'correo', label: 'Correo' },
  { value: 'email', label: 'Correo (email)' },
];

function el(className, tag = 'div') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

/**
 * Ingesta universal Jarvis — reemplaza el flujo principal del módulo ingreso-operativo.
 */
export function jarvisUniversalIntakeView({
  data,
  navigateToView,
  reloadApp,
} = {}) {
  const root = el('hnf-jarvis-intake hnf-op-view', 'section');
  root.setAttribute('aria-label', 'Ingesta universal Jarvis');

  const head = el('hnf-jarvis-intake__head');
  const h1 = el('hnf-jarvis-intake__title', 'h1');
  h1.textContent = 'Ingesta universal';
  const sub = el('hnf-jarvis-intake__sub', 'p');
  sub.textContent =
    'Jarvis clasifica texto y metadatos de archivo (PDF e imágenes: preparado; subida persistente próximamente). Nada se descarta: lo incierto queda en revisión.';
  head.append(h1, sub);

  const grid = el('hnf-jarvis-intake__grid');

  const formCard = el('hnf-jarvis-intake__card');
  const fcTitle = el('hnf-jarvis-intake__card-title', 'h2');
  fcTitle.textContent = 'Entrada';
  const srcRow = el('hnf-jarvis-intake__field');
  const srcLab = el('hnf-jarvis-intake__label', 'label');
  srcLab.htmlFor = 'uji-source';
  srcLab.textContent = 'Canal declarado';
  const srcSel = el('hnf-jarvis-intake__select', 'select');
  srcSel.id = 'uji-source';
  for (const o of SOURCE_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    srcSel.append(opt);
  }
  srcRow.append(srcLab, srcSel);

  const typeRow = el('hnf-jarvis-intake__field');
  const typeLab = el('hnf-jarvis-intake__label', 'label');
  typeLab.htmlFor = 'uji-type';
  typeLab.textContent = 'Tipo documental (opcional)';
  const typeSel = el('hnf-jarvis-intake__select', 'select');
  typeSel.id = 'uji-type';
  const optAuto = document.createElement('option');
  optAuto.value = '';
  optAuto.textContent = 'Inferir por contenido';
  typeSel.append(optAuto);
  for (const t of JARVIS_DOCUMENT_ENTRY_TYPES) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = ENTRY_LABEL[t] || t;
    typeSel.append(opt);
  }
  typeRow.append(typeLab, typeSel);

  const taRow = el('hnf-jarvis-intake__field');
  const taLab = el('hnf-jarvis-intake__label', 'label');
  taLab.htmlFor = 'uji-text';
  taLab.textContent = 'Texto o pegado de documento';
  const ta = el('hnf-jarvis-intake__textarea', 'textarea');
  ta.id = 'uji-text';
  ta.rows = 8;
  ta.placeholder = 'Pegá asunto, cuerpo, OCR manual o notas. Cliente: … OC: … OT: …';
  taRow.append(taLab, ta);

  const fileRow = el('hnf-jarvis-intake__field');
  const fileLab = el('hnf-jarvis-intake__label', 'label');
  fileLab.htmlFor = 'uji-file';
  fileLab.textContent = 'Archivo (local, sin subir aún)';
  const fileIn = el('hnf-jarvis-intake__file', 'input');
  fileIn.type = 'file';
  fileIn.id = 'uji-file';
  fileIn.accept = '.pdf,image/*,.png,.jpg,.jpeg,.webp';
  const fileHint = el('hnf-jarvis-intake__hint', 'p');
  fileHint.textContent =
    'El archivo no se envía al servidor en esta versión: solo se usa nombre y tipo para enrutar y guardar la fila local.';
  fileRow.append(fileLab, fileIn, fileHint);

  const actions = el('hnf-jarvis-intake__actions');
  const btnRoute = el('primary-button hnf-jarvis-intake__btn', 'button');
  btnRoute.type = 'button';
  btnRoute.textContent = 'Enrutar con Jarvis';
  const btnClassic = el('secondary-button hnf-jarvis-intake__btn--secondary', 'button');
  btnClassic.type = 'button';
  btnClassic.textContent = 'Ingreso operativo clásico';
  btnClassic.addEventListener('click', () => navigateToView?.('ingreso-clasico'));
  actions.append(btnRoute, btnClassic);

  const resultHost = el('hnf-jarvis-intake__result');

  formCard.append(fcTitle, srcRow, typeRow, taRow, fileRow, actions, resultHost);

  const listCard = el('hnf-jarvis-intake__card');
  const lcTitle = el('hnf-jarvis-intake__card-title', 'h2');
  lcTitle.textContent = 'Cola local reciente';
  const listUl = el('hnf-jarvis-intake__list', 'ul');
  listCard.append(lcTitle, listUl);

  grid.append(formCard, listCard);

  let lastFile = null;
  fileIn.addEventListener('change', () => {
    lastFile = fileIn.files?.[0] || null;
  });

  function renderList() {
    listUl.replaceChildren();
    const items = listUniversalIntakeItems().slice(0, 40);
    if (!items.length) {
      const li = el('hnf-jarvis-intake__empty', 'li');
      li.textContent = 'Sin ítems aún.';
      listUl.append(li);
      return;
    }
    for (const it of items) {
      const li = el('hnf-jarvis-intake__li', 'li');
      const badge = it.revision_jarvis_pendiente
        ? ' · revision_jarvis_pendiente'
        : '';
      li.textContent = `${String(it.creadoEn || '').slice(0, 16)} · ${ENTRY_LABEL[it.entryType] || it.entryType} → ${DEST_LABEL[it.destination] || it.destination}${badge}`;
      listUl.append(li);
    }
  }

  btnRoute.addEventListener('click', () => {
    const forced = typeSel.value || null;
    const route = routeDocument({
      text: ta.value,
      declaredSource: srcSel.value || null,
      fileStub: buildFileDescriptorStub(lastFile),
      forcedEntryType: forced,
    });
    const row = appendUniversalIntakeItem({
      textSample: ta.value.slice(0, 2000),
      fileStub: buildFileDescriptorStub(lastFile),
      declaredSource: srcSel.value || null,
      ...route,
    });
    resultHost.replaceChildren();
    const box = el('hnf-jarvis-intake__route-box');
    const line = (strong, rest) => {
      const p = el('hnf-jarvis-intake__route-line', 'p');
      const b = document.createElement('strong');
      b.textContent = strong;
      p.append(b, document.createTextNode(` · ${rest}`));
      return p;
    };
    box.append(
      line('Tipo', `${ENTRY_LABEL[route.entryType] || route.entryType} (${route.confidence})`),
      line('Destino', DEST_LABEL[route.destination] || route.destination),
      line('Área', route.area),
      line('Cliente', route.client || 'sin dato'),
      line('OC / OT', `${route.ocNumber || '—'} / ${route.otNumber || '—'}`),
      line(
        'Monto / fecha',
        `${route.amount != null ? route.amount : 'sin dato'} · ${route.dateIso || 'sin dato'}`
      )
    );
    const rat = el('hnf-jarvis-intake__route-rationale', 'p');
    rat.textContent = `${row.revision_jarvis_pendiente ? 'Marcado revision_jarvis_pendiente. ' : ''}${route.rationale}`;
    box.append(rat);
    resultHost.append(box);
    renderList();
  });

  const foot = el('hnf-jarvis-intake__foot');
  const sync = el('secondary-button', 'button');
  sync.type = 'button';
  sync.textContent = 'Actualizar datos';
  sync.addEventListener('click', () => {
    if (typeof reloadApp === 'function') void reloadApp();
  });
  foot.append(sync);

  root.append(head, createHnfOperationalFlowStrip(1), grid, foot);
  renderList();
  return root;
}

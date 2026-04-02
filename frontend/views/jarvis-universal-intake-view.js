/* Jarvis universal intake: hnf-ds-jarvis.css vía app.css */
import {
  JARVIS_DOCUMENT_ENTRY_TYPES,
  buildFileDescriptorStub,
  routeDocument,
} from '../domain/jarvis-document-router.js';
import {
  appendUniversalIntakeItem,
  listUniversalIntakeItems,
} from '../domain/jarvis-universal-intake-storage.js';
import {
  createClient,
  createOT,
  createQuickTestOT,
  getClients,
  getOTs,
} from '../domain/hnf-local-registry.js';
import { createOtFromIntakeFlow } from '../domain/ot-repository.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import {
  listStarkDocuments,
  uploadStarkDocument,
} from '../services/stark-documents.service.js';

const DEST_LABEL = {
  ot: 'OT / operaciones',
  compras: 'Compras',
  finanzas: 'Finanzas',
  documentos_cliente: 'Documentos cliente',
  evidencia: 'Evidencia OT',
  bandeja_revision: 'Bandeja por revisar',
};

const DEST_STARK_LABEL = {
  compras: 'Compras',
  finanzas: 'Finanzas',
  cliente_documentos: 'Documentos cliente',
  evidencia: 'Evidencia OT',
  OT: 'OT / operaciones',
  bandeja_revision_jarvis: 'Bandeja revisión Jarvis',
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
 * Ingesta universal Jarvis — router local + subida multipart Stark Integrity (servidor).
 */
export function jarvisUniversalIntakeView({
  data,
  navigateToView,
  reloadApp,
} = {}) {
  const root = el('hnf-jarvis-intake hnf-op-view hnf-stark-surface', 'section');
  root.setAttribute('aria-label', 'Ingesta universal Jarvis');

  const shell = el('hnf-jarvis-intake__shell');
  const chrome = el('hnf-jarvis-intake__chrome');
  const chromeBrand = el('hnf-jarvis-intake__chrome-brand');
  chromeBrand.textContent = 'Jarvis | Integridad Operativa HNF';
  const chromeMeta = el('hnf-jarvis-intake__chrome-meta', 'p');
  chromeMeta.textContent =
    'Stark Integrity: subida real multipart al backend (`POST /jarvis/stark/documents`), metadatos en `jarvis_stark_documents.json`, archivos en `data/stark-uploads/`. Router servidor alineado a `jarvis-document-router.js`.';
  chrome.append(chromeBrand, chromeMeta);

  const body = el('hnf-jarvis-intake__body');
  const rail = el('hnf-jarvis-intake__rail');
  const railH = el('hnf-jarvis-intake__rail-h', 'h3');
  railH.textContent = 'Tipos soportados';
  rail.append(railH);
  for (const t of JARVIS_DOCUMENT_ENTRY_TYPES) {
    const chip = el('hnf-jarvis-intake__chip', 'span');
    chip.textContent = ENTRY_LABEL[t] || t;
    rail.append(chip);
  }

  const main = el('hnf-jarvis-intake__main');

  const head = el('hnf-jarvis-intake__head');
  const h1 = el('hnf-jarvis-intake__title', 'h1');
  h1.textContent = 'Enrutado de entrada';
  const sub = el('hnf-jarvis-intake__sub', 'p');
  sub.textContent =
    'Hernán, podés enrutar en cola local (sin red) o subir el archivo al servidor: Jarvis clasifica por texto extraído (PDF), nombre, MIME y canal, define destino operativo y deja trazabilidad auditada.';
  head.append(h1, sub);

  const grid = el('hnf-jarvis-intake__grid');

  const formCard = el('hnf-jarvis-intake__card');
  const fcTitle = el('hnf-jarvis-intake__card-title', 'h2');
  fcTitle.textContent = 'Entrada';
  const srcRow = el('hnf-jarvis-intake__field');
  const srcLab = el('hnf-jarvis-intake__label', 'label');
  srcLab.htmlFor = 'uji-source';
  srcLab.textContent = 'Origen declarado';
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

  const cliRow = el('hnf-jarvis-intake__field');
  const cliLab = el('hnf-jarvis-intake__label', 'label');
  cliLab.htmlFor = 'uji-cliente';
  cliLab.textContent = 'Cliente (opcional)';
  const cliIn = el('hnf-jarvis-intake__input', 'input');
  cliIn.type = 'text';
  cliIn.id = 'uji-cliente';
  cliIn.placeholder = 'Razón social o nombre';
  cliRow.append(cliLab, cliIn);

  const otRow = el('hnf-jarvis-intake__field');
  const otLab = el('hnf-jarvis-intake__label', 'label');
  otLab.htmlFor = 'uji-ot';
  otLab.textContent = 'OT / referencia (opcional)';
  const otIn = el('hnf-jarvis-intake__input', 'input');
  otIn.type = 'text';
  otIn.id = 'uji-ot';
  otIn.placeholder = 'Ej. OT-1234';
  otRow.append(otLab, otIn);

  const taRow = el('hnf-jarvis-intake__field');
  const taLab = el('hnf-jarvis-intake__label', 'label');
  taLab.htmlFor = 'uji-text';
  taLab.textContent = 'Texto o notas';
  const ta = el('hnf-jarvis-intake__textarea', 'textarea');
  ta.id = 'uji-text';
  ta.rows = 8;
  ta.placeholder = 'Pegá asunto, cuerpo u OCR manual. Cliente: … OC: … OT: …';
  taRow.append(taLab, ta);

  const fileRow = el('hnf-jarvis-intake__field');
  const fileLab = el('hnf-jarvis-intake__label', 'label');
  fileLab.htmlFor = 'uji-file';
  fileLab.textContent = 'Archivo (PDF / imagen)';
  const fileIn = el('hnf-jarvis-intake__file', 'input');
  fileIn.type = 'file';
  fileIn.id = 'uji-file';
  fileIn.accept = '.pdf,image/*,.png,.jpg,.jpeg,.webp,.gif';
  const fileHint = el('hnf-jarvis-intake__hint', 'p');
  fileHint.textContent =
    'OC, factura, guía, cotización o evidencia: subí PDF o imagen. Imágenes quedan con OCR pendiente en servidor hasta motor dedicado.';
  fileRow.append(fileLab, fileIn, fileHint);

  const actions = el('hnf-jarvis-intake__actions');
  const btnStark = el('primary-button hnf-jarvis-intake__btn hnf-jarvis-intake__btn--stark', 'button');
  btnStark.type = 'button';
  btnStark.textContent = 'Subir al servidor (Stark)';
  const btnRoute = el('secondary-button hnf-jarvis-intake__btn hnf-jarvis-intake__btn--route', 'button');
  btnRoute.type = 'button';
  btnRoute.textContent = 'Solo cola local';
  const btnClassic = el('secondary-button hnf-jarvis-intake__btn--secondary', 'button');
  btnClassic.type = 'button';
  btnClassic.textContent = 'Ingreso operativo clásico';
  btnClassic.addEventListener('click', () => navigateToView?.('ingreso-clasico'));
  actions.append(btnStark, btnRoute, btnClassic);

  const resultHost = el('hnf-jarvis-intake__result');

  formCard.append(
    fcTitle,
    srcRow,
    typeRow,
    cliRow,
    otRow,
    taRow,
    fileRow,
    actions,
    resultHost
  );

  const listCard = el('hnf-jarvis-intake__card');
  const lcTitle = el('hnf-jarvis-intake__card-title', 'h2');
  lcTitle.textContent = 'Historial';
  const serverH = el('hnf-jarvis-intake__list-sub', 'h3');
  serverH.textContent = 'Stark — servidor';
  const listServerUl = el('hnf-jarvis-intake__list hnf-jarvis-intake__list--server', 'ul');
  const localH = el('hnf-jarvis-intake__list-sub', 'h3');
  localH.textContent = 'Cola local';
  const listUl = el('hnf-jarvis-intake__list', 'ul');
  listCard.append(lcTitle, serverH, listServerUl, localH, listUl);

  grid.append(formCard, listCard);

  let lastFile = null;
  fileIn.addEventListener('change', () => {
    lastFile = fileIn.files?.[0] || null;
    btnStark.disabled = !lastFile;
  });
  btnStark.disabled = true;

  function renderRouteBox(route, extraNote) {
    const box = el('hnf-jarvis-intake__route-box');
    const line = (strong, rest) => {
      const p = el('hnf-jarvis-intake__route-line', 'p');
      const b = document.createElement('strong');
      b.textContent = strong;
      p.append(b, document.createTextNode(` · ${rest}`));
      return p;
    };
    const dest =
      route.destination && DEST_STARK_LABEL[route.destination]
        ? DEST_STARK_LABEL[route.destination]
        : DEST_LABEL[route.destination] || route.destination;
    box.append(
      line('Tipo', `${ENTRY_LABEL[route.entryType] || route.entryType} (${route.confidence})`),
      line('Destino', dest),
      line('Área', route.area),
      line('Cliente', route.client || 'sin dato'),
      line('OC / OT', `${route.ocNumber || '—'} / ${route.otNumber || '—'}`),
      line(
        'Monto / fecha',
        `${route.amount != null ? route.amount : 'sin dato'} · ${route.dateIso || 'sin dato'}`
      )
    );
    const rat = el('hnf-jarvis-intake__route-rationale', 'p');
    rat.textContent = `${route.revision_jarvis_pendiente ? 'Marcado revision_jarvis_pendiente. ' : ''}${route.rationale}${extraNote ? ` ${extraNote}` : ''}`;
    box.append(rat);
    return box;
  }

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
      const badge = it.revision_jarvis_pendiente ? ' · revision_jarvis_pendiente' : '';
      li.textContent = `${String(it.creadoEn || '').slice(0, 16)} · ${ENTRY_LABEL[it.entryType] || it.entryType} → ${DEST_LABEL[it.destination] || it.destination}${badge}`;
      listUl.append(li);
    }
  }

  async function refreshServerList() {
    listServerUl.replaceChildren();
    const loading = el('hnf-jarvis-intake__empty', 'li');
    loading.textContent = 'Cargando documentos Stark…';
    listServerUl.append(loading);
    try {
      const rows = await listStarkDocuments(50);
      listServerUl.replaceChildren();
      if (!Array.isArray(rows) || !rows.length) {
        const li = el('hnf-jarvis-intake__empty', 'li');
        li.textContent = 'Sin subidas en servidor aún.';
        listServerUl.append(li);
        return;
      }
      for (const r of rows) {
        const li = el('hnf-jarvis-intake__li', 'li');
        const rt = r.router || {};
        const dest = DEST_STARK_LABEL[rt.destination] || rt.destination || '—';
        const pend = rt.revision_jarvis_pendiente ? ' · revisión pendiente' : '';
        li.textContent = `${String(r.creadoEn || '').slice(0, 16)} · ${r.nombreOriginal || 'archivo'} · ${ENTRY_LABEL[rt.entryType] || rt.entryType} → ${dest}${pend}`;
        listServerUl.append(li);
      }
    } catch (e) {
      listServerUl.replaceChildren();
      const li = el('hnf-jarvis-intake__empty', 'li');
      li.textContent = `No se pudo leer el servidor: ${e.message || 'error'}`;
      listServerUl.append(li);
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
    appendUniversalIntakeItem({
      textSample: ta.value.slice(0, 2000),
      fileStub: buildFileDescriptorStub(lastFile),
      declaredSource: srcSel.value || null,
      ...route,
    });
    if (String(route.destination || '').toLowerCase() === 'ot') {
      createOtFromIntakeFlow({
        text: ta.value,
        descripcion: ta.value.slice(0, 2000),
        cliente: route.client || cliIn.value || '',
        area: route.area,
      });
    }
    resultHost.replaceChildren();
    resultHost.append(renderRouteBox(route, '(solo cola local; no se envió al servidor.)'));
    renderList();
  });

  btnStark.addEventListener('click', async () => {
    if (!lastFile) {
      resultHost.replaceChildren();
      const err = el('hnf-jarvis-intake__err', 'p');
      err.textContent = 'Seleccioná un archivo para subir al servidor.';
      resultHost.append(err);
      return;
    }
    btnStark.disabled = true;
    resultHost.replaceChildren();
    const wait = el('hnf-jarvis-intake__hint', 'p');
    wait.textContent = 'Subiendo y clasificando en servidor…';
    resultHost.append(wait);
    try {
      const pack = await uploadStarkDocument({
        file: lastFile,
        origen: srcSel.value || '',
        cliente: cliIn.value || '',
        otId: otIn.value || '',
        notas: ta.value || '',
        declaredDocType: typeSel.value || undefined,
      });
      const router = pack.router || pack.record?.router;
      resultHost.replaceChildren();
      if (router) {
        resultHost.append(
          renderRouteBox(router, `(registro ${pack.record?.id || '—'} en índice Stark, auditoría central.)`)
        );
        if (String(router.destination || '').toLowerCase() === 'ot') {
          createOtFromIntakeFlow({
            text: ta.value,
            descripcion: (ta.value || pack.record?.notas || '').slice(0, 2000),
            cliente: router.client || cliIn.value || '',
            area: router.area,
          });
        }
      } else {
        const ok = el('hnf-jarvis-intake__route-box', 'p');
        ok.textContent = 'Subida completada.';
        resultHost.append(ok);
      }
      await refreshServerList();
    } catch (e) {
      resultHost.replaceChildren();
      const err = el('hnf-jarvis-intake__err', 'p');
      err.textContent = e.message || 'Error al subir.';
      resultHost.append(err);
    } finally {
      btnStark.disabled = !lastFile;
    }
  });

  const foot = el('hnf-jarvis-intake__foot');
  const sync = el('secondary-button', 'button');
  sync.type = 'button';
  sync.textContent = 'Actualizar datos';
  sync.addEventListener('click', () => {
    if (typeof reloadApp === 'function') void reloadApp();
    void refreshServerList();
  });
  foot.append(sync);

  const localBox = el('hnf-jarvis-intake__card');
  const localTitle = el('hnf-jarvis-intake__card-title', 'h2');
  localTitle.textContent = 'Persistencia local (clientes + OT → Kanban)';
  const localHint = el('hnf-jarvis-intake__hint', 'p');
  localHint.textContent =
    'Persistencia: base maestra hnf.md.bundle.v1 (clientes; espejo hnf.local.clients.v1) y operación hnf.ot.flow.v1 (localOts). Tras crear OT, abrí Mando o Actualizar datos.';

  const rowCli = el('hnf-jarvis-intake__field');
  const lbCli = el('hnf-jarvis-intake__label', 'label');
  lbCli.htmlFor = 'hnf-lr-cli-nombre';
  lbCli.textContent = 'Nombre cliente (nuevo)';
  const inCli = el('hnf-jarvis-intake__input', 'input');
  inCli.id = 'hnf-lr-cli-nombre';
  inCli.type = 'text';
  inCli.placeholder = 'Ej. Tienda Central';
  const btnSaveCli = el('primary-button', 'button');
  btnSaveCli.type = 'button';
  btnSaveCli.textContent = 'Guardar cliente';
  rowCli.append(lbCli, inCli, btnSaveCli);

  const rowOt = el('hnf-jarvis-intake__field');
  const lbSel = el('hnf-jarvis-intake__label', 'label');
  lbSel.htmlFor = 'hnf-lr-cli-sel';
  lbSel.textContent = 'Cliente para OT';
  const selCli = el('hnf-jarvis-intake__select', 'select');
  selCli.id = 'hnf-lr-cli-sel';
  const lbTipo = el('hnf-jarvis-intake__label', 'label');
  lbTipo.htmlFor = 'hnf-lr-tipo';
  lbTipo.textContent = 'Tipo';
  const selTipo = el('hnf-jarvis-intake__select', 'select');
  selTipo.id = 'hnf-lr-tipo';
  [['clima', 'Clima'], ['flota', 'Flota']].forEach(([v, lab]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = lab;
    selTipo.append(o);
  });
  const lbDesc = el('hnf-jarvis-intake__label', 'label');
  lbDesc.htmlFor = 'hnf-lr-desc';
  lbDesc.textContent = 'Descripción OT';
  const taOt = el('hnf-jarvis-intake__textarea', 'textarea');
  taOt.id = 'hnf-lr-desc';
  taOt.rows = 2;
  taOt.placeholder = 'Detalle mínimo';
  rowOt.append(lbSel, selCli, lbTipo, selTipo, lbDesc, taOt);

  const fillClientSelect = () => {
    selCli.replaceChildren();
    const clients = getClients();
    if (!clients.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = '— Creá un cliente primero —';
      selCli.append(o);
      return;
    }
    for (const c of clients) {
      const o = document.createElement('option');
      o.value = String(c.id);
      o.textContent = `${c.nombre} (${c.id})`;
      selCli.append(o);
    }
  };

  const statusLr = el('hnf-jarvis-intake__hint', 'p');
  const setLrMsg = (t, isErr) => {
    statusLr.textContent = t;
    statusLr.style.color = isErr ? '#f87171' : '#94a3b8';
  };

  btnSaveCli.addEventListener('click', () => {
    try {
      createClient({ nombre: inCli.value });
      inCli.value = '';
      fillClientSelect();
      setLrMsg(`Clientes: ${getClients().length} · OT locales: ${getOTs().length}`, false);
    } catch (e) {
      setLrMsg(e.message || String(e), true);
    }
  });

  const btnCreOt = el('primary-button', 'button');
  btnCreOt.type = 'button';
  btnCreOt.textContent = 'Crear OT (manual)';
  btnCreOt.addEventListener('click', () => {
    try {
      const cid = selCli.value;
      if (!cid) throw new Error('Elegí un cliente');
      createOT({
        clienteId: cid,
        tipoServicio: selTipo.value,
        descripcion: taOt.value,
      });
      setLrMsg(`OT creada · estado ingreso · OT locales: ${getOTs().length}`, false);
      if (typeof reloadApp === 'function') void reloadApp();
    } catch (e) {
      setLrMsg(e.message || String(e), true);
    }
  });

  const btnQuick = el('secondary-button', 'button');
  btnQuick.type = 'button';
  btnQuick.textContent = 'Crear OT rápida';
  btnQuick.addEventListener('click', () => {
    try {
      createQuickTestOT();
      fillClientSelect();
      setLrMsg(`OT rápida creada · OT locales: ${getOTs().length}`, false);
      if (typeof reloadApp === 'function') void reloadApp();
    } catch (e) {
      setLrMsg(e.message || String(e), true);
    }
  });

  const rowBtns = el('hnf-jarvis-intake__actions');
  rowBtns.append(btnCreOt, btnQuick);

  fillClientSelect();
  setLrMsg(`Clientes: ${getClients().length} · OT locales: ${getOTs().length}`, false);

  localBox.append(localTitle, localHint, rowCli, rowOt, rowBtns, statusLr);

  main.append(head, createHnfOperationalFlowStrip(1), grid, foot, localBox);
  body.append(rail, main);
  shell.append(chrome, body);
  root.append(shell);
  renderList();
  void refreshServerList();
  return root;
}

/**
 * Jarvis agente flotante — asistente persistente (overlay), sin rail lateral.
 * Incluye estación local HNF: adjuntar archivos, fotos, PDF, Excel y respaldar en carpeta/descarga.
 */

import { formatAllCloseBlockersMessage, getEvidenceGaps, otCanClose } from '../utils/ot-evidence.js';
import { computeCommandCenterMetrics } from '../domain/hnf-command-center-metrics.js';
import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';

const LOCAL_WORKSPACE_KEY = 'hnf.jarvis.localWorkspace.v1';
const MAX_TEXT_CHARS = 90000;
const MAX_PREVIEW_BYTES = 950000;

function findOt(data, id) {
  if (!id) return null;
  const list = data?.planOts ?? data?.ots?.data ?? [];
  if (!Array.isArray(list)) return null;
  return list.find((o) => o.id === id) || null;
}

function truncate(s, max) {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function readLocalWorkspace() {
  try {
    const raw = localStorage.getItem(LOCAL_WORKSPACE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return { files: [], notes: [], updatedAt: null };
    return {
      files: Array.isArray(parsed.files) ? parsed.files.slice(-80) : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(-80) : [],
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return { files: [], notes: [], updatedAt: null };
  }
}

function writeLocalWorkspace(workspace) {
  const payload = {
    files: Array.isArray(workspace.files) ? workspace.files.slice(-80) : [],
    notes: Array.isArray(workspace.notes) ? workspace.notes.slice(-80) : [],
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(LOCAL_WORKSPACE_KEY, JSON.stringify(payload));
  return payload;
}

function classifyLocalFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/i.test(name)) return 'foto';
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel';
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.txt') || type.startsWith('text/')) return 'texto';
  return 'archivo';
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').slice(0, MAX_TEXT_CHARS));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo generar vista previa.'));
    reader.readAsDataURL(file);
  });
}

function extractWhatsAppSignals(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  const joined = lines.join('\n');
  const patenteMatches = joined.match(/\b[A-Z]{2,4}[- ]?\d{2,4}\b/gi) || [];
  const moneyMatches = joined.match(/\$\s?\d[\d.]{2,}/g) || [];
  const clientWords = ['puma', 'tattersall', 'autotattersall', 'granleasing', 'west', 'dominion', 'sixt'];
  const detectedClients = clientWords.filter((c) => joined.toLowerCase().includes(c));
  const serviceWords = ['clima', 'mantenci', 'lavado', 'traslado', 'rt', 'revision tecnica', 'obra', 'civil', 'instalaci'];
  const detectedServices = serviceWords.filter((s) => joined.toLowerCase().includes(s));
  return {
    lineas: lines.length,
    posiblesPatentes: [...new Set(patenteMatches.map((x) => x.toUpperCase().replace(' ', '-')))].slice(0, 12),
    montosDetectados: [...new Set(moneyMatches)].slice(0, 12),
    clientesDetectados: detectedClients,
    serviciosDetectados: detectedServices,
    resumen: truncate(lines.slice(0, 6).join(' · '), 420),
  };
}

async function buildLocalFileRecord(file) {
  const kind = classifyLocalFile(file);
  const base = {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name || 'archivo-sin-nombre',
    type: file.type || kind,
    kind,
    size: file.size || 0,
    addedAt: new Date().toISOString(),
    status: 'registrado',
    extraction: null,
    previewDataUrl: null,
  };

  if (['texto', 'csv', 'json'].includes(kind) || file.size <= 180000) {
    try {
      const text = await readFileAsText(file);
      base.textSample = truncate(text, 4000);
      base.extraction = extractWhatsAppSignals(text);
      base.status = 'extraído local';
    } catch {
      base.status = 'registrado sin lectura';
    }
  }

  if (kind === 'foto' && file.size <= MAX_PREVIEW_BYTES) {
    try {
      base.previewDataUrl = await readFileAsDataUrl(file);
      base.status = base.status === 'extraído local' ? 'extraído local + vista previa' : 'vista previa local';
    } catch {
      base.previewDataUrl = null;
    }
  }

  if (kind === 'pdf') {
    base.extraction = {
      resumen: 'PDF registrado localmente. Para extracción completa se requiere motor PDF/backend o carga manual del texto.',
      lineas: 0,
      posiblesPatentes: [],
      montosDetectados: [],
      clientesDetectados: [],
      serviciosDetectados: [],
    };
  }

  if (kind === 'excel') {
    base.extraction = {
      resumen: 'Excel registrado localmente. Base lista para conectar parser XLSX o importación guiada al ERP.',
      lineas: 0,
      posiblesPatentes: [],
      montosDetectados: [],
      clientesDetectados: [],
      serviciosDetectados: [],
    };
  }

  return base;
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function saveWorkspaceToLocalFolder(workspace) {
  if (!('showDirectoryPicker' in window)) {
    downloadJson(`HNF-respaldo-local-${new Date().toISOString().slice(0, 10)}.json`, workspace);
    return 'Descarga generada. En iPad/Safari se guarda en Archivos/Descargas.';
  }
  const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
  const file = await dir.getFileHandle(`HNF-respaldo-local-${new Date().toISOString().slice(0, 10)}.json`, {
    create: true,
  });
  const writable = await file.createWritable();
  await writable.write(JSON.stringify(workspace, null, 2));
  await writable.close();
  return 'Respaldo guardado en carpeta local seleccionada.';
}

/**
 * @param {object} ctx
 * @returns {object}
 */
export function buildJarvisAgentBrief(ctx) {
  const {
    activeView = 'jarvis',
    data = {},
    integrationStatus = 'pendiente',
    selectedOTId = null,
  } = ctx;

  const adn = buildHnfAdnSnapshot(data);
  const metrics = computeCommandCenterMetrics(data, { hnfAdn: adn });
  const ot = activeView === 'clima' ? findOt(data, selectedOTId) : null;
  const workspace = readLocalWorkspace();
  const attachedCount = workspace.files.length;

  let statusLabel = 'Activo';
  if (integrationStatus === 'sin conexión') statusLabel = 'Sin conexión';
  else if (integrationStatus === 'cargando' || integrationStatus === 'pendiente') {
    statusLabel = 'Sincronizando';
  }

  let priorityLine = 'Operación estable en este corte.';
  if (metrics.otSinEvidenciaCompleta > 0) {
    priorityLine = `${metrics.otSinEvidenciaCompleta} OT sin evidencia completa · priorizar cierre limpio.`;
  } else if (metrics.otEnRiesgo > 0) {
    priorityLine = `${metrics.otEnRiesgo} OT en riesgo o atraso · revisión en Clima.`;
  } else if (metrics.solicitudesNuevasHoy > 0) {
    priorityLine = `${metrics.solicitudesNuevasHoy} solicitud(es) flota nuevas hoy.`;
  }

  let riskLine = 'Sin riesgo operativo destacado.';
  if (integrationStatus === 'sin conexión') {
    riskLine = 'Backend no alcanzable · datos pueden estar desactualizados.';
  } else if (metrics.otEnRiesgo > 0) {
    riskLine = 'Atraso o criticidad en órdenes abiertas.';
  } else if (metrics.otSinEvidenciaCompleta > 0) {
    riskLine = 'Evidencia incompleta aumenta riesgo de retrabajo al informar.';
  }

  let actionLine = 'Revisá portada y módulos según prioridad.';
  if (activeView === 'clima' && ot) {
    const gaps = getEvidenceGaps(ot);
    if (!otCanClose(ot)) {
      actionLine = truncate(formatAllCloseBlockersMessage(ot), 140);
    } else if (gaps.length) {
      actionLine = `Completá ${gaps.length} hueco(s) de evidencia antes del informe.`;
    } else {
      actionLine = 'Evidencia OK en esta OT · podés avanzar a informe o cierre.';
    }
  } else if (activeView === 'flota') {
    actionLine =
      metrics.flotaPipelineAbiertas > 0
        ? `${metrics.flotaPipelineAbiertas} ítem(es) en pipeline flota · seguí trazabilidad.`
        : 'Flota sin cola crítica en este corte.';
  } else if (metrics.otSinEvidenciaCompleta > 0) {
    actionLine = 'Abrí Clima y cargá fotos antes / durante / después donde falten.';
  } else if (metrics.solicitudesNuevasHoy > 0) {
    actionLine = 'Revisá solicitudes del día en Flota.';
  }

  if (attachedCount > 0) {
    actionLine = `${attachedCount} archivo(s) en estación local Jarvis · exportá respaldo antes de cerrar.`;
  }

  if (activeView === 'ingreso-operativo') {
    actionLine =
      'Completá teléfono o WhatsApp según el origen. Revisá «Información importante» en el resumen antes de guardar.';
    priorityLine = 'Ingreso guiado: datos completos hoy ahorran llamadas mañana.';
  }
  if (activeView === 'finanzas') {
    actionLine =
      'Los gastos nuevos quedan «Registrado»: la operación sigue. Acá aprobás, observás o rechazás con registro.';
    priorityLine = 'Finanzas: revisión posterior sin frenar a Romina, Gery ni técnicos.';
  }
  if (activeView === 'oportunidades') {
    actionLine = 'Comercial: oportunidades y OT con tipo Comercial para Lyn / Hernán.';
    priorityLine = 'Seguimiento de cartera y propuestas.';
  }

  const modHint =
    activeView === 'clima'
      ? ' · Módulo Clima (Romina).'
      : activeView === 'flota'
        ? ' · Módulo Flota (Gery).'
        : '';
  if (modHint && !priorityLine.includes('Módulo')) {
    priorityLine = `${priorityLine}${modHint}`;
  }

  let executeTarget = 'clima';
  let executeLabel = 'Ejecutar acción';
  if (metrics.otEnRiesgo > 0 || metrics.otSinEvidenciaCompleta > 0) {
    executeTarget = 'clima';
    executeLabel = 'Ir a OT crítica';
  } else if (metrics.solicitudesNuevasHoy > 0) {
    executeTarget = 'flota';
    executeLabel = 'Abrir Flota';
  } else {
    executeTarget = 'ingreso-operativo';
    executeLabel = 'Nuevo ingreso';
  }

  return {
    statusLabel,
    priorityLine,
    riskLine,
    actionLine,
    executeTarget,
    executeLabel,
    viewLabel: activeView,
    attachedCount,
  };
}

/**
 * @param {HTMLElement} [anchor]
 * @returns {{ update: Function, destroy: Function, root: HTMLElement }}
 */
export function mountHnfJarvisFloatingAgent(anchor = typeof document !== 'undefined' ? document.body : null) {
  if (!anchor) {
    return {
      update: () => {},
      destroy: () => {},
      root: null,
    };
  }

  const already = anchor.querySelector('[data-hnf-jarvis-agent-root]');
  if (already?.hnfJarvisFloatingAgentApi) {
    return already.hnfJarvisFloatingAgentApi;
  }

  const root = document.createElement('div');
  root.className = 'hnf-jarvis-agent-root';
  root.setAttribute('data-hnf-jarvis-agent-root', '');

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'hnf-jarvis-agent-fab';
  fab.setAttribute('aria-label', 'Abrir asistente Jarvis');
  fab.setAttribute('aria-expanded', 'false');
  const orb = document.createElement('span');
  orb.className = 'hnf-jarvis-agent-fab__orb';
  orb.setAttribute('aria-hidden', 'true');
  const ring = document.createElement('span');
  ring.className = 'hnf-jarvis-agent-fab__ring';
  ring.setAttribute('aria-hidden', 'true');
  fab.append(ring, orb);

  const backdrop = document.createElement('div');
  backdrop.className = 'hnf-jarvis-agent-backdrop';
  backdrop.hidden = true;

  const panel = document.createElement('div');
  panel.className = 'hnf-jarvis-agent-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Asistente Jarvis');

  const panelHead = document.createElement('div');
  panelHead.className = 'hnf-jarvis-agent-panel__head';
  const panelTitle = document.createElement('span');
  panelTitle.className = 'hnf-jarvis-agent-panel__title';
  panelTitle.textContent = 'Jarvis · HNF Local';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'hnf-jarvis-agent-panel__close';
  closeBtn.setAttribute('aria-label', 'Cerrar asistente');
  closeBtn.textContent = '×';
  panelHead.append(panelTitle, closeBtn);

  const mkRow = (k, className) => {
    const row = document.createElement('div');
    row.className = 'hnf-jarvis-agent-panel__row';
    const kk = document.createElement('span');
    kk.className = 'hnf-jarvis-agent-panel__k';
    kk.textContent = k;
    const vv = document.createElement('p');
    vv.className = `hnf-jarvis-agent-panel__v ${className || ''}`;
    row.append(kk, vv);
    return { row, vv };
  };

  const r0 = mkRow('Estado', 'hnf-jarvis-agent-panel__v--status');
  const r1 = mkRow('Prioridad', '');
  const r2 = mkRow('Riesgo', '');
  const r3 = mkRow('Siguiente acción', '');
  const r4 = mkRow('Adjuntos locales', 'hnf-jarvis-agent-panel__v--local');

  const localBox = document.createElement('div');
  localBox.className = 'hnf-jarvis-agent-local';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = '.txt,.csv,.json,.pdf,.xlsx,.xls,image/*,.jpg,.jpeg,.png,.webp';
  fileInput.className = 'hnf-jarvis-agent-local__input';
  fileInput.hidden = true;

  const localHint = document.createElement('p');
  localHint.className = 'hnf-jarvis-agent-local__hint';
  localHint.textContent = 'Adjunta foto, Excel, PDF o chat exportado de WhatsApp. Se guarda en este equipo hasta exportar respaldo.';

  const localList = document.createElement('div');
  localList.className = 'hnf-jarvis-agent-local__list';

  const actions = document.createElement('div');
  actions.className = 'hnf-jarvis-agent-panel__actions';

  const btnAttach = document.createElement('button');
  btnAttach.type = 'button';
  btnAttach.className = 'hnf-jarvis-agent-panel__btn hnf-jarvis-agent-panel__btn--primary';
  btnAttach.textContent = 'Adjuntar archivo';

  const btnExport = document.createElement('button');
  btnExport.type = 'button';
  btnExport.className = 'hnf-jarvis-agent-panel__btn';
  btnExport.textContent = 'Exportar respaldo';

  const btnFolder = document.createElement('button');
  btnFolder.type = 'button';
  btnFolder.className = 'hnf-jarvis-agent-panel__btn hnf-jarvis-agent-panel__btn--accent';
  btnFolder.textContent = 'Carpeta local';

  actions.append(btnAttach, btnExport, btnFolder);

  const navActions = document.createElement('div');
  navActions.className = 'hnf-jarvis-agent-panel__actions hnf-jarvis-agent-panel__actions--nav';

  const btnClima = document.createElement('button');
  btnClima.type = 'button';
  btnClima.className = 'hnf-jarvis-agent-panel__btn hnf-jarvis-agent-panel__btn--ghost';
  btnClima.textContent = 'Ir a Clima';

  const btnOt = document.createElement('button');
  btnOt.type = 'button';
  btnOt.className = 'hnf-jarvis-agent-panel__btn hnf-jarvis-agent-panel__btn--ghost';
  btnOt.textContent = 'Revisar OT';

  const btnExec = document.createElement('button');
  btnExec.type = 'button';
  btnExec.className = 'hnf-jarvis-agent-panel__btn hnf-jarvis-agent-panel__btn--ghost';
  btnExec.textContent = 'Ejecutar acción';

  navActions.append(btnClima, btnOt, btnExec);
  localBox.append(fileInput, localHint, localList, actions);

  panel.append(panelHead, r0.row, r1.row, r2.row, r3.row, r4.row, localBox, navActions);
  root.append(fab, backdrop, panel);
  anchor.append(root);

  const refs = {
    fab,
    backdrop,
    panel,
    closeBtn,
    vals: [r0.vv, r1.vv, r2.vv, r3.vv, r4.vv],
    btnClima,
    btnOt,
    btnExec,
    btnAttach,
    btnExport,
    btnFolder,
    fileInput,
    localList,
    localHint,
  };

  let handlers = {
    navigateToView: null,
    intelNavigate: null,
    brief: null,
  };

  const renderLocalWorkspace = () => {
    const workspace = readLocalWorkspace();
    const last = workspace.files.slice(-4).reverse();
    refs.vals[4].textContent = workspace.files.length
      ? `${workspace.files.length} archivo(s) guardados · último ${truncate(last[0]?.name, 34)}`
      : 'Sin archivos locales todavía.';
    refs.localList.innerHTML = '';
    if (!last.length) {
      const empty = document.createElement('p');
      empty.className = 'hnf-jarvis-agent-local__empty';
      empty.textContent = 'Sin adjuntos. Úsalo para chats WhatsApp, fotos de terreno, PDFs, Excel y evidencias.';
      refs.localList.append(empty);
      return;
    }
    last.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'hnf-jarvis-agent-local__item';
      const name = document.createElement('strong');
      name.textContent = truncate(item.name, 38);
      const meta = document.createElement('span');
      const extracted = item.extraction?.posiblesPatentes?.length
        ? ` · patente ${item.extraction.posiblesPatentes[0]}`
        : '';
      meta.textContent = `${item.kind} · ${Math.round((item.size || 0) / 1024)} KB · ${item.status || 'registrado'}${extracted}`;
      row.append(name, meta);
      refs.localList.append(row);
    });
  };

  const setOpen = (open) => {
    fab.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
    panel.hidden = !open;
    root.classList.toggle('hnf-jarvis-agent-root--open', open);
    if (open) {
      renderLocalWorkspace();
      requestAnimationFrame(() => {
        btnAttach.focus();
      });
    } else {
      fab.focus();
    }
  };

  const onFabClick = () => setOpen(panel.hidden);
  const onClose = () => setOpen(false);

  fab.addEventListener('click', onFabClick);
  closeBtn.addEventListener('click', onClose);
  backdrop.addEventListener('click', onClose);

  const onKey = (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      e.preventDefault();
      setOpen(false);
    }
  };
  document.addEventListener('keydown', onKey);

  btnAttach.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    refs.localHint.textContent = `Procesando ${files.length} archivo(s)…`;
    const workspace = readLocalWorkspace();
    for (const file of files) {
      try {
        const record = await buildLocalFileRecord(file);
        workspace.files.push(record);
      } catch (e) {
        workspace.files.push({
          id: `local-error-${Date.now()}`,
          name: file.name || 'archivo con error',
          kind: classifyLocalFile(file),
          size: file.size || 0,
          addedAt: new Date().toISOString(),
          status: `error: ${truncate(e?.message || e, 80)}`,
        });
      }
    }
    const saved = writeLocalWorkspace(workspace);
    window.dispatchEvent(new CustomEvent('hnf:jarvis-local-files-updated', { detail: saved }));
    refs.localHint.textContent = 'Adjunto guardado localmente. Exporta respaldo para dejar copia en carpeta/unidad.';
    fileInput.value = '';
    renderLocalWorkspace();
  });

  btnExport.addEventListener('click', () => {
    const workspace = readLocalWorkspace();
    downloadJson(`HNF-respaldo-local-${new Date().toISOString().slice(0, 10)}.json`, workspace);
    refs.localHint.textContent = 'Respaldo descargado. Súbelo a Drive/OneDrive o guárdalo en carpeta HNF.';
  });

  btnFolder.addEventListener('click', async () => {
    try {
      const workspace = readLocalWorkspace();
      refs.localHint.textContent = await saveWorkspaceToLocalFolder(workspace);
    } catch (e) {
      refs.localHint.textContent = `No se pudo guardar carpeta: ${truncate(e?.message || e, 120)}`;
    }
  });

  btnClima.addEventListener('click', () => {
    handlers.navigateToView?.('clima');
    setOpen(false);
  });
  btnOt.addEventListener('click', () => {
    if (typeof handlers.intelNavigate === 'function') {
      handlers.intelNavigate({ view: 'clima' });
    } else {
      handlers.navigateToView?.('clima');
    }
    setOpen(false);
  });
  btnExec.addEventListener('click', () => {
    const t = handlers.brief?.executeTarget || 'clima';
    handlers.navigateToView?.(t);
    setOpen(false);
  });

  function update(ctx = {}) {
    handlers.navigateToView = ctx.navigateToView;
    handlers.intelNavigate = ctx.intelNavigate;
    const brief = buildJarvisAgentBrief(ctx);
    handlers.brief = brief;
    refs.vals[0].textContent = brief.statusLabel;
    refs.vals[1].textContent = brief.priorityLine;
    refs.vals[2].textContent = brief.riskLine;
    refs.vals[3].textContent = brief.actionLine;
    btnExec.textContent = brief.executeLabel;
    fab.classList.toggle('hnf-jarvis-agent-fab--warn', brief.statusLabel !== 'Activo');
    fab.classList.toggle('hnf-jarvis-agent-fab--has-files', brief.attachedCount > 0);
    renderLocalWorkspace();
  }

  function destroy() {
    document.removeEventListener('keydown', onKey);
    fab.removeEventListener('click', onFabClick);
    closeBtn.removeEventListener('click', onClose);
    backdrop.removeEventListener('click', onClose);
    root.remove();
  }

  const api = { update, destroy, root };
  root.hnfJarvisFloatingAgentApi = api;
  renderLocalWorkspace();
  return api;
}

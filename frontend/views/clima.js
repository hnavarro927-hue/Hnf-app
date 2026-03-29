import { createCard } from '../components/card.js';
import { mergeEquipoChecklist } from '../constants/hvacChecklist.js';
import { otFormDefinition } from '../config/form-definitions.js';
import { buildOtOperationalBrief } from '../domain/operational-intelligence.js';
import { monthRangeYmd } from '../domain/hnf-intelligence-engine.js';
import { resolveOperatorRole } from '../domain/hnf-operator-role.js';
import {
  formatAllCloseBlockersMessage,
  getEvidenceGaps,
  getEquipoEvidenceBlock,
  getQualityCloseGaps,
  otCanClose,
  otHasResponsible,
} from '../utils/ot-evidence.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import { createHnfClimaOpsIdentityCard } from '../components/hnf-brand-ops-strip.js';
import {
  CLIMA_OT_FLOW_STAGES,
  createFlowStorageKey,
  detailStageStorageKey,
  jarvisLinesForCreateStage,
  jarvisLinesForDetailStage,
  nextActionHintForDetailStage,
  readStoredStageIndex,
  validateCreateStageAdvance,
  validateDetailStageAdvance,
  writeStoredStageIndex,
} from '../domain/clima-ot-flow-stages.js';
import {
  HNF_OT_OPERATION_MODES,
  HNF_OT_ORIGEN_PEDIDO,
  HNF_OT_ORIGEN_SOLICITUD,
  HNF_OT_PRIORIDAD_OPERATIVA,
  HNF_OT_TECNICOS_PRESETS,
  labelOperationMode,
  labelOrigenPedido,
  labelOrigenSolicitud,
  labelPrioridadOperativa,
} from '../constants/hnf-ot-operation.js';
import { computeOtSlaTierForClimaListItem } from '../domain/hnf-ot-sla-presentation.js';

const OT_STATUS_OPTIONS = [
  { value: 'nueva', label: 'Nueva' },
  { value: 'asignada', label: 'Asignada' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'pendiente_validacion', label: 'Pendiente validación' },
  { value: 'cerrada', label: 'Cerrada' },
];

const isOtEstadoCerradaUi = (e) =>
  ['terminado', 'cerrada', 'cerrado'].includes(String(e || '').toLowerCase());

const MAX_EQUIPOS = 12;
const EQ_ESTADOS = ['operativo', 'mantenimiento', 'falla'];

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const readFilesAsEvidence = async (input) => {
  const files = Array.from(input?.files || []);
  const out = [];
  for (const file of files) {
    const url = await readFileAsDataUrl(file);
    out.push({ name: file.name, url });
  }
  return out;
};

const newLocalEvidenceId = () => `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeEvidenceItemForUi = (item, index) => ({
  id: item?.id || newLocalEvidenceId(),
  name: item?.name || `imagen-${index + 1}.jpg`,
  url: typeof item?.url === 'string' ? item.url : '',
  createdAt: item?.createdAt || new Date().toISOString(),
});

const initRowEvidence = (equipo = {}) => {
  const ev = equipo.evidencias;
  if (ev && typeof ev === 'object') {
    return {
      fotografiasAntes: (ev.antes || []).map(normalizeEvidenceItemForUi),
      fotografiasDurante: (ev.durante || []).map(normalizeEvidenceItemForUi),
      fotografiasDespues: (ev.despues || []).map(normalizeEvidenceItemForUi),
    };
  }
  return {
    fotografiasAntes: (equipo.fotografiasAntes || []).map(normalizeEvidenceItemForUi),
    fotografiasDurante: (equipo.fotografiasDurante || []).map(normalizeEvidenceItemForUi),
    fotografiasDespues: (equipo.fotografiasDespues || []).map(normalizeEvidenceItemForUi),
  };
};

const toApiEvidence = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter((e) => typeof e.url === 'string' && e.url.trim().length > 0)
    .map(({ id, name, url, createdAt }) => ({
      id,
      name,
      url,
      createdAt: createdAt || new Date().toISOString(),
    }));

const collectEquipoEvidencePayload = (ev) => {
  const antes = toApiEvidence(ev.fotografiasAntes);
  const durante = toApiEvidence(ev.fotografiasDurante);
  const despues = toApiEvidence(ev.fotografiasDespues);
  return {
    evidencias: { antes, durante, despues },
    fotografiasAntes: antes,
    fotografiasDurante: durante,
    fotografiasDespues: despues,
  };
};

const attachEvidenceUI = (parent, evidenceStore, fieldKey, title, readOnly) => {
  const wrap = document.createElement('article');
  wrap.className = 'ot-evidence-saas-card';

  const head = document.createElement('div');
  head.className = 'ot-evidence-saas-card__head';

  const lb = document.createElement('h4');
  lb.className = 'ot-evidence-saas-card__title';
  lb.textContent = title;

  const status = document.createElement('span');
  status.className = 'ot-evidence-status';

  head.append(lb, status);

  const hint = document.createElement('p');
  hint.className = 'ot-evidence-saas-card__hint muted';
  hint.textContent = 'Sube imágenes con toque (iPad) o arrastra y suelta.';

  const uploader = document.createElement('button');
  uploader.type = 'button';
  uploader.className = 'ot-evidence-dropzone';
  uploader.innerHTML = '<strong>+ Agregar imágenes</strong><span>Toca aquí para abrir la galería o cámara.</span>';

  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*';
  input.hidden = true;

  const preview = document.createElement('div');
  preview.className = 'ot-evidence-grid';

  const getList = () => {
    if (!Array.isArray(evidenceStore[fieldKey])) evidenceStore[fieldKey] = [];
    return evidenceStore[fieldKey];
  };

  const rerender = () => {
    preview.innerHTML = '';
    const list = getList();
    const isComplete = list.length > 0;
    status.textContent = isComplete ? 'Completo' : 'Faltante';
    status.className = `ot-evidence-status ${isComplete ? 'is-complete' : 'is-missing'}`;

    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'muted ot-evidence-empty';
      empty.textContent = 'Aún no hay imágenes en esta sección.';
      preview.append(empty);
      return;
    }

    list.forEach((item) => {
      const card = document.createElement('figure');
      card.className = 'ot-evidence-thumb-card';

      const img = document.createElement('img');
      img.src = item.url || '';
      img.alt = item.name || 'Evidencia';
      img.className = 'ot-evidence-thumb';
      img.loading = 'lazy';
      card.append(img);

      if (!readOnly) {
        const rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'ot-evidence-thumb-remove';
        rmBtn.textContent = '❌';
        rmBtn.setAttribute('aria-label', `Eliminar ${item.name || 'evidencia'}`);
        rmBtn.addEventListener('click', () => {
          const arr = getList();
          const idx = arr.findIndex((x) => x.id === item.id);
          if (idx !== -1) arr.splice(idx, 1);
          rerender();
        });
        card.append(rmBtn);
      }

      const cap = document.createElement('figcaption');
      cap.className = 'ot-evidence-name';
      cap.textContent = item.name || 'Sin nombre';
      cap.title = item.name || '';
      card.append(cap);
      preview.append(card);
    });
  };

  const addFilesFromInput = async (srcInput) => {
    const added = await readFilesAsEvidence(srcInput);
    if (!added.length) return;
    const arr = getList();
    arr.push(
      ...added.map((a) => ({
        id: newLocalEvidenceId(),
        name: a.name,
        url: a.url,
        createdAt: new Date().toISOString(),
      }))
    );
    srcInput.value = '';
    rerender();
  };

  if (!readOnly) {
    uploader.addEventListener('click', () => input.click());
    uploader.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploader.classList.add('is-over');
    });
    uploader.addEventListener('dragleave', () => uploader.classList.remove('is-over'));
    uploader.addEventListener('drop', async (e) => {
      e.preventDefault();
      uploader.classList.remove('is-over');
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      input.files = dt.files;
      await addFilesFromInput(input);
    });
    input.addEventListener('change', async () => {
      await addFilesFromInput(input);
    });
  } else {
    uploader.hidden = true;
  }

  wrap.append(head, hint, uploader, input, preview);
  parent.append(wrap);
  rerender();
};

const attachChecklistUI = (parent, checklistRef, readOnly) => {
  const wrap = document.createElement('div');
  wrap.className = 'form-field ot-checklist-block';
  const lb = document.createElement('span');
  lb.className = 'form-field__label';
  lb.textContent = 'Checklist técnico HVAC (obligatorio al cerrar la OT)';
  wrap.append(lb);
  const rerender = () => {
    wrap.querySelectorAll('.ot-checklist-row').forEach((n) => n.remove());
    checklistRef.forEach((item, idx) => {
      const row = document.createElement('label');
      row.className = 'ot-checklist-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.realizado;
      cb.disabled = readOnly;
      cb.addEventListener('change', () => {
        checklistRef[idx].realizado = cb.checked;
      });
      const span = document.createElement('span');
      span.textContent = item.label;
      row.append(cb, span);
      wrap.append(row);
    });
  };
  parent.append(wrap);
  rerender();
};

const buildField = (field) => {
  const wrapper = document.createElement('label');
  wrapper.className = 'form-field';

  const label = document.createElement('span');
  label.className = 'form-field__label';
  label.textContent = field.label;

  let control;

  if (field.type === 'select') {
    control = document.createElement('select');
    field.options.forEach((option) => {
      const optionNode = document.createElement('option');
      optionNode.value = option;
      optionNode.textContent = option;
      control.append(optionNode);
    });
  } else if (field.type === 'textarea') {
    control = document.createElement('textarea');
    control.rows = 4;
  } else {
    control = document.createElement('input');
    control.type = field.type === 'file-list' ? 'file' : field.type;

    if (field.type === 'file-list') {
      control.multiple = true;
      control.accept = 'image/*';
    }
  }

  control.name = field.name;
  control.required = Boolean(field.required && field.type !== 'readonly');

  if (field.type === 'readonly') {
    control.value = field.defaultValue || '';
    control.readOnly = true;
  }

  wrapper.append(label, control);
  return wrapper;
};

const createStatusBadge = (status, variant = 'estado') => {
  const raw = String(status || '').trim().toLowerCase();
  const normalized =
    raw === 'terminado' || raw === 'cerrada' || raw === 'cerrado'
      ? 'completado'
      : raw === 'en proceso' || raw === 'en_proceso'
        ? 'en-proceso'
        : raw === 'automatico'
          ? 'automatico'
          : raw === 'automático'
            ? 'automatico'
            : raw || 'pendiente';
  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${normalized} ${variant === 'mode' ? 'status-badge--mode' : ''}`;
  badge.textContent = status || 'pendiente';
  if (variant !== 'mode') {
    const st = raw.replace(/\s+/g, '_');
    const cerrado = ['terminado', 'cerrada', 'cerrado', 'completado'].includes(normalized) || normalized === 'completado';
    const proceso =
      normalized === 'en-proceso' ||
      normalized === 'pendiente_validacion' ||
      st === 'pendiente_validacion' ||
      raw === 'en proceso';
    const neonTier = cerrado ? 'cerrado' : proceso ? 'proceso' : 'abierto';
    badge.classList.add(`hnf-ot-neon--${neonTier}`);
  }
  return badge;
};

const buildOtAltaOperationSection = () => {
  const fs = document.createElement('fieldset');
  fs.className = 'ot-form__section ot-form__section--operation';
  const leg = document.createElement('legend');
  leg.textContent = 'Modo operación · Nº OT · Origen · Prioridad · Técnico';
  const grid = document.createElement('div');
  grid.className = 'ot-form__grid';

  const mk = (labelText, inner) => {
    const w = document.createElement('label');
    w.className = 'form-field';
    const lb = document.createElement('span');
    lb.className = 'form-field__label';
    lb.textContent = labelText;
    w.append(lb, inner);
    return w;
  };

  const idInp = document.createElement('input');
  idInp.type = 'text';
  idInp.name = 'otCustomId';
  idInp.placeholder = 'Vacío = siguiente OT-### automático';
  idInp.autocomplete = 'off';

  const modeSel = document.createElement('select');
  modeSel.name = 'operationModeCreate';
  HNF_OT_OPERATION_MODES.forEach((o) => {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.label;
    modeSel.append(op);
  });

  const origenSolSel = document.createElement('select');
  origenSolSel.name = 'origenSolicitudCreate';
  origenSolSel.required = true;
  HNF_OT_ORIGEN_SOLICITUD.forEach((o) => {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.label;
    origenSolSel.append(op);
  });

  const waNumInp = document.createElement('input');
  waNumInp.type = 'tel';
  waNumInp.name = 'whatsappNumeroCreate';
  waNumInp.placeholder = '+56 9 …';
  waNumInp.autocomplete = 'off';
  const waNomInp = document.createElement('input');
  waNomInp.type = 'text';
  waNomInp.name = 'whatsappNombreCreate';
  waNomInp.placeholder = 'Nombre contacto';
  waNomInp.autocomplete = 'name';

  const waWrap = document.createElement('div');
  waWrap.className = 'ot-form__grid';
  waWrap.style.gridColumn = '1 / -1';
  waWrap.hidden = true;
  waWrap.append(mk('WhatsApp · número *', waNumInp), mk('WhatsApp · nombre contacto *', waNomInp));
  origenSolSel.addEventListener('change', () => {
    waWrap.hidden = origenSolSel.value !== 'whatsapp';
  });

  const prioSel = document.createElement('select');
  prioSel.name = 'prioridadOperativaCreate';
  prioSel.required = true;
  HNF_OT_PRIORIDAD_OPERATIVA.forEach((o) => {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.label;
    if (o.value === 'media') op.selected = true;
    prioSel.append(op);
  });

  const techWrap = document.createElement('div');
  techWrap.className = 'ot-tech-pick';
  const techSel = document.createElement('select');
  techSel.name = 'tecnicoPreset';
  HNF_OT_TECNICOS_PRESETS.forEach((o) => {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.label;
    techSel.append(op);
  });
  const otroOpt = document.createElement('option');
  otroOpt.value = '__otro__';
  otroOpt.textContent = 'Otro (nombre libre)';
  techSel.append(otroOpt);
  const techOther = document.createElement('input');
  techOther.type = 'text';
  techOther.name = 'tecnicoOtro';
  techOther.placeholder = 'Nombre del técnico';
  techOther.className = 'ot-tech-pick__other';
  techOther.hidden = true;
  techSel.addEventListener('change', () => {
    techOther.hidden = techSel.value !== '__otro__';
    if (!techOther.hidden) techOther.focus();
  });
  techWrap.append(techSel, techOther);

  const hint = document.createElement('p');
  hint.className = 'muted small';
  hint.style.gridColumn = '1 / -1';
  hint.innerHTML =
    '<strong>Manual:</strong> vos definís técnico y, si querés, un número de OT fijo. <strong>Automático:</strong> si no elegís técnico, el servidor aplica reglas Jarvis (stub) y lo deja registrado como asignado por Jarvis; siempre podés corregir después.';

  grid.append(
    mk('Nº OT (opcional)', idInp),
    mk('Modo operación', modeSel),
    mk('Origen de la solicitud *', origenSolSel),
    waWrap,
    mk('Prioridad operativa *', prioSel),
    mk('Técnico asignado', techWrap),
    hint
  );
  fs.append(leg, grid);
  return fs;
};

const resolveTecnicoFromAltaForm = (form) => {
  const preset = form.elements.tecnicoPreset?.value;
  const otro = form.elements.tecnicoOtro?.value?.trim() || '';
  if (preset === '__otro__') return otro || 'Por asignar';
  return preset || 'Por asignar';
};

const formatOtExecTs = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
};

const countEvidenciaFase = (ot, phase) => {
  const eqs = ot.equipos || [];
  if (eqs.length) {
    let n = 0;
    for (const eq of eqs) {
      const arr = getEquipoEvidenceBlock(eq, phase);
      n += arr.filter((e) => e?.url && String(e.url).trim()).length;
    }
    return n;
  }
  const key =
    phase === 'antes'
      ? 'fotografiasAntes'
      : phase === 'durante'
        ? 'fotografiasDurante'
        : 'fotografiasDespues';
  const arr = ot[key];
  return Array.isArray(arr) ? arr.filter((e) => e?.url && String(e.url).trim()).length : 0;
};

const countChecklistPendiente = (ot) => {
  let pending = 0;
  for (const eq of ot.equipos || []) {
    for (const it of mergeEquipoChecklist(eq)) {
      if (!it.realizado) pending += 1;
    }
  }
  return pending;
};

const operativoSemaforo = (ot) => {
  const st = String(ot.estado || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (['terminado', 'cerrada', 'cerrado'].includes(st)) {
    return { cls: 'ot-exec-signal--neutral', label: 'Cerrada / terminada', dot: 'off' };
  }
  if (!otHasResponsible(ot) || getEvidenceGaps(ot).length) {
    return { cls: 'ot-exec-signal--red', label: 'Crítico: técnico o evidencia', dot: 'red' };
  }
  if (getQualityCloseGaps(ot).length || st === 'pendiente_validacion') {
    return { cls: 'ot-exec-signal--yellow', label: 'Calidad o validación', dot: 'yellow' };
  }
  if (otCanClose(ot)) {
    return { cls: 'ot-exec-signal--green', label: 'Lista para cierre', dot: 'green' };
  }
  return { cls: 'ot-exec-signal--yellow', label: 'Completar requisitos', dot: 'yellow' };
};

const truncateExec = (s, n = 200) => {
  const t = String(s || '').trim();
  if (!t) return '—';
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

/**
 * Panel ejecutivo persistente en detalle OT (Clima).
 */
const buildOtExecutiveSummaryCard = (ot, { economicsSaved = false } = {}) => {
  const article = document.createElement('article');
  article.className = 'ot-exec-summary-card';
  const head = document.createElement('header');
  head.className = 'ot-exec-summary-card__head';
  const h = document.createElement('h3');
  h.className = 'ot-exec-summary-card__title';
  h.textContent = 'Resumen ejecutivo · OT';
  const sig = operativoSemaforo(ot);
  const signal = document.createElement('div');
  signal.className = `ot-exec-signal ${sig.cls}`;
  const dot = document.createElement('span');
  dot.className = `ot-exec-signal__dot ot-exec-signal__dot--${sig.dot}`;
  const lab = document.createElement('span');
  lab.textContent = sig.label;
  signal.append(dot, lab);
  head.append(h, signal);

  const grid = document.createElement('div');
  grid.className = 'ot-exec-summary-card__grid';
  const row = (k, v) => {
    const d = document.createElement('div');
    d.className = 'ot-exec-kv';
    const sk = document.createElement('span');
    sk.className = 'ot-exec-kv__k';
    sk.textContent = k;
    const sv = document.createElement('strong');
    sv.className = 'ot-exec-kv__v';
    const val = v == null || v === '' ? '—' : String(v);
    sv.textContent = val;
    d.append(sk, sv);
    return d;
  };

  const stNorm = String(ot.estado || '').toLowerCase().replace(/\s+/g, '_');
  const validacionCierre =
    stNorm === 'pendiente_validacion'
      ? 'Pendiente validación'
      : ['cerrada', 'terminado', 'cerrado'].includes(stNorm)
        ? 'Cierre registrado'
        : 'En curso';

  const creadoRaw = ot.createdAt || ot.creadoEn || ot.fechaCreacion || ot.fecha || ot.fechaVisita;
  const eqCount = (ot.equipos || []).filter((e) => e && Object.keys(e).length).length;

  grid.append(
    row('Nº OT', ot.id),
    row('Estado', ot.estado || '—'),
    row('Prioridad', labelPrioridadOperativa(ot.prioridadOperativa)),
    row('Cliente', ot.cliente),
    row('Sucursal / sitio', ot.sucursal || ot.sitio || ot.nombreSucursal),
    row('Comuna', ot.comuna),
    row('Dirección', ot.direccion),
    row('Origen pedido', `${labelOrigenSolicitud(ot.origenSolicitud)} · ${labelOrigenPedido(ot.origenPedido)}`),
    row('Técnico asignado', ot.tecnicoAsignado),
    row('Modo asignación', labelOperationMode(ot.operationMode === 'automatic' ? 'automatic' : 'manual')),
    row('Subtipo trabajo', ot.subtipoServicio),
    row('Creación', creadoRaw ? formatOtExecTs(creadoRaw) : '—'),
    row('Última actualización', formatOtExecTs(ot.updatedAt)),
    row(
      'Checklist pendiente',
      countChecklistPendiente(ot) ? `${countChecklistPendiente(ot)} ítem(es)` : 'Sin pendientes'
    ),
    row(
      'Fotos · antes / durante / después',
      `${countEvidenciaFase(ot, 'antes')} / ${countEvidenciaFase(ot, 'durante')} / ${countEvidenciaFase(ot, 'despues')}`
    ),
    row('Equipos cargados', eqCount ? `${eqCount} equipo(s)` : 'Sin equipos'),
    row('Texto técnico (resumen)', truncateExec(ot.resumenTrabajo, 220)),
    row('Observaciones / cierre', truncateExec(ot.observaciones, 220)),
    row('Validación de cierre', validacionCierre),
    row('Economía informada', economicsSaved ? 'Guardada en sesión' : 'Pendiente de guardar (informe)')
  );

  article.append(head, grid);
  return article;
};

const DETAIL_STAGE_HERO = {
  entrada: {
    title: 'Entrada · sitio y contacto',
    lede: 'Datos del cliente, ubicación e historial reciente. Base para clasificar y asignar.',
  },
  clasificacion: {
    title: 'Clasificación operativa',
    lede: 'Origen, prioridad y tipo de intervención. Alineá la OT con el flujo comercial y técnico.',
  },
  asignacion: {
    title: 'Asignación y estado',
    lede: 'Estado en servidor, técnico y modo manual o Jarvis. Definí responsable antes de ejecución.',
  },
  ejecucion: {
    title: 'Ejecución en terreno',
    lede: 'Textos, equipos y evidencia fotográfica antes / durante / después.',
  },
  informe: {
    title: 'Informe y economía',
    lede: 'Checklist de calidad, vista previa al cliente y generación de PDF.',
  },
  cierre: {
    title: 'Cierre formal',
    lede: 'Validación final, cierre de OT y eliminación (solo admin).',
  },
};

const buildOtOperationalSummarySection = (ot) => {
  const block = document.createElement('div');
  block.className = 'ot-op-detail__summary-block';

  const mode = ot.operationMode === 'automatic' ? 'automatic' : 'manual';

  const head = document.createElement('div');
  head.className = 'ot-op-detail__head';
  const ht = document.createElement('h3');
  ht.className = 'ot-section-title';
  ht.textContent = 'Clasificación operativa';
  const hp = document.createElement('p');
  hp.className = 'muted small';
  hp.innerHTML =
    '<strong>Automático</strong> permite sugerencias de asignación; <strong>Manual</strong> deja el control en el equipo.';
  head.append(ht, hp);

  const badges = document.createElement('div');
  badges.className = 'ot-op-detail__badges';
  const bMode = document.createElement('span');
  bMode.className = `ot-op-badge ot-op-badge--mode ot-op-badge--mode-${mode}`;
  bMode.textContent = labelOperationMode(mode);
  const bOrig = document.createElement('span');
  bOrig.className = 'ot-op-badge ot-op-badge--neutral';
  bOrig.textContent = `Origen pedido: ${labelOrigenPedido(ot.origenPedido)}`;
  badges.append(bMode, bOrig);

  const grid = document.createElement('div');
  grid.className = 'ot-op-detail__grid';
  const row = (k, v) => {
    const d = document.createElement('div');
    d.className = 'ot-op-detail__kv';
    const sk = document.createElement('span');
    sk.textContent = k;
    const sv = document.createElement('strong');
    sv.textContent = v || '—';
    d.append(sk, sv);
    return d;
  };
  grid.append(
    row('Origen solicitud', labelOrigenSolicitud(ot.origenSolicitud)),
    row('Prioridad', labelPrioridadOperativa(ot.prioridadOperativa)),
    row('Tipo / subtipo', `${ot.tipoServicio || '—'} / ${ot.subtipoServicio || '—'}`),
    row('Bandeja → aviso', `${ot.bandejaAsignada || '—'} → ${ot.notificacionAsignadaA || '—'}`)
  );

  block.append(head, badges, grid);
  return block;
};

const buildOtOperationalControlsSection = (ot, actions, readOnly, isPatching) => {
  const empty = document.createElement('div');
  if (readOnly || typeof actions?.patchOtOperational !== 'function') {
    return { element: empty, flushOperationalSave: async () => true };
  }

  const ctl = document.createElement('div');
  ctl.className = 'ot-op-detail__controls';

  const rowCtrl = document.createElement('div');
  rowCtrl.className = 'ot-op-detail__ctrl-row';

  const mode = ot.operationMode === 'automatic' ? 'automatic' : 'manual';

  const ms = document.createElement('select');
  ms.className = 'ot-op-detail__select ot-flow-touch-control';
  ms.setAttribute('aria-label', 'Modo operación');
  [
    ['manual', 'Manual'],
    ['automatic', 'Automático (Jarvis)'],
  ].forEach(([v, l]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = l;
    if (v === mode) o.selected = true;
    ms.append(o);
  });

  const tSel = document.createElement('select');
  tSel.className = 'ot-op-detail__select ot-flow-touch-control';
  tSel.setAttribute('aria-label', 'Técnico');
  HNF_OT_TECNICOS_PRESETS.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.value;
    o.textContent = p.label;
    tSel.append(o);
  });
  const otroOpt = document.createElement('option');
  otroOpt.value = '__otro__';
  otroOpt.textContent = 'Otro…';
  tSel.append(otroOpt);
  const tOther = document.createElement('input');
  tOther.type = 'text';
  tOther.className = 'ot-op-detail__other ot-flow-touch-control';
  tOther.placeholder = 'Nombre técnico';
  tOther.hidden = true;
  const curTech = String(ot.tecnicoAsignado || '').trim() || 'Por asignar';
  if (HNF_OT_TECNICOS_PRESETS.some((p) => p.value === curTech)) {
    tSel.value = curTech;
  } else {
    tSel.value = '__otro__';
    tOther.value = curTech === 'Por asignar' ? '' : curTech;
    tOther.hidden = false;
  }
  tSel.addEventListener('change', () => {
    tOther.hidden = tSel.value !== '__otro__';
    if (!tOther.hidden) tOther.focus();
  });

  const os = document.createElement('select');
  os.className = 'ot-op-detail__select ot-flow-touch-control';
  os.setAttribute('aria-label', 'Origen del pedido');
  HNF_OT_ORIGEN_PEDIDO.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.value;
    o.textContent = p.label;
    if ((ot.origenPedido || '') === p.value) o.selected = true;
    os.append(o);
  });

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'primary-button ot-flow-footer__btn';
  save.textContent = isPatching ? 'Guardando…' : 'Guardar asignación operativa';
  save.disabled = Boolean(isPatching);

  const flushOperationalSave = async () => {
    if (readOnly || typeof actions?.patchOtOperational !== 'function') return true;
    let t = tSel.value;
    if (t === '__otro__') t = tOther.value.trim() || 'Por asignar';
    await actions.patchOtOperational(ot.id, {
      operationMode: ms.value,
      tecnicoAsignado: t,
      origenPedido: os.value,
    });
    return true;
  };

  save.addEventListener('click', () => {
    flushOperationalSave();
  });

  rowCtrl.append(ms, tSel, tOther, os, save);
  ctl.append(rowCtrl);
  return { element: ctl, flushOperationalSave };
};

const createEquipoFormRow = () => {
  const fs = document.createElement('fieldset');
  fs.className = 'ot-equipo-form-row';

  const legend = document.createElement('legend');
  legend.textContent = 'Equipo';
  fs.append(legend);

  const grid = document.createElement('div');
  grid.className = 'ot-form__grid';

  const add = (name, label, type, extra = {}) => {
    const w = document.createElement('label');
    w.className = 'form-field';
    const lb = document.createElement('span');
    lb.className = 'form-field__label';
    lb.textContent = label;
    let el;
    if (type === 'select') {
      el = document.createElement('select');
      EQ_ESTADOS.forEach((v) => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        el.append(o);
      });
    } else if (type === 'textarea') {
      el = document.createElement('textarea');
      el.rows = 3;
    } else {
      el = document.createElement('input');
      el.type = type;
    }
    el.name = name;
    if (extra.accept) {
      el.accept = extra.accept;
      el.multiple = true;
    }
    w.append(lb, el);
    grid.append(w);
  };

  add('nombreEquipo', 'Nombre / tipo equipo', 'text');
  add('estadoEquipo', 'Estado equipo', 'select');
  add('observaciones', 'Observaciones', 'textarea');
  add('accionesRealizadas', 'Acciones realizadas', 'textarea');
  add('recomendaciones', 'Recomendaciones', 'textarea');

  fs._evidence = initRowEvidence({});
  attachEvidenceUI(grid, fs._evidence, 'fotografiasAntes', 'Fotos ANTES', false);
  attachEvidenceUI(grid, fs._evidence, 'fotografiasDurante', 'Fotos DURANTE', false);
  attachEvidenceUI(grid, fs._evidence, 'fotografiasDespues', 'Fotos DESPUÉS', false);
  fs._checklist = mergeEquipoChecklist({});
  attachChecklistUI(grid, fs._checklist, false);

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'secondary-button';
  rm.textContent = 'Quitar equipo';
  rm.addEventListener('click', () => {
    const host = fs.closest('.ot-equipos-create');
    if (!host || host.querySelectorAll('.ot-equipo-form-row').length <= 1) return;
    fs.remove();
    renumberEquipoFormRows(host);
  });
  grid.append(rm);

  fs.append(grid);
  return fs;
};

const renumberEquipoFormRows = (container) => {
  container.querySelectorAll('.ot-equipo-form-row').forEach((row, i) => {
    const leg = row.querySelector('legend');
    if (leg) leg.textContent = `Equipo ${i + 1}`;
  });
};

const collectEquiposFromCreateForm = (container) => {
  const rows = container.querySelectorAll('.ot-equipo-form-row');
  const out = [];
  let idx = 0;
  for (const row of rows) {
    const nombre = row.querySelector('[name=nombreEquipo]')?.value?.trim() || `Equipo ${idx + 1}`;
    const estado = row.querySelector('[name=estadoEquipo]')?.value || 'operativo';
    const observaciones = row.querySelector('[name=observaciones]')?.value?.trim() || '';
    const accionesRealizadas = row.querySelector('[name=accionesRealizadas]')?.value?.trim() || '';
    const recomendaciones = row.querySelector('[name=recomendaciones]')?.value?.trim() || '';
    const ev = row._evidence || initRowEvidence({});
    const cl = row._checklist || mergeEquipoChecklist({});
    out.push({
      nombreEquipo: nombre,
      estadoEquipo: estado,
      observaciones,
      accionesRealizadas,
      recomendaciones,
      checklist: cl.map(({ id, label, realizado }) => ({ id, label, realizado: Boolean(realizado) })),
      ...collectEquipoEvidencePayload(ev),
    });
    idx += 1;
  }
  return out;
};

const buildDetailEquipoRow = (equipo, index, readOnly = false) => {
  const fs = document.createElement('fieldset');
  fs.className = 'ot-equipo-detail-row';
  fs.dataset.equipoIndex = String(index);
  if (equipo.id) fs.dataset.equipoId = equipo.id;

  const legend = document.createElement('legend');
  legend.textContent = `Equipo ${index + 1}`;
  fs.append(legend);

  const grid = document.createElement('div');
  grid.className = 'ot-form__grid';

  const field = (label, inner) => {
    const w = document.createElement('label');
    w.className = 'form-field';
    const lb = document.createElement('span');
    lb.className = 'form-field__label';
    lb.textContent = label;
    w.append(lb, inner);
    grid.append(w);
  };

  const nombre = document.createElement('input');
  nombre.type = 'text';
  nombre.name = 'nombreEquipo';
  nombre.value = equipo.nombreEquipo || '';
  nombre.readOnly = readOnly;
  field('Nombre / tipo equipo', nombre);

  const estado = document.createElement('select');
  estado.name = 'estadoEquipo';
  estado.disabled = readOnly;
  EQ_ESTADOS.forEach((v) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    if (equipo.estadoEquipo === v) o.selected = true;
    estado.append(o);
  });
  field('Estado', estado);

  const obs = document.createElement('textarea');
  obs.name = 'observaciones';
  obs.rows = 3;
  obs.value = equipo.observaciones || '';
  obs.readOnly = readOnly;
  field('Observaciones', obs);

  const acc = document.createElement('textarea');
  acc.name = 'accionesRealizadas';
  acc.rows = 3;
  acc.value = equipo.accionesRealizadas || '';
  acc.readOnly = readOnly;
  field('Acciones realizadas', acc);

  const rec = document.createElement('textarea');
  rec.name = 'recomendaciones';
  rec.rows = 3;
  rec.value = equipo.recomendaciones || '';
  rec.readOnly = readOnly;
  field('Recomendaciones', rec);

  fs._evidence = initRowEvidence(equipo);
  attachEvidenceUI(grid, fs._evidence, 'fotografiasAntes', 'Evidencias ANTES', readOnly);
  attachEvidenceUI(grid, fs._evidence, 'fotografiasDurante', 'Evidencias DURANTE', readOnly);
  attachEvidenceUI(grid, fs._evidence, 'fotografiasDespues', 'Evidencias DESPUÉS', readOnly);
  fs._checklist = mergeEquipoChecklist(equipo);
  attachChecklistUI(grid, fs._checklist, readOnly);

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'secondary-button';
  rm.textContent = 'Quitar equipo';
  rm.disabled = readOnly;
  rm.addEventListener('click', () => {
    const host = fs.closest('.ot-detail-equipos-host');
    if (!host || host.querySelectorAll('.ot-equipo-detail-row').length <= 1) return;
    fs.remove();
  });
  grid.append(rm);

  fs.append(grid);
  return fs;
};

const collectEquiposFromDetail = (container, ot) => {
  const rows = container.querySelectorAll('.ot-equipo-detail-row');
  const out = [];
  let i = 0;
  for (const row of rows) {
    const eid = row.dataset.equipoId || '';
    const base = (ot.equipos || []).find((e) => e.id === eid) || {};
    i += 1;
    const nombre = row.querySelector('[name=nombreEquipo]')?.value?.trim() || `Equipo ${i}`;
    const estado = row.querySelector('[name=estadoEquipo]')?.value || 'operativo';
    const observaciones = row.querySelector('[name=observaciones]')?.value?.trim() || '';
    const accionesRealizadas = row.querySelector('[name=accionesRealizadas]')?.value?.trim() || '';
    const recomendaciones = row.querySelector('[name=recomendaciones]')?.value?.trim() || '';
    const ev = row._evidence || initRowEvidence({});
    const cl = row._checklist || mergeEquipoChecklist(base);

    out.push({
      id: base.id || eid || `eq-${Date.now()}-${i}`,
      nombreEquipo: nombre,
      estadoEquipo: estado,
      observaciones,
      accionesRealizadas,
      recomendaciones,
      checklist: cl.map(({ id, label, realizado }) => ({ id, label, realizado: Boolean(realizado) })),
      ...collectEquipoEvidencePayload(ev),
    });
  }
  return out;
};

const createClientPreview = (ot) => {
  const article = document.createElement('article');
  article.className = 'preview-sheet';

  const eqCount = (ot.equipos || []).length;
  const header = document.createElement('header');
  header.className = 'preview-sheet__header';
  header.innerHTML = `
    <div>
      <p class="preview-sheet__eyebrow">HNF Servicios Integrales</p>
      <h3>Vista previa · OT HVAC</h3>
      <p class="muted">${eqCount} equipo(s) registrado(s) en esta OT.</p>
    </div>
    <div class="preview-sheet__meta">
      <span>${ot.id}</span>
      <span>${ot.fecha} · ${ot.hora}</span>
    </div>
  `;

  const summary = document.createElement('div');
  summary.className = 'preview-summary-grid';

  [
    ['Cliente', ot.cliente],
    ['Ubicación', `${ot.direccion}, ${ot.comuna}`],
    ['Contacto', `${ot.contactoTerreno} · ${ot.telefonoContacto}`],
    ['Servicio', `${ot.tipoServicio} / ${ot.subtipoServicio}`],
    ['Técnico', ot.tecnicoAsignado],
    ['Estado', ot.estado],
  ].forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'preview-summary-item';
    row.innerHTML = `<span>${label}</span><strong>${value || 'No informado'}</strong>`;
    summary.append(row);
  });

  const textSections = document.createElement('div');
  textSections.className = 'preview-text-grid';

  [
    ['Observaciones', ot.observaciones || 'Sin observaciones registradas.'],
    ['Resumen del trabajo', ot.resumenTrabajo || 'Sin resumen registrado.'],
    ['Recomendaciones', ot.recomendaciones || 'Sin recomendaciones registradas.'],
  ].forEach(([label, value]) => {
    const textBlock = document.createElement('section');
    textBlock.className = 'preview-text-card';
    textBlock.innerHTML = `<h4>${label}</h4><p>${value}</p>`;
    textSections.append(textBlock);
  });

  article.append(header, summary, textSections);
  return article;
};

const createEvidenceSection = (title, items = []) => {
  const article = document.createElement('article');
  article.className = 'evidence-card';
  const heading = document.createElement('h4');
  heading.textContent = title;
  const preview = document.createElement('div');
  preview.className = 'ot-evidence-preview ot-evidence-preview--legacy';
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Sin archivos.';
    preview.append(empty);
  } else {
    list.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'ot-evidence-card';
      if (item.url) {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.name || 'Evidencia';
        img.className = 'ot-evidence-thumb';
        img.loading = 'lazy';
        card.append(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'ot-evidence-thumb ot-evidence-thumb--empty';
        ph.textContent = 'Sin archivo';
        card.append(ph);
      }
      const meta = document.createElement('div');
      meta.className = 'ot-evidence-meta';
      const nameEl = document.createElement('span');
      nameEl.className = 'ot-evidence-name';
      nameEl.textContent = item.name || 'Sin nombre';
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'secondary-button ot-evidence-open';
      openBtn.textContent = 'Abrir';
      openBtn.disabled = !item.url;
      openBtn.addEventListener('click', () => {
        if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
      });
      meta.append(nameEl, openBtn);
      card.append(meta);
      preview.append(card);
    });
  }
  article.append(heading, preview);
  return article;
};

const mountClimaOtDetailFlow = (
  detailCard,
  {
    selectedOT,
    actions,
    ro,
    isClosingOT,
    isGeneratingPdf,
    isSavingEquipos,
    isPatchingOtOperational,
    otEconomicsSaved,
  }
) => {
  const storageKey = detailStageStorageKey(selectedOT.id);
  let detailStageIdx = readStoredStageIndex(storageKey, CLIMA_OT_FLOW_STAGES.length - 1);

  detailCard.classList.add('ot-flow-app', 'ot-flow-app--detail');
  const flowRoot = document.createElement('div');
  flowRoot.className = 'ot-flow-app__inner ot-flow-app__inner--command';

  const compactHeader = document.createElement('header');
  compactHeader.className = 'ot-saas-sticky ot-flow-compact-header';
  const meta = document.createElement('div');
  meta.className = 'ot-saas-sticky__meta';
  [
    ['OT', selectedOT.id],
    ['Cliente', selectedOT.cliente],
    ['Técnico', selectedOT.tecnicoAsignado],
  ].forEach(([k, v]) => {
    const pill = document.createElement('div');
    pill.className = 'ot-saas-pill';
    pill.innerHTML = `<span>${k}</span><strong>${v || '—'}</strong>`;
    meta.append(pill);
  });
  const statusPill = document.createElement('div');
  statusPill.className = 'ot-saas-pill';
  const stK = document.createElement('span');
  stK.textContent = 'Estado';
  const stV = document.createElement('strong');
  stV.append(createStatusBadge(selectedOT.estado));
  statusPill.append(stK, stV);
  meta.append(statusPill);
  compactHeader.append(meta);

  const progressNav = document.createElement('nav');
  progressNav.className = 'ot-flow-progress';
  progressNav.setAttribute('aria-label', 'Etapas de la OT');

  const jarvisAside = document.createElement('aside');
  jarvisAside.className = 'ot-flow-jarvis';
  const jt = document.createElement('h4');
  jt.className = 'ot-flow-jarvis__title';
  jt.textContent = 'Jarvis · esta etapa';
  const jarvisUl = document.createElement('ul');
  jarvisUl.className = 'ot-flow-jarvis__list';
  const jarvisNext = document.createElement('p');
  jarvisNext.className = 'ot-flow-jarvis__next';
  jarvisAside.append(jt, jarvisUl, jarvisNext);

  const execSummaryAside = document.createElement('aside');
  execSummaryAside.className = 'ot-flow-exec-summary';
  execSummaryAside.setAttribute('aria-label', 'Resumen ejecutivo de la orden');

  const progressWrap = document.createElement('div');
  progressWrap.className = 'ot-flow-progress-bar-wrap';
  progressWrap.setAttribute('aria-hidden', 'true');
  const progressFill = document.createElement('div');
  progressFill.className = 'ot-flow-progress-bar__fill';
  progressWrap.append(progressFill);

  const stageHero = document.createElement('div');
  stageHero.className = 'ot-flow-stage-hero';

  const validationBanner = document.createElement('div');
  validationBanner.className = 'ot-flow-validation-banner';
  validationBanner.hidden = true;
  validationBanner.setAttribute('role', 'alert');

  const stageRow = document.createElement('div');
  stageRow.className = 'ot-flow-command-stage-row';

  const stageBody = document.createElement('div');
  stageBody.className = 'ot-flow-stage-body';

  const mkPanel = (idx) => {
    const p = document.createElement('section');
    p.className = 'ot-flow-stage-panel';
    p.dataset.detailStage = String(idx);
    p.hidden = true;
    return p;
  };

  const p0 = mkPanel(0);
  const h0 = document.createElement('h3');
  h0.className = 'ot-flow-stage-title';
  h0.textContent = 'Entrada · datos del sitio';
  const waRow = document.createElement('div');
  waRow.className = 'ot-saas-block ot-flow-block';
  const waMeta = document.createElement('p');
  waMeta.className = 'muted small';
  const os0 = String(selectedOT.origenSolicitud || selectedOT.origenPedido || '').toLowerCase();
  waMeta.textContent =
    os0 === 'whatsapp'
      ? `WhatsApp · Pendiente respuesta al cliente: ${selectedOT.pendienteRespuestaCliente ? 'sí' : 'no'}`
      : '';
  const btnWa = document.createElement('button');
  btnWa.type = 'button';
  btnWa.className = 'secondary-button ot-flow-footer__btn';
  btnWa.textContent = 'Simular envío respuesta al cliente';
  btnWa.hidden = !(os0 === 'whatsapp' && selectedOT.pendienteRespuestaCliente);
  btnWa.addEventListener('click', async () => {
    await actions.patchOtOperational(selectedOT.id, { pendienteRespuestaCliente: false });
  });
  waRow.append(waMeta, btnWa);

  const histBlock = document.createElement('div');
  histBlock.className = 'ot-saas-block ot-flow-block ot-flow-block--scroll';
  const histH = document.createElement('h4');
  histH.textContent = 'Historial reciente';
  const histUl = document.createElement('ul');
  histUl.className = 'muted small';
  histUl.style.paddingLeft = '1.1rem';
  const hist = Array.isArray(selectedOT.historial) ? selectedOT.historial : [];
  if (!hist.length) {
    const li = document.createElement('li');
    li.textContent = 'Sin eventos registrados.';
    histUl.append(li);
  } else {
    for (const ev of [...hist].slice(-12).reverse()) {
      const li = document.createElement('li');
      li.textContent = `${formatAuditTs(ev.at)} · ${ev.actor || '—'} · ${ev.accion || '—'} — ${ev.detalle || ''}`;
      histUl.append(li);
    }
  }
  histBlock.append(histH, histUl);

  const editGrid = document.createElement('div');
  editGrid.className = 'ot-form__grid';
  const mkEdit = (name, lab, val) => {
    const w = document.createElement('label');
    w.className = 'form-field';
    const sp = document.createElement('span');
    sp.className = 'form-field__label';
    sp.textContent = lab;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.name = `edit-${name}`;
    inp.value = val || '';
    inp.className = 'form-field__control ot-flow-touch-control';
    inp.readOnly = ro;
    w.append(sp, inp);
    return w;
  };
  editGrid.append(
    mkEdit('cliente', 'Cliente', selectedOT.cliente),
    mkEdit('direccion', 'Dirección', selectedOT.direccion),
    mkEdit('comuna', 'Comuna', selectedOT.comuna),
    mkEdit('contactoTerreno', 'Contacto', selectedOT.contactoTerreno),
    mkEdit('telefonoContacto', 'Teléfono', selectedOT.telefonoContacto),
    mkEdit('subtipoServicio', 'Subtipo servicio', selectedOT.subtipoServicio)
  );

  const flushEntrada = async () => {
    if (ro) return true;
    const g = (n) => editGrid.querySelector(`[name="edit-${n}"]`)?.value?.trim() ?? '';
    await actions.patchOtCore(selectedOT.id, {
      cliente: g('cliente'),
      direccion: g('direccion'),
      comuna: g('comuna'),
      contactoTerreno: g('contactoTerreno'),
      telefonoContacto: g('telefonoContacto'),
      subtipoServicio: g('subtipoServicio'),
    });
    return true;
  };

  const draftEntradaOt = () => {
    const g = (n) => editGrid.querySelector(`[name="edit-${n}"]`)?.value?.trim() ?? '';
    return {
      ...selectedOT,
      cliente: g('cliente') || selectedOT.cliente,
      direccion: g('direccion') || selectedOT.direccion,
      comuna: g('comuna') || selectedOT.comuna,
      contactoTerreno: g('contactoTerreno') || selectedOT.contactoTerreno,
      telefonoContacto: g('telefonoContacto') || selectedOT.telefonoContacto,
      subtipoServicio: g('subtipoServicio') || selectedOT.subtipoServicio,
    };
  };

  p0.append(h0, waRow, histBlock, editGrid);

  const p1 = mkPanel(1);
  const h1 = document.createElement('h3');
  h1.className = 'ot-flow-stage-title';
  h1.textContent = 'Clasificación';
  p1.append(h1, buildOtOperationalSummarySection(selectedOT));

  const p2 = mkPanel(2);
  const h2 = document.createElement('h3');
  h2.className = 'ot-flow-stage-title';
  h2.textContent = 'Asignación';
  const estadoBar = document.createElement('div');
  estadoBar.className = 'ot-saas-block ot-flow-block';
  const estLab = document.createElement('label');
  estLab.className = 'form-field';
  const estSpan = document.createElement('span');
  estSpan.className = 'form-field__label';
  estSpan.textContent = 'Estado en servidor';
  const estadoSel = document.createElement('select');
  estadoSel.className = 'ot-op-detail__select ot-flow-touch-control';
  const curNorm = String(selectedOT.estado || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  const curVal =
    selectedOT.estado === 'en proceso'
      ? 'en_proceso'
      : OT_STATUS_OPTIONS.some((o) => o.value === curNorm)
        ? curNorm
        : 'nueva';
  OT_STATUS_OPTIONS.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === curVal) opt.selected = true;
    estadoSel.append(opt);
  });
  estadoSel.disabled = ro;
  estLab.append(estSpan, estadoSel);
  estadoBar.append(estLab);

  const { element: opControls, flushOperationalSave } = buildOtOperationalControlsSection(
    selectedOT,
    actions,
    ro,
    isPatchingOtOperational
  );
  p2.append(h2, estadoBar, opControls);

  const flushAsignacion = async () => {
    if (ro) return true;
    await actions.updateOTStatus(selectedOT.id, estadoSel.value);
    await flushOperationalSave();
    return true;
  };

  const p3 = mkPanel(3);
  const h3 = document.createElement('h3');
  h3.className = 'ot-flow-stage-title';
  h3.textContent = 'Ejecución · texto, equipos y fotos';
  const summaryMini = document.createElement('div');
  summaryMini.className = 'ot-summary-grid ot-flow-summary-mini';
  [
    ['Fecha / hora', `${selectedOT.fecha} · ${selectedOT.hora}`],
    ['Técnico', selectedOT.tecnicoAsignado],
    ['Servicio', `${selectedOT.tipoServicio} / ${selectedOT.subtipoServicio}`],
  ].forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'ot-summary-item';
    row.innerHTML = `<span>${label}</span><strong>${value || '—'}</strong>`;
    summaryMini.append(row);
  });

  const mkTa = (label, value) => {
    const w = document.createElement('label');
    w.className = 'form-field ot-flow-field-stack';
    const sp = document.createElement('span');
    sp.className = 'form-field__label';
    sp.textContent = label;
    const ta = document.createElement('textarea');
    ta.rows = 4;
    ta.className = 'ot-flow-textarea ot-flow-touch-control';
    ta.value = value || '';
    ta.readOnly = ro;
    w.append(sp, ta);
    return { w, ta };
  };
  const resBlock = mkTa('Resumen del trabajo', selectedOT.resumenTrabajo);
  const obsBlock = mkTa('Observaciones', selectedOT.observaciones);
  const recBlock = mkTa('Recomendaciones', selectedOT.recomendaciones);

  const detailEqHost = document.createElement('div');
  detailEqHost.className = 'ot-detail-equipos-host ot-saas-cards';
  (selectedOT.equipos?.length ? selectedOT.equipos : [{}]).forEach((eq, idx) => {
    detailEqHost.append(buildDetailEquipoRow(eq, idx, ro));
  });

  const eqToolbar = document.createElement('div');
  eqToolbar.className = 'ot-equipos-toolbar';
  const addDetailEq = document.createElement('button');
  addDetailEq.type = 'button';
  addDetailEq.className = 'secondary-button ot-flow-footer__btn';
  addDetailEq.textContent = '+ Equipo';
  addDetailEq.disabled = Boolean(ro || isSavingEquipos);
  addDetailEq.addEventListener('click', () => {
    const n = detailEqHost.querySelectorAll('.ot-equipo-detail-row').length;
    if (n >= MAX_EQUIPOS || ro) return;
    detailEqHost.append(buildDetailEquipoRow({ id: `eq-new-${Date.now()}-${n}` }, n, false));
  });
  const saveEq = document.createElement('button');
  saveEq.type = 'button';
  saveEq.className = 'primary-button ot-flow-footer__btn';
  saveEq.textContent = isSavingEquipos ? 'Guardando…' : 'Guardar equipos ahora';
  saveEq.disabled = Boolean(ro || isSavingEquipos);
  saveEq.addEventListener('click', async () => {
    await actions.saveEquipos(selectedOT.id, collectEquiposFromDetail(detailEqHost, selectedOT));
  });
  eqToolbar.append(addDetailEq, saveEq);

  const evidenceBoard = document.createElement('div');
  evidenceBoard.className = 'ot-saas-evidence-grid';
  ['fotografiasAntes', 'fotografiasDurante', 'fotografiasDespues'].forEach((key, idx) => {
    const labels = ['Antes', 'Durante', 'Después'];
    const col = document.createElement('article');
    col.className = 'ot-saas-block';
    const hh = document.createElement('h4');
    hh.textContent = `${labels[idx]} (visita)`;
    const drop = document.createElement('label');
    drop.className = 'ot-dropzone';
    drop.innerHTML = '<span>Tocá o arrastrá fotos acá</span>';
    const hiddenFile = document.createElement('input');
    hiddenFile.type = 'file';
    hiddenFile.accept = 'image/*';
    hiddenFile.multiple = true;
    hiddenFile.hidden = true;
    drop.append(hiddenFile);
    const gallery = document.createElement('div');
    gallery.className = 'ot-evidence-preview';
    const renderGallery = (items = []) => {
      gallery.innerHTML = '';
      if (!items.length) {
        const em = document.createElement('p');
        em.className = 'muted';
        em.textContent = 'Sin evidencia.';
        gallery.append(em);
        return;
      }
      items.forEach((it) => gallery.append(createEvidenceSection(it.name || 'Evidencia', [it])));
    };
    renderGallery((selectedOT[key] || []).map(normalizeEvidenceItemForUi));
    hiddenFile.addEventListener('change', async () => {
      const added = await readFilesAsEvidence(hiddenFile);
      const payload = collectEquiposFromDetail(detailEqHost, selectedOT);
      if (!payload[0]) return;
      payload[0][key] = [...(payload[0][key] || []), ...added.map((a) => ({ ...a, id: newLocalEvidenceId() }))];
      await actions.saveEquipos(selectedOT.id, payload);
    });
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('is-over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', async (e) => {
      e.preventDefault();
      drop.classList.remove('is-over');
      hiddenFile.files = e.dataTransfer.files;
      hiddenFile.dispatchEvent(new Event('change'));
    });
    col.append(hh, drop, gallery);
    evidenceBoard.append(col);
  });

  const flushEjecucion = async () => {
    if (ro) return true;
    await actions.saveVisitText(selectedOT.id, {
      observaciones: obsBlock.ta.value.trim(),
      resumenTrabajo: resBlock.ta.value.trim(),
      recomendaciones: recBlock.ta.value.trim(),
    });
    await actions.saveEquipos(selectedOT.id, collectEquiposFromDetail(detailEqHost, selectedOT));
    return true;
  };

  const draftExecOt = () => ({
    ...selectedOT,
    resumenTrabajo: resBlock.ta.value.trim(),
    observaciones: obsBlock.ta.value.trim(),
    recomendaciones: recBlock.ta.value.trim(),
  });

  p3.append(
    h3,
    summaryMini,
    resBlock.w,
    obsBlock.w,
    recBlock.w,
    detailEqHost,
    eqToolbar,
    evidenceBoard
  );

  const p4 = mkPanel(4);
  const h4 = document.createElement('h3');
  h4.className = 'ot-flow-stage-title';
  h4.textContent = 'Informe';
  const checklistPanel = document.createElement('article');
  checklistPanel.className = 'ot-saas-block';
  checklistPanel.innerHTML = '<h4>Checklist</h4>';
  const brief = buildOtOperationalBrief(selectedOT, { economicsSaved: otEconomicsSaved });
  const checklist = document.createElement('div');
  checklist.className = 'ot-visual-checklist';
  (brief.blockers.length ? brief.blockers.map((b) => ({ ok: false, label: b.detail })) : [{ ok: true, label: 'Sin bloqueos operativos.' }]).forEach((item) => {
    const row = document.createElement('label');
    row.className = `ot-visual-check ${item.ok ? 'is-on' : ''}`;
    const t = document.createElement('span');
    t.textContent = item.label;
    row.append(t);
    checklist.append(row);
  });
  checklistPanel.append(checklist);
  const previewPanel = document.createElement('article');
  previewPanel.className = 'ot-saas-block';
  previewPanel.innerHTML = '<h4>Vista previa</h4>';
  previewPanel.append(createClientPreview(selectedOT));
  const pdfTop = document.createElement('button');
  pdfTop.type = 'button';
  pdfTop.className = 'secondary-button ot-flow-footer__btn';
  pdfTop.textContent = isGeneratingPdf ? 'Generando…' : 'Generar PDF';
  pdfTop.disabled = Boolean(isGeneratingPdf || isClosingOT);
  pdfTop.addEventListener('click', async () => actions.generatePdfFromOt(selectedOT));
  p4.append(h4, checklistPanel, previewPanel, pdfTop);

  const p5 = mkPanel(5);
  const h5 = document.createElement('h3');
  h5.className = 'ot-flow-stage-title';
  h5.textContent = 'Cierre';
  const closeHint = document.createElement('p');
  closeHint.className = 'muted';
  closeHint.textContent =
    'Solo podés cerrar cuando haya evidencia completa, textos, economía guardada y técnico asignado.';
  const blockersP = document.createElement('p');
  blockersP.className = 'ot-flow-blockers';
  blockersP.textContent = otCanClose(selectedOT) ? '' : formatAllCloseBlockersMessage(selectedOT);
  const closeTop = document.createElement('button');
  closeTop.type = 'button';
  closeTop.className = 'primary-button ot-flow-footer__btn';
  closeTop.textContent = isClosingOT ? 'Procesando…' : 'Cerrar OT';
  closeTop.disabled = Boolean(isClosingOT || ro || !otCanClose(selectedOT));
  closeTop.addEventListener('click', async () => {
    await actions.closeAndGenerateReport(selectedOT, {
      costoMateriales: roundEcon(selectedOT.costoMateriales),
      costoManoObra: roundEcon(selectedOT.costoManoObra),
      costoTraslado: roundEcon(selectedOT.costoTraslado),
      costoOtros: roundEcon(selectedOT.costoOtros),
      montoCobrado: roundEcon(selectedOT.montoCobrado),
    });
  });
  const delTop = document.createElement('button');
  delTop.type = 'button';
  delTop.className = 'secondary-button ot-flow-footer__btn';
  delTop.textContent = 'Eliminar OT';
  delTop.hidden = resolveOperatorRole() !== 'admin';
  delTop.addEventListener('click', async () => {
    if (!window.confirm(`¿Eliminar definitivamente ${selectedOT.id}? Solo admin.`)) return;
    await actions.deleteOt(selectedOT.id);
  });
  p5.append(h5, closeHint, blockersP, closeTop, delTop);

  stageBody.append(p0, p1, p2, p3, p4, p5);

  stageRow.append(jarvisAside, stageBody);

  const footer = document.createElement('div');
  footer.className = 'ot-flow-footer';
  const btnPrev = document.createElement('button');
  btnPrev.type = 'button';
  btnPrev.className = 'secondary-button ot-flow-footer__btn';
  btnPrev.textContent = 'Anterior';
  const btnSaveStage = document.createElement('button');
  btnSaveStage.type = 'button';
  btnSaveStage.className = 'secondary-button ot-flow-footer__btn ot-flow-footer__btn--save';
  btnSaveStage.textContent = 'Guardar etapa';
  btnSaveStage.hidden = Boolean(ro);
  const footMsg = document.createElement('p');
  footMsg.className = 'ot-flow-footer__msg muted';
  const btnNext = document.createElement('button');
  btnNext.type = 'button';
  btnNext.className = 'primary-button ot-flow-footer__btn';
  btnNext.textContent = 'Siguiente etapa';
  footer.append(btnPrev, btnSaveStage, footMsg, btnNext);

  const panels = [p0, p1, p2, p3, p4, p5];

  const paintExecSummary = () => {
    const base = { ...selectedOT, ...draftEntradaOt() };
    const merged = detailStageIdx >= 3 ? { ...base, ...draftExecOt() } : base;
    execSummaryAside.replaceChildren(
      buildOtExecutiveSummaryCard(merged, { economicsSaved: otEconomicsSaved })
    );
  };

  btnSaveStage.addEventListener('click', async () => {
    if (ro) return;
    validationBanner.hidden = true;
    validationBanner.textContent = '';
    try {
      if (detailStageIdx === 0) await flushEntrada();
      if (detailStageIdx === 2) await flushAsignacion();
      if (detailStageIdx === 3) await flushEjecucion();
      footMsg.textContent = 'Etapa guardada.';
      actions?.showFeedback?.({ type: 'success', message: footMsg.textContent });
    } catch {
      footMsg.textContent = 'No se pudo guardar esta etapa.';
      validationBanner.textContent = footMsg.textContent;
      validationBanner.hidden = false;
      actions?.showFeedback?.({ type: 'error', message: footMsg.textContent });
      return;
    }
    paintExecSummary();
  });

  const renderJarvis = () => {
    jarvisUl.innerHTML = '';
    jarvisLinesForDetailStage(selectedOT, detailStageIdx, { economicsSaved: otEconomicsSaved }).forEach((txt) => {
      const li = document.createElement('li');
      li.textContent = txt;
      jarvisUl.append(li);
    });
    jarvisNext.textContent = `Acción sugerida: ${nextActionHintForDetailStage(selectedOT, detailStageIdx)}`;
  };

  const setDetailStage = (idx) => {
    const n = Math.max(0, Math.min(CLIMA_OT_FLOW_STAGES.length - 1, idx));
    detailStageIdx = n;
    writeStoredStageIndex(storageKey, n);
    panels.forEach((p, i) => {
      p.hidden = i !== n;
    });
    progressNav.querySelectorAll('.ot-flow-progress__step').forEach((btn, i) => {
      btn.classList.toggle('is-active', i === n);
      btn.classList.toggle('is-done', i < n);
      btn.disabled = !ro && i > n;
    });
    const pct = ((n + 1) / CLIMA_OT_FLOW_STAGES.length) * 100;
    progressFill.style.width = `${pct}%`;

    const stMeta = CLIMA_OT_FLOW_STAGES[n];
    const heroMeta = DETAIL_STAGE_HERO[stMeta.id] || { title: stMeta.label, lede: '' };
    stageHero.replaceChildren();
    const ey = document.createElement('span');
    ey.className = 'ot-flow-stage-hero__eyebrow';
    ey.textContent = `Etapa ${n + 1} de ${CLIMA_OT_FLOW_STAGES.length} · ${stMeta.label}`;
    const h2 = document.createElement('h2');
    h2.className = 'ot-flow-stage-hero__title';
    h2.textContent = heroMeta.title;
    const sub = document.createElement('p');
    sub.className = 'ot-flow-stage-hero__lede';
    sub.textContent = heroMeta.lede;
    stageHero.append(ey, h2, sub);

    btnPrev.disabled = n === 0;
    btnNext.hidden = n === CLIMA_OT_FLOW_STAGES.length - 1 || ro;
    btnNext.textContent = n === 4 ? 'Ir a cierre' : 'Siguiente etapa';
    footMsg.textContent = '';
    validationBanner.hidden = true;
    validationBanner.textContent = '';
    renderJarvis();
    paintExecSummary();
  };

  CLIMA_OT_FLOW_STAGES.forEach((st, i) => {
    if (i > 0) {
      const ar = document.createElement('span');
      ar.className = 'ot-flow-progress__arrow';
      ar.setAttribute('aria-hidden', 'true');
      ar.textContent = '→';
      progressNav.append(ar);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ot-flow-progress__step';
    btn.innerHTML = `<span class="ot-flow-progress__dot">${i + 1}</span><span class="ot-flow-progress__label">${st.label}</span>`;
    btn.addEventListener('click', () => {
      if (i <= detailStageIdx) setDetailStage(i);
    });
    progressNav.append(btn);
  });

  btnPrev.addEventListener('click', () => setDetailStage(detailStageIdx - 1));

  btnNext.addEventListener('click', async () => {
    if (ro) {
      setDetailStage(detailStageIdx + 1);
      return;
    }
    try {
      if (detailStageIdx === 0) await flushEntrada();
      if (detailStageIdx === 2) await flushAsignacion();
      if (detailStageIdx === 3) await flushEjecucion();
    } catch {
      footMsg.textContent = 'No se pudo guardar. Revisá conexión e intentá de nuevo.';
      actions?.showFeedback?.({ type: 'error', message: footMsg.textContent });
      return;
    }

    let v = { ok: true, message: '' };
    if (detailStageIdx === 0) v = validateDetailStageAdvance(draftEntradaOt(), 0);
    else if (detailStageIdx === 1) v = validateDetailStageAdvance(selectedOT, 1);
    else if (detailStageIdx === 2) v = validateDetailStageAdvance(selectedOT, 2);
    else if (detailStageIdx === 3) v = validateDetailStageAdvance(draftExecOt(), 3);
    else if (detailStageIdx === 4) v = validateDetailStageAdvance(selectedOT, 4, { economicsSaved: otEconomicsSaved });

    if (!v.ok) {
      footMsg.textContent = v.message;
      validationBanner.textContent = v.message;
      validationBanner.hidden = false;
      actions?.showFeedback?.({ type: 'error', message: v.message });
      return;
    }
    setDetailStage(detailStageIdx + 1);
  });

  const mainColumn = document.createElement('div');
  mainColumn.className = 'ot-flow-command-main';
  mainColumn.append(
    compactHeader,
    progressWrap,
    progressNav,
    stageHero,
    validationBanner,
    stageRow,
    footer
  );
  flowRoot.append(execSummaryAside, mainColumn);
  detailCard.append(flowRoot);
  setDetailStage(detailStageIdx);
};

const parseMoneyInput = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const roundEcon = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const formatClp = (n) => {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
};

const formatAuditTs = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
};

const computeLiveEconomicsFrom = (root) => {
  if (!root) {
    return { costoTotal: 0, monto: 0, utilidad: 0, margenPct: null };
  }
  const q = (name) => roundEcon(root.querySelector(`[name="${name}"]`)?.value);
  const costoTotal = roundEcon(
    q('costoMateriales') + q('costoManoObra') + q('costoTraslado') + q('costoOtros')
  );
  const monto = roundEcon(root.querySelector('[name="montoCobrado"]')?.value);
  const utilidad = roundEcon(monto - costoTotal);
  const margenPct = monto > 0 ? roundEcon((utilidad / monto) * 100) : null;
  return { costoTotal, monto, utilidad, margenPct };
};

const utilidadToneClass = (utilidad, monto) => {
  if (!(monto > 0)) return 'ot-econ-kpi--neutral';
  if (utilidad > 0) return 'ot-econ-kpi--pos';
  if (utilidad < 0) return 'ot-econ-kpi--neg';
  return 'ot-econ-kpi--neutral';
};

const intelFilterActiveKeys = (f) =>
  f && typeof f === 'object'
    ? Object.keys(f).filter((k) => f[k] != null && f[k] !== false && f[k] !== '')
    : [];

const filterOtsIntelList = (list, intelListFilter) => {
  if (!intelFilterActiveKeys(intelListFilter).length) return list;
  let out = list;
  if (intelListFilter.soloMesActual) {
    const { start, end } = monthRangeYmd();
    out = out.filter((o) => o.fecha >= start && o.fecha <= end);
  }
  if (intelListFilter.sinCostoTerminadas) {
    out = out.filter((o) => isOtEstadoCerradaUi(o.estado) && roundEcon(o.costoTotal) <= 0);
  }
  if (intelListFilter.sinCobroConPdf) {
    out = out.filter(
      (o) =>
        isOtEstadoCerradaUi(o.estado) &&
        o.pdfUrl &&
        String(o.pdfUrl).trim() &&
        roundEcon(o.montoCobrado) <= 0
    );
  }
  if (intelListFilter.sinPdfTerminadas) {
    out = out.filter((o) => isOtEstadoCerradaUi(o.estado) && (!o.pdfUrl || !String(o.pdfUrl).trim()));
  }
  if (intelListFilter.soloAbiertas) {
    out = out.filter((o) => !isOtEstadoCerradaUi(o.estado));
  }
  if (intelListFilter.clienteContains) {
    const q = String(intelListFilter.clienteContains).toLowerCase();
    out = out.filter((o) => String(o.cliente || '').toLowerCase().includes(q));
  }
  return out;
};

const buildClimaIntelChecklist = (ot, economicsSaved) => {
  if (!ot) return [];
  if (isOtEstadoCerradaUi(ot.estado)) {
    return [
      { ok: roundEcon(ot.costoTotal) > 0, label: 'Costo total > 0 guardado' },
      { ok: roundEcon(ot.montoCobrado) > 0, label: 'Monto cobrado > 0 guardado' },
      { ok: Boolean(ot.pdfUrl && String(ot.pdfUrl).trim()), label: 'PDF informe en servidor' },
    ];
  }
  const brief = buildOtOperationalBrief(ot, { economicsSaved });
  if (brief.blockers.length) {
    return brief.blockers.map((b) => ({ ok: false, label: b.detail }));
  }
  return [
    {
      ok: Boolean(otCanClose(ot) && economicsSaved),
      label: 'Evidencias, textos y economía listos para cerrar',
    },
  ];
};

export const climaView = ({
  data,
  actions,
  feedback,
  integrationStatus,
  isSubmitting,
  isUpdatingStatus = false,
  isClosingOT,
  isUploadingEvidence,
  isGeneratingPdf,
  isSavingEquipos,
  isSavingVisitText,
  isSavingOtEconomics,
  otEconomicsSaved,
  selectedOTId,
  reloadApp,
  intelListFilter,
  intelGuidance,
  isPatchingOtOperational,
} = {}) => {
  const section = document.createElement('section');
  section.className = 'ot-workspace hnf-op-view hnf-op-view--clima';

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML =
    '<h2>Clima · ejecución OT</h2><p class="muted">Módulo técnico <strong class="hnf-accent-clima">HVAC</strong>: precisión de campo. Orden en pantalla: <strong>A</strong> completar ahora · <strong>B</strong> datos automáticos · <strong>C</strong> evidencia visita · <strong>D</strong> cierre. Flujo: ingreso → Bandeja → asignación → <strong>ejecución acá</strong> → informe → cierre.</p>';

  const flowStrip = createHnfOperationalFlowStrip(3);
  const climaIdentity = createHnfClimaOpsIdentityCard();

  if (feedback?.message) {
    const notice = document.createElement('div');
    notice.className = `form-feedback form-feedback--${feedback.type} workspace-notice`;
    notice.setAttribute('role', 'status');
    notice.textContent = feedback.message;
    header.append(notice);
  }

  const climaToolbar = document.createElement('div');
  climaToolbar.className = 'module-toolbar';
  const climaRefresh = document.createElement('button');
  climaRefresh.type = 'button';
  climaRefresh.className = 'secondary-button';
  climaRefresh.textContent = 'Actualizar datos';
  climaRefresh.title = 'Vuelve a cargar la lista de OT desde el servidor.';
  const climaRefreshHint = document.createElement('span');
  climaRefreshHint.className = 'muted module-toolbar__hint';
  climaRefreshHint.textContent = 'Sincronizá si otra persona editó o llevás la pantalla abierta mucho tiempo.';
  climaRefresh.addEventListener('click', async () => {
    if (typeof reloadApp !== 'function') return;
    const prev = climaRefresh.textContent;
    climaRefresh.disabled = true;
    climaRefresh.textContent = 'Actualizando…';
    actions?.showFeedback?.({ type: 'neutral', message: 'Sincronizando órdenes…' });
    const ok = await reloadApp();
    actions?.showFeedback?.({
      type: ok ? 'success' : 'error',
      message: ok ? 'Datos al día con el servidor.' : 'Sin conexión o error al actualizar.',
    });
    climaRefresh.textContent = ok ? 'Listo' : 'Error';
    setTimeout(() => {
      climaRefresh.textContent = prev;
      climaRefresh.disabled = false;
    }, 1600);
  });
  climaToolbar.append(climaRefresh, climaRefreshHint);

  const opRole = resolveOperatorRole();
  let ots = [...(data?.data || [])].reverse();
  if (opRole === 'clima' || opRole === 'tecnico') {
    ots = ots.filter((o) => {
      const t = String(o.tipoServicio || '').toLowerCase();
      return t === 'clima' || t === 'administrativo';
    });
  } else if (opRole === 'flota') {
    ots = [];
  }
  const listOts = filterOtsIntelList(ots, intelListFilter);
  const effectiveSelectedId = listOts.some((item) => item.id === selectedOTId)
    ? selectedOTId
    : listOts[0]?.id ?? selectedOTId;
  const selectedOT = ots.find((item) => item.id === effectiveSelectedId) || ots[0] || null;
  const pendingCount = ots.filter((item) => {
    const s = String(item.estado || '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    return s === 'nueva' || s === 'pendiente' || s === 'asignada';
  }).length;
  const inProgressCount = ots.filter((item) => {
    const s = String(item.estado || '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    return s === 'en_proceso' || s === 'pendiente_validacion' || item.estado === 'en proceso';
  }).length;
  const eqTotal = ots.reduce((t, o) => t + (o.equipos?.length || 0), 0);

  const cards = document.createElement('div');
  cards.className = 'cards';
  [
    {
      title: 'Órdenes de trabajo',
      description: 'Resumen rápido.',
      items: [
        `Total: ${ots.length}`,
        `Nueva / asignada: ${pendingCount}`,
        `En proceso / validación: ${inProgressCount}`,
      ],
    },
    {
      title: 'Equipos',
      description: 'En todas las visitas.',
      items: [`Equipos cargados: ${eqTotal}`, `Tope por visita: ${MAX_EQUIPOS}`],
    },
    {
      title: 'Antes de cerrar',
      description: 'Requisitos.',
      items: [
        'Fotos antes, durante y después por equipo',
        'Checklist completo y texto de resumen de visita',
      ],
    },
  ].forEach((item) => cards.append(createCard(item)));

  const formCard = document.createElement('article');
  formCard.className = 'ot-form-card ot-flow-app ot-flow-app--create';

  const formHeader = document.createElement('div');
  formHeader.className = 'ot-form-card__header';
  formHeader.innerHTML = `
    <div>
      <p class="muted">Nueva visita · flujo por etapas</p>
      <h3>Crear OT</h3>
      <p class="muted ot-flow-app__lede">Una etapa por pantalla. Podés volver atrás tocando una etapa ya visitada.</p>
    </div>
  `;

  const form = document.createElement('form');
  form.className = 'ot-form ot-flow-app__form';
  form.setAttribute('novalidate', 'true');

  const createStageKey = createFlowStorageKey();
  let createStageIdx = readStoredStageIndex(createStageKey, CLIMA_OT_FLOW_STAGES.length - 1);

  const mkPanel = (idx) => {
    const p = document.createElement('div');
    p.className = 'ot-flow-stage-panel';
    p.dataset.createStage = String(idx);
    p.hidden = idx !== createStageIdx;
    return p;
  };

  const panel0 = mkPanel(0);
  const grid0 = document.createElement('div');
  grid0.className = 'ot-form__grid';
  ['cliente', 'direccion', 'comuna', 'contactoTerreno', 'telefonoContacto'].forEach((name) => {
    const field = otFormDefinition.sections[0].fields.find((f) => f.name === name);
    if (field) grid0.append(buildField(field));
  });
  panel0.append(grid0);

  const panel1 = mkPanel(1);
  const grid1 = document.createElement('div');
  grid1.className = 'ot-form__grid';
  ['tipoServicio', 'subtipoServicio', 'fecha', 'hora'].forEach((name) => {
    const field = otFormDefinition.sections[0].fields.find((f) => f.name === name);
    if (field) grid1.append(buildField(field));
  });
  const estNote = document.createElement('p');
  estNote.className = 'muted small';
  estNote.textContent = 'La OT se crea en estado inicial «nueva» en el servidor.';
  panel1.append(grid1, estNote);

  const panel2 = mkPanel(2);
  panel2.append(buildOtAltaOperationSection());

  const panel3 = mkPanel(3);
  const fsDet = document.createElement('fieldset');
  fsDet.className = 'ot-form__section';
  const legDet = document.createElement('legend');
  legDet.textContent = 'Detalle técnico (opcional en el alta)';
  const gridDet = document.createElement('div');
  gridDet.className = 'ot-form__grid';
  otFormDefinition.sections[1].fields.forEach((field) => gridDet.append(buildField(field)));
  fsDet.append(legDet, gridDet);
  panel3.append(fsDet);

  const panel4 = mkPanel(4);
  const eqWrap = document.createElement('div');
  eqWrap.className = 'ot-form__section';
  eqWrap.innerHTML =
    '<h4 class="ot-equipos-title">Equipos en sitio (máx. 12)</h4><p class="muted">Podés agregar más después desde el detalle de la OT.</p>';
  const eqContainer = document.createElement('div');
  eqContainer.className = 'ot-equipos-create';
  const addEqBtn = document.createElement('button');
  addEqBtn.type = 'button';
  addEqBtn.className = 'secondary-button ot-flow-footer__btn';
  addEqBtn.textContent = '+ Agregar equipo';

  const appendEquipoRow = () => {
    if (eqContainer.querySelectorAll('.ot-equipo-form-row').length >= MAX_EQUIPOS) return;
    eqContainer.append(createEquipoFormRow());
    renumberEquipoFormRows(eqContainer);
  };

  appendEquipoRow();

  addEqBtn.addEventListener('click', () => {
    if (eqContainer.querySelectorAll('.ot-equipo-form-row').length >= MAX_EQUIPOS) return;
    eqContainer.append(createEquipoFormRow());
    renumberEquipoFormRows(eqContainer);
  });

  eqWrap.append(eqContainer, addEqBtn);
  panel4.append(eqWrap);

  const panel5 = mkPanel(5);
  const review = document.createElement('div');
  review.className = 'ot-flow-review';
  review.innerHTML =
    '<h4 class="ot-section-title">Última revisión</h4><p class="muted">Al confirmar se envía la OT al servidor con los datos cargados en las etapas anteriores.</p><ul class="ot-flow-review__list muted"></ul>';
  const reviewList = review.querySelector('.ot-flow-review__list');
  const refreshReview = () => {
    if (!reviewList) return;
    reviewList.innerHTML = '';
    const add = (k, v) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${k}:</strong> ${v || '—'}`;
      reviewList.append(li);
    };
    add('Cliente', form.elements.cliente?.value);
    add('Ubicación', `${form.elements.direccion?.value || ''}, ${form.elements.comuna?.value || ''}`);
    add('Contacto', `${form.elements.contactoTerreno?.value || ''} · ${form.elements.telefonoContacto?.value || ''}`);
    add('Servicio', `${form.elements.tipoServicio?.value || ''} / ${form.elements.subtipoServicio?.value || ''}`);
    add('Fecha', `${form.elements.fecha?.value || ''} ${form.elements.hora?.value || ''}`);
  };
  panel5.append(review);

  form.append(panel0, panel1, panel2, panel3, panel4, panel5);

  const createProgress = document.createElement('nav');
  createProgress.className = 'ot-flow-progress';
  createProgress.setAttribute('aria-label', 'Etapas de alta');

  const createJarvis = document.createElement('aside');
  createJarvis.className = 'ot-flow-jarvis';
  const createJarvisTitle = document.createElement('h4');
  createJarvisTitle.className = 'ot-flow-jarvis__title';
  createJarvisTitle.textContent = 'Jarvis · esta etapa';
  const createJarvisUl = document.createElement('ul');
  createJarvisUl.className = 'ot-flow-jarvis__list';
  const createJarvisNext = document.createElement('p');
  createJarvisNext.className = 'ot-flow-jarvis__next';
  createJarvis.append(createJarvisTitle, createJarvisUl, createJarvisNext);

  const createStageBody = document.createElement('div');
  createStageBody.className = 'ot-flow-stage-body';
  createStageBody.append(form);

  const createFooter = document.createElement('div');
  createFooter.className = 'ot-flow-footer';
  const createBtnPrev = document.createElement('button');
  createBtnPrev.type = 'button';
  createBtnPrev.className = 'secondary-button ot-flow-footer__btn';
  createBtnPrev.textContent = 'Anterior';
  const createMsg = document.createElement('p');
  createMsg.className = 'ot-flow-footer__msg muted';
  const createBtnNext = document.createElement('button');
  createBtnNext.type = 'button';
  createBtnNext.className = 'primary-button ot-flow-footer__btn';
  createBtnNext.textContent = 'Siguiente etapa';
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'primary-button ot-flow-footer__btn';
  submitButton.textContent = isSubmitting ? 'Guardando…' : 'Crear OT';
  submitButton.disabled = Boolean(isSubmitting);
  submitButton.hidden = true;
  createFooter.append(createBtnPrev, createMsg, createBtnNext, submitButton);

  const renderCreateJarvis = () => {
    createJarvisUl.innerHTML = '';
    jarvisLinesForCreateStage(createStageIdx).forEach((txt) => {
      const li = document.createElement('li');
      li.textContent = txt;
      createJarvisUl.append(li);
    });
    createJarvisNext.textContent =
      createStageIdx < CLIMA_OT_FLOW_STAGES.length - 1
        ? `Siguiente sugerido: ${CLIMA_OT_FLOW_STAGES[createStageIdx + 1].label}`
        : 'Confirmá y creá la orden.';
  };

  const setCreateStage = (idx) => {
    const n = Math.max(0, Math.min(CLIMA_OT_FLOW_STAGES.length - 1, idx));
    createStageIdx = n;
    writeStoredStageIndex(createStageKey, n);
    form.querySelectorAll('.ot-flow-stage-panel').forEach((el) => {
      el.hidden = Number(el.dataset.createStage) !== n;
    });
    createBtnPrev.disabled = n === 0;
    createBtnNext.hidden = n === CLIMA_OT_FLOW_STAGES.length - 1;
    submitButton.hidden = n !== CLIMA_OT_FLOW_STAGES.length - 1;
    createMsg.textContent = '';
    createProgress.querySelectorAll('.ot-flow-progress__step').forEach((btn, i) => {
      btn.classList.toggle('is-active', i === n);
      btn.classList.toggle('is-done', i < n);
      btn.disabled = i > n;
    });
    if (n === CLIMA_OT_FLOW_STAGES.length - 1) refreshReview();
    renderCreateJarvis();
  };

  CLIMA_OT_FLOW_STAGES.forEach((st, i) => {
    if (i > 0) {
      const ar = document.createElement('span');
      ar.className = 'ot-flow-progress__arrow';
      ar.setAttribute('aria-hidden', 'true');
      ar.textContent = '→';
      createProgress.append(ar);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ot-flow-progress__step';
    btn.dataset.stageIndex = String(i);
    btn.innerHTML = `<span class="ot-flow-progress__dot">${i + 1}</span><span class="ot-flow-progress__label">${st.label}</span>`;
    btn.addEventListener('click', () => {
      if (i <= createStageIdx) setCreateStage(i);
    });
    createProgress.append(btn);
  });

  createBtnPrev.addEventListener('click', () => setCreateStage(createStageIdx - 1));
  createBtnNext.addEventListener('click', () => {
    const v = validateCreateStageAdvance(form, eqContainer, createStageIdx);
    if (!v.ok) {
      createMsg.textContent = v.message;
      actions?.showFeedback?.({ type: 'error', message: v.message });
      return;
    }
    setCreateStage(createStageIdx + 1);
  });

  setCreateStage(createStageIdx);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const origenSolicitud = form.elements.origenSolicitudCreate?.value || '';
    const waNum = form.elements.whatsappNumeroCreate?.value?.trim() || '';
    const waNom = form.elements.whatsappNombreCreate?.value?.trim() || '';
    if (origenSolicitud === 'whatsapp' && (!waNum || !waNom)) {
      actions?.showFeedback?.({
        type: 'error',
        message: 'Con origen WhatsApp el número y el nombre de contacto son obligatorios.',
      });
      return;
    }
    const equipos = collectEquiposFromCreateForm(eqContainer);
    const customId = form.elements.otCustomId?.value?.trim() || '';
    const prioridadOperativa = form.elements.prioridadOperativaCreate?.value || 'media';
    const payload = {
      ...(customId ? { id: customId } : {}),
      cliente: form.elements.cliente.value.trim(),
      direccion: form.elements.direccion.value.trim(),
      comuna: form.elements.comuna.value.trim(),
      contactoTerreno: form.elements.contactoTerreno.value.trim(),
      telefonoContacto: form.elements.telefonoContacto.value.trim(),
      tipoServicio: form.elements.tipoServicio.value,
      subtipoServicio: form.elements.subtipoServicio.value.trim(),
      tecnicoAsignado: resolveTecnicoFromAltaForm(form),
      operationMode: form.elements.operationModeCreate?.value || 'manual',
      origenSolicitud,
      origenPedido: origenSolicitud,
      prioridadOperativa,
      whatsappContactoNumero: waNum,
      whatsappContactoNombre: waNom,
      fecha: form.elements.fecha.value,
      hora: form.elements.hora.value,
      observaciones: form.elements.observaciones.value.trim(),
      resumenTrabajo: form.elements.resumenTrabajo.value.trim(),
      recomendaciones: form.elements.recomendaciones.value.trim(),
      equipos,
    };
    await actions.createOT(payload);
  });

  formCard.append(formHeader, createProgress, createJarvis, createStageBody, createFooter);

  const overview = document.createElement('div');
  overview.className = 'ot-overview';

  const listCard = document.createElement('article');
  listCard.className = 'ot-list-card';
  listCard.innerHTML =
    '<div class="ot-list-card__header"><h3>Visitas / OT</h3><p class="muted">Paso 2 · Tocá una fila para ver el detalle y cargar evidencias.</p></div>';

  const hasIntelFilter = intelFilterActiveKeys(intelListFilter).length > 0;
  const hasIntelGuide = Boolean(intelGuidance && (intelGuidance.why || intelGuidance.fix));
  if (hasIntelFilter || hasIntelGuide) {
    const stack = document.createElement('div');
    stack.className = 'intel-guide-stack';
    if (hasIntelGuide) {
      const g = document.createElement('div');
      g.className = 'intel-guide-banner';
      const title = document.createElement('div');
      title.className = 'intel-guide-banner__title';
      title.textContent = 'Resolución guiada · inteligencia operativa';
      g.append(title);
      const mkLine = (k, v) => {
        if (!v) return;
        const lab = document.createElement('div');
        lab.className = 'intel-guide-banner__k';
        lab.textContent = k;
        const p = document.createElement('p');
        p.className = 'intel-guide-banner__p';
        p.textContent = v;
        g.append(lab, p);
      };
      mkLine('Por qué estás acá', intelGuidance.why);
      mkLine('Qué corregir', intelGuidance.fix);
      mkLine('Cierra cuando', intelGuidance.unlock);
      if (intelGuidance.recordLabel) {
        mkLine('Registro', String(intelGuidance.recordLabel));
      }
      stack.append(g);
      const chkItems = buildClimaIntelChecklist(selectedOT, otEconomicsSaved);
      if (chkItems.length) {
        const box = document.createElement('div');
        box.className = 'intel-guide-checklist';
        const hh = document.createElement('div');
        hh.className = 'intel-guide-checklist__h';
        hh.textContent = 'Checklist (reglas actuales)';
        const ul = document.createElement('ul');
        ul.className = 'intel-guide-checklist__ul';
        chkItems.forEach(({ ok, label }) => {
          const li = document.createElement('li');
          li.className = ok ? 'intel-guide-checklist__li is-ok' : 'intel-guide-checklist__li is-pend';
          li.textContent = `${ok ? '✓ ' : '○ '}${label}`;
          ul.append(li);
        });
        box.append(hh, ul);
        stack.append(box);
      }
    }
    if (hasIntelFilter) {
      const ban = document.createElement('div');
      ban.className = 'intel-filter-banner intel-filter-banner--nested';
      const lab = document.createElement('span');
      lab.className = 'intel-filter-banner__text';
      lab.textContent = 'Listado filtrado desde el Centro de inteligencia.';
      ban.append(lab);
      stack.append(ban);
    }
    const act = document.createElement('div');
    act.className = 'intel-guide-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'secondary-button';
    clr.textContent = hasIntelFilter ? 'Quitar filtro y guía' : 'Cerrar guía';
    clr.addEventListener('click', () =>
      hasIntelFilter ? actions?.clearIntelUiFilters?.() : actions?.dismissIntelGuidance?.()
    );
    act.append(clr);
    stack.append(act);
    listCard.insertBefore(stack, listCard.firstChild);
  }

  const list = document.createElement('div');
  list.className = 'ot-list';

  if (opRole === 'flota') {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent =
      'Tu bandeja de OT de Flota está en el módulo Flota. Este listado es para operación Clima / HVAC.';
    list.append(empty);
  } else if (!ots.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent =
      integrationStatus === 'sin conexión'
        ? 'Sin conexión al servidor: no hay órdenes cargadas. Revisá la red y tocá «Actualizar datos».'
        : 'No hay OT. Creá una visita arriba o sincronizá cuando el servidor esté disponible.';
    list.append(empty);
  } else if (!listOts.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent =
      'Ninguna OT coincide con el filtro inteligente. Quitá el filtro o ajustá criterios en el módulo.';
    list.append(empty);
  } else {
    listOts.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      const isTarget = intelGuidance?.recordLabel && item.id === intelGuidance.recordLabel;
      button.className = `ot-list__item ${selectedOT?.id === item.id ? 'is-active' : ''} ${
        isTarget ? 'is-intel-target' : ''
      }`.trim();
      const slaTier = computeOtSlaTierForClimaListItem(item);
      if (slaTier) button.dataset.hnfSlaTier = slaTier;
      const opMode = item.operationMode === 'automatic' ? 'automatic' : 'manual';
      button.innerHTML = `
        <div>
          <span class="ot-list__id muted">${item.id}</span>
          <span class="ot-list__mode ot-list__mode--${opMode}" title="Modo operación">${opMode === 'automatic' ? 'AUTO' : 'MANUAL'}</span>
          <strong>${item.cliente}</strong>
          <span class="muted">${item.fecha} · ${item.equipos?.length || 0} eq. · ${item.tipoServicio}</span>
        </div>
      `;
      button.append(createStatusBadge(item.estado), createStatusBadge(opMode === 'automatic' ? 'Automático' : 'Manual', 'mode'));
      button.addEventListener('click', () => actions.selectOT(item.id));
      list.append(button);
    });
  }

  listCard.append(list);
  queueMicrotask(() => {
    const t = list.querySelector('.ot-list__item.is-intel-target') || list.querySelector('.ot-list__item.is-active');
    t?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  });

  const detailCard = document.createElement('article');
  detailCard.className = 'ot-detail-card ot-saas-dashboard';

  if (!selectedOT) {
    detailCard.innerHTML =
      '<h3>Detalle de la visita</h3><p class="muted">Creá una orden arriba o elegí una del listado del medio.</p>';
  } else {
    mountClimaOtDetailFlow(detailCard, {
      selectedOT,
      actions,
      ro: isOtEstadoCerradaUi(selectedOT.estado),
      isClosingOT,
      isGeneratingPdf,
      isSavingEquipos,
      isPatchingOtOperational,
      otEconomicsSaved,
    });
  }

  overview.append(listCard, detailCard);

  const offlineBanner =
    integrationStatus === 'sin conexión'
      ? (() => {
          const b = document.createElement('div');
          b.className = 'integration-banner integration-banner--offline';
          b.setAttribute('role', 'status');
          b.textContent =
            'Sin conexión al servidor. El listado puede estar vacío o desactualizado. Revisá la red y usá «Actualizar datos».';
          return b;
        })()
      : null;

  const heroBand = document.createElement('div');
  heroBand.className = 'hnf-clima__hero';
  heroBand.append(header, flowStrip, climaIdentity, ...(offlineBanner ? [offlineBanner] : []), climaToolbar);

  const statsBand = document.createElement('div');
  statsBand.className = 'hnf-clima__stats';
  statsBand.append(cards);

  const workBand = document.createElement('div');
  workBand.className = 'hnf-clima__body';
  workBand.append(formCard, overview);

  section.append(heroBand, statsBand, workBand);

  return section;
};

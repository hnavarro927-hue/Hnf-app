import { mergeEquipoChecklist } from '../constants/hvacChecklist.js';
import { otFormDefinition } from '../config/form-definitions.js';
import { buildOtOperationalBrief } from '../domain/operational-intelligence.js';
import { getSessionBackendRole } from '../config/session-bridge.js';
import { filtrarOtsPorRolBackend } from '../domain/hnf-operativa-reglas.js';
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
import {
  createHnfEnterpriseWorkspace,
  createHnfEwSplitThree,
  createHnfEwDetails,
} from '../components/hnf-enterprise-workspace.js';
import { createHnfDisciplinaTecnicosPanel } from '../components/hnf-disciplina-tecnicos.js';
import {
  CLIMA_OT_FLOW_STAGES,
  createFlowStorageKey,
  detailStageStorageKey,
  jarvisLinesForDetailStage,
  nextActionHintForDetailStage,
  readStoredStageIndex,
  validateDetailStageAdvance,
  writeStoredStageIndex,
} from '../domain/clima-ot-flow-stages.js';
import {
  OT_CREATE_WORKSPACE_STAGE_COUNT,
  OT_CREATE_WORKSPACE_STAGES,
  buildOtCreateWorkspacePayload,
  getOtCreateWorkspaceStageForSubmitErrors,
  validateOtCreateWorkspaceStage,
  validateOtCreateWorkspaceSubmit,
} from '../domain/ot-create-workspace.js';
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
import {
  filterOtsIntelList,
  intelFilterActiveKeys,
  isOtEstadoCerradaUi,
  roundEcon,
} from '../domain/clima-ot-intel-filters.js';

const CLIMA_CREATE_DRAFT_KEY = 'hnf-clima-ot-create-draft';

const otcwDevLog = (action, detail) => {
  try {
    if (import.meta.env?.DEV) console.debug('[HNF][OT-Wizard]', action, detail ?? '');
  } catch {
    /* sin import.meta */
  }
};

const OT_STATUS_OPTIONS = [
  { value: 'nueva', label: 'Nueva' },
  { value: 'asignada', label: 'Asignada' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'pendiente_validacion', label: 'Pendiente validación' },
  { value: 'cerrada', label: 'Cerrada' },
  { value: 'finalizada', label: 'Finalizada' },
  { value: 'facturada', label: 'Facturada' },
];

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
  const tiles = document.createElement('div');
  tiles.className = 'ot-checklist-tiles';
  wrap.append(tiles);
  const rerender = () => {
    tiles.replaceChildren();
    checklistRef.forEach((item, idx) => {
      const tile = document.createElement('label');
      tile.className = `ot-checklist-tile ${item.realizado ? 'is-on' : ''}`;
      if (readOnly) tile.classList.add('is-readonly');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'ot-checklist-tile__cb';
      cb.checked = item.realizado;
      cb.disabled = readOnly;
      const span = document.createElement('span');
      span.className = 'ot-checklist-tile__text';
      span.textContent = item.label;
      const sync = () => {
        checklistRef[idx].realizado = cb.checked;
        tile.classList.toggle('is-on', cb.checked);
      };
      cb.addEventListener('change', sync);
      tile.append(cb, span);
      tiles.append(tile);
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
    row('Meta informe (SLA docs.)', '≤ 2 días hábiles desde solicitud'),
    row('Economía informada', economicsSaved ? 'Guardada en sesión' : 'Pendiente de guardar (informe)')
  );

  article.append(head, grid);
  return article;
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
  const fmtEst = (n) =>
    n != null && Number.isFinite(Number(n))
      ? `$${Math.round(Number(n)).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`
      : '—';
  const tf = String(ot.tipoFacturacion || 'inmediata').toLowerCase();
  grid.append(
    row('Origen solicitud', labelOrigenSolicitud(ot.origenSolicitud)),
    row('Prioridad', labelPrioridadOperativa(ot.prioridadOperativa)),
    row('Tipo / subtipo', `${ot.tipoServicio || '—'} / ${ot.subtipoServicio || '—'}`),
    row('Bandeja → aviso', `${ot.bandejaAsignada || '—'} → ${ot.notificacionAsignadaA || '—'}`),
    row('Facturación', tf === 'mensual' ? 'Mensual (ingreso consolidado al cierre; estimado ≠ facturado)' : 'Inmediata'),
    row('Período facturación', ot.periodoFacturacion || '—'),
    row('Tienda (referencia)', ot.tiendaNombre ? `${ot.tiendaNombre}${ot.tiendaId ? ` · ${ot.tiendaId}` : ''}` : '—'),
    row('Valor ref. tienda', `${fmtEst(ot.valorReferencialTienda)} · estimado gerencial`),
    row('Utilidad estimada', ot.utilidadEstimada != null ? `${fmtEst(ot.utilidadEstimada)} · estimado` : '—'),
    row(
      'Margen estimado',
      ot.margenEstimadoRatio != null ? `${(Number(ot.margenEstimadoRatio) * 100).toFixed(1)}% · estimado` : '—'
    ),
    row('Cierre mensual', ot.incluidaEnCierreMensual ? `Incluida · ${ot.cierreMensualId || '—'}` : 'No incluida')
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

const otcwStripControlHints = (root) => {
  root.querySelectorAll('input, textarea, select').forEach((el) => el.removeAttribute('placeholder'));
};

const otcwWrapField = (fieldLabel) => {
  const ctl = fieldLabel.querySelector('input, textarea, select');
  const name = ctl?.name || '';
  const wrap = document.createElement('div');
  wrap.className = 'hnf-otcw-field';
  if (name) wrap.dataset.otcwField = name;
  const err = document.createElement('p');
  err.className = 'hnf-otcw-field-error';
  err.hidden = true;
  err.setAttribute('role', 'alert');
  fieldLabel.append(err);
  wrap.append(fieldLabel);
  const clear = () => {
    err.hidden = true;
    err.textContent = '';
    wrap.classList.remove('hnf-otcw--invalid');
  };
  ctl?.addEventListener('input', clear);
  ctl?.addEventListener('change', clear);
  return wrap;
};

const otcwClearFieldErrors = (form) => {
  form.querySelectorAll('.hnf-otcw-field-error').forEach((e) => {
    e.hidden = true;
    e.textContent = '';
  });
  form.querySelectorAll('.hnf-otcw-field').forEach((w) => w.classList.remove('hnf-otcw--invalid'));
};

const otcwApplyFieldErrors = (form, errors) => {
  otcwClearFieldErrors(form);
  for (const [name, msg] of Object.entries(errors || {})) {
    const w = form.querySelector(`.hnf-otcw-field[data-otcw-field="${name}"]`);
    if (!w) continue;
    const err = w.querySelector('.hnf-otcw-field-error');
    if (err) {
      err.textContent = msg;
      err.hidden = false;
    }
    w.classList.add('hnf-otcw--invalid');
  }
};

const otcwFocusFirstErrorField = (form, errors) => {
  const names = Object.keys(errors || {});
  if (!names.length) return;
  requestAnimationFrame(() => {
    for (const name of names) {
      const w = form.querySelector(`.hnf-otcw-field[data-otcw-field="${name}"]`);
      if (!w) continue;
      const el = w.querySelector(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      if (el) {
        el.focus({ preventScroll: true });
        return;
      }
    }
  });
};

const createOtWorkspaceEquipoRow = () => {
  const fs = document.createElement('fieldset');
  fs.className = 'otcw-equipo-row';

  const legend = document.createElement('legend');
  legend.textContent = 'Equipo';
  fs.append(legend);

  const grid = document.createElement('div');
  grid.className = 'hnf-otcw-grid';

  const mk = (labelText, el) => {
    const lb = document.createElement('label');
    lb.className = 'form-field hnf-otcw-field__inner';
    const sp = document.createElement('span');
    sp.className = 'form-field__label';
    sp.textContent = labelText;
    lb.append(sp, el);
    return otcwWrapField(lb);
  };

  const nombre = document.createElement('input');
  nombre.type = 'text';
  nombre.name = 'equipoNombreWs';
  nombre.autocomplete = 'off';

  const tipo = document.createElement('input');
  tipo.type = 'text';
  tipo.name = 'equipoTipoWs';
  tipo.autocomplete = 'off';

  const estado = document.createElement('select');
  estado.name = 'equipoEstadoWs';
  EQ_ESTADOS.forEach((v) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    estado.append(o);
  });

  const obsCorta = document.createElement('input');
  obsCorta.type = 'text';
  obsCorta.name = 'equipoObsCortaWs';
  obsCorta.autocomplete = 'off';

  grid.append(mk('Nombre', nombre), mk('Tipo', tipo), mk('Estado', estado));

  const { details: det, body: body } = createHnfEwDetails('Más datos', false);
  const inner = document.createElement('div');
  inner.className = 'hnf-otcw-grid';

  const serie = document.createElement('input');
  serie.type = 'text';
  serie.name = 'equipoSerieWs';
  serie.autocomplete = 'off';
  const ubic = document.createElement('input');
  ubic.type = 'text';
  ubic.name = 'equipoUbicacionWs';
  ubic.autocomplete = 'off';
  const rec = document.createElement('textarea');
  rec.name = 'equipoRecWs';
  rec.rows = 2;
  inner.append(
    mk('Observación corta', obsCorta),
    mk('Nº serie', serie),
    mk('Ubicación', ubic),
    mk('Recomendación', rec)
  );
  body.append(inner);

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'secondary-button';
  rm.textContent = 'Quitar equipo';
  rm.addEventListener('click', () => {
    const host = fs.closest('.otcw-equipos');
    if (!host || host.querySelectorAll('.otcw-equipo-row').length <= 1) return;
    fs.remove();
    renumberOtWorkspaceEquipos(host);
  });
  body.append(rm);

  fs.append(grid, det);
  return fs;
};

const renumberOtWorkspaceEquipos = (container) => {
  container.querySelectorAll('.otcw-equipo-row').forEach((row, i) => {
    const leg = row.querySelector('legend');
    if (leg) leg.textContent = `Equipo ${i + 1}`;
  });
};

const OTWS_EQUIPO_DRAFT_NAMES = new Set([
  'equipoNombreWs',
  'equipoTipoWs',
  'equipoEstadoWs',
  'equipoObsCortaWs',
  'equipoSerieWs',
  'equipoUbicacionWs',
  'equipoRecWs',
]);

const serializeWorkspaceEquiposForDraft = (host) => {
  if (!host) return [];
  return [...host.querySelectorAll('.otcw-equipo-row')].map((row) => {
    const o = {};
    for (const name of OTWS_EQUIPO_DRAFT_NAMES) {
      const el = row.querySelector(`[name="${name}"]`);
      o[name] = el && 'value' in el ? el.value : '';
    }
    return o;
  });
};

const applyWorkspaceEquiposFromDraft = (host, rows) => {
  if (!host) return;
  host.querySelectorAll('.otcw-equipo-row').forEach((r) => r.remove());
  const list = Array.isArray(rows) && rows.length ? rows : [{}];
  for (const data of list) {
    const fs = createOtWorkspaceEquipoRow();
    host.append(fs);
    for (const name of OTWS_EQUIPO_DRAFT_NAMES) {
      const el = fs.querySelector(`[name="${name}"]`);
      if (el && 'value' in el && data[name] != null) el.value = String(data[name]);
    }
  }
  renumberOtWorkspaceEquipos(host);
};

const collectEquiposFromWorkspace = (container) => {
  const rows = container.querySelectorAll('.otcw-equipo-row');
  const out = [];
  let idx = 0;
  for (const row of rows) {
    const nombre = row.querySelector('[name="equipoNombreWs"]')?.value?.trim() || '';
    const tipo = row.querySelector('[name="equipoTipoWs"]')?.value?.trim() || '';
    const estado = row.querySelector('[name="equipoEstadoWs"]')?.value || 'operativo';
    const obsCorta = row.querySelector('[name="equipoObsCortaWs"]')?.value?.trim() || '';
    const serie = row.querySelector('[name="equipoSerieWs"]')?.value?.trim() || '';
    const ubic = row.querySelector('[name="equipoUbicacionWs"]')?.value?.trim() || '';
    const rec = row.querySelector('[name="equipoRecWs"]')?.value?.trim() || '';
    const nombreEquipo = [nombre, tipo].filter(Boolean).join(' · ') || `Equipo ${idx + 1}`;
    const obsParts = [];
    if (serie) obsParts.push(`Serie: ${serie}`);
    if (ubic) obsParts.push(`Ubicación: ${ubic}`);
    if (obsCorta) obsParts.push(obsCorta);
    const emptyEv = initRowEvidence({});
    out.push({
      nombreEquipo,
      estadoEquipo: estado,
      observaciones: obsParts.join('\n'),
      accionesRealizadas: '',
      recomendaciones: rec,
      checklist: mergeEquipoChecklist({}).map(({ id, label, realizado }) => ({
        id,
        label,
        realizado: Boolean(realizado),
      })),
      ...collectEquipoEvidencePayload(emptyEv),
    });
    idx += 1;
  }
  return out;
};

const uniqueSortedStrings = (vals, cap = 80) => {
  const s = [...new Set(vals.map((v) => String(v || '').trim()).filter(Boolean))];
  s.sort((a, b) => a.localeCompare(b, 'es'));
  return s.slice(0, cap);
};

const attachCreateOtAutocomplete = (form, otsList) => {
  if (!form || !Array.isArray(otsList)) return;
  const ensureDatalist = (id, options) => {
    let dl = form.querySelector(`#${id}`);
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = id;
      form.append(dl);
    }
    dl.replaceChildren();
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt;
      dl.append(o);
    }
  };
  const clientes = uniqueSortedStrings(otsList.map((o) => o.cliente));
  const direcciones = uniqueSortedStrings(otsList.map((o) => o.direccion));
  const tecnicos = uniqueSortedStrings(otsList.map((o) => o.tecnicoAsignado));
  const comunas = uniqueSortedStrings(otsList.map((o) => o.comuna));
  const sucursales = uniqueSortedStrings(otsList.map((o) => o.tiendaNombre));
  ensureDatalist('hnf-create-ot-clientes', clientes);
  ensureDatalist('hnf-create-ot-direcciones', direcciones);
  ensureDatalist('hnf-create-ot-tecnicos', tecnicos);
  ensureDatalist('hnf-otcw-comunas', comunas);
  ensureDatalist('hnf-otcw-sucursales', sucursales);
  form.elements.cliente?.setAttribute('list', 'hnf-create-ot-clientes');
  form.elements.direccion?.setAttribute('list', 'hnf-create-ot-direcciones');
  form.elements.comuna?.setAttribute('list', 'hnf-otcw-comunas');
  form.elements.sucursalCreate?.setAttribute('list', 'hnf-otcw-sucursales');
  form.elements.tecnicoOtro?.setAttribute('list', 'hnf-create-ot-tecnicos');
};

const readCreateOtDraft = () => {
  try {
    const raw = localStorage.getItem(CLIMA_CREATE_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** @returns {boolean} */
const writeCreateOtDraft = (form, equiposHost) => {
  if (!form) return false;
  try {
    const snap = {};
    const els = form.elements;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!el.name || el.type === 'file' || el.type === 'submit' || el.type === 'button') continue;
      if (equiposHost && OTWS_EQUIPO_DRAFT_NAMES.has(el.name)) continue;
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) snap[el.name] = el.value;
      } else {
        snap[el.name] = el.value;
      }
    }
    if (equiposHost) snap.__otcwEquipos = serializeWorkspaceEquiposForDraft(equiposHost);
    localStorage.setItem(CLIMA_CREATE_DRAFT_KEY, JSON.stringify(snap));
    return true;
  } catch {
    return false;
  }
};

const clearCreateOtDraft = () => {
  try {
    localStorage.removeItem(CLIMA_CREATE_DRAFT_KEY);
  } catch {
    /* ignore */
  }
};

const applyCreateOtDraft = (form, data, equiposHost) => {
  if (!form || !data || typeof data !== 'object') return;
  const equiposSnap = data.__otcwEquipos;
  for (const [k, v] of Object.entries(data)) {
    if (k === '__otcwEquipos') continue;
    if (Array.isArray(equiposSnap) && OTWS_EQUIPO_DRAFT_NAMES.has(k)) continue;
    const str = String(v);
    const el = form.elements[k];
    if (!el) continue;
    if (el.length && el[0]?.type === 'radio') {
      for (let j = 0; j < el.length; j++) {
        const r = el[j];
        if (r.value === str) {
          r.checked = true;
          break;
        }
      }
      continue;
    }
    if (el.type === 'checkbox') {
      el.checked = str === 'on' || el.value === str;
      continue;
    }
    if ('value' in el && el.type !== 'file') el.value = str;
  }
  if (equiposHost && Array.isArray(equiposSnap)) {
    applyWorkspaceEquiposFromDraft(equiposHost, equiposSnap);
  }
  form.elements.origenSolicitudCreate?.dispatchEvent(new Event('change', { bubbles: true }));
  form.elements.tecnicoPreset?.dispatchEvent(new Event('change', { bubbles: true }));
  form.elements.origenPedidoWs?.dispatchEvent(new Event('change', { bubbles: true }));
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

const fmtEnvioClienteFecha = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
};

const mountClimaOtDetailFlow = (
  detailCard,
  contextRail,
  {
    selectedOT,
    actions,
    ro,
    isClosingOT,
    isGeneratingPdf,
    isEnviandoInformeCliente,
    isSavingEquipos,
    isPatchingOtOperational,
    otEconomicsSaved,
    allOts = [],
    navigateToView,
    intelListFilter,
    intelGuidance,
  }
) => {
  const storageKey = detailStageStorageKey(selectedOT.id);
  let detailStageIdx = readStoredStageIndex(storageKey, CLIMA_OT_FLOW_STAGES.length - 1);

  detailCard.replaceChildren();
  contextRail.replaceChildren();

  detailCard.classList.add('ot-flow-app', 'ot-flow-app--detail', 'ot-clima-detail-card');
  const flowRoot = document.createElement('div');
  flowRoot.className = 'ot-flow-app__inner ot-flow-app__inner--workspace ot-clima-exec-stepped';

  const compactHeader = document.createElement('header');
  compactHeader.className = 'ot-saas-sticky ot-flow-compact-header ot-clima-compact-header';
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
  progressNav.className = 'ot-flow-progress ot-clima-stage-tabs';
  progressNav.setAttribute('aria-label', 'Etapas de la OT');

  const jarvisAside = document.createElement('aside');
  jarvisAside.className = 'ot-flow-jarvis ot-flow-jarvis--rail';
  const jt = document.createElement('h4');
  jt.className = 'ot-flow-jarvis__title';
  jt.textContent = 'Jarvis · esta etapa';
  const jarvisUl = document.createElement('ul');
  jarvisUl.className = 'ot-flow-jarvis__list';
  const jarvisNext = document.createElement('p');
  jarvisNext.className = 'ot-flow-jarvis__next';
  jarvisAside.append(jt, jarvisUl, jarvisNext);

  const execSummaryAside = document.createElement('aside');
  execSummaryAside.className = 'ot-flow-exec-summary ot-flow-exec-summary--rail';
  execSummaryAside.setAttribute('aria-label', 'Resumen ejecutivo de la orden');

  const progressWrap = document.createElement('div');
  progressWrap.className = 'ot-flow-progress-bar-wrap';
  progressWrap.setAttribute('aria-hidden', 'true');
  const progressFill = document.createElement('div');
  progressFill.className = 'ot-flow-progress-bar__fill';
  progressWrap.append(progressFill);

  const validationBanner = document.createElement('div');
  validationBanner.className = 'ot-flow-validation-banner';
  validationBanner.hidden = true;
  validationBanner.setAttribute('role', 'alert');

  const stageRow = document.createElement('div');
  stageRow.className = 'ot-flow-command-stage-row';

  const stageBody = document.createElement('div');
  stageBody.className = 'ot-flow-stage-body ot-clima-stage-scroll';

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

  const { details: histDet, body: histBody } = createHnfEwDetails('Historial y auditoría reciente', false);
  const histUl = document.createElement('ul');
  histUl.className = 'muted small flota-historial';
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
  histBody.append(histUl);

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

  p0.append(h0, waRow, histDet, editGrid);

  const p1 = mkPanel(1);
  const h1 = document.createElement('h3');
  h1.className = 'ot-flow-stage-title';
  h1.textContent = 'Clasificación';
  const sumBlock = buildOtOperationalSummarySection(selectedOT);
  const sumGrid = sumBlock.querySelector('.ot-op-detail__grid');
  if (sumGrid) {
    sumGrid.remove();
    const { details: sumMore, body: sumMoreBody } = createHnfEwDetails('Más datos de clasificación (gerencial)', false);
    sumMoreBody.append(sumGrid);
    sumBlock.append(sumMore);
  }
  p1.append(h1, sumBlock);

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
  const { details: previewDet, body: previewBody } = createHnfEwDetails('Vista previa informe (cliente)', false);
  previewBody.append(createClientPreview(selectedOT));
  const pdfTop = document.createElement('button');
  pdfTop.type = 'button';
  pdfTop.className = 'secondary-button ot-flow-footer__btn';
  pdfTop.textContent = isGeneratingPdf ? 'Generando…' : 'Generar PDF';
  pdfTop.disabled = Boolean(isGeneratingPdf || isClosingOT);
  pdfTop.addEventListener('click', async () => actions.generatePdfFromOt(selectedOT));

  const envioClienteBlock = document.createElement('article');
  envioClienteBlock.className = 'ot-saas-block';
  const aprobadoLyn = String(selectedOT.aprobacionLynEstado || '').trim() === 'aprobado_lyn';
  envioClienteBlock.hidden = !aprobadoLyn;
  const envioTit = document.createElement('h4');
  envioTit.textContent = 'Envío al cliente (post-Lyn)';
  const envioEstado = document.createElement('p');
  envioEstado.className = 'muted';
  const yaEnviado = Boolean(selectedOT.enviadoCliente);
  const pdfListo = Boolean(String(selectedOT.pdfUrl || '').trim());
  const listoEnviar = Boolean(selectedOT.listoEnviarCliente);
  envioEstado.innerHTML = yaEnviado
    ? '<strong>✅ Enviado a cliente</strong>'
    : '<strong>Estado envío:</strong> Pendiente de envío';
  const envioMeta = document.createElement('p');
  envioMeta.className = 'small muted';
  envioMeta.textContent = yaEnviado
    ? `Fecha envío: ${fmtEnvioClienteFecha(selectedOT.fechaEnvio)} · Enviado por: ${String(selectedOT.enviadoPor || '—').trim()}`
    : listoEnviar && pdfListo
      ? 'Podés registrar el envío simulado (correo real en una fase posterior).'
      : !pdfListo
        ? 'Falta PDF en servidor: generá y guardá el informe antes de enviar.'
        : 'La OT debe estar marcada como lista para enviar al cliente (listoEnviarCliente).';
  const btnEnviarCliente = document.createElement('button');
  btnEnviarCliente.type = 'button';
  btnEnviarCliente.className = 'primary-button ot-flow-footer__btn';
  btnEnviarCliente.textContent = isEnviandoInformeCliente ? 'Enviando…' : 'Enviar informe al cliente';
  btnEnviarCliente.disabled = Boolean(
    isEnviandoInformeCliente || yaEnviado || !listoEnviar || !pdfListo || isClosingOT
  );
  btnEnviarCliente.addEventListener('click', async () => actions.enviarInformeCliente(selectedOT));
  envioClienteBlock.append(envioTit, envioEstado, envioMeta, btnEnviarCliente);

  p4.append(h4, checklistPanel, previewDet, pdfTop, envioClienteBlock);

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

  stageRow.append(stageBody);

  const footer = document.createElement('div');
  footer.className = 'ot-flow-footer ot-clima-stage-footer';
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
      const show = i === n;
      p.hidden = !show;
      if (show) {
        p.classList.remove('ot-flow-stage-panel--enter');
        void p.offsetWidth;
        p.classList.add('ot-flow-stage-panel--enter');
      }
    });
    progressNav.querySelectorAll('.ot-flow-progress__step').forEach((btn, i) => {
      btn.classList.toggle('is-active', i === n);
      btn.classList.toggle('is-done', i < n);
      btn.disabled = !ro && i > n + 1;
    });
    const pct = ((n + 1) / CLIMA_OT_FLOW_STAGES.length) * 100;
    progressFill.style.width = `${pct}%`;

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
      if (i <= detailStageIdx) {
        setDetailStage(i);
        return;
      }
      if (ro) {
        setDetailStage(i);
        return;
      }
      if (i === detailStageIdx + 1) btnNext.click();
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
  mainColumn.className = 'ot-flow-command-main ot-clima-command-main';
  mainColumn.append(compactHeader, progressWrap, progressNav, validationBanner, stageRow, footer);
  contextRail.append(buildClimaPortalStrip(selectedOT));
  appendClimaIntelToRail(contextRail, selectedOT, {
    intelListFilter,
    intelGuidance,
    actions,
    otEconomicsSaved,
  });
  const { details: discDet, body: discBody } = createHnfEwDetails('Disciplina técnica (evidencia)', false);
  discBody.append(
    createHnfDisciplinaTecnicosPanel(allOts, { navigateToView, variant: 'compact' })
  );
  contextRail.append(discDet);

  const contextStack = document.createElement('div');
  contextStack.className = 'ot-flow-context-rail';
  contextStack.append(execSummaryAside, jarvisAside);
  contextRail.append(contextStack);

  flowRoot.append(mainColumn);
  detailCard.append(flowRoot);
  setDetailStage(detailStageIdx);
};

const parseMoneyInput = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
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

/** Resumen estable para futuro portal cliente (data-* homogéneos con Flota). */
const buildClimaPortalStrip = (ot) => {
  const el = document.createElement('div');
  el.className = 'flota-rail-portal clima-rail-portal';
  el.setAttribute('data-hnf-portal-surface', 'clima-ot-resumen');
  if (!ot) {
    el.innerHTML =
      '<p class="flota-rail-portal__empty muted">Seleccioná una OT para ver el resumen operativo.</p>';
    return el;
  }
  el.setAttribute('data-ot-id', String(ot.id || ''));
  el.setAttribute('data-ot-estado', String(ot.estado || ''));
  const iso = ot.updatedAt ? new Date(ot.updatedAt).toISOString() : '';
  el.setAttribute('data-ot-updated-at', iso);
  const k = document.createElement('div');
  k.className = 'flota-rail-portal__kicker';
  k.textContent = 'Resumen operativo (base portal cliente)';
  const dl = document.createElement('dl');
  dl.className = 'flota-rail-portal__dl';
  const row = (dt, dd) => {
    const dtt = document.createElement('dt');
    dtt.textContent = dt;
    const ddd = document.createElement('dd');
    ddd.textContent = dd;
    dl.append(dtt, ddd);
  };
  row('Estado', String(ot.estado || '—'));
  row('Cliente', ot.cliente || '—');
  row('Ubicación', [ot.direccion, ot.comuna].filter(Boolean).join(', ') || '—');
  row('Técnico', ot.tecnicoAsignado || '—');
  row('Servicio', `${ot.tipoServicio || '—'} / ${ot.subtipoServicio || '—'}`);
  row('Última actualización', formatAuditTs(ot.updatedAt));
  el.append(k, dl);
  return el;
};

const appendClimaIntelToRail = (parent, ot, { intelListFilter, intelGuidance, actions, otEconomicsSaved }) => {
  const hasIntelFilter = intelFilterActiveKeys(intelListFilter).length > 0;
  const hasIntelGuide = Boolean(intelGuidance && (intelGuidance.why || intelGuidance.fix));
  if (!hasIntelFilter && !hasIntelGuide) return;
  const intelStrip = document.createElement('div');
  intelStrip.className = 'intel-guide-stack flota-rail-intel';
  if (hasIntelGuide) {
    const g = document.createElement('div');
    g.className = 'intel-guide-banner';
    const title = document.createElement('div');
    title.className = 'intel-guide-banner__title';
    title.textContent = 'Inteligencia operativa';
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
    intelStrip.append(g);
    const chkItems = buildClimaIntelChecklist(ot, otEconomicsSaved);
    if (chkItems.length) {
      const box = document.createElement('div');
      box.className = 'intel-guide-checklist';
      const hh = document.createElement('div');
      hh.className = 'intel-guide-checklist__h';
      hh.textContent = 'Checklist';
      const ul = document.createElement('ul');
      ul.className = 'intel-guide-checklist__ul';
      chkItems.forEach(({ ok, label }) => {
        const li = document.createElement('li');
        li.className = ok ? 'intel-guide-checklist__li is-ok' : 'intel-guide-checklist__li is-pend';
        li.textContent = `${ok ? '✓ ' : '○ '}${label}`;
        ul.append(li);
      });
      box.append(hh, ul);
      intelStrip.append(box);
    }
  }
  if (hasIntelFilter) {
    const ban = document.createElement('div');
    ban.className = 'intel-filter-banner intel-filter-banner--nested';
    const lab = document.createElement('span');
    lab.className = 'intel-filter-banner__text';
    lab.textContent = 'Listado filtrado desde inteligencia.';
    ban.append(lab);
    intelStrip.append(ban);
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
  intelStrip.append(act);
  parent.append(intelStrip);
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
  isEnviandoInformeCliente = false,
  isSavingEquipos,
  isSavingVisitText,
  isSavingOtEconomics,
  otEconomicsSaved,
  selectedOTId,
  reloadApp,
  intelListFilter,
  intelGuidance,
  isPatchingOtOperational,
  navigateToView,
  climaTrayNotice = null,
} = {}) => {
  const header = document.createElement('div');
  header.className = 'module-header flota-module-header--enterprise';
  header.innerHTML =
    '<h2>Clima · ejecución OT</h2><p class="muted flota-module-header__lead">HVAC HNF: bandeja a la izquierda, ficha por etapas al centro, contexto + Jarvis a la derecha. Cierre sujeto a evidencias y economía persistida en servidor.</p>';

  const flowStrip = createHnfOperationalFlowStrip(3);

  if (feedback?.message) {
    const notice = document.createElement('div');
    notice.className = `form-feedback form-feedback--${feedback.type} workspace-notice`;
    notice.setAttribute('role', 'status');
    notice.textContent = feedback.message;
    header.append(notice);
  }

  if (climaTrayNotice?.kind === 'post_create_filtered' && climaTrayNotice.otId) {
    const trayWrap = document.createElement('div');
    trayWrap.className = 'hnf-clima-tray-notice workspace-notice';
    trayWrap.setAttribute('role', 'status');
    const trayP = document.createElement('p');
    trayP.className = 'hnf-clima-tray-notice__text';
    trayP.textContent = `OT ${climaTrayNotice.otId}: el filtro oculta la fila en la bandeja. La ficha al centro es esa orden.`;
    const trayBtn = document.createElement('button');
    trayBtn.type = 'button';
    trayBtn.className = 'secondary-button hnf-clima-tray-notice__cta';
    trayBtn.textContent = 'Ver todas';
    trayBtn.addEventListener('click', () => actions?.clearClimaTrayFilterToRevealOt?.());
    trayWrap.append(trayP, trayBtn);
    header.append(trayWrap);
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
  climaRefreshHint.textContent = 'Recarga la lista desde el servidor.';
  climaRefresh.addEventListener('click', async () => {
    if (typeof reloadApp !== 'function') return;
    const prev = climaRefresh.textContent;
    climaRefresh.disabled = true;
    climaRefresh.textContent = 'Actualizando…';
    const ok = await reloadApp();
    climaRefresh.textContent = ok ? 'Listo' : 'Error';
    setTimeout(() => {
      climaRefresh.textContent = prev;
      climaRefresh.disabled = false;
    }, 1600);
  });
  climaToolbar.append(climaRefresh, climaRefreshHint);

  const opRole = resolveOperatorRole();
  let ots = [...(data?.data || [])].reverse();
  const br = getSessionBackendRole() || 'admin';
  ots = filtrarOtsPorRolBackend(ots, br);
  if (String(br || '').toLowerCase() === 'gery') {
    ots = [];
  }
  const listOts = filterOtsIntelList(ots, intelListFilter);
  const selectedInFiltered = listOts.some((item) => item.id === selectedOTId);
  const selectedInFull = ots.some((item) => item.id === selectedOTId);
  const effectiveSelectedId = selectedInFiltered
    ? selectedOTId
    : selectedInFull
      ? selectedOTId
      : listOts[0]?.id ?? selectedOTId ?? null;
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

  const ew = createHnfEnterpriseWorkspace({
    variant: 'clima',
    ariaLabel: 'Clima · órdenes de trabajo',
  });
  ew.root.classList.add('ot-workspace', 'hnf-op-view', 'hnf-op-view--clima');
  ew.header.classList.add('hnf-clima__hero');
  ew.body.classList.add('hnf-clima__body');

  const form = document.createElement('form');
  form.className = 'hnf-otcw-form';
  form.setAttribute('novalidate', 'true');

  const createStageKey = createFlowStorageKey();
  let createStageIdx = readStoredStageIndex(createStageKey, OT_CREATE_WORKSPACE_STAGE_COUNT - 1);
  let prevCreateStageForDraft = -1;
  let draftSaveTimer;

  const otcwAppendDef = (grid, names) => {
    for (const name of names) {
      const def =
        otFormDefinition.sections[0].fields.find((f) => f.name === name) ||
        otFormDefinition.sections[1].fields.find((f) => f.name === name);
      if (!def) continue;
      const inner = buildField(def);
      otcwStripControlHints(inner);
      grid.append(otcwWrapField(inner));
    }
  };

  const otcwMkSelect = (name, labelText, optionList) => {
    const sel = document.createElement('select');
    sel.name = name;
    optionList.forEach(({ value, label }) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      sel.append(o);
    });
    const lb = document.createElement('label');
    lb.className = 'form-field hnf-otcw-field__inner';
    const sp = document.createElement('span');
    sp.className = 'form-field__label';
    sp.textContent = labelText;
    lb.append(sp, sel);
    return otcwWrapField(lb);
  };

  const mkPanel = (idx) => {
    const p = document.createElement('div');
    p.className = 'hnf-otcw-stage';
    p.dataset.createStage = String(idx);
    p.hidden = idx !== createStageIdx;
    return p;
  };

  const panel0 = mkPanel(0);
  const g0 = document.createElement('div');
  g0.className = 'hnf-otcw-grid';
  otcwAppendDef(g0, ['cliente', 'direccion', 'comuna', 'contactoTerreno']);
  const { details: d0, body: b0 } = createHnfEwDetails('Más datos', false);
  const g0m = document.createElement('div');
  g0m.className = 'hnf-otcw-grid';
  otcwAppendDef(g0m, ['telefonoContacto']);
  const emLb = document.createElement('label');
  emLb.className = 'form-field hnf-otcw-field__inner';
  const emSp = document.createElement('span');
  emSp.className = 'form-field__label';
  emSp.textContent = 'Email';
  const emIn = document.createElement('input');
  emIn.type = 'email';
  emIn.name = 'clienteEmailCreate';
  emIn.autocomplete = 'email';
  emLb.append(emSp, emIn);
  g0m.append(otcwWrapField(emLb));
  const suLb = document.createElement('label');
  suLb.className = 'form-field hnf-otcw-field__inner';
  const suSp = document.createElement('span');
  suSp.className = 'form-field__label';
  suSp.textContent = 'Sucursal';
  const suIn = document.createElement('input');
  suIn.type = 'text';
  suIn.name = 'sucursalCreate';
  suIn.autocomplete = 'organization';
  suLb.append(suSp, suIn);
  g0m.append(otcwWrapField(suLb));
  b0.append(g0m);
  panel0.append(g0, d0);
  const ctLbl = panel0.querySelector('.hnf-otcw-field[data-otcw-field="contactoTerreno"] .form-field__label');
  if (ctLbl) ctLbl.textContent = 'Contacto';

  const panel1 = mkPanel(1);
  const g1 = document.createElement('div');
  g1.className = 'hnf-otcw-grid';
  otcwAppendDef(g1, ['fecha', 'hora', 'tipoServicio', 'subtipoServicio']);
  panel1.append(g1);

  const panel2 = mkPanel(2);
  const g2 = document.createElement('div');
  g2.className = 'hnf-otcw-grid';
  const opOpts = HNF_OT_ORIGEN_PEDIDO.filter((o) => o.value);
  g2.append(otcwMkSelect('origenPedidoWs', 'Origen del pedido', opOpts));
  const prSel = document.createElement('select');
  prSel.name = 'prioridadOperativaCreate';
  HNF_OT_PRIORIDAD_OPERATIVA.forEach((o) => {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.label;
    if (o.value === 'media') op.selected = true;
    prSel.append(op);
  });
  const prLb = document.createElement('label');
  prLb.className = 'form-field hnf-otcw-field__inner';
  const prSp = document.createElement('span');
  prSp.className = 'form-field__label';
  prSp.textContent = 'Prioridad operativa';
  prLb.append(prSp, prSel);
  g2.append(otcwWrapField(prLb));
  g2.append(
    otcwMkSelect('responsableHnfWs', 'Responsable HNF', [
      { value: '', label: '—' },
      { value: 'Romina', label: 'Romina' },
      { value: 'Gery', label: 'Gery' },
    ])
  );
  const techLb = document.createElement('label');
  techLb.className = 'form-field hnf-otcw-field__inner';
  const techSp = document.createElement('span');
  techSp.className = 'form-field__label';
  techSp.textContent = 'Técnico asignado';
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
  techOther.className = 'ot-tech-pick__other';
  techOther.hidden = true;
  techSel.addEventListener('change', () => {
    techOther.hidden = techSel.value !== '__otro__';
    if (!techOther.hidden) techOther.focus();
  });
  techWrap.append(techSel, techOther);
  techLb.append(techSp, techWrap);
  g2.append(otcwWrapField(techLb));
  g2.append(
    otcwMkSelect('canalWs', 'Canal', [
      { value: '', label: '—' },
      { value: 'llamada', label: 'Llamada' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'presencial', label: 'Presencial' },
      { value: 'correo', label: 'Correo' },
    ])
  );
  const { details: d2, body: b2 } = createHnfEwDetails('Más datos', false);
  const g2m = document.createElement('div');
  g2m.className = 'hnf-otcw-grid';
  const osSel = document.createElement('select');
  osSel.name = 'origenSolicitudCreate';
  HNF_OT_ORIGEN_SOLICITUD.forEach((o) => {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.label;
    osSel.append(op);
  });
  const osLb = document.createElement('label');
  osLb.className = 'form-field hnf-otcw-field__inner';
  const osSp = document.createElement('span');
  osSp.className = 'form-field__label';
  osSp.textContent = 'Origen de la solicitud';
  osLb.append(osSp, osSel);
  g2m.append(otcwWrapField(osLb));
  const waN = document.createElement('input');
  waN.type = 'tel';
  waN.name = 'whatsappNumeroCreate';
  const waNLb = document.createElement('label');
  waNLb.className = 'form-field hnf-otcw-field__inner';
  const waNSp = document.createElement('span');
  waNSp.className = 'form-field__label';
  waNSp.textContent = 'WhatsApp · número';
  waNLb.append(waNSp, waN);
  const waNm = document.createElement('input');
  waNm.type = 'text';
  waNm.name = 'whatsappNombreCreate';
  const waNmLb = document.createElement('label');
  waNmLb.className = 'form-field hnf-otcw-field__inner';
  const waNmSp = document.createElement('span');
  waNmSp.className = 'form-field__label';
  waNmSp.textContent = 'WhatsApp · nombre';
  waNmLb.append(waNmSp, waNm);
  g2m.append(otcwWrapField(waNLb), otcwWrapField(waNmLb));
  g2m.append(otcwMkSelect('operationModeWs', 'Modo de asignación', HNF_OT_OPERATION_MODES));
  const idLb = document.createElement('label');
  idLb.className = 'form-field hnf-otcw-field__inner';
  const idSp = document.createElement('span');
  idSp.className = 'form-field__label';
  idSp.textContent = 'Nº OT manual (opcional)';
  const idIn = document.createElement('input');
  idIn.type = 'text';
  idIn.name = 'otCustomId';
  idIn.autocomplete = 'off';
  idLb.append(idSp, idIn);
  g2m.append(otcwWrapField(idLb));
  b2.append(g2m);
  panel2.append(g2, d2);

  const panel3 = mkPanel(3);
  const g3 = document.createElement('div');
  g3.className = 'hnf-otcw-grid';
  const rtLb = document.createElement('label');
  rtLb.className = 'form-field hnf-otcw-field__inner';
  rtLb.append(
    Object.assign(document.createElement('span'), {
      className: 'form-field__label',
      textContent: 'Descripción breve',
    }),
    Object.assign(document.createElement('textarea'), {
      name: 'resumenTrabajo',
      rows: 2,
      className: 'hnf-otcw-textarea hnf-otcw-textarea--sm',
    })
  );
  const coLb = document.createElement('label');
  coLb.className = 'form-field hnf-otcw-field__inner';
  coLb.append(
    Object.assign(document.createElement('span'), {
      className: 'form-field__label',
      textContent: 'Observaciones operativas',
    }),
    Object.assign(document.createElement('textarea'), {
      name: 'coordObsCreate',
      rows: 2,
      className: 'hnf-otcw-textarea hnf-otcw-textarea--sm',
    })
  );
  const oiLb = document.createElement('label');
  oiLb.className = 'form-field hnf-otcw-field__inner';
  oiLb.append(
    Object.assign(document.createElement('span'), {
      className: 'form-field__label',
      textContent: 'Comentario técnico',
    }),
    Object.assign(document.createElement('textarea'), {
      name: 'observacionesInternaWs',
      rows: 2,
      className: 'hnf-otcw-textarea hnf-otcw-textarea--sm',
    })
  );
  const { details: d3, body: b3 } = createHnfEwDetails('Más datos', false);
  const g3m = document.createElement('div');
  g3m.className = 'hnf-otcw-grid';
  g3m.append(
    otcwMkSelect('tipoFacturacionWs', 'Facturación', [
      { value: '', label: '—' },
      { value: 'inmediata', label: 'Inmediata' },
      { value: 'mensual', label: 'Mensual' },
    ])
  );
  const refLb = document.createElement('label');
  refLb.className = 'form-field hnf-otcw-field__inner';
  refLb.append(
    Object.assign(document.createElement('span'), { className: 'form-field__label', textContent: 'Referencia / tienda' }),
    Object.assign(document.createElement('input'), { type: 'text', name: 'refFacturacionWs', autocomplete: 'off' })
  );
  g3m.append(otcwWrapField(refLb));
  b3.append(g3m);
  g3.append(otcwWrapField(rtLb), otcwWrapField(coLb), otcwWrapField(oiLb));
  panel3.append(g3, d3);

  const panel4 = mkPanel(4);
  const eqHost = document.createElement('div');
  eqHost.className = 'otcw-equipos';
  const addEqBtn = document.createElement('button');
  addEqBtn.type = 'button';
  addEqBtn.className = 'secondary-button';
  addEqBtn.textContent = '+ Agregar equipo';
  const appendEq = () => {
    if (eqHost.querySelectorAll('.otcw-equipo-row').length >= MAX_EQUIPOS) return;
    eqHost.append(createOtWorkspaceEquipoRow());
    renumberOtWorkspaceEquipos(eqHost);
  };
  appendEq();
  addEqBtn.addEventListener('click', appendEq);
  panel4.append(eqHost, addEqBtn);

  const panel5 = mkPanel(5);
  const confirmLead = document.createElement('p');
  confirmLead.className = 'hnf-otcw-confirm-lead';
  confirmLead.textContent = 'Último paso: revisá y pulsá Crear OT (único envío al servidor).';
  const review = document.createElement('div');
  review.className = 'hnf-otcw-review';
  review.innerHTML =
    '<ul class="hnf-otcw-review__list" aria-label="Vista previa"></ul><p class="hnf-otcw-review__checks muted" role="status"></p>';
  const reviewList = review.querySelector('.hnf-otcw-review__list');
  const reviewChecks = review.querySelector('.hnf-otcw-review__checks');
  const refreshReview = () => {
    if (!reviewList) return;
    reviewList.innerHTML = '';
    const add = (k, v) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${k}:</strong> ${v || '—'}`;
      reviewList.append(li);
    };
    const clip = (s, n) => {
      const t = String(s || '').trim();
      if (!t) return '';
      return t.length > n ? `${t.slice(0, n)}…` : t;
    };
    const hasNotas = Boolean(
      clip(form.elements.resumenTrabajo?.value, 1) ||
        clip(form.elements.coordObsCreate?.value, 1) ||
        clip(form.elements.observacionesInternaWs?.value, 1)
    );
    const nEq = eqHost.querySelectorAll('.otcw-equipo-row').length;
    add(
      'Cliente · lugar',
      [form.elements.cliente?.value, form.elements.direccion?.value, form.elements.comuna?.value]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .join(' · ') || '—'
    );
    add(
      'Visita',
      `${form.elements.fecha?.value || '—'} ${form.elements.hora?.value || ''} · ${form.elements.tipoServicio?.value || '—'} / ${form.elements.subtipoServicio?.value || '—'}`
    );
    add(
      'Pedido',
      `${labelOrigenPedido(form.elements.origenPedidoWs?.value || '')} · ${labelPrioridadOperativa(form.elements.prioridadOperativaCreate?.value || '')} · ${resolveTecnicoFromAltaForm(form)} · ${form.elements.canalWs?.value || '—'}`
    );
    add('Notas', hasNotas ? 'Sí (revisá paso Notas si hace falta)' : '—');
    add('Equipos', `${nEq} fila(s)`);
    if (reviewChecks) reviewChecks.textContent = '';
  };
  panel5.append(confirmLead, review);

  form.append(panel0, panel1, panel2, panel3, panel4, panel5);

  const cwHeader = document.createElement('header');
  cwHeader.className = 'hnf-otcw__header';
  const cwTitleRow = document.createElement('div');
  cwTitleRow.className = 'hnf-otcw__title-row';
  const cwH1 = document.createElement('h2');
  cwH1.className = 'hnf-otcw__title';
  cwH1.textContent = 'Nueva OT';
  const btnCloseCreate = document.createElement('button');
  btnCloseCreate.type = 'button';
  btnCloseCreate.className = 'secondary-button hnf-otcw__close';
  btnCloseCreate.textContent = 'Cerrar';
  cwTitleRow.append(cwH1, btnCloseCreate);

  const createProgress = document.createElement('nav');
  createProgress.className = 'hnf-otcw__steps';
  createProgress.setAttribute('aria-label', 'Etapas');

  const progBar = document.createElement('div');
  progBar.className = 'hnf-otcw__progress-track';
  const progFill = document.createElement('div');
  progFill.className = 'hnf-otcw__progress-fill';
  progBar.append(progFill);

  const paintCreateProgress = () => {
    const pct = ((createStageIdx + 1) / OT_CREATE_WORKSPACE_STAGE_COUNT) * 100;
    progFill.style.width = `${pct}%`;
  };

  const stageScroll = document.createElement('div');
  stageScroll.className = 'hnf-otcw__stage-scroll';
  stageScroll.append(form);

  const cwBody = document.createElement('div');
  cwBody.className = 'hnf-otcw__body';
  cwBody.append(stageScroll);

  const createFooter = document.createElement('footer');
  createFooter.className = 'hnf-otcw__footer';
  const createBtnPrev = document.createElement('button');
  createBtnPrev.type = 'button';
  createBtnPrev.className = 'secondary-button';
  createBtnPrev.textContent = 'Anterior';
  const btnDraft = document.createElement('button');
  btnDraft.type = 'button';
  btnDraft.className = 'secondary-button';
  btnDraft.textContent = 'Guardar borrador';
  const createBtnNext = document.createElement('button');
  createBtnNext.type = 'button';
  createBtnNext.className = 'primary-button';
  createBtnNext.textContent = 'Siguiente';
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'primary-button';
  submitButton.textContent = isSubmitting ? 'Creando en servidor…' : 'Crear OT';
  submitButton.disabled = Boolean(isSubmitting);
  const footerRight = document.createElement('div');
  footerRight.className = 'hnf-otcw__footer-right';
  footerRight.append(createBtnNext, submitButton);
  const footerCenter = document.createElement('div');
  footerCenter.className = 'hnf-otcw__footer-center';
  const draftStatusEl = document.createElement('p');
  draftStatusEl.className = 'hnf-otcw__footer-draft muted';
  draftStatusEl.setAttribute('role', 'status');
  const ctaHintEl = document.createElement('p');
  ctaHintEl.className = 'hnf-otcw__footer-hint muted';
  const wizardErrEl = document.createElement('p');
  wizardErrEl.className = 'hnf-otcw__footer-wizard-error';
  wizardErrEl.hidden = true;
  wizardErrEl.setAttribute('role', 'alert');
  footerCenter.append(draftStatusEl, ctaHintEl, wizardErrEl);
  createFooter.append(createBtnPrev, btnDraft, footerCenter, footerRight);

  const formatDraftTime = () =>
    new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const setWizardFooter = (opts = {}) => {
    if ('draftLine' in opts && opts.draftLine != null) {
      draftStatusEl.textContent = opts.draftLine;
      draftStatusEl.classList.toggle('hnf-otcw__footer-draft--ok', Boolean(opts.draftLine));
    }
    if ('hint' in opts) ctaHintEl.textContent = opts.hint ?? '';
    if ('error' in opts) {
      if (opts.error) {
        wizardErrEl.textContent = opts.error;
        wizardErrEl.hidden = false;
      } else {
        wizardErrEl.textContent = '';
        wizardErrEl.hidden = true;
      }
    }
  };

  ctaHintEl.textContent = 'Borrador automático. Servidor: solo con Crear OT.';

  const persistDraftAndNotify = (label) => {
    const ok = writeCreateOtDraft(form, eqHost);
    const t = formatDraftTime();
    if (ok) {
      otcwDevLog('draft_saved', { label, t });
      setWizardFooter({ draftLine: `${label} ${t}` });
    } else {
      setWizardFooter({
        draftLine: `Sin guardar · ${t}`,
        error: 'No se pudo guardar el borrador en este equipo. Los datos siguen en pantalla.',
      });
    }
  };

  const focusFirstOtcwInput = () => {
    requestAnimationFrame(() => {
      const stage = form.querySelector('.hnf-otcw-stage:not([hidden])');
      if (!stage) return;
      const el = stage.querySelector(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      el?.focus?.({ preventScroll: true });
    });
  };

  const refreshOtcwActionState = () => {
    const last = OT_CREATE_WORKSPACE_STAGE_COUNT - 1;
    createBtnNext.disabled = false;
    createBtnNext.title = '';
    submitButton.disabled = Boolean(isSubmitting);
    submitButton.title = isSubmitting ? 'Enviando…' : '';
    if (createStageIdx >= last) {
      createBtnNext.disabled = true;
    }
  };

  const setOtcwFinalBusy = (on) => {
    if (on) {
      submitButton.disabled = true;
      submitButton.setAttribute('aria-busy', 'true');
      submitButton.textContent = 'Creando…';
      createBtnNext.disabled = true;
      createBtnPrev.disabled = true;
      btnDraft.disabled = true;
      btnCloseCreate.disabled = true;
      createProgress.querySelectorAll('.hnf-otcw__step').forEach((b) => {
        b.disabled = true;
      });
      setWizardFooter({ error: '', draftLine: 'Creando OT en servidor…' });
    } else {
      submitButton.setAttribute('aria-busy', 'false');
      submitButton.textContent = 'Crear OT';
      btnCloseCreate.disabled = false;
      btnDraft.disabled = false;
      createProgress.querySelectorAll('.hnf-otcw__step').forEach((btn, i) => {
        btn.disabled = i > createStageIdx;
      });
      setWizardFooter({ draftLine: '' });
      refreshOtcwActionState();
    }
  };

  let otcwFinalSubmitBusy = false;

  const setCreateStage = (idx) => {
    const n = Math.max(0, Math.min(OT_CREATE_WORKSPACE_STAGE_COUNT - 1, idx));
    if (prevCreateStageForDraft >= 0 && n > prevCreateStageForDraft) writeCreateOtDraft(form, eqHost);
    prevCreateStageForDraft = n;
    createStageIdx = n;
    writeStoredStageIndex(createStageKey, n);
    form.querySelectorAll('.hnf-otcw-stage').forEach((el) => {
      el.hidden = Number(el.dataset.createStage) !== n;
    });
    createBtnPrev.disabled = n === 0;
    createBtnNext.hidden = n === OT_CREATE_WORKSPACE_STAGE_COUNT - 1;
    submitButton.hidden = n !== OT_CREATE_WORKSPACE_STAGE_COUNT - 1;
    createProgress.querySelectorAll('.hnf-otcw__step').forEach((btn, i) => {
      btn.classList.toggle('is-active', i === n);
      btn.classList.toggle('is-done', i < n);
      btn.disabled = i > n;
    });
    if (n === OT_CREATE_WORKSPACE_STAGE_COUNT - 1) refreshReview();
    paintCreateProgress();
    refreshOtcwActionState();
    otcwDevLog('step', { index: n, id: OT_CREATE_WORKSPACE_STAGES[n]?.id });
    createBtnNext.setAttribute(
      'aria-label',
      n < OT_CREATE_WORKSPACE_STAGE_COUNT - 1 ? `Validar y paso al siguiente (${OT_CREATE_WORKSPACE_STAGES[n + 1]?.label || ''})` : ''
    );
    focusFirstOtcwInput();
  };

  OT_CREATE_WORKSPACE_STAGES.forEach((st, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hnf-otcw__step';
    btn.dataset.stageIndex = String(i);
    btn.innerHTML = `<span class="hnf-otcw__step-num">${i + 1}</span><span class="hnf-otcw__step-label">${st.label}</span>`;
    btn.addEventListener('click', () => {
      if (i <= createStageIdx) setCreateStage(i);
    });
    createProgress.append(btn);
  });

  cwHeader.append(cwTitleRow, createProgress, progBar);

  const createDialog = document.createElement('dialog');
  createDialog.className = 'hnf-otcw-dialog';
  createDialog.setAttribute('aria-label', 'Crear orden de trabajo');
  const cwShell = document.createElement('div');
  cwShell.className = 'hnf-otcw';
  cwShell.append(cwHeader, cwBody, createFooter);
  createDialog.append(cwShell);
  createDialog.addEventListener('close', () => {
    window.clearTimeout(draftSaveTimer);
    writeCreateOtDraft(form, eqHost);
  });

  btnCloseCreate.addEventListener('click', () => createDialog.close());
  createBtnPrev.addEventListener('click', () => setCreateStage(createStageIdx - 1));
  btnDraft.addEventListener('click', () => {
    persistDraftAndNotify('Guardado');
  });
  createBtnNext.addEventListener('click', () => {
    const v = validateOtCreateWorkspaceStage(form, createStageIdx);
    if (!v.ok) {
      otcwApplyFieldErrors(form, v.errors);
      otcwFocusFirstErrorField(form, v.errors);
      otcwDevLog('validation_fail', { stage: createStageIdx, errors: v.errors });
      return;
    }
    otcwClearFieldErrors(form);
    setWizardFooter({ error: '' });
    setCreateStage(createStageIdx + 1);
  });

  attachCreateOtAutocomplete(form, ots);
  const initialDraft = readCreateOtDraft();
  const hadMeaningfulDraft =
    Boolean(initialDraft && typeof initialDraft === 'object' && Object.keys(initialDraft).length > 0);
  applyCreateOtDraft(form, initialDraft, eqHost);
  if (hadMeaningfulDraft) {
    persistDraftAndNotify('Restaurado');
  }
  const onFormLive = () => {
    refreshOtcwActionState();
    window.clearTimeout(draftSaveTimer);
    draftSaveTimer = window.setTimeout(() => persistDraftAndNotify('Guardado'), 450);
  };
  form.addEventListener('input', onFormLive);
  form.addEventListener('change', onFormLive);

  setCreateStage(createStageIdx);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (otcwFinalSubmitBusy) return;

    const v = validateOtCreateWorkspaceSubmit(form);
    if (!v.ok) {
      const target = getOtCreateWorkspaceStageForSubmitErrors(v.errors);
      setCreateStage(target);
      otcwApplyFieldErrors(form, v.errors);
      otcwFocusFirstErrorField(form, v.errors);
      otcwDevLog('validation_fail', { submit: true, errors: v.errors });
      setWizardFooter({
        draftLine: '',
        error: 'Completá lo obligatorio en los pasos anteriores (campos marcados).',
      });
      return;
    }

    const equipos = collectEquiposFromWorkspace(eqHost);
    const payload = buildOtCreateWorkspacePayload(form, equipos, resolveTecnicoFromAltaForm);

    otcwFinalSubmitBusy = true;
    setOtcwFinalBusy(true);
    try {
      const result = await actions.createOT(payload);
      if (result?.ok) {
        otcwDevLog('create_success', { id: result.id });
        clearCreateOtDraft();
        otcwClearFieldErrors(form);
        setWizardFooter({ draftLine: '', error: '' });
        form.reset();
        const prEl = form.elements.prioridadOperativaCreate;
        if (prEl) {
          for (let i = 0; i < prEl.options.length; i++) {
            if (prEl.options[i].value === 'media') {
              prEl.selectedIndex = i;
              break;
            }
          }
        }
        const opEl = form.elements.operationModeWs;
        if (opEl) {
          for (let i = 0; i < opEl.options.length; i++) {
            if (opEl.options[i].value === 'manual') {
              opEl.selectedIndex = i;
              break;
            }
          }
        }
        applyWorkspaceEquiposFromDraft(eqHost, []);
        form.elements.origenSolicitudCreate?.dispatchEvent(new Event('change', { bubbles: true }));
        form.elements.tecnicoPreset?.dispatchEvent(new Event('change', { bubbles: true }));
        form.elements.origenPedidoWs?.dispatchEvent(new Event('change', { bubbles: true }));
        prevCreateStageForDraft = -1;
        writeStoredStageIndex(createStageKey, 0);
        setCreateStage(0);
        createDialog.close();

        const reloaded = await actions.reloadApp?.();
        if (reloaded) {
          actions.finalizeClimaOtCreateUi?.();
        } else {
          actions.showFeedback?.({
            type: 'warning',
            message: `OT ${result.id} registrada. No se pudo refrescar la lista (conexión o servidor).`,
          });
        }
      } else {
        otcwDevLog('create_fail', { message: result?.message });
        setWizardFooter({
          draftLine: '',
          error: result?.message || 'Error del servidor. Reintentá con Crear OT.',
        });
      }
    } finally {
      if (createDialog.open) {
        setOtcwFinalBusy(false);
        otcwFinalSubmitBusy = false;
      } else {
        otcwFinalSubmitBusy = false;
      }
    }
  });

  const createActionBar = document.createElement('div');
  createActionBar.className = 'hnf-clima-action-bar';
  const btnOpenCreate = document.createElement('button');
  btnOpenCreate.type = 'button';
  btnOpenCreate.className = 'primary-button hnf-clima-action-bar__primary';
  btnOpenCreate.textContent = 'Crear nueva OT';
  btnOpenCreate.addEventListener('click', () => {
    otcwClearFieldErrors(form);
    setWizardFooter({ error: '' });
    createDialog.showModal();
    requestAnimationFrame(() => {
      refreshOtcwActionState();
      focusFirstOtcwInput();
    });
  });
  createActionBar.append(btnOpenCreate, climaToolbar);

  const { split: workspaceSplit, railNav, main: workspaceMain, railCtx } = createHnfEwSplitThree();
  workspaceSplit.classList.add('hnf-cc-split-pane--clima-enterprise');
  workspaceMain.classList.add('hnf-cc-split-pane__center');

  const listCard = document.createElement('article');
  listCard.className = 'ot-list-card ot-list-card--split-rail hnf-cc-split-pane__rail hnf-cc-split-pane__rail--left';
  listCard.innerHTML =
    '<div class="ot-list-card__header"><h3 class="flota-list-heading">Bandeja OT</h3><p class="muted small">Filtrá por cliente. La fila permanece seleccionada tras guardar en servidor.</p></div>';

  const filtTitle = document.createElement('div');
  filtTitle.className = 'flota-desk-heading';
  filtTitle.innerHTML =
    '<strong>Listado</strong> <span class="muted small">· Fuente: servidor · SLA en chips</span>';

  const filtRow = document.createElement('div');
  filtRow.className = 'flota-filters';
  const fCliente = document.createElement('input');
  fCliente.type = 'search';
  fCliente.placeholder = 'Filtrar por cliente (contiene)';
  filtRow.append(fCliente);

  const list = document.createElement('div');
  list.className = 'ot-list ot-list--split-pane';

  const renderOtList = () => {
    list.innerHTML = '';
    const qCliente = fCliente.value.trim().toLowerCase();
    const rows = qCliente.length
      ? listOts.filter((o) => String(o.cliente || '').toLowerCase().includes(qCliente))
      : listOts;

    if (opRole === 'flota') {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent =
        'Tu bandeja de OT de Flota está en el módulo Flota. Este listado es para operación Clima / HVAC.';
      list.append(empty);
      return;
    }
    if (!ots.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent =
        integrationStatus === 'sin conexión'
          ? 'Sin conexión al servidor: no hay órdenes cargadas. Revisá la red y tocá «Actualizar datos».'
          : 'No hay OT. Tocá «Crear nueva OT» en la barra de acciones o sincronizá cuando el servidor esté disponible.';
      list.append(empty);
      return;
    }
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = qCliente.length
        ? 'Ninguna OT coincide con el texto de cliente.'
        : 'Ninguna OT coincide con el filtro inteligente. Quitá el filtro o ajustá criterios en el módulo.';
      list.append(empty);
      return;
    }
    rows.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      const isTarget = intelGuidance?.recordLabel && item.id === intelGuidance.recordLabel;
      button.className = `ot-list__item hnf-ot-mini-card ${selectedOT?.id === item.id ? 'is-active' : ''} ${
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
      const tf = String(item.tipoFacturacion || 'inmediata').toLowerCase();
      const factRow = document.createElement('div');
      factRow.className = 'ot-list__fact-row';
      const chip = (text, cls) => {
        const s = document.createElement('span');
        s.className = `hnf-ot-fact-chip ${cls}`;
        s.textContent = text;
        return s;
      };
      factRow.append(
        chip(tf === 'mensual' ? 'Fact. mensual' : 'Fact. inmediata', tf === 'mensual' ? 'hnf-ot-fact-chip--warn' : 'hnf-ot-fact-chip--ok')
      );
      if (tf === 'mensual' && !item.incluidaEnCierreMensual && String(item.estado || '').toLowerCase() !== 'facturada') {
        factRow.append(chip('Pend. cierre mensual', 'hnf-ot-fact-chip--pending'));
      }
      if (String(item.estado || '').toLowerCase() === 'facturada') {
        factRow.append(chip('Facturada', 'hnf-ot-fact-chip--done'));
      }
      button.querySelector('div')?.append(factRow);
      button.append(createStatusBadge(item.estado), createStatusBadge(opMode === 'automatic' ? 'Automático' : 'Manual', 'mode'));
      button.addEventListener('click', () => actions.selectOT(item.id));
      list.append(button);
    });
    queueMicrotask(() => {
      const t =
        list.querySelector('.ot-list__item.is-intel-target') || list.querySelector('.ot-list__item.is-active');
      t?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
  };

  fCliente.addEventListener('input', () => renderOtList());

  listCard.append(list);
  railNav.append(filtTitle, filtRow, listCard);

  const contextRail = railCtx;
  contextRail.classList.add('hnf-cc-split-pane__rail', 'hnf-cc-split-pane__rail--right', 'ot-context-rail');
  contextRail.setAttribute('aria-label', 'Portal, inteligencia, disciplina, resumen y Jarvis');

  const detailCard = document.createElement('article');
  detailCard.className = 'ot-detail-card ot-saas-dashboard ot-detail-card--split-workspace hnf-cc-split-pane__center';

  if (!selectedOT) {
    detailCard.innerHTML =
      '<h3>Detalle de la visita</h3><p class="muted">Tocá «Crear nueva OT» en la barra de acciones o elegí una fila en la bandeja.</p>';
    contextRail.replaceChildren();
    contextRail.append(buildClimaPortalStrip(null));
    appendClimaIntelToRail(contextRail, null, {
      intelListFilter,
      intelGuidance,
      actions,
      otEconomicsSaved,
    });
    const emptyCtx = document.createElement('p');
    emptyCtx.className = 'ot-context-rail__empty';
    emptyCtx.textContent =
      'Seleccioná una OT para resumen tipo portal, bloqueos, disciplina técnica, ejecutivo y Jarvis por etapa.';
    contextRail.append(emptyCtx);
  } else {
    mountClimaOtDetailFlow(detailCard, contextRail, {
      selectedOT,
      actions,
      ro: isOtEstadoCerradaUi(selectedOT.estado),
      isClosingOT,
      isGeneratingPdf,
      isEnviandoInformeCliente,
      isSavingEquipos,
      isPatchingOtOperational,
      otEconomicsSaved,
      allOts: ots,
      navigateToView,
      intelListFilter,
      intelGuidance,
    });
  }

  workspaceMain.append(detailCard);
  ew.body.append(workspaceSplit);

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

  ew.header.append(header);

  const signalsStrip = document.createElement('div');
  signalsStrip.className = 'hnf-ew-signals-strip';
  const p1 = document.createElement('span');
  p1.className = 'hnf-ew-pill-metric';
  p1.textContent = `OT en servidor: ${ots.length}`;
  const p2 = document.createElement('span');
  p2.className = 'hnf-ew-pill-metric';
  p2.textContent = `Nueva/asignada: ${pendingCount}`;
  const p3 = document.createElement('span');
  p3.className = 'hnf-ew-pill-metric';
  p3.textContent = `En curso: ${inProgressCount}`;
  const p4 = document.createElement('span');
  p4.className = 'hnf-ew-pill-metric';
  p4.textContent = `Equipos (suma): ${eqTotal}`;
  const p5 = document.createElement('span');
  p5.className = 'hnf-ew-pill-metric';
  p5.textContent = `Integración: ${integrationStatus || '—'}`;
  signalsStrip.append(p1, p2, p3, p4, p5);
  ew.signals.append(...(offlineBanner ? [offlineBanner] : []), signalsStrip);

  ew.flow.append(flowStrip);

  ew.quick.append(createActionBar);
  ew.root.append(createDialog);

  renderOtList();

  return ew.root;
};

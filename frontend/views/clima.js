import { createCard } from '../components/card.js';
import { mergeEquipoChecklist } from '../constants/hvacChecklist.js';
import { otFormDefinition } from '../config/form-definitions.js';
import { buildOtOperationalBrief } from '../domain/operational-intelligence.js';
import { monthRangeYmd } from '../domain/hnf-intelligence-engine.js';
import { otCanClose } from '../utils/ot-evidence.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import {
  HNF_OT_OPERATION_MODES,
  HNF_OT_ORIGEN_PEDIDO,
  HNF_OT_TECNICOS_PRESETS,
  labelOperationMode,
  labelOrigenPedido,
} from '../constants/hnf-ot-operation.js';

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

const createInlineEditableBlock = ({ title, hint, value = '', readOnly = false, onSave }) => {
  const block = document.createElement('article');
  block.className = 'ot-saas-block ot-saas-block--summary';
  const head = document.createElement('div');
  head.className = 'ot-saas-block__head';
  const h = document.createElement('h4');
  h.textContent = title;
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = hint;
  head.append(h, p);

  const content = document.createElement('div');
  content.className = 'ot-inline-edit';
  const area = document.createElement('div');
  area.className = 'ot-inline-edit__area';
  area.contentEditable = String(!readOnly);
  area.textContent = value || '';
  area.dataset.placeholder = 'Escribe aquí…';

  const actions = document.createElement('div');
  actions.className = 'ot-inline-edit__actions';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'secondary-button';
  save.textContent = 'Guardar';
  save.disabled = readOnly || typeof onSave !== 'function';
  save.addEventListener('click', async () => {
    if (typeof onSave !== 'function') return;
    await onSave(String(area.textContent || '').trim());
  });
  actions.append(save);

  content.append(area, actions);
  block.append(head, content);
  return block;
};

const createJarvisSuggestions = (ot) => {
  const out = [];
  if (!ot) return out;
  if (!ot.resumenTrabajo?.trim()) out.push('Completa el resumen para habilitar cierre sin fricción.');
  if ((ot.equipos?.length || 0) === 0) out.push('Agrega al menos un equipo para trazabilidad técnica.');
  if (!ot.pdfUrl) out.push('Genera borrador PDF antes del cierre para validación interna.');
  if (ot.estado === 'pendiente') out.push('Mueve la OT a “en proceso” para reflejar ejecución real.');
  return out.slice(0, 3);
};

const mountJarvisOrb = (host, ot) => {
  const orb = document.createElement('aside');
  orb.className = `jarvis-orb jarvis-orb--${(ot?.estado || 'pendiente').replace(/\s+/g, '-')}`;
  orb.setAttribute('aria-label', 'Jarvis contextual');
  orb.innerHTML = `
    <button type="button" class="jarvis-orb__core" aria-expanded="false" aria-controls="jarvis-orb-panel">J</button>
    <div id="jarvis-orb-panel" class="jarvis-orb__panel" hidden>
      <h4>Jarvis · Sugerencias</h4>
      <ul class="jarvis-orb__list"></ul>
    </div>
  `;
  const core = orb.querySelector('.jarvis-orb__core');
  const panel = orb.querySelector('.jarvis-orb__panel');
  const ul = orb.querySelector('.jarvis-orb__list');
  createJarvisSuggestions(ot).forEach((txt) => {
    const li = document.createElement('li');
    li.textContent = txt;
    ul.append(li);
  });
  if (!ul.children.length) {
    const li = document.createElement('li');
    li.textContent = 'Operación estable. Mantén evidencias y costos al día.';
    ul.append(li);
  }
  core?.addEventListener('click', () => {
    const open = panel?.hasAttribute('hidden') === false;
    if (open) {
      panel?.setAttribute('hidden', '');
      core.setAttribute('aria-expanded', 'false');
    } else {
      panel?.removeAttribute('hidden');
      core.setAttribute('aria-expanded', 'true');
    }
  });
  host.append(orb);
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
    raw === 'terminado'
      ? 'completado'
      : raw === 'en proceso'
        ? 'en-proceso'
        : raw === 'automatico'
          ? 'automatico'
          : raw === 'automático'
            ? 'automatico'
            : raw || 'pendiente';
  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${normalized} ${variant === 'mode' ? 'status-badge--mode' : ''}`;
  badge.textContent = status || 'pendiente';
  return badge;
};

const buildOtAltaOperationSection = () => {
  const fs = document.createElement('fieldset');
  fs.className = 'ot-form__section ot-form__section--operation';
  const leg = document.createElement('legend');
  leg.textContent = 'Modo operación · Nº OT · Origen · Técnico';
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

  const origenSel = document.createElement('select');
  origenSel.name = 'origenPedidoCreate';
  HNF_OT_ORIGEN_PEDIDO.forEach((o) => {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.label;
    origenSel.append(op);
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
    mk('Origen del pedido', origenSel),
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

const buildOtOperationalDetailPanel = (ot, actions, readOnly, isPatching) => {
  const sec = document.createElement('section');
  sec.className = 'ot-op-detail';
  sec.setAttribute('aria-label', 'Modo operación y responsabilidades');

  const mode = ot.operationMode === 'automatic' ? 'automatic' : 'manual';

  const head = document.createElement('div');
  head.className = 'ot-op-detail__head';
  const ht = document.createElement('h3');
  ht.className = 'ot-section-title';
  ht.textContent = 'Control operativo (modo · responsables · origen)';
  const hp = document.createElement('p');
  hp.className = 'muted small';
  hp.innerHTML =
    'Indicadores siempre visibles. <strong>Automático</strong> = Jarvis puede proponer técnico al crear; el equipo mantiene control y puede anular.';
  head.append(ht, hp);

  const badges = document.createElement('div');
  badges.className = 'ot-op-detail__badges';
  const bMode = document.createElement('span');
  bMode.className = `ot-op-badge ot-op-badge--mode ot-op-badge--mode-${mode}`;
  bMode.textContent = labelOperationMode(mode);
  const bOrig = document.createElement('span');
  bOrig.className = 'ot-op-badge ot-op-badge--neutral';
  bOrig.textContent = `Origen: ${labelOrigenPedido(ot.origenPedido)}`;
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
    row('Creada por', ot.creadoPor),
    row('Asignación por', ot.asignadoPor),
    row('Responsable actual', ot.responsableActual || ot.tecnicoAsignado),
    row('Técnico (OT)', ot.tecnicoAsignado)
  );

  sec.append(head, badges, grid);

  if (readOnly || typeof actions?.patchOtOperational !== 'function') {
    return sec;
  }

  const ctl = document.createElement('div');
  ctl.className = 'ot-op-detail__controls';

  const rowCtrl = document.createElement('div');
  rowCtrl.className = 'ot-op-detail__ctrl-row';

  const ms = document.createElement('select');
  ms.className = 'ot-op-detail__select';
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
  tSel.className = 'ot-op-detail__select';
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
  tOther.className = 'ot-op-detail__other';
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
  os.className = 'ot-op-detail__select';
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
  save.className = 'primary-button';
  save.textContent = isPatching ? 'Guardando…' : 'Guardar modo / técnico / origen';
  save.disabled = Boolean(isPatching);
  save.addEventListener('click', () => {
    let t = tSel.value;
    if (t === '__otro__') t = tOther.value.trim() || 'Por asignar';
    actions.patchOtOperational(ot.id, {
      operationMode: ms.value,
      tecnicoAsignado: t,
      origenPedido: os.value,
    });
  });

  rowCtrl.append(ms, tSel, tOther, os, save);
  ctl.append(rowCtrl);
  sec.append(ctl);

  return sec;
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
    out = out.filter((o) => o.estado === 'terminado' && roundEcon(o.costoTotal) <= 0);
  }
  if (intelListFilter.sinCobroConPdf) {
    out = out.filter(
      (o) =>
        o.estado === 'terminado' &&
        o.pdfUrl &&
        String(o.pdfUrl).trim() &&
        roundEcon(o.montoCobrado) <= 0
    );
  }
  if (intelListFilter.sinPdfTerminadas) {
    out = out.filter((o) => o.estado === 'terminado' && (!o.pdfUrl || !String(o.pdfUrl).trim()));
  }
  if (intelListFilter.soloAbiertas) {
    out = out.filter((o) => o.estado !== 'terminado');
  }
  if (intelListFilter.clienteContains) {
    const q = String(intelListFilter.clienteContains).toLowerCase();
    out = out.filter((o) => String(o.cliente || '').toLowerCase().includes(q));
  }
  return out;
};

const buildClimaIntelChecklist = (ot, economicsSaved) => {
  if (!ot) return [];
  if (ot.estado === 'terminado') {
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
  isUpdatingStatus,
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

  const ots = [...(data?.data || [])].reverse();
  const listOts = filterOtsIntelList(ots, intelListFilter);
  const effectiveSelectedId = listOts.some((item) => item.id === selectedOTId)
    ? selectedOTId
    : listOts[0]?.id ?? selectedOTId;
  const selectedOT = ots.find((item) => item.id === effectiveSelectedId) || ots[0] || null;
  const pendingCount = ots.filter((item) => item.estado === 'pendiente').length;
  const inProgressCount = ots.filter((item) => item.estado === 'en proceso').length;
  const eqTotal = ots.reduce((t, o) => t + (o.equipos?.length || 0), 0);

  const cards = document.createElement('div');
  cards.className = 'cards';
  [
    {
      title: 'Órdenes de trabajo',
      description: 'Resumen rápido.',
      items: [`Total: ${ots.length}`, `Pendientes: ${pendingCount}`, `En proceso: ${inProgressCount}`],
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
  formCard.className = 'ot-form-card';

  const formHeader = document.createElement('div');
  formHeader.className = 'ot-form-card__header';
  formHeader.innerHTML = `
    <div>
      <p class="muted">Paso 1 · Nueva visita</p>
      <h3>Crear OT</h3>
      <p class="muted" style="margin-top:8px;font-size:13px;">Completá los datos del cliente y del servicio. Más abajo podés sumar equipos y fotos ya en el alta.</p>
    </div>
  `;

  const form = document.createElement('form');
  form.className = 'ot-form';

  otFormDefinition.sections.forEach((sectionConfig) => {
    if (sectionConfig.title === 'Evidencias fotográficas') return;

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'ot-form__section';

    const legend = document.createElement('legend');
    legend.textContent = sectionConfig.title;
    fieldset.append(legend);

    const grid = document.createElement('div');
    grid.className = 'ot-form__grid';

    sectionConfig.fields.forEach((field) => {
      grid.append(buildField(field));
    });

    fieldset.append(grid);
    form.append(fieldset);
  });

  form.append(buildOtAltaOperationSection());

  const eqWrap = document.createElement('div');
  eqWrap.className = 'ot-form__section';
  eqWrap.innerHTML = '<h4 class="ot-equipos-title">Equipos en sitio (máx. 12)</h4><p class="muted">Cada equipo lleva sus propias fotos antes / durante / después.</p>';
  const eqContainer = document.createElement('div');
  eqContainer.className = 'ot-equipos-create';
  const addEqBtn = document.createElement('button');
  addEqBtn.type = 'button';
  addEqBtn.className = 'secondary-button';
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
  form.append(eqWrap);

  const footer = document.createElement('div');
  footer.className = 'ot-form__footer';
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'primary-button';
  submitButton.textContent = isSubmitting ? 'Guardando…' : 'Crear OT';
  submitButton.disabled = Boolean(isSubmitting);
  footer.append(submitButton);
  form.append(footer);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const equipos = collectEquiposFromCreateForm(eqContainer);
    const customId = form.elements.otCustomId?.value?.trim() || '';
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
      origenPedido: form.elements.origenPedidoCreate?.value || '',
      fecha: form.elements.fecha.value,
      hora: form.elements.hora.value,
      observaciones: form.elements.observaciones.value.trim(),
      resumenTrabajo: form.elements.resumenTrabajo.value.trim(),
      recomendaciones: form.elements.recomendaciones.value.trim(),
      equipos,
    };
    await actions.createOT(payload);
  });

  formCard.append(formHeader, form);

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

  if (!ots.length) {
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
    const ro = selectedOT.estado === 'terminado';
    const topSticky = document.createElement('header');
    topSticky.className = 'ot-saas-sticky';
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
    const modePill = document.createElement('div');
    modePill.className = 'ot-saas-pill';
    const modeK = document.createElement('span');
    modeK.textContent = 'Modo';
    const modeV = document.createElement('strong');
    modeV.append(createStatusBadge(labelOperationMode(selectedOT.operationMode), 'mode'));
    modePill.append(modeK, modeV);
    meta.append(modePill);
    const actionsTop = document.createElement('div');
    actionsTop.className = 'ot-saas-sticky__actions';
    const pdfTop = document.createElement('button');
    pdfTop.type = 'button';
    pdfTop.className = 'secondary-button';
    pdfTop.textContent = isGeneratingPdf ? 'Generando…' : 'Generar PDF';
    pdfTop.disabled = Boolean(isGeneratingPdf || isClosingOT);
    pdfTop.addEventListener('click', async () => actions.generatePdfFromOt(selectedOT));
    const closeTop = document.createElement('button');
    closeTop.type = 'button';
    closeTop.className = 'primary-button';
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
    actionsTop.append(pdfTop, closeTop);
    topSticky.append(meta, actionsTop);
    detailCard.append(topSticky);

    const tabs = document.createElement('div');
    tabs.className = 'ot-saas-tabs';
    const tabPanels = document.createElement('div');
    tabPanels.className = 'ot-saas-panels';
    const tabDefs = [
      { key: 'ejecucion', label: 'Ejecución' },
      { key: 'equipos', label: 'Equipos' },
      { key: 'evidencia', label: 'Evidencia' },
      { key: 'informe', label: 'Informe' },
    ];
    const setActiveTab = (key) => {
      tabs.querySelectorAll('button').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === key));
      tabPanels.querySelectorAll('[data-panel]').forEach((p) => {
        p.hidden = p.dataset.panel !== key;
      });
    };
    tabDefs.forEach((t, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ot-saas-tab ${idx === 0 ? 'is-active' : ''}`;
      btn.dataset.tab = t.key;
      btn.textContent = t.label;
      btn.addEventListener('click', () => setActiveTab(t.key));
      tabs.append(btn);
    });

    const summaryGrid = document.createElement('div');
    summaryGrid.className = 'ot-summary-grid ot-saas-block';
    [
      ['Dirección', selectedOT.direccion],
      ['Comuna', selectedOT.comuna],
      ['Contacto', selectedOT.contactoTerreno],
      ['Teléfono', selectedOT.telefonoContacto],
      ['Modo operación', labelOperationMode(selectedOT.operationMode)],
      ['Origen del pedido', labelOrigenPedido(selectedOT.origenPedido)],
      ['Técnico', selectedOT.tecnicoAsignado],
      ['Tipo / subtipo', `${selectedOT.tipoServicio} / ${selectedOT.subtipoServicio}`],
      ['Fecha / hora', `${selectedOT.fecha} · ${selectedOT.hora}`],
    ].forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'ot-summary-item';
      row.innerHTML = `<span>${label}</span><strong>${value || '—'}</strong>`;
      summaryGrid.append(row);
    });

    const panelExec = document.createElement('section');
    panelExec.className = 'ot-saas-panel';
    panelExec.dataset.panel = 'ejecucion';
    panelExec.hidden = false;
    panelExec.append(
      summaryGrid,
      createInlineEditableBlock({
        title: 'Resumen',
        hint: 'Edición inline y guardado rápido',
        value: selectedOT.resumenTrabajo,
        readOnly: ro,
        onSave: async (txt) =>
          actions.saveVisitText(selectedOT.id, {
            observaciones: selectedOT.observaciones || '',
            resumenTrabajo: txt,
            recomendaciones: selectedOT.recomendaciones || '',
          }),
      }),
      createInlineEditableBlock({
        title: 'Observaciones',
        hint: 'Bloque operativo editable',
        value: selectedOT.observaciones,
        readOnly: ro,
        onSave: async (txt) =>
          actions.saveVisitText(selectedOT.id, {
            observaciones: txt,
            resumenTrabajo: selectedOT.resumenTrabajo || '',
            recomendaciones: selectedOT.recomendaciones || '',
          }),
      }),
      createInlineEditableBlock({
        title: 'Recomendaciones',
        hint: 'Sugerencias para continuidad',
        value: selectedOT.recomendaciones,
        readOnly: ro,
        onSave: async (txt) =>
          actions.saveVisitText(selectedOT.id, {
            observaciones: selectedOT.observaciones || '',
            resumenTrabajo: selectedOT.resumenTrabajo || '',
            recomendaciones: txt,
          }),
      })
    );

    const panelEquipos = document.createElement('section');
    panelEquipos.className = 'ot-saas-panel';
    panelEquipos.dataset.panel = 'equipos';
    panelEquipos.hidden = true;
    const detailEqHost = document.createElement('div');
    detailEqHost.className = 'ot-detail-equipos-host ot-saas-cards';
    (selectedOT.equipos?.length ? selectedOT.equipos : [{}]).forEach((eq, idx) => {
      detailEqHost.append(buildDetailEquipoRow(eq, idx, ro));
    });

    const eqToolbar = document.createElement('div');
    eqToolbar.className = 'ot-equipos-toolbar';
    const addDetailEq = document.createElement('button');
    addDetailEq.type = 'button';
    addDetailEq.className = 'secondary-button';
    addDetailEq.textContent = '+ Equipo';
    addDetailEq.disabled = Boolean(ro || isSavingEquipos);
    addDetailEq.addEventListener('click', () => {
      const n = detailEqHost.querySelectorAll('.ot-equipo-detail-row').length;
      if (n >= MAX_EQUIPOS || ro) return;
      detailEqHost.append(buildDetailEquipoRow({ id: `eq-new-${Date.now()}-${n}` }, n, false));
    });
    const saveEq = document.createElement('button');
    saveEq.type = 'button';
    saveEq.className = 'primary-button';
    saveEq.textContent = isSavingEquipos ? 'Guardando…' : 'Guardar equipos';
    saveEq.disabled = Boolean(ro || isSavingEquipos);
    saveEq.addEventListener('click', async () => {
      await actions.saveEquipos(selectedOT.id, collectEquiposFromDetail(detailEqHost, selectedOT));
    });
    eqToolbar.append(addDetailEq, saveEq);
    panelEquipos.append(detailEqHost, eqToolbar);

    const panelEvidence = document.createElement('section');
    panelEvidence.className = 'ot-saas-panel';
    panelEvidence.dataset.panel = 'evidencia';
    panelEvidence.hidden = true;
    const evidenceBoard = document.createElement('div');
    evidenceBoard.className = 'ot-saas-evidence-grid';
    ['fotografiasAntes', 'fotografiasDurante', 'fotografiasDespues'].forEach((key, idx) => {
      const labels = ['Antes', 'Durante', 'Después'];
      const col = document.createElement('article');
      col.className = 'ot-saas-block';
      const h = document.createElement('h4');
      h.textContent = `${labels[idx]} (visita)`;
      const drop = document.createElement('label');
      drop.className = 'ot-dropzone';
      drop.innerHTML = '<span>Arrastrá imágenes aquí o toca para cargar</span>';
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
      col.append(h, drop, gallery);
      evidenceBoard.append(col);
    });
    panelEvidence.append(evidenceBoard);

    const panelInforme = document.createElement('section');
    panelInforme.className = 'ot-saas-panel';
    panelInforme.dataset.panel = 'informe';
    panelInforme.hidden = true;
    const checklistPanel = document.createElement('article');
    checklistPanel.className = 'ot-saas-block';
    checklistPanel.innerHTML = '<h4>Checklist visual</h4>';
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
    previewPanel.innerHTML = '<h4>Preview de informe</h4>';
    previewPanel.append(createClientPreview(selectedOT));
    panelInforme.append(checklistPanel, previewPanel);

    tabPanels.append(panelExec, panelEquipos, panelEvidence, panelInforme);
    detailCard.append(tabs, tabPanels);
    detailCard.append(buildOtOperationalDetailPanel(selectedOT, actions, ro, isPatchingOtOperational));
    mountJarvisOrb(detailCard, selectedOT);
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
  heroBand.append(header, flowStrip, ...(offlineBanner ? [offlineBanner] : []), climaToolbar);

  const statsBand = document.createElement('div');
  statsBand.className = 'hnf-clima__stats';
  statsBand.append(cards);

  const workBand = document.createElement('div');
  workBand.className = 'hnf-clima__body';
  workBand.append(formCard, overview);

  section.append(heroBand, statsBand, workBand);

  return section;
};

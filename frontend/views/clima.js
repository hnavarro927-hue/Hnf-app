import { createCard } from '../components/card.js';
import { mergeEquipoChecklist } from '../constants/hvacChecklist.js';
import { otFormDefinition } from '../config/form-definitions.js';
import { buildOtOperationalBrief } from '../domain/operational-intelligence.js';
import { monthRangeYmd } from '../domain/hnf-intelligence-engine.js';
import { formatAllCloseBlockersMessage, otCanClose } from '../utils/ot-evidence.js';
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
  const wrap = document.createElement('div');
  wrap.className = 'form-field ot-evidence-block';

  const lb = document.createElement('span');
  lb.className = 'form-field__label';
  lb.textContent = title;

  const preview = document.createElement('div');
  preview.className = 'ot-evidence-preview';

  const rerender = () => {
    preview.innerHTML = '';
    const list = evidenceStore[fieldKey] || [];
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
      nameEl.title = item.name || '';

      const actions = document.createElement('div');
      actions.className = 'ot-evidence-actions';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'secondary-button ot-evidence-open';
      openBtn.textContent = 'Abrir';
      openBtn.disabled = !item.url;
      openBtn.addEventListener('click', () => {
        if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
      });

      actions.append(openBtn);
      if (!readOnly) {
        const rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'secondary-button';
        rmBtn.textContent = 'Quitar';
        rmBtn.addEventListener('click', () => {
          const arr = evidenceStore[fieldKey];
          const idx = arr.findIndex((x) => x.id === item.id);
          if (idx !== -1) arr.splice(idx, 1);
          rerender();
        });
        actions.append(rmBtn);
      }

      meta.append(nameEl, actions);
      card.append(meta);
      preview.append(card);
    });
  };

  wrap.append(lb, preview);

  if (!readOnly) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = 'image/*';
    inp.addEventListener('change', async () => {
      const added = await readFilesAsEvidence(inp);
      evidenceStore[fieldKey] = added.map((a) => ({
        id: newLocalEvidenceId(),
        name: a.name,
        url: a.url,
        createdAt: new Date().toISOString(),
      }));
      inp.value = '';
      rerender();
    });
    wrap.append(inp);
  }

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

const createStatusBadge = (status) => {
  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${(status || 'pendiente').replace(/\s+/g, '-')}`;
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
      button.append(createStatusBadge(item.estado));
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
  detailCard.className = 'ot-detail-card';

  if (!selectedOT) {
    detailCard.innerHTML =
      '<h3>Detalle de la visita</h3><p class="muted">Creá una orden arriba o elegí una del listado del medio.</p>';
  } else {
    const ro = selectedOT.estado === 'terminado';
    const titleRow = document.createElement('div');
    titleRow.className = 'ot-detail-card__header';
    const titleBlock = document.createElement('div');
    titleBlock.innerHTML = `<p class="muted">Paso 3 · Detalle y cierre</p><h3>${selectedOT.id} · ${selectedOT.cliente}</h3>`;
    titleRow.append(titleBlock, createStatusBadge(selectedOT.estado));
    detailCard.append(
      titleRow,
      buildOtOperationalDetailPanel(selectedOT, actions, ro, isPatchingOtOperational)
    );
    if (intelGuidance?.recordLabel && selectedOT.id === intelGuidance.recordLabel) {
      detailCard.classList.add('is-intel-detail-focus');
    }

    const summaryGrid = document.createElement('div');
    summaryGrid.className = 'ot-summary-grid';
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
    const lastHist = (() => {
      const h = selectedOT.historial;
      if (!Array.isArray(h) || !h.length) return null;
      return h[h.length - 1];
    })();
    const audit = document.createElement('div');
    audit.className = 'ot-audit-strip';
    audit.setAttribute('role', 'region');
    audit.setAttribute('aria-label', 'Auditoría y trazabilidad');
    const lh = lastHist;
    const histLine = lh
      ? `${lh.accion || '—'}${lh.detalle ? ` · ${lh.detalle}` : ''}${lh.actor ? ` · por ${lh.actor}` : ''} · ${formatAuditTs(lh.at)}`
      : 'Sin movimientos en historial todavía.';
    audit.innerHTML = `
      <p class="ot-audit-strip__line"><strong>Última actualización (servidor):</strong> ${formatAuditTs(selectedOT.updatedAt)}</p>
      <p class="ot-audit-strip__line"><strong>Alta:</strong> ${formatAuditTs(selectedOT.createdAt || selectedOT.creadoEn)} · <strong>Creado por:</strong> ${selectedOT.creadoPor || '—'} · <strong>Último cambio por:</strong> ${selectedOT.actualizadoPor || '—'}</p>
      <p class="ot-audit-strip__line"><strong>Última acción registrada:</strong> ${histLine}</p>
    `;

    const blockB = document.createElement('section');
    blockB.className = 'ot-exec-block ot-exec-block--b-datos';
    const bTitle = document.createElement('h3');
    bTitle.className = 'ot-exec-block__title';
    bTitle.textContent = 'B · Datos automáticos (solo lectura)';
    blockB.append(bTitle, summaryGrid, audit);

    const blockA = document.createElement('section');
    blockA.className = 'ot-exec-block ot-exec-block--a-trabajo';
    const aTitle = document.createElement('h3');
    aTitle.className = 'ot-exec-block__title';
    aTitle.textContent = ro ? 'A · Registro de visita' : 'A · Completar ahora';
    blockA.append(aTitle);

    if (selectedOT.estado !== 'terminado') {
      const visitWrap = document.createElement('div');
      visitWrap.className = 'ot-visit-text';
      const vtTitle = document.createElement('h3');
      vtTitle.className = 'ot-section-title';
      vtTitle.textContent = 'Resumen de visita (obligatorio para cerrar OT)';
      const vtHint = document.createElement('p');
      vtHint.className = 'muted';
      vtHint.textContent =
        'Completá y guardá resumen, recomendaciones y observaciones antes de usar «Cerrar OT».';

      const vGrid = document.createElement('div');
      vGrid.className = 'ot-form__grid';

      const mkTa = (name, label, value) => {
        const w = document.createElement('label');
        w.className = 'form-field';
        const lb = document.createElement('span');
        lb.className = 'form-field__label';
        lb.textContent = label;
        const ta = document.createElement('textarea');
        ta.name = name;
        ta.rows = 3;
        ta.value = value || '';
        w.append(lb, ta);
        return w;
      };

      vGrid.append(
        mkTa('visitObs', 'Observaciones generales', selectedOT.observaciones),
        mkTa('visitResumen', 'Resumen del trabajo', selectedOT.resumenTrabajo),
        mkTa('visitReco', 'Recomendaciones generales', selectedOT.recomendaciones)
      );

      const saveVisit = document.createElement('button');
      saveVisit.type = 'button';
      saveVisit.className = 'primary-button';
      saveVisit.textContent = isSavingVisitText ? 'Guardando…' : 'Guardar resumen de visita';
      saveVisit.disabled = Boolean(isSavingVisitText || isClosingOT || isSavingOtEconomics);
      saveVisit.addEventListener('click', async () => {
        const obs = vGrid.querySelector('[name=visitObs]')?.value?.trim() ?? '';
        const res = vGrid.querySelector('[name=visitResumen]')?.value?.trim() ?? '';
        const rec = vGrid.querySelector('[name=visitReco]')?.value?.trim() ?? '';
        await actions.saveVisitText(selectedOT.id, {
          observaciones: obs,
          resumenTrabajo: res,
          recomendaciones: rec,
        });
      });

      visitWrap.append(vtTitle, vtHint, vGrid, saveVisit);
      blockA.append(visitWrap);
    }

    const equiposTitle = document.createElement('h3');
    equiposTitle.className = 'ot-section-title';
    equiposTitle.textContent = 'Equipos de la OT';
    blockA.append(equiposTitle);

    const detailEqHost = document.createElement('div');
    detailEqHost.className = 'ot-detail-equipos-host';

    const initialEquipos =
      selectedOT.equipos?.length > 0 ? selectedOT.equipos : [{}];
    initialEquipos.forEach((eq, idx) => {
      detailEqHost.append(buildDetailEquipoRow(eq, idx, selectedOT.estado === 'terminado'));
    });

    const addDetailEq = document.createElement('button');
    addDetailEq.type = 'button';
    addDetailEq.className = 'secondary-button';
    addDetailEq.textContent = '+ Agregar equipo';
    addDetailEq.disabled = Boolean(
      isSavingEquipos || isSavingOtEconomics || selectedOT.estado === 'terminado'
    );
    addDetailEq.addEventListener('click', () => {
      if (detailEqHost.querySelectorAll('.ot-equipo-detail-row').length >= MAX_EQUIPOS) return;
      if (selectedOT.estado === 'terminado') return;
      const n = detailEqHost.querySelectorAll('.ot-equipo-detail-row').length;
      detailEqHost.append(
        buildDetailEquipoRow({ id: `eq-new-${Date.now()}-${n}` }, n, false)
      );
    });

    const saveEq = document.createElement('button');
    saveEq.type = 'button';
    saveEq.className = 'primary-button';
    saveEq.textContent = isSavingEquipos ? 'Guardando…' : 'Guardar equipos y fotos';
    saveEq.disabled = Boolean(
      isSavingEquipos || isClosingOT || isSavingOtEconomics || selectedOT.estado === 'terminado'
    );
    saveEq.addEventListener('click', async () => {
      const built = collectEquiposFromDetail(detailEqHost, selectedOT);
      await actions.saveEquipos(selectedOT.id, built);
    });

    const eqToolbar = document.createElement('div');
    eqToolbar.className = 'ot-equipos-toolbar';
    eqToolbar.append(addDetailEq, saveEq);
    blockA.append(detailEqHost, eqToolbar);

    const pdfRow = document.createElement('div');
    pdfRow.className = 'ot-pdf-actions';
    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.className = 'secondary-button';
    pdfBtn.textContent = isGeneratingPdf ? 'Generando…' : 'Generar informe (PDF borrador)';
    pdfBtn.disabled = Boolean(isGeneratingPdf || isClosingOT || isSavingOtEconomics);
    pdfBtn.addEventListener('click', async () => {
      await actions.generatePdfFromOt(selectedOT);
    });
    const pdfHelp = document.createElement('p');
    pdfHelp.className = 'muted';
    pdfHelp.textContent = 'No cierra la OT: solo abre un PDF con lo que hay ahora para revisar o imprimir.';
    pdfRow.append(pdfBtn, pdfHelp);
    blockA.append(pdfRow);

    if (selectedOT.pdfUrl && selectedOT.pdfName) {
      const reportRow = document.createElement('div');
      reportRow.className = 'report-actions';
      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'secondary-button';
      viewBtn.textContent = 'Ver informe guardado';
      viewBtn.addEventListener('click', () => {
        window.open(selectedOT.pdfUrl, '_blank', 'noopener,noreferrer');
      });
      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'secondary-button';
      dlBtn.textContent = 'Descargar informe';
      dlBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = selectedOT.pdfUrl;
        a.download = selectedOT.pdfName;
        a.rel = 'noopener';
        document.body.append(a);
        a.click();
        a.remove();
      });
      reportRow.append(viewBtn, dlBtn);
      blockA.append(reportRow);
    }

    detailCard.append(blockA, blockB);

    const blockC = document.createElement('section');
    blockC.className = 'ot-exec-block ot-exec-block--c-evidencia';
    const cTitle = document.createElement('h3');
    cTitle.className = 'ot-exec-block__title';
    cTitle.textContent = 'C · Evidencia a nivel visita (fotos)';
    const legTitle = document.createElement('h4');
    legTitle.className = 'ot-exec-block__sub';
    legTitle.textContent = 'Antes / durante / después (OT sin equipos o legado)';
    const evidenceGrid = document.createElement('div');
    evidenceGrid.className = 'evidence-grid';
    evidenceGrid.append(
      createEvidenceSection('Antes (OT)', selectedOT.fotografiasAntes),
      createEvidenceSection('Durante (OT)', selectedOT.fotografiasDurante),
      createEvidenceSection('Después (OT)', selectedOT.fotografiasDespues)
    );
    blockC.append(cTitle, legTitle, evidenceGrid);
    detailCard.append(blockC);

    const blockD = document.createElement('section');
    blockD.className = 'ot-exec-block ot-exec-block--d-cierre';
    const dTitle = document.createElement('h3');
    dTitle.className = 'ot-exec-block__title';
    dTitle.textContent = 'D · Cierre (checklist, economía y estado)';
    blockD.append(dTitle);

    if (selectedOT.estado !== 'terminado') {
      const brief = buildOtOperationalBrief(selectedOT, { economicsSaved: otEconomicsSaved });
      const opPanel = document.createElement('div');
      opPanel.className = 'hnf-operational-context hnf-operational-context--clima';
      opPanel.setAttribute('data-hnf-domain', 'clima-ot');
      opPanel.setAttribute('data-hnf-schema', brief.schema);
      const opTitle = document.createElement('h4');
      opTitle.className = 'hnf-operational-context__title';
      opTitle.textContent = 'Checklist operativo (cierre)';
      if (!brief.blockers.length) {
        const ok = document.createElement('p');
        ok.className = 'hnf-operational-context__ok';
        ok.textContent =
          'Sin bloqueos detectados en este resumen. Confirmá siempre con «Guardar» en cada bloque y con el servidor antes de «Cerrar OT».';
        opPanel.append(opTitle, ok);
      } else {
        const ul = document.createElement('ul');
        ul.className = 'hnf-operational-context__list';
        brief.blockers.forEach((b) => {
          const li = document.createElement('li');
          li.textContent = b.detail;
          ul.append(li);
        });
        opPanel.append(opTitle, ul);
      }
      blockD.append(opPanel);
    }

    let updateCloseButtonState = () => {};

    const econModern = document.createElement('div');
    econModern.className = 'ot-economics-modern';

    const econHead = document.createElement('div');
    econHead.className = 'ot-economics-modern__head';
    const econTitle = document.createElement('h3');
    econTitle.className = 'ot-economics-modern__title';
    econTitle.textContent = 'Resultado económico (CLP · panel interno)';
    const econHint = document.createElement('p');
    econHint.className = 'muted ot-economics-modern__hint';
    econHint.textContent = ro
      ? 'Valores guardados al cerrar la visita. Solo lectura.'
      : 'Los indicadores grandes se calculan al instante al escribir. Guardá para grabar en el servidor. Para usar «Cerrar OT» necesitás monto cobrado y costo total (suma de costos) mayores que cero.';
    const econSavedRow = document.createElement('p');
    econSavedRow.className =
      ro || otEconomicsSaved
        ? 'ot-econ-saved-badge ot-econ-saved-badge--ok'
        : 'ot-econ-saved-badge ot-econ-saved-badge--pending';
    econSavedRow.setAttribute('role', 'status');
    econSavedRow.textContent = ro
      ? '✔ Resultado económico guardado (OT cerrada).'
      : otEconomicsSaved
        ? '✔ Resultado económico guardado'
        : '⚠ Cambios pendientes por guardar';
    econHead.append(econTitle, econHint, econSavedRow);

    const econLiveRoot = document.createElement('div');
    econLiveRoot.className = 'ot-economics-live-root';

    const inputsRow = document.createElement('div');
    inputsRow.className = 'ot-econ-inputs-grid';

    const mkCostCard = (name, label, value) => {
      const card = document.createElement('div');
      card.className = 'ot-econ-field-card';
      const lb = document.createElement('span');
      lb.className = 'ot-econ-field-card__label';
      lb.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0';
      inp.step = 'any';
      inp.name = name;
      inp.value = String(value ?? 0);
      inp.className = 'ot-econ-field-card__input';
      inp.readOnly = ro;
      card.append(lb, inp);
      return card;
    };

    if (!ro) {
      inputsRow.append(
        mkCostCard('costoMateriales', 'Materiales', selectedOT.costoMateriales),
        mkCostCard('costoManoObra', 'Mano de obra', selectedOT.costoManoObra),
        mkCostCard('costoTraslado', 'Traslado', selectedOT.costoTraslado),
        mkCostCard('costoOtros', 'Otros', selectedOT.costoOtros),
        mkCostCard('montoCobrado', 'Monto cobrado (CLP)', selectedOT.montoCobrado)
      );
    }

    const kpiRow = document.createElement('div');
    kpiRow.className = 'ot-econ-kpi-row';

    const mkKpi = (label, variantClass) => {
      const card = document.createElement('div');
      card.className = `ot-econ-kpi ${variantClass}`.trim();
      const lb = document.createElement('span');
      lb.className = 'ot-econ-kpi__label';
      lb.textContent = label;
      const val = document.createElement('span');
      val.className = 'ot-econ-kpi__value';
      val.textContent = formatClp(0);
      card.append(lb, val);
      return { card, val };
    };

    const kCosto = mkKpi('Costo total (CLP)', 'ot-econ-kpi--costo');
    const kMonto = mkKpi('Monto cobrado (CLP)', 'ot-econ-kpi--ingreso');
    const kUtil = mkKpi('Utilidad (CLP)', 'ot-econ-kpi--util ot-econ-kpi--neutral');
    const kMar = mkKpi('Margen %', 'ot-econ-kpi--margen');

    kpiRow.append(kCosto.card, kMonto.card, kUtil.card, kMar.card);

    if (!ro) {
      econLiveRoot.append(inputsRow, kpiRow);
    } else {
      econLiveRoot.append(kpiRow);
    }

    const updateLiveEconomics = () => {
      if (ro) {
        const ct = roundEcon(selectedOT.costoTotal);
        const mc = roundEcon(selectedOT.montoCobrado);
        const ut = roundEcon(selectedOT.utilidad ?? mc - ct);
        const mp = mc > 0 ? roundEcon((ut / mc) * 100) : null;
        kCosto.val.textContent = formatClp(ct);
        kMonto.val.textContent = formatClp(mc);
        kUtil.val.textContent = formatClp(ut);
        kMar.val.textContent = mc > 0 && mp != null ? `${mp.toFixed(1)}%` : '—';
        kUtil.card.className = `ot-econ-kpi ot-econ-kpi--util ${utilidadToneClass(ut, mc)}`.trim();
        return;
      }
      const { costoTotal, monto, utilidad, margenPct } = computeLiveEconomicsFrom(econLiveRoot);
      kCosto.val.textContent = formatClp(costoTotal);
      kMonto.val.textContent = formatClp(monto);
      kUtil.val.textContent = formatClp(utilidad);
      kMar.val.textContent = monto > 0 && margenPct != null ? `${margenPct.toFixed(1)}%` : '—';
      kUtil.card.className = `ot-econ-kpi ot-econ-kpi--util ${utilidadToneClass(utilidad, monto)}`.trim();
    };

    updateLiveEconomics();

    if (!ro) {
      inputsRow.querySelectorAll('input').forEach((inp) => {
        inp.addEventListener('input', () => {
          actions?.invalidateOtEconomicsSaved?.();
          updateLiveEconomics();
          updateCloseButtonState();
        });
      });
    }

    const saveEcon = document.createElement('button');
    saveEcon.type = 'button';
    saveEcon.className = 'primary-button ot-economics-modern__save';
    saveEcon.textContent = isSavingOtEconomics ? 'Guardando…' : 'Guardar resultado económico';
    saveEcon.title = 'Envía materiales, mano de obra, traslado, otros y monto cobrado al servidor.';
    saveEcon.disabled = Boolean(
      ro || isSavingOtEconomics || isClosingOT || isSavingEquipos || isSavingVisitText
    );
    saveEcon.addEventListener('click', async () => {
      const q = (n) => econLiveRoot.querySelector(`[name="${n}"]`);
      await actions.saveOtEconomics(selectedOT.id, {
        costoMateriales: parseMoneyInput(q('costoMateriales')?.value),
        costoManoObra: parseMoneyInput(q('costoManoObra')?.value),
        costoTraslado: parseMoneyInput(q('costoTraslado')?.value),
        costoOtros: parseMoneyInput(q('costoOtros')?.value),
        montoCobrado: parseMoneyInput(q('montoCobrado')?.value),
      });
    });

    econModern.append(econHead, econLiveRoot);
    if (!ro) econModern.append(saveEcon);
    blockD.append(econModern);

    const statusActions = document.createElement('div');
    statusActions.className = 'status-actions';
    statusActions.innerHTML = '<p class="muted">Cambiar estado (sin cerrar definitivamente)</p>';
    const statusButtons = document.createElement('div');
    statusButtons.className = 'status-actions__buttons';

    ['pendiente', 'en proceso', 'terminado'].forEach((status) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `secondary-button ${selectedOT.estado === status ? 'is-active' : ''}`.trim();
      button.textContent = status;
      button.disabled = Boolean(isUpdatingStatus || isSavingOtEconomics);
      button.addEventListener('click', async () => {
        if (status === selectedOT.estado) return;
        await actions.updateOTStatus(selectedOT.id, status);
      });
      statusButtons.append(button);
    });
    statusActions.append(statusButtons);

    const closeWrap = document.createElement('div');
    closeWrap.className = 'status-actions status-actions--close';
    const closeLabel = document.createElement('p');
    closeLabel.className = 'muted';
    closeLabel.textContent =
      'Cierre definitivo: la OT pasa a terminada, se genera el PDF con los datos ya guardados en el servidor y queda el informe archivado. Requisitos: fotos por equipo, checklist completo, resumen y recomendaciones; resultado económico guardado con monto cobrado y costo total mayores que cero (si tocaste los importes, guardá antes o se guardarán al intentar cerrar).';
    const canCloseNow = selectedOT.estado === 'terminado' || otCanClose(selectedOT);
    if (!canCloseNow && selectedOT.estado !== 'terminado') {
      const gapHint = document.createElement('p');
      gapHint.className = 'ot-close-hint';
      gapHint.textContent = formatAllCloseBlockersMessage(selectedOT);
      closeWrap.append(closeLabel, gapHint);
    } else {
      closeWrap.append(closeLabel);
    }
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'primary-button';
    closeBtn.textContent = isClosingOT ? 'Procesando…' : 'Cerrar OT e informe final';

    updateCloseButtonState = () => {
      if (selectedOT.estado === 'terminado') {
        closeBtn.disabled = true;
        closeBtn.title = '';
        return;
      }
      const mcSrv = roundEcon(selectedOT.montoCobrado);
      const ctSrv = roundEcon(selectedOT.costoTotal);
      const econBlocked =
        !otEconomicsSaved || mcSrv <= 0 || ctSrv <= 0;
      const evidenceOk = otCanClose(selectedOT);
      closeBtn.disabled = Boolean(
        isClosingOT ||
          isUploadingEvidence ||
          isSavingEquipos ||
          isSavingVisitText ||
          isSavingOtEconomics ||
          !evidenceOk ||
          econBlocked
      );
      const hints = [];
      if (!evidenceOk) hints.push(formatAllCloseBlockersMessage(selectedOT));
      if (!otEconomicsSaved) {
        hints.push('Guardá el resultado económico en el servidor (botón Guardar). Si ya cargaste los montos, se intentará guardar automáticamente al cerrar.');
      } else if (mcSrv <= 0 || ctSrv <= 0) {
        hints.push(
          'En el servidor el monto cobrado y el costo total deben ser mayores que cero. Ajustá y guardá de nuevo.'
        );
      }
      closeBtn.title = hints.filter(Boolean).join(' ');
    };

    updateCloseButtonState();

    closeBtn.addEventListener('click', async () => {
      const collectEconPayload = () => {
        const q = (n) => econLiveRoot.querySelector(`[name="${n}"]`);
        return {
          costoMateriales: parseMoneyInput(q('costoMateriales')?.value),
          costoManoObra: parseMoneyInput(q('costoManoObra')?.value),
          costoTraslado: parseMoneyInput(q('costoTraslado')?.value),
          costoOtros: parseMoneyInput(q('costoOtros')?.value),
          montoCobrado: parseMoneyInput(q('montoCobrado')?.value),
        };
      };
      await actions.closeAndGenerateReport(selectedOT, collectEconPayload());
    });
    closeWrap.append(closeBtn);
    statusActions.append(closeWrap);
    blockD.append(statusActions);

    if (selectedOT.estado === 'terminado') {
      const textBlocks = document.createElement('div');
      textBlocks.className = 'ot-text-blocks';
      [
        ['Observaciones generales', selectedOT.observaciones || '—'],
        ['Resumen del trabajo', selectedOT.resumenTrabajo || '—'],
        ['Recomendaciones generales', selectedOT.recomendaciones || '—'],
      ].forEach(([label, value]) => {
        const block = document.createElement('article');
        block.className = 'ot-text-card';
        block.innerHTML = `<h4>${label}</h4><p class="muted">${value}</p>`;
        textBlocks.append(block);
      });
      blockD.append(textBlocks);
    }

    detailCard.append(blockD);

    detailCard.append(createClientPreview(selectedOT));
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

  section.append(header, flowStrip, ...(offlineBanner ? [offlineBanner] : []), climaToolbar, cards, formCard, overview);

  return section;
};

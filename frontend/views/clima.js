import { createCard } from '../components/card.js';
import { otFormDefinition } from '../config/form-definitions.js';
import {
  formatEvidenceGapsMessage,
  getEvidenceGaps,
} from '../utils/ot-evidence.js';

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
    out.push({
      nombreEquipo: nombre,
      estadoEquipo: estado,
      observaciones,
      accionesRealizadas,
      recomendaciones,
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

    out.push({
      id: base.id || eid || `eq-${Date.now()}-${i}`,
      nombreEquipo: nombre,
      estadoEquipo: estado,
      observaciones,
      accionesRealizadas,
      recomendaciones,
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

export const climaView = ({
  data,
  actions,
  feedback,
  isSubmitting,
  isUpdatingStatus,
  isClosingOT,
  isUploadingEvidence,
  isGeneratingPdf,
  isSavingEquipos,
  selectedOTId,
} = {}) => {
  const section = document.createElement('section');
  section.className = 'ot-workspace';

  const header = document.createElement('div');
  header.innerHTML =
    '<h2>Clima · OT en terreno</h2><p class="muted">Equipos (hasta 12), evidencias por equipo, informe PDF.</p>';

  const ots = [...(data?.data || [])].reverse();
  const selectedOT = ots.find((item) => item.id === selectedOTId) || ots[0] || null;
  const pendingCount = ots.filter((item) => item.estado === 'pendiente').length;
  const inProgressCount = ots.filter((item) => item.estado === 'en proceso').length;
  const eqTotal = ots.reduce((t, o) => t + (o.equipos?.length || 0), 0);

  const cards = document.createElement('div');
  cards.className = 'cards';
  [
    {
      title: 'OT',
      description: 'Operación.',
      items: [`Total: ${ots.length}`, `Pendientes: ${pendingCount}`, `En proceso: ${inProgressCount}`],
    },
    {
      title: 'Equipos',
      description: 'Registrados en todas las OT.',
      items: [`Total equipos: ${eqTotal}`, `Máx. por OT: ${MAX_EQUIPOS}`],
    },
    {
      title: 'Cierre',
      description: 'Informe.',
      items: ['PDF por equipo', 'Estado terminado con evidencias completas'],
    },
  ].forEach((item) => cards.append(createCard(item)));

  const formCard = document.createElement('article');
  formCard.className = 'ot-form-card';

  const formHeader = document.createElement('div');
  formHeader.className = 'ot-form-card__header';
  formHeader.innerHTML = `
    <div>
      <p class="muted">Nueva OT</p>
      <h3>Crear orden de trabajo</h3>
    </div>
  `;

  if (feedback?.message) {
    const feedbackBox = document.createElement('div');
    feedbackBox.className = `form-feedback form-feedback--${feedback.type}`;
    feedbackBox.textContent = feedback.message;
    formHeader.append(feedbackBox);
  }

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
  submitButton.textContent = isSubmitting ? 'Guardando...' : 'Crear OT';
  submitButton.disabled = Boolean(isSubmitting);
  footer.append(submitButton);
  form.append(footer);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const equipos = collectEquiposFromCreateForm(eqContainer);
    const payload = {
      cliente: form.elements.cliente.value.trim(),
      direccion: form.elements.direccion.value.trim(),
      comuna: form.elements.comuna.value.trim(),
      contactoTerreno: form.elements.contactoTerreno.value.trim(),
      telefonoContacto: form.elements.telefonoContacto.value.trim(),
      tipoServicio: form.elements.tipoServicio.value,
      subtipoServicio: form.elements.subtipoServicio.value.trim(),
      tecnicoAsignado: form.elements.tecnicoAsignado.value.trim(),
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
    '<div class="ot-list-card__header"><h3>Listado de OT</h3><p class="muted">Seleccioná una para operar.</p></div>';

  const list = document.createElement('div');
  list.className = 'ot-list';

  if (!ots.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No hay OT.';
    list.append(empty);
  } else {
    ots.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ot-list__item ${selectedOT?.id === item.id ? 'is-active' : ''}`.trim();
      button.innerHTML = `
        <div>
          <span class="ot-list__id muted">${item.id}</span>
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

  const detailCard = document.createElement('article');
  detailCard.className = 'ot-detail-card';

  if (!selectedOT) {
    detailCard.innerHTML = '<h3>Detalle</h3><p class="muted">Creá una OT o elegí una del listado.</p>';
  } else {
    if (feedback?.message) {
      const detailFeedback = document.createElement('div');
      detailFeedback.className = `form-feedback form-feedback--${feedback.type} detail-feedback`;
      detailFeedback.textContent = feedback.message;
      detailCard.append(detailFeedback);
    }

    const titleRow = document.createElement('div');
    titleRow.className = 'ot-detail-card__header';
    const titleBlock = document.createElement('div');
    titleBlock.innerHTML = `<p class="muted">Detalle OT</p><h3>${selectedOT.id} · ${selectedOT.cliente}</h3>`;
    titleRow.append(titleBlock, createStatusBadge(selectedOT.estado));
    detailCard.append(titleRow);

    const summaryGrid = document.createElement('div');
    summaryGrid.className = 'ot-summary-grid';
    [
      ['Dirección', selectedOT.direccion],
      ['Comuna', selectedOT.comuna],
      ['Contacto', selectedOT.contactoTerreno],
      ['Teléfono', selectedOT.telefonoContacto],
      ['Técnico', selectedOT.tecnicoAsignado],
      ['Tipo / subtipo', `${selectedOT.tipoServicio} / ${selectedOT.subtipoServicio}`],
      ['Fecha / hora', `${selectedOT.fecha} · ${selectedOT.hora}`],
    ].forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'ot-summary-item';
      row.innerHTML = `<span>${label}</span><strong>${value || '—'}</strong>`;
      summaryGrid.append(row);
    });
    detailCard.append(summaryGrid);

    const equiposTitle = document.createElement('h3');
    equiposTitle.className = 'ot-section-title';
    equiposTitle.textContent = 'Equipos de la OT';
    detailCard.append(equiposTitle);

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
    addDetailEq.disabled = Boolean(isSavingEquipos || selectedOT.estado === 'terminado');
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
    saveEq.textContent = isSavingEquipos ? 'Guardando equipos...' : 'Guardar equipos';
    saveEq.disabled = Boolean(
      isSavingEquipos || isClosingOT || selectedOT.estado === 'terminado'
    );
    saveEq.addEventListener('click', async () => {
      const built = collectEquiposFromDetail(detailEqHost, selectedOT);
      await actions.saveEquipos(selectedOT.id, built);
    });

    const eqToolbar = document.createElement('div');
    eqToolbar.className = 'ot-equipos-toolbar';
    eqToolbar.append(addDetailEq, saveEq);
    detailCard.append(detailEqHost, eqToolbar);

    const pdfRow = document.createElement('div');
    pdfRow.className = 'ot-pdf-actions';
    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.className = 'secondary-button';
    pdfBtn.textContent = isGeneratingPdf ? 'Generando PDF...' : 'Generar PDF (informe actual)';
    pdfBtn.disabled = Boolean(isGeneratingPdf || isClosingOT);
    pdfBtn.addEventListener('click', async () => {
      await actions.generatePdfFromOt(selectedOT);
    });
    const pdfHelp = document.createElement('p');
    pdfHelp.className = 'muted';
    pdfHelp.textContent = 'Informe técnico con datos y equipos actuales.';
    pdfRow.append(pdfBtn, pdfHelp);
    detailCard.append(pdfRow);

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
      detailCard.append(reportRow);
    }

    const statusActions = document.createElement('div');
    statusActions.className = 'status-actions';
    statusActions.innerHTML = '<p class="muted">Estado de la OT</p>';
    const statusButtons = document.createElement('div');
    statusButtons.className = 'status-actions__buttons';

    ['pendiente', 'en proceso', 'terminado'].forEach((status) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `secondary-button ${selectedOT.estado === status ? 'is-active' : ''}`.trim();
      button.textContent = status;
      button.disabled = Boolean(isUpdatingStatus);
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
      'Cerrar y generar informe: pasa a terminado, PDF y guardado en la OT (cada equipo debe tener al menos una foto con archivo en ANTES, DURANTE y DESPUÉS).';
    const closeGaps = getEvidenceGaps(selectedOT);
    if (closeGaps.length && selectedOT.estado !== 'terminado') {
      const gapHint = document.createElement('p');
      gapHint.className = 'ot-close-hint';
      gapHint.textContent = formatEvidenceGapsMessage(closeGaps);
      closeWrap.append(closeLabel, gapHint);
    } else {
      closeWrap.append(closeLabel);
    }
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'primary-button';
    closeBtn.textContent = isClosingOT ? 'Procesando...' : 'Cerrar y generar informe';
    closeBtn.disabled = Boolean(isClosingOT || isUploadingEvidence || isSavingEquipos || selectedOT.estado === 'terminado');
    if (closeGaps.length && selectedOT.estado !== 'terminado') {
      closeBtn.title = formatEvidenceGapsMessage(closeGaps);
    }
    closeBtn.addEventListener('click', async () => {
      await actions.closeAndGenerateReport(selectedOT);
    });
    closeWrap.append(closeBtn);
    statusActions.append(closeWrap);
    detailCard.append(statusActions);

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
    detailCard.append(textBlocks);

    const legTitle = document.createElement('h4');
    legTitle.textContent = 'Evidencias a nivel visita (OT sin equipos o legado)';
    detailCard.append(legTitle);
    const evidenceGrid = document.createElement('div');
    evidenceGrid.className = 'evidence-grid';
    evidenceGrid.append(
      createEvidenceSection('Antes (OT)', selectedOT.fotografiasAntes),
      createEvidenceSection('Durante (OT)', selectedOT.fotografiasDurante),
      createEvidenceSection('Después (OT)', selectedOT.fotografiasDespues)
    );
    detailCard.append(evidenceGrid);

    detailCard.append(createClientPreview(selectedOT));
  }

  overview.append(listCard, detailCard);
  section.append(header, cards, formCard, overview);

  return section;
};

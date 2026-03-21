import { createCard } from '../components/card.js';
import { otFormDefinition } from '../config/form-definitions.js';

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

const getFileNames = (form, fieldName) =>
  Array.from(form.elements[fieldName]?.files || []).map((file) => file.name);

const createStatusBadge = (status) => {
  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${(status || 'pendiente').replace(/\s+/g, '-')}`;
  badge.textContent = status || 'pendiente';
  return badge;
};

const createEvidenceSection = (title, items = []) => {
  const article = document.createElement('article');
  article.className = 'evidence-card';

  const heading = document.createElement('h4');
  heading.textContent = title;

  const list = document.createElement('ul');
  list.className = 'evidence-list';

  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'Sin referencias cargadas todavía.';
    list.append(empty);
  } else {
    items.forEach((item) => {
      const row = document.createElement('li');
      row.innerHTML = `<strong>${item.name}</strong><span class="muted">${item.url || 'Referencia preparada para imagen real'}</span>`;
      list.append(row);
    });
  }

  article.append(heading, list);
  return article;
};

const createPreviewPhotos = (title, items = []) => {
  const block = document.createElement('section');
  block.className = 'preview-photo-section';

  const heading = document.createElement('h4');
  heading.textContent = title;

  const grid = document.createElement('div');
  grid.className = 'preview-photo-grid';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'preview-photo-card is-empty';
    empty.innerHTML = '<strong>Sin evidencias</strong><span>Espacio preparado para imágenes reales</span>';
    grid.append(empty);
  } else {
    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'preview-photo-card';
      card.innerHTML = `
        <div class="preview-photo-card__placeholder">Imagen / referencia</div>
        <strong>${item.name}</strong>
        <span>${item.url || 'Referencia cargada para futura imagen incrustada'}</span>
      `;
      grid.append(card);
    });
  }

  block.append(heading, grid);
  return block;
};

const createClientPreview = (ot) => {
  const article = document.createElement('article');
  article.className = 'preview-sheet';

  const header = document.createElement('header');
  header.className = 'preview-sheet__header';
  header.innerHTML = `
    <div>
      <p class="preview-sheet__eyebrow">HNF Servicios Integrales</p>
      <h3>Vista previa OT / Informe para cliente</h3>
      <p class="muted">Documento preliminar antes de la exportación a PDF.</p>
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
    const block = document.createElement('section');
    block.className = 'preview-text-card';
    block.innerHTML = `<h4>${label}</h4><p>${value}</p>`;
    textSections.append(block);
  });

  const evidence = document.createElement('div');
  evidence.className = 'preview-evidence';
  evidence.append(
    createPreviewPhotos('Evidencias antes', ot.fotografiasAntes || []),
    createPreviewPhotos('Evidencias durante', ot.fotografiasDurante || []),
    createPreviewPhotos('Evidencias después', ot.fotografiasDespues || [])
  );

  article.append(header, summary, textSections, evidence);
  return article;
};

export const climaView = ({
  data,
  actions,
  feedback,
  isSubmitting,
  isUpdatingStatus,
  selectedOTId,
} = {}) => {
  const section = document.createElement('section');
  section.className = 'ot-workspace';

  const header = document.createElement('div');
  header.innerHTML = '<h2>Módulo Clima</h2><p class="muted">Vista conectada al flujo operativo de OT.</p>';

  const ots = data?.data || [];
  const selectedOT = ots.find((item) => item.id === selectedOTId) || ots[ots.length - 1] || null;
  const pendingCount = ots.filter((item) => item.estado === 'pendiente').length;
  const inProgressCount = ots.filter((item) => item.estado === 'en proceso').length;
  const evidenceCount = ots.reduce(
    (total, item) =>
      total +
      (item.fotografiasAntes?.length || 0) +
      (item.fotografiasDurante?.length || 0) +
      (item.fotografiasDespues?.length || 0),
    0
  );

  const cards = document.createElement('div');
  cards.className = 'cards';
  [
    {
      title: 'OT activas',
      description: 'Registro y seguimiento.',
      items: [`Cantidad OT: ${ots.length}`, `Pendientes: ${pendingCount}`, `En proceso: ${inProgressCount}`],
    },
    {
      title: 'Técnicos',
      description: 'Asignación inicial.',
      items: ['Responsables', 'Agenda', 'Terreno'],
    },
    {
      title: 'Evidencias',
      description: 'Documentación base para informe.',
      items: [`Fotos cargadas: ${evidenceCount}`, 'Antes / Durante / Después'],
    },
  ].forEach((item) => cards.append(createCard(item)));

  const formCard = document.createElement('article');
  formCard.className = 'ot-form-card';

  const formHeader = document.createElement('div');
  formHeader.className = 'ot-form-card__header';
  formHeader.innerHTML = `
    <div>
      <p class="muted">Formulario operativo</p>
      <h3>Nueva Orden de Trabajo</h3>
      <p class="muted">La información queda estructurada para una futura vista previa o PDF para cliente.</p>
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

  const footer = document.createElement('div');
  footer.className = 'ot-form__footer';
  footer.innerHTML = '<p class="muted">Estado inicial fijo en pendiente. Las fotografías se agrupan por etapa para el próximo módulo de informe.</p>';

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'primary-button';
  submitButton.textContent = isSubmitting ? 'Guardando OT...' : otFormDefinition.submitLabel;
  submitButton.disabled = Boolean(isSubmitting);

  footer.append(submitButton);
  form.append(footer);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

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
      fotografiasAntes: getFileNames(form, 'fotografiasAntes'),
      fotografiasDurante: getFileNames(form, 'fotografiasDurante'),
      fotografiasDespues: getFileNames(form, 'fotografiasDespues'),
    };

    await actions.createOT(payload);
  });

  formCard.append(formHeader, form);

  const overview = document.createElement('div');
  overview.className = 'ot-overview';

  const listCard = document.createElement('article');
  listCard.className = 'ot-list-card';
  listCard.innerHTML = '<div class="ot-list-card__header"><h3>Listado de OT</h3><p class="muted">Cliente, fecha, tipo y estado actual.</p></div>';

  const list = document.createElement('div');
  list.className = 'ot-list';

  if (!ots.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Aún no hay OT registradas.';
    list.append(empty);
  } else {
    ots.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ot-list__item ${selectedOT?.id === item.id ? 'is-active' : ''}`.trim();
      button.innerHTML = `
        <div>
          <strong>${item.cliente}</strong>
          <span class="muted">${item.fecha} · ${item.tipoServicio} / ${item.subtipoServicio}</span>
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
    detailCard.innerHTML = '<h3>Detalle de OT</h3><p class="muted">Crea una OT para revisar aquí su información y evidencias.</p>';
  } else {
    const titleRow = document.createElement('div');
    titleRow.className = 'ot-detail-card__header';

    const titleBlock = document.createElement('div');
    titleBlock.innerHTML = `<p class="muted">Detalle / resumen OT</p><h3>${selectedOT.id} · ${selectedOT.cliente}</h3>`;
    titleRow.append(titleBlock, createStatusBadge(selectedOT.estado));

    const summaryGrid = document.createElement('div');
    summaryGrid.className = 'ot-summary-grid';

    [
      ['Dirección', selectedOT.direccion],
      ['Comuna', selectedOT.comuna],
      ['Contacto terreno', selectedOT.contactoTerreno],
      ['Teléfono', selectedOT.telefonoContacto],
      ['Técnico', selectedOT.tecnicoAsignado],
      ['Tipo / subtipo', `${selectedOT.tipoServicio} / ${selectedOT.subtipoServicio}`],
      ['Fecha / hora', `${selectedOT.fecha} · ${selectedOT.hora}`],
      ['Cliente relacionado', selectedOT.clienteRelacionado || 'No informado'],
      ['Vehículo relacionado', selectedOT.vehiculoRelacionado || 'No informado'],
    ].forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'ot-summary-item';
      row.innerHTML = `<span>${label}</span><strong>${value || 'No informado'}</strong>`;
      summaryGrid.append(row);
    });

    const textBlocks = document.createElement('div');
    textBlocks.className = 'ot-text-blocks';
    [
      ['Observaciones', selectedOT.observaciones || 'Sin observaciones.'],
      ['Resumen del trabajo', selectedOT.resumenTrabajo || 'Sin resumen de trabajo.'],
      ['Recomendaciones', selectedOT.recomendaciones || 'Sin recomendaciones.'],
    ].forEach(([label, value]) => {
      const block = document.createElement('article');
      block.className = 'ot-text-card';
      block.innerHTML = `<h4>${label}</h4><p class="muted">${value}</p>`;
      textBlocks.append(block);
    });

    const statusActions = document.createElement('div');
    statusActions.className = 'status-actions';
    statusActions.innerHTML = '<p class="muted">Actualizar estado</p>';

    const statusButtons = document.createElement('div');
    statusButtons.className = 'status-actions__buttons';

    ['pendiente', 'en proceso', 'terminado'].forEach((status) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `secondary-button ${selectedOT.estado === status ? 'is-active' : ''}`.trim();
      button.textContent = status;
      button.disabled = Boolean(isUpdatingStatus && selectedOT.estado !== status);
      button.addEventListener('click', async () => {
        if (status === selectedOT.estado) return;
        await actions.updateOTStatus(selectedOT.id, status);
      });
      statusButtons.append(button);
    });

    statusActions.append(statusButtons);

    const evidenceGrid = document.createElement('div');
    evidenceGrid.className = 'evidence-grid';
    evidenceGrid.append(
      createEvidenceSection('Fotografías antes', selectedOT.fotografiasAntes || []),
      createEvidenceSection('Fotografías durante', selectedOT.fotografiasDurante || []),
      createEvidenceSection('Fotografías después', selectedOT.fotografiasDespues || [])
    );

    const previewCard = document.createElement('div');
    previewCard.className = 'preview-wrapper';
    previewCard.append(createClientPreview(selectedOT));

    detailCard.append(titleRow, summaryGrid, statusActions, textBlocks, evidenceGrid, previewCard);
  }

  overview.append(listCard, detailCard);
  section.append(header, cards, formCard, overview);

  return section;
};
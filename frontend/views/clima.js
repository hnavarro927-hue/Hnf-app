import { createCard } from '../components/card.js';
import { otFormDefinition } from '../config/form-definitions.js';

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

const createEvidenceBlock = (selectedOT, fieldKey, title, actions, isUploading) => {
  const article = document.createElement('article');
  article.className = 'evidence-card';

  const items = selectedOT[fieldKey] || [];
  const heading = document.createElement('h4');
  heading.textContent = `${title} (${items.length})`;

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
      row.innerHTML = `<strong>${item.name}</strong><span class="muted">${item.url ? 'Archivo cargado' : 'Sin URL'}</span>`;
      list.append(row);
    });
  }

  const manager = document.createElement('div');
  manager.className = 'evidence-manager';

  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*';
  input.className = 'evidence-manager__input';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'secondary-button evidence-manager__btn';
  btn.textContent = isUploading ? 'Enviando evidencias...' : 'Agregar evidencias a este bloque';
  btn.disabled = Boolean(isUploading);

  btn.addEventListener('click', async () => {
    const files = Array.from(input.files || []);
    if (!files.length) {
      actions.showFeedback({
        type: 'error',
        message: 'Selecciona al menos un archivo para este bloque.',
      });
      return;
    }
    const evidences = [];
    for (const f of files) {
      evidences.push({ name: f.name, url: await readFileAsDataUrl(f) });
    }
    await actions.addEvidences(selectedOT.id, { [fieldKey]: evidences });
    input.value = '';
  });

  manager.append(input, btn);
  article.append(heading, list, manager);
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
      if (item.url && String(item.url).startsWith('data:image')) {
        const img = document.createElement('img');
        img.className = 'preview-photo-card__img';
        img.alt = item.name || '';
        img.src = item.url;
        const nameEl = document.createElement('strong');
        nameEl.textContent = item.name || '';
        card.append(img, nameEl);
      } else {
        card.innerHTML = `
          <div class="preview-photo-card__placeholder">Imagen / referencia</div>
          <strong></strong>
          <span></span>
        `;
        card.querySelector('strong').textContent = item.name || '';
        card.querySelector('span').textContent =
          item.url || 'Referencia cargada para futura imagen incrustada';
      }
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
    const textBlock = document.createElement('section');
    textBlock.className = 'preview-text-card';
    textBlock.innerHTML = `<h4>${label}</h4><p>${value}</p>`;
    textSections.append(textBlock);
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
  isClosingOT,
  isUploadingEvidence,
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
  const evidenceBefore = ots.reduce((t, item) => t + (item.fotografiasAntes?.length || 0), 0);
  const evidenceDuring = ots.reduce((t, item) => t + (item.fotografiasDurante?.length || 0), 0);
  const evidenceAfter = ots.reduce((t, item) => t + (item.fotografiasDespues?.length || 0), 0);

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
      description: 'Conteo por tipo (todas las OT).',
      items: [`Antes: ${evidenceBefore}`, `Durante: ${evidenceDuring}`, `Después: ${evidenceAfter}`],
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
  footer.innerHTML =
    '<p class="muted">Estado inicial fijo en pendiente. Las fotografías se agrupan por etapa; al crear la OT se envían como evidencias con nombre y contenido.</p>';

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'primary-button';
  submitButton.textContent = isSubmitting ? 'Guardando OT...' : otFormDefinition.submitLabel;
  submitButton.disabled = Boolean(isSubmitting);

  footer.append(submitButton);
  form.append(footer);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const antesInput = form.elements.fotografiasAntes;
    const duranteInput = form.elements.fotografiasDurante;
    const despuesInput = form.elements.fotografiasDespues;

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
      fotografiasAntes: await readFilesAsEvidence(antesInput),
      fotografiasDurante: await readFilesAsEvidence(duranteInput),
      fotografiasDespues: await readFilesAsEvidence(despuesInput),
    };

    await actions.createOT(payload);
  });

  formCard.append(formHeader, form);

  const overview = document.createElement('div');
  overview.className = 'ot-overview';

  const listCard = document.createElement('article');
  listCard.className = 'ot-list-card';
  listCard.innerHTML =
    '<div class="ot-list-card__header"><h3>Listado de OT</h3><p class="muted">Cliente, fecha, tipo y estado actual.</p></div>';

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
    detailCard.innerHTML =
      '<h3>Detalle de OT</h3><p class="muted">Crea una OT para revisar aquí su información y evidencias.</p>';
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
    titleBlock.innerHTML = `<p class="muted">Detalle / resumen OT</p><h3>${selectedOT.id} · ${selectedOT.cliente}</h3>`;
    titleRow.append(titleBlock, createStatusBadge(selectedOT.estado));
    detailCard.append(titleRow);

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

    detailCard.append(summaryGrid);

    if (selectedOT.pdfUrl && selectedOT.pdfName) {
      const reportRow = document.createElement('div');
      reportRow.className = 'report-actions';

      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'secondary-button';
      viewBtn.textContent = 'Ver informe';
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
    statusActions.innerHTML = '<p class="muted">Actualizar estado</p>';

    const statusButtons = document.createElement('div');
    statusButtons.className = 'status-actions__buttons';

    ['pendiente', 'en proceso'].forEach((status) => {
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

    const closeWrap = document.createElement('div');
    closeWrap.className = 'status-actions status-actions--close';
    const closeLabel = document.createElement('p');
    closeLabel.className = 'muted';
    closeLabel.textContent = 'Cierre con informe PDF persistente';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'primary-button';
    closeBtn.textContent = isClosingOT ? 'Cerrando y generando informe...' : 'Cerrar y Generar Informe';
    const closeDisabled =
      Boolean(isClosingOT || isUploadingEvidence) || selectedOT.estado === 'terminado';
    closeBtn.disabled = closeDisabled;
    closeBtn.addEventListener('click', async () => {
      await actions.closeAndGenerateReport(selectedOT);
    });
    closeWrap.append(closeLabel, closeBtn);
    statusActions.append(closeWrap);

    detailCard.append(statusActions);

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

    detailCard.append(textBlocks);

    const evidenceGrid = document.createElement('div');
    evidenceGrid.className = 'evidence-grid';
    evidenceGrid.append(
      createEvidenceBlock(selectedOT, 'fotografiasAntes', 'Fotografías antes', actions, isUploadingEvidence),
      createEvidenceBlock(
        selectedOT,
        'fotografiasDurante',
        'Fotografías durante',
        actions,
        isUploadingEvidence
      ),
      createEvidenceBlock(
        selectedOT,
        'fotografiasDespues',
        'Fotografías después',
        actions,
        isUploadingEvidence
      )
    );

    detailCard.append(evidenceGrid);

    const previewCard = document.createElement('div');
    previewCard.className = 'preview-wrapper';
    previewCard.append(createClientPreview(selectedOT));

    detailCard.append(previewCard);
  }

  overview.append(listCard, detailCard);
  section.append(header, cards, formCard, overview);

  return section;
};

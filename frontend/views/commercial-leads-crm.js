/**
 * CRM leads (pre-IA): pipeline, tarjetas y acciones rápidas.
 */

import { buildMailtoUrl } from '../domain/jarvis-commercial-brain.js';
import { commercialLeadsService } from '../services/commercial-leads.service.js';

const ESTADOS_PIPELINE = [
  'nuevo',
  'contactado',
  'propuesta_enviada',
  'cerrado_ganado',
  'cerrado_perdido',
];

const ESTADO_LABEL = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  propuesta_enviada: 'Propuesta enviada',
  cerrado_ganado: 'Cerrado ganado',
  cerrado_perdido: 'Cerrado perdido',
};

const ORIGEN_LABEL = { whatsapp: 'WhatsApp', correo: 'Correo', manual: 'Manual' };

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildLeadWhatsappText(lead) {
  const n = String(lead?.nombreContacto || '').trim() || '—';
  const emp = String(lead?.empresa || '').trim() || 'su empresa';
  const linea =
    lead?.tipoServicio === 'flota'
      ? 'servicios de flota y vehículos'
      : 'servicios de climatización';
  return `Hola ${n}, te escribimos de HNF Servicios Integrales por ${linea} (${emp}). ¿Podemos coordinar un contacto breve?`;
}

export function buildLeadEmailDraft(lead) {
  const n = String(lead?.nombreContacto || '').trim() || '';
  const emp = String(lead?.empresa || '').trim() || '';
  const subject = `HNF — seguimiento ${emp || 'consulta'}`;
  const body = `Hola ${n || 'estimado/a'},\n\nNos ponemos en contacto desde HNF Servicios Integrales en seguimiento a su consulta${emp ? ` (${emp})` : ''}.\n\nQuedamos atentos a coordinar el próximo paso.\n\nSaludos,`;
  return { subject, body };
}

export function createCommercialLeadsCrmSection({
  leads = [],
  reloadApp,
  integrationStatus,
  navigateToView,
  onFeedback,
} = {}) {
  const root = document.createElement('section');
  root.className = 'hnf-crm tarjeta';
  root.setAttribute('aria-label', 'Leads CRM');

  let filterEstado = 'todos';
  let showForm = false;

  const fb = (type, msg) => onFeedback?.(type, msg);

  const header = document.createElement('div');
  header.className = 'hnf-crm__head';
  header.innerHTML = `<h2 class="hnf-crm__title">Leads CRM</h2>
    <p class="muted small">Pipeline operativo antes de automatizar con IA. Los documentos Base Maestra con destino <strong>comercial</strong> generan un lead al <strong>aprobar</strong> el intake.</p>`;

  const toolbar = document.createElement('div');
  toolbar.className = 'hnf-crm__toolbar';

  const selFilter = document.createElement('select');
  selFilter.className = 'opp-filter';
  selFilter.append(new Option('Todos los estados', 'todos'));
  ESTADOS_PIPELINE.forEach((e) => selFilter.append(new Option(ESTADO_LABEL[e], e)));

  const btnNew = document.createElement('button');
  btnNew.type = 'button';
  btnNew.className = 'secondary-button';
  btnNew.textContent = 'Nuevo lead';
  btnNew.addEventListener('click', () => {
    showForm = !showForm;
    paint();
  });

  const btnRel = document.createElement('button');
  btnRel.type = 'button';
  btnRel.className = 'secondary-button';
  btnRel.textContent = 'Actualizar';
  btnRel.addEventListener('click', async () => {
    fb('neutral', 'Actualizando…');
    const ok = await reloadApp?.();
    fb(ok ? 'success' : 'error', ok ? 'Listo.' : 'Sin conexión o error.');
  });

  toolbar.append(selFilter, btnNew, btnRel);
  selFilter.addEventListener('change', () => {
    filterEstado = selFilter.value;
    paint();
  });

  const formHost = document.createElement('div');
  const pipelineHost = document.createElement('div');

  root.append(header, toolbar, formHost, pipelineHost);

  const paintForm = () => {
    formHost.replaceChildren();
    if (!showForm) return;
    const wrap = document.createElement('div');
    wrap.className = 'hnf-crm__new-form';
    wrap.innerHTML = `<p class="small"><strong>Alta manual</strong></p>
      <div class="hnf-crm__form-grid">
        <label>Contacto <input type="text" data-f="nombreContacto" class="hnf-crm__in" required /></label>
        <label>Empresa <input type="text" data-f="empresa" class="hnf-crm__in" required /></label>
        <label>Teléfono <input type="text" data-f="telefono" class="hnf-crm__in" /></label>
        <label>Email <input type="email" data-f="email" class="hnf-crm__in" /></label>
        <label>Origen <select data-f="origen" class="hnf-crm__in"><option value="manual">manual</option><option value="whatsapp">whatsapp</option><option value="correo">correo</option></select></label>
        <label>Tipo servicio <select data-f="tipoServicio" class="hnf-crm__in"><option value="clima">clima</option><option value="flota">flota</option></select></label>
        <label class="hnf-crm__form-span2">Notas <textarea data-f="notas" class="hnf-crm__ta" rows="2"></textarea></label>
      </div>
      <button type="button" class="primary-button" data-save-lead>Guardar lead</button>`;
    wrap.querySelector('[data-save-lead]')?.addEventListener('click', async () => {
      if (integrationStatus === 'sin conexión') {
        fb('error', 'Sin conexión.');
        return;
      }
      const get = (k) => wrap.querySelector(`[data-f="${k}"]`)?.value?.trim() ?? '';
      try {
        await commercialLeadsService.create({
          nombreContacto: get('nombreContacto'),
          empresa: get('empresa'),
          telefono: get('telefono'),
          email: get('email'),
          origen: get('origen') || 'manual',
          tipoServicio: get('tipoServicio') || 'clima',
          notas: get('notas'),
        });
        showForm = false;
        fb('success', 'Lead creado.');
        await reloadApp?.();
      } catch (e) {
        fb('error', e?.message || 'No se pudo crear.');
      }
    });
    formHost.append(wrap);
  };

  const paintPipeline = () => {
    pipelineHost.replaceChildren();
    if (integrationStatus === 'sin conexión') {
      const p = document.createElement('p');
      p.className = 'muted small';
      p.textContent = 'Sin conexión: los leads no están disponibles.';
      pipelineHost.append(p);
      return;
    }

    const list = Array.isArray(leads) ? leads : [];
    const estadosVisibles =
      filterEstado === 'todos' ? ESTADOS_PIPELINE : ESTADOS_PIPELINE.filter((e) => e === filterEstado);

    const row = document.createElement('div');
    row.className = 'hnf-crm__pipeline';

    for (const estado of estadosVisibles) {
      const col = document.createElement('div');
      col.className = 'hnf-crm__col';
      const inCol = list.filter((l) => String(l.estado) === estado);
      const h = document.createElement('h3');
      h.className = 'hnf-crm__col-title';
      h.textContent = `${ESTADO_LABEL[estado]} (${inCol.length})`;
      col.append(h);

      for (const lead of inCol) {
        col.append(renderCard(lead));
      }
      if (!inCol.length) {
        const empty = document.createElement('p');
        empty.className = 'muted small hnf-crm__col-empty';
        empty.textContent = 'Vacío';
        col.append(empty);
      }
      row.append(col);
    }
    pipelineHost.append(row);
  };

  const renderCard = (lead) => {
    const card = document.createElement('article');
    card.className = 'hnf-crm__card';
    card.dataset.leadId = lead.id;

    const top = document.createElement('div');
    top.className = 'hnf-crm__card-top';
    top.innerHTML = `<strong class="hnf-crm__card-name">${escapeHtml(lead.nombreContacto)}</strong>
      <span class="muted small">${escapeHtml(lead.empresa)}</span>`;

    const meta = document.createElement('div');
    meta.className = 'hnf-crm__card-meta';
    meta.innerHTML = `<span>${escapeHtml(lead.telefono || '—')}</span>
      <span>${escapeHtml(lead.email || '—')}</span>`;

    const chips = document.createElement('div');
    chips.className = 'hnf-crm__chips';
    chips.innerHTML = `<span class="hnf-crm__chip">${escapeHtml(ORIGEN_LABEL[lead.origen] || lead.origen)}</span>
      <span class="hnf-crm__chip hnf-crm__chip--svc">${escapeHtml(lead.tipoServicio || '')}</span>`;
    if (lead.maestroDocumentoOrigenId) {
      const d = document.createElement('span');
      d.className = 'hnf-crm__chip hnf-crm__chip--doc';
      d.textContent = lead.maestroDocumentoOrigenId;
      chips.append(d);
    }
    if (lead.otId) {
      const o = document.createElement('span');
      o.className = 'hnf-crm__chip hnf-crm__chip--ot';
      o.textContent = `OT ${lead.otId}`;
      chips.append(o);
    }

    const quick = document.createElement('div');
    quick.className = 'hnf-crm__quick';

    const mkBtn = (label, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary-button hnf-crm__mini';
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };

    quick.append(
      mkBtn('Copiar WhatsApp', async () => {
        try {
          await navigator.clipboard.writeText(buildLeadWhatsappText(lead));
          fb('success', 'Texto copiado.');
        } catch {
          fb('error', 'No se pudo copiar.');
        }
      }),
      mkBtn('Abrir / copiar correo', () => {
        const { subject, body } = buildLeadEmailDraft(lead);
        const url = buildMailtoUrl(lead.email || '', subject, body);
        window.open(url, '_blank', 'noopener,noreferrer');
      }),
      mkBtn('Marcar contactado', async () => {
        if (integrationStatus === 'sin conexión') return;
        try {
          await commercialLeadsService.patch(lead.id, { estado: 'contactado' });
          fb('success', 'Estado actualizado.');
          await reloadApp?.();
        } catch (e) {
          fb('error', e?.message || 'Error');
        }
      })
    );

    const estadoRow = document.createElement('div');
    estadoRow.className = 'hnf-crm__estado-row';
    const sel = document.createElement('select');
    sel.className = 'hnf-crm__estado-sel';
    ESTADOS_PIPELINE.forEach((e) => sel.append(new Option(ESTADO_LABEL[e], e)));
    sel.value = lead.estado || 'nuevo';
    sel.addEventListener('change', async () => {
      if (integrationStatus === 'sin conexión') return;
      try {
        await commercialLeadsService.patch(lead.id, { estado: sel.value });
        fb('success', 'Estado guardado.');
        await reloadApp?.();
      } catch (e) {
        fb('error', e?.message || 'Error');
        sel.value = lead.estado || 'nuevo';
      }
    });
    estadoRow.append(document.createTextNode('Estado: '), sel);

    const conv = document.createElement('div');
    conv.className = 'hnf-crm__convert';
    if (!lead.otId && lead.estado !== 'cerrado_perdido') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'primary-button hnf-crm__convert-btn';
      b.textContent = 'Convertir a OT';
      b.addEventListener('click', async () => {
        if (integrationStatus === 'sin conexión') return;
        if (!window.confirm('Se creará una OT Clima o Flota según el lead. ¿Continuar?')) return;
        try {
          const r = await commercialLeadsService.convertirOt(lead.id);
          const oid = r?.ot?.id || r?.otId;
          fb('success', oid ? `OT ${oid} creada.` : 'Convertido.');
          await reloadApp?.();
          if (oid) navigateToView?.('clima', { otId: oid });
        } catch (e) {
          fb('error', e?.message || 'No se pudo convertir.');
        }
      });
      conv.append(b);
    }

    const det = document.createElement('details');
    det.className = 'hnf-crm__details';
    const sum = document.createElement('summary');
    sum.textContent = 'Vista rápida / notas / interacción';
    const body = document.createElement('div');
    body.className = 'hnf-crm__details-body';
    const notas = document.createElement('textarea');
    notas.className = 'hnf-crm__ta';
    notas.rows = 3;
    notas.value = lead.notas || '';
    const btnSaveNotas = document.createElement('button');
    btnSaveNotas.type = 'button';
    btnSaveNotas.className = 'secondary-button hnf-crm__mini';
    btnSaveNotas.textContent = 'Guardar notas';
    btnSaveNotas.addEventListener('click', async () => {
      if (integrationStatus === 'sin conexión') return;
      try {
        await commercialLeadsService.patch(lead.id, { notas: notas.value });
        fb('success', 'Notas guardadas.');
        await reloadApp?.();
      } catch (e) {
        fb('error', e?.message || 'Error');
      }
    });
    const interLab = document.createElement('label');
    interLab.className = 'hnf-crm__inter';
    interLab.innerHTML = '<span class="small">Registrar interacción</span>';
    const interIn = document.createElement('input');
    interIn.type = 'text';
    interIn.className = 'hnf-crm__in';
    interIn.placeholder = 'Ej.: Llamado, envió cotización…';
    const btnInter = document.createElement('button');
    btnInter.type = 'button';
    btnInter.className = 'secondary-button hnf-crm__mini';
    btnInter.textContent = 'Registrar';
    btnInter.addEventListener('click', async () => {
      if (integrationStatus === 'sin conexión') return;
      const nota = interIn.value.trim();
      if (!nota) {
        fb('error', 'Escribí una nota.');
        return;
      }
      try {
        await commercialLeadsService.postInteraccion(lead.id, { nota, tipo: 'manual' });
        interIn.value = '';
        fb('success', 'Interacción registrada.');
        await reloadApp?.();
      } catch (e) {
        fb('error', e?.message || 'Error');
      }
    });
    interLab.append(interIn, btnInter);

    const hist = document.createElement('ul');
    hist.className = 'hnf-crm__hist muted small';
    const ints = Array.isArray(lead.interacciones) ? [...lead.interacciones].reverse() : [];
    for (const it of ints.slice(0, 6)) {
      const li = document.createElement('li');
      li.textContent = `${String(it.at || '').slice(0, 16)} · ${it.nota || ''}`;
      hist.append(li);
    }
    if (!ints.length) {
      const li = document.createElement('li');
      li.textContent = 'Sin interacciones registradas.';
      hist.append(li);
    }

    body.append(notas, btnSaveNotas, interLab, document.createElement('p'), hist);
    det.append(sum, body);

    card.append(top, meta, chips, quick, estadoRow, conv, det);
    return card;
  };

  function paint() {
    paintForm();
    paintPipeline();
  }

  paint();
  return root;
}

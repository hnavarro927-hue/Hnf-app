/**
 * Órdenes de compra PDF (Puma / retail): carga, extracción Jarvis heurística, revisión manual.
 */

import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import { ocDocumentosService } from '../services/oc-documentos.service.js';

const fmtMoney = (n) => {
  const x = Math.round(Number(n) || 0);
  return x.toLocaleString('es-CL', { maximumFractionDigits: 0 });
};

export const ordenesCompraOcView = ({ data, reloadApp, integrationStatus } = {}) => {
  const root = document.createElement('div');
  root.className = 'hnf-oc-view hnf-op-view';

  const list = Array.isArray(data?.documentosOc) ? data.documentosOc : [];
  let selectedId = list[0]?.id || '';

  const head = document.createElement('header');
  head.className = 'hnf-oc-view__head';
  head.innerHTML = `<h1 class="hnf-oc-view__title">Órdenes de compra (PDF)</h1>
    <p class="muted small">Motor documental: extracción local de cliente, N° OC, fecha, período, tiendas y montos. Si falta data, el PDF <strong>no se pierde</strong>: revisión manual asistida.</p>`;

  const flow = createHnfOperationalFlowStrip(3);
  const fb = document.createElement('p');
  fb.className = 'form-feedback';
  fb.hidden = true;

  const toolbar = document.createElement('div');
  toolbar.className = 'hnf-oc-view__toolbar';
  const fileIn = document.createElement('input');
  fileIn.type = 'file';
  fileIn.accept = 'application/pdf,.pdf';
  fileIn.className = 'hnf-oc-view__file';
  const btnUp = document.createElement('button');
  btnUp.type = 'button';
  btnUp.className = 'primary-button';
  btnUp.textContent = 'Subir PDF';
  const btnRel = document.createElement('button');
  btnRel.type = 'button';
  btnRel.className = 'secondary-button';
  btnRel.textContent = 'Actualizar';
  toolbar.append(fileIn, btnUp, btnRel);

  const split = document.createElement('div');
  split.className = 'hnf-oc-view__split';

  const listEl = document.createElement('div');
  listEl.className = 'hnf-oc-view__list tarjeta';
  const detailEl = document.createElement('div');
  detailEl.className = 'hnf-oc-view__detail tarjeta';

  split.append(listEl, detailEl);

  const showFb = (ok, msg) => {
    fb.hidden = !msg;
    fb.className = `form-feedback${ok ? ' form-feedback--success' : ' form-feedback--error'}`;
    fb.textContent = msg || '';
  };

  const paintList = () => {
    listEl.replaceChildren();
    const h = document.createElement('h2');
    h.className = 'hnf-oc-view__h';
    h.textContent = 'Registros OC';
    listEl.append(h);
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'muted small';
      p.textContent = 'Sin órdenes cargadas.';
      listEl.append(p);
      return;
    }
    for (const c of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `hnf-oc-view__row${c.id === selectedId ? ' is-sel' : ''}`;
      b.innerHTML = `<strong>${c.id}</strong><span class="muted small">${c.numeroOc || '—'} · ${c.estadoExtraccion || ''}</span>`;
      b.addEventListener('click', () => {
        selectedId = c.id;
        paintList();
        void paintDetail();
      });
      listEl.append(b);
    }
  };

  const paintDetail = async () => {
    detailEl.replaceChildren();
    if (!selectedId || integrationStatus === 'sin conexión') {
      detailEl.innerHTML = '<p class="muted small">Seleccioná una OC o verificá conexión.</p>';
      return;
    }
    let pack;
    try {
      pack = await ocDocumentosService.get(selectedId);
    } catch (e) {
      detailEl.innerHTML = `<p class="form-feedback form-feedback--error">${e?.message || 'Error'}</p>`;
      return;
    }
    const cab = pack.cabecera;
    const detalles = pack.detalles || [];
    const res = pack.resumen || {};

    const sum = document.createElement('div');
    sum.className = 'hnf-oc-view__resumen';
    sum.innerHTML = `<h2 class="hnf-oc-view__h">Resumen</h2>
      <ul class="hnf-oc-view__sumul muted small">
        <li>Tiendas detectadas: <strong>${res.tiendasDetectadas ?? '—'}</strong></li>
        <li>Pendientes revisión: <strong>${res.pendientesRevision ?? '—'}</strong></li>
        <li>Total validado (líneas OK): <strong>$${fmtMoney(res.totalValidado)}</strong></li>
        <li>Total cabecera (extraído): <strong>$${fmtMoney(cab?.totalGeneral)}</strong></li>
        <li>Estado: <strong>${cab?.estadoExtraccion || '—'}</strong></li>
      </ul>`;
    detailEl.append(sum);

    const form = document.createElement('div');
    form.className = 'hnf-oc-view__form';
    form.innerHTML = `<label>Cliente <input type="text" data-k="cliente" class="hnf-oc-view__in" /></label>
      <label>N° OC <input type="text" data-k="numeroOc" class="hnf-oc-view__in" /></label>
      <label>Fecha <input type="text" data-k="fechaOc" class="hnf-oc-view__in" /></label>
      <label>Período (YYYY-MM) <input type="text" data-k="periodo" class="hnf-oc-view__in" /></label>`;
    for (const inp of form.querySelectorAll('[data-k]')) {
      const k = inp.getAttribute('data-k');
      inp.value = cab[k] || '';
    }
    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.className = 'secondary-button';
    btnSave.textContent = 'Guardar cabecera';
    btnSave.addEventListener('click', async () => {
      const body = {};
      for (const inp of form.querySelectorAll('[data-k]')) {
        body[inp.getAttribute('data-k')] = inp.value.trim();
      }
      try {
        await ocDocumentosService.patchCabecera(cab.id, body);
        showFb(true, 'Cabecera actualizada.');
        await reloadApp?.();
      } catch (e) {
        showFb(false, e?.message || 'Error');
      }
    });
    form.append(btnSave);
    detailEl.append(form);

    const tbl = document.createElement('table');
    tbl.className = 'hnf-oc-view__table';
    tbl.innerHTML =
      '<thead><tr><th>Tienda / ítem</th><th>Costo</th><th>Validado</th><th>Plan</th><th>Finanza</th><th>OT</th><th>Rev.</th></tr></thead>';
    const tb = document.createElement('tbody');
    for (const d of detalles) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(d.tiendaNombre)}</td>
        <td>$${fmtMoney(d.costo)}</td>
        <td><input type="number" class="hnf-oc-view__in--sm" data-d="${d.id}" data-f="costoValidado" value="${d.costoValidado != null ? d.costoValidado : ''}" /></td>
        <td class="small">${escapeHtml(d.planTiendaId || '—')}</td>
        <td class="small">${escapeHtml(d.tiendaFinancieraId || '—')}</td>
        <td><input type="text" class="hnf-oc-view__in--sm" data-d="${d.id}" data-f="otId" value="${escapeHtml(d.otId || '')}" placeholder="OT-…" /></td>
        <td><input type="checkbox" data-d="${d.id}" data-f="needsReview" ${d.needsReview ? 'checked' : ''} /></td>`;
      tb.append(tr);
    }
    tbl.append(tb);
    detailEl.append(tbl);

    const btnDet = document.createElement('button');
    btnDet.type = 'button';
    btnDet.className = 'secondary-button';
    btnDet.textContent = 'Guardar líneas editadas';
    btnDet.addEventListener('click', async () => {
      try {
        for (const d of detalles) {
          const cv = tbl.querySelector(`[data-d="${d.id}"][data-f="costoValidado"]`);
          const oid = tbl.querySelector(`[data-d="${d.id}"][data-f="otId"]`);
          const nr = tbl.querySelector(`[data-d="${d.id}"][data-f="needsReview"]`);
          await ocDocumentosService.patchDetalle(d.id, {
            costoValidado: cv?.value === '' ? null : Number(cv?.value),
            otId: oid?.value?.trim() || null,
            needsReview: Boolean(nr?.checked),
          });
        }
        showFb(true, 'Líneas guardadas.');
        await reloadApp?.();
      } catch (e) {
        showFb(false, e?.message || 'Error');
      }
    });
    detailEl.append(btnDet);

    const btnVal = document.createElement('button');
    btnVal.type = 'button';
    btnVal.className = 'primary-button';
    btnVal.textContent = 'Validar OC (sin líneas en revisión)';
    btnVal.addEventListener('click', async () => {
      try {
        await ocDocumentosService.validar(cab.id);
        showFb(true, 'OC validada.');
        await reloadApp?.();
      } catch (e) {
        showFb(false, e?.message || 'No se pudo validar');
      }
    });
    detailEl.append(btnVal);

    if (cab.textoExtraidoSnippet) {
      const det = document.createElement('details');
      det.className = 'hnf-oc-view__snippet';
      det.innerHTML = '<summary class="small">Fragmento texto extraído (auditoría)</summary>';
      const pre = document.createElement('pre');
      pre.className = 'muted small';
      pre.textContent = cab.textoExtraidoSnippet.slice(0, 3500);
      det.append(pre);
      detailEl.append(det);
    }
  };

  btnUp.addEventListener('click', () => {
    const f = fileIn.files?.[0];
    if (!f) {
      showFb(false, 'Elegí un PDF.');
      return;
    }
    if (integrationStatus === 'sin conexión') {
      showFb(false, 'Sin conexión.');
      return;
    }
    const r = new FileReader();
    r.onload = async () => {
      const dataUrl = String(r.result || '');
      const b64 = dataUrl.split(',')[1] || '';
      try {
        await ocDocumentosService.uploadPdf({
          nombre_archivo: f.name,
          dataBase64: b64,
        });
        showFb(true, 'PDF procesado.');
        await reloadApp?.();
      } catch (e) {
        showFb(false, e?.message || 'Error al subir');
      }
    };
    r.readAsDataURL(f);
  });

  btnRel.addEventListener('click', () => reloadApp?.());

  paintList();
  void paintDetail();

  root.append(head, flow, fb, toolbar, split);
  return root;
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

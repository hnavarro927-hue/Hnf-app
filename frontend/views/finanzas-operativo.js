/**
 * Finanzas — lectura ejecutiva + aprobación de gastos (sin bloquear operación: estado inicial «Registrado»).
 */

import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import { resolveOperatorRole } from '../domain/hnf-operator-role.js';
import { finanzasHnfService } from '../services/finanzas-hnf.service.js';

const fmtMoney = (n) => {
  const x = Math.round(Number(n) || 0);
  return x.toLocaleString('es-CL', { maximumFractionDigits: 0 });
};

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const ESTADO_LABEL = {
  registrado: 'Registrado',
  aprobado: 'Aprobado',
  observado: 'Observado',
  rechazado: 'Rechazado',
};

const CIERRE_ESTADO_LABEL = {
  borrador: 'Borrador',
  cerrado: 'Cerrado',
  facturado: 'Facturado',
};

const periodoActual = () => new Date().toISOString().slice(0, 7);

const otIdOf = (o) => String(o?.id || o?.otId || '').trim();

const escAttr = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

export const finanzasOperativoView = ({
  data,
  navigateToView,
  reloadApp,
  actions,
  integrationStatus,
} = {}) => {
  const root = document.createElement('div');
  root.className = 'hnf-mod-finanzas hnf-op-view hnf-op-view--finanzas';

  const opRole = resolveOperatorRole();
  const canFinanceApprove = opRole === 'admin' || opRole === 'control';

  const adn = data?.hnfAdn || {};
  const ots = data?.planOts || data?.ots?.data || [];
  const sol = Array.isArray(data?.flotaSolicitudes) ? data.flotaSolicitudes : [];
  const expenses = data?.expenses?.data || [];

  let climaAbierto = 0;
  let climaMonto = 0;
  for (const o of ots) {
    if (['terminado', 'cerrada', 'cerrado'].includes(String(o?.estado || '').toLowerCase())) continue;
    const st = String(o?.tipoServicio || '').toLowerCase();
    if (st === 'flota' || st === 'comercial') continue;
    climaAbierto += 1;
    climaMonto += roundMoney(o.montoPresupuestado ?? o.montoEstimado ?? o.montoCobrado ?? o.monto ?? 0);
  }

  let flotaAbierta = 0;
  let flotaMonto = 0;
  for (const s of sol) {
    if (String(s?.estado || '').toLowerCase() === 'cerrada') continue;
    flotaAbierta += 1;
    flotaMonto += roundMoney(s.ingresoFinal || s.ingresoEstimado || s.monto || 0);
  }

  const gastosMes = expenses.reduce((acc, e) => acc + roundMoney(e?.monto ?? e?.amount ?? 0), 0);

  const sinComprobante = expenses.filter((e) => !e?.comprobante).length;
  const pendientesReg = expenses.filter((e) => (e?.estadoAprobacion || 'registrado') === 'registrado').length;
  const observados = expenses.filter((e) => e?.estadoAprobacion === 'observado').length;

  const head = document.createElement('header');
  head.className = 'hnf-mod-finanzas__head';
  head.innerHTML = `<h1 class="hnf-mod-finanzas__title">Finanzas</h1>
    <p class="hnf-mod-finanzas__sub muted">Revisión de gastos y lectura ejecutiva. Los gastos nuevos quedan <strong>Registrado</strong>: la operación no se detiene.</p>`;

  const flowStrip = createHnfOperationalFlowStrip(4);

  const jarvisBox = document.createElement('div');
  jarvisBox.className = 'tarjeta hnf-mod-finanzas__jarvis';
  jarvisBox.innerHTML = `<p class="small muted"><strong>Resumen:</strong> ${pendientesReg} gasto(s) pendientes de revisión · ${observados} observado(s) · ${sinComprobante} sin comprobante.</p>
    <p class="small muted"><strong>Recomendaciones:</strong> priorizá observados y montos altos. <strong>Información importante:</strong> al aprobar u observar queda trazabilidad en el registro.</p>`;

  const grid = document.createElement('div');
  grid.className = 'hnf-mod-finanzas__grid';

  const card = (t, v, hint, nav) => {
    const c = document.createElement('section');
    c.className = 'hnf-mod-finanzas__card tarjeta';
    c.innerHTML = `<h2 class="hnf-mod-finanzas__card-t">${t}</h2>
      <p class="hnf-mod-finanzas__card-v">$${fmtMoney(v)}</p>
      <p class="hnf-mod-finanzas__card-h muted small">${hint}</p>`;
    if (nav) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary-button';
      b.textContent = 'Ver módulo';
      b.addEventListener('click', () => navigateToView?.(nav));
      c.append(b);
    }
    return c;
  };

  grid.append(
    card(
      'Dinero en operación (referencia)',
      adn.dineroEnRiesgo || climaMonto + flotaMonto,
      'Suma orientativa de OT abiertas (Clima / administrativo) + pipeline Flota.',
      'clima'
    ),
    card('Clima / admin — OT abiertas (monto ref.)', climaMonto, `${climaAbierto} orden(es) sin cerrar.`, 'clima'),
    card('Flota — pipeline abierto (monto ref.)', flotaMonto, `${flotaAbierta} solicitud(es) activas.`, 'flota'),
    card('Egresos cargados (total listado)', gastosMes, 'Incluye todos los estados de aprobación.', null)
  );

  const gastosSection = document.createElement('section');
  gastosSection.className = 'tarjeta hnf-mod-finanzas__gastos';
  const gh = document.createElement('h2');
  gh.className = 'hnf-mod-finanzas__gastos-t';
  gh.textContent = 'Gastos · aprobación';
  const gsub = document.createElement('p');
  gsub.className = 'muted small';
  gsub.textContent = canFinanceApprove
    ? 'Podés marcar Aprobado, Observado o Rechazado. Si observás, indicá devolución a Romina o Gery en la observación.'
    : 'Solo lectura de estados. Lyn y Hernán aprueban desde su sesión.';
  gastosSection.append(gh, gsub);

  const fb = document.createElement('p');
  fb.className = 'form-feedback';
  fb.hidden = true;
  gastosSection.append(fb);

  const tblWrap = document.createElement('div');
  tblWrap.className = 'hnf-mod-finanzas__table-wrap';

  if (!expenses.length) {
    const empty = document.createElement('p');
    empty.className = 'muted small';
    empty.textContent = 'No hay gastos cargados aún.';
    tblWrap.append(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'hnf-mod-finanzas__table';
    const thead = document.createElement('thead');
    thead.innerHTML =
      '<tr><th>ID</th><th>Fecha</th><th>Monto</th><th>Estado</th><th>Observación</th><th>Acciones</th></tr>';
    const tbody = document.createElement('tbody');
    for (const e of expenses) {
      const tr = document.createElement('tr');
      const est = String(e.estadoAprobacion || 'registrado').toLowerCase();
      const obs = e.observacionFinanzas || '—';
      tr.innerHTML = `<td>${e.id || '—'}</td><td>${e.fecha || '—'}</td><td>$${fmtMoney(e.monto)}</td><td>${ESTADO_LABEL[est] || est}</td><td class="muted small">${String(obs).slice(0, 80)}${String(obs).length > 80 ? '…' : ''}</td>`;
      const tdAct = document.createElement('td');
      tdAct.className = 'hnf-mod-finanzas__acts';
      if (canFinanceApprove && e.id) {
        const run = async (payload, okMsg) => {
          fb.hidden = true;
          try {
            await actions?.patchExpenseEstado?.(e.id, payload);
            fb.className = 'form-feedback form-feedback--success';
            fb.textContent = okMsg;
            fb.hidden = false;
          } catch (err) {
            fb.className = 'form-feedback form-feedback--error';
            fb.textContent = err?.message || 'No se pudo actualizar el gasto.';
            fb.hidden = false;
          }
        };
        const bOk = document.createElement('button');
        bOk.type = 'button';
        bOk.className = 'secondary-button hnf-mod-finanzas__mini';
        bOk.textContent = 'Aprobado';
        bOk.addEventListener('click', () =>
          run({ estadoAprobacion: 'aprobado' }, 'Aprobado. Registro actualizado.')
        );
        const bObs = document.createElement('button');
        bObs.type = 'button';
        bObs.className = 'secondary-button hnf-mod-finanzas__mini';
        bObs.textContent = 'Observado';
        bObs.addEventListener('click', () => {
          const observacionFinanzas =
            window.prompt('Observación para quien cargó el gasto (obligatorio):') || '';
          if (!observacionFinanzas.trim()) {
            fb.className = 'form-feedback form-feedback--error';
            fb.textContent = 'Falta texto de observación.';
            fb.hidden = false;
            return;
          }
          const devolverA =
            (window.prompt('¿Devolver a Romina o Gery? (opcional, texto libre):') || '').trim() || null;
          run(
            { estadoAprobacion: 'observado', observacionFinanzas, devolverA },
            'Observado. Quedó trazabilidad para corrección.'
          );
        });
        const bRej = document.createElement('button');
        bRej.type = 'button';
        bRej.className = 'secondary-button hnf-mod-finanzas__mini';
        bRej.textContent = 'Rechazado';
        bRej.addEventListener('click', () => {
          const observacionFinanzas =
            (window.prompt('Motivo del rechazo (opcional):') || '').trim() || null;
          run(
            { estadoAprobacion: 'rechazado', observacionFinanzas },
            'Rechazado. Registro actualizado.'
          );
        });
        tdAct.append(bOk, bObs, bRej);
      } else {
        tdAct.textContent = '—';
      }
      tr.append(tdAct);
      tbody.append(tr);
    }
    table.append(thead, tbody);
    tblWrap.append(table);
  }
  gastosSection.append(tblWrap);

  const io = data?.maestroIntakeResumen;
  const finKpiSection = document.createElement('section');
  finKpiSection.className = 'tarjeta hnf-mod-finanzas__kpi-fin-wrap';
  finKpiSection.innerHTML = `<h2 class="hnf-mod-finanzas__gastos-t">KPI financieros OT (mes en curso)</h2>
    <p class="muted small">Costo ejecutado e ingresos facturados usan el calendario del mes actual. Ingreso estimado y utilidad estimada aplican a OT de mantención con facturación mensual y período YYYY-MM actual, aún no facturadas.</p>
    <div class="hnf-mod-finanzas__kpi-fin"></div>`;
  const finKpiGrid = finKpiSection.querySelector('.hnf-mod-finanzas__kpi-fin');
  const kpiDefs = [
    ['Costo ejecutado (real)', io?.kpi_fin_costo_ejecutado_mes_clp, 'Suma costoTotal OT con fecha o alta en el mes.'],
    ['Ingreso estimado (mensual)', io?.kpi_fin_ingreso_estimado_mensual_clp, 'Valor referencial tienda, OT mensual período actual.'],
    ['Ingreso facturado (real)', io?.kpi_fin_ingreso_facturado_mes_clp, 'montoCobrado en el mes (inmediata o tras cierre).'],
    ['Utilidad estimada (mensual)', io?.kpi_fin_utilidad_estimada_mensual_clp, 'Sobre OT mensual no facturadas.'],
    ['Utilidad facturada (mes)', io?.kpi_fin_utilidad_facturada_mes_clp, 'Según cobros del mes.'],
  ];
  for (const [t, v, hint] of kpiDefs) {
    const c = document.createElement('div');
    c.className = 'hnf-mod-finanzas__kpi-fin-card';
    c.innerHTML = `<h3 class="hnf-mod-finanzas__kpi-fin-t">${t}</h3>
      <p class="hnf-mod-finanzas__kpi-fin-v">$${fmtMoney(v)}</p>
      <p class="hnf-mod-finanzas__kpi-fin-h muted small">${hint}</p>`;
    finKpiGrid.append(c);
  }

  const otMensualSection = document.createElement('section');
  otMensualSection.className = 'tarjeta hnf-mod-finanzas__ot-mensual';
  otMensualSection.innerHTML = `<h2 class="hnf-mod-finanzas__gastos-t">Tiendas (costos) y cierre mensual OT</h2>
    <p class="muted small">Maestro por tienda para valor referencial y costo base. Los cierres agrupan OT con <strong>facturación mensual</strong> por período; al marcar facturado se actualiza el estado de cada OT.</p>
    <p class="form-feedback hnf-mod-finanzas__fin-mensual-fb" hidden></p>
    <div class="hnf-mod-finanzas__fin-mensual-offline muted small" hidden></div>
    <div class="hnf-mod-finanzas__split-two">
      <div class="hnf-mod-finanzas__col hnf-mod-finanzas__col--tiendas"></div>
      <div class="hnf-mod-finanzas__col hnf-mod-finanzas__col--cierres"></div>
    </div>`;
  const finMensualFb = otMensualSection.querySelector('.hnf-mod-finanzas__fin-mensual-fb');
  const finMensualOffline = otMensualSection.querySelector('.hnf-mod-finanzas__fin-mensual-offline');
  const colTiendas = otMensualSection.querySelector('.hnf-mod-finanzas__col--tiendas');
  const colCierres = otMensualSection.querySelector('.hnf-mod-finanzas__col--cierres');

  let tiendasCache = [];
  let cierresCache = [];
  let candidatasCache = [];
  let selectedCierreId = '';
  let periodoCierre = periodoActual();

  const showFinFb = (ok, msg) => {
    finMensualFb.hidden = !msg;
    finMensualFb.className = `form-feedback hnf-mod-finanzas__fin-mensual-fb${ok ? ' form-feedback--success' : ' form-feedback--error'}`;
    finMensualFb.textContent = msg || '';
  };

  const paintTiendas = () => {
    colTiendas.replaceChildren();
    const h = document.createElement('h3');
    h.className = 'hnf-mod-finanzas__subcol-t';
    h.textContent = 'Maestro tiendas';
    colTiendas.append(h);

    const addForm = document.createElement('div');
    addForm.className = 'hnf-mod-finanzas__inline-form';
    addForm.innerHTML = `<p class="small muted">Nueva tienda</p>
      <input type="text" class="hnf-mod-finanzas__inp" data-f="nombre" placeholder="Nombre" />
      <input type="text" class="hnf-mod-finanzas__inp" data-f="clienteId" placeholder="ID cliente (opcional)" />
      <input type="number" class="hnf-mod-finanzas__inp" data-f="costoBaseTienda" placeholder="Costo base" step="any" />
      <input type="number" class="hnf-mod-finanzas__inp" data-f="valorReferencialTienda" placeholder="Valor referencial" step="any" />
      <input type="text" class="hnf-mod-finanzas__inp hnf-mod-finanzas__inp--wide" data-f="observacionFinanciera" placeholder="Observación" />
      <button type="button" class="secondary-button hnf-mod-finanzas__mini" data-action="add-tienda">Guardar tienda</button>`;
    colTiendas.append(addForm);

    addForm.querySelector('[data-action="add-tienda"]')?.addEventListener('click', async () => {
      if (integrationStatus === 'sin conexión') return;
      const get = (k) => addForm.querySelector(`[data-f="${k}"]`)?.value?.trim() ?? '';
      const nombre = get('nombre');
      if (!nombre) {
        showFinFb(false, 'Nombre obligatorio.');
        return;
      }
      try {
        await finanzasHnfService.postTienda({
          nombre,
          clienteId: get('clienteId') || null,
          costoBaseTienda: Number(get('costoBaseTienda')) || 0,
          valorReferencialTienda: Number(get('valorReferencialTienda')) || 0,
          observacionFinanciera: get('observacionFinanciera') || '',
        });
        showFinFb(true, 'Tienda creada.');
        await refreshFinanzasMensual();
      } catch (e) {
        showFinFb(false, e?.message || 'No se pudo crear la tienda.');
      }
    });

    const tblWrap = document.createElement('div');
    tblWrap.className = 'hnf-mod-finanzas__table-wrap';
    const table = document.createElement('table');
    table.className = 'hnf-mod-finanzas__table';
    const thead = document.createElement('thead');
    thead.innerHTML =
      '<tr><th>ID</th><th>Nombre</th><th>Cliente</th><th>Costo base</th><th>Valor ref.</th><th>Obs.</th><th></th></tr>';
    const tbody = document.createElement('tbody');
    for (const t of tiendasCache) {
      const tr = document.createElement('tr');
      tr.dataset.tiendaId = t.id;
      tr.innerHTML = `<td class="muted small">${t.id || '—'}</td>
        <td><input type="text" class="hnf-mod-finanzas__inp" data-e="nombre" value="${escAttr(t.nombre)}" /></td>
        <td><input type="text" class="hnf-mod-finanzas__inp" data-e="clienteId" value="${escAttr(t.clienteId)}" /></td>
        <td><input type="number" class="hnf-mod-finanzas__inp" data-e="costoBaseTienda" step="any" value="${Number(t.costoBaseTienda) || 0}" /></td>
        <td><input type="number" class="hnf-mod-finanzas__inp" data-e="valorReferencialTienda" step="any" value="${Number(t.valorReferencialTienda) || 0}" /></td>
        <td><input type="text" class="hnf-mod-finanzas__inp" data-e="observacionFinanciera" value="${escAttr(t.observacionFinanciera)}" /></td>
        <td><button type="button" class="secondary-button hnf-mod-finanzas__mini" data-save-tienda>Guardar</button></td>`;
      tr.querySelector('[data-save-tienda]')?.addEventListener('click', async () => {
        if (integrationStatus === 'sin conexión') return;
        const body = {};
        for (const k of ['nombre', 'clienteId', 'observacionFinanciera']) {
          body[k] = tr.querySelector(`[data-e="${k}"]`)?.value ?? '';
        }
        body.costoBaseTienda = Number(tr.querySelector('[data-e="costoBaseTienda"]')?.value) || 0;
        body.valorReferencialTienda = Number(tr.querySelector('[data-e="valorReferencialTienda"]')?.value) || 0;
        body.clienteId = String(body.clienteId || '').trim() || null;
        try {
          await finanzasHnfService.patchTienda(t.id, body);
          showFinFb(true, `Tienda ${t.id} actualizada.`);
          await refreshFinanzasMensual();
        } catch (e) {
          showFinFb(false, e?.message || 'No se pudo guardar.');
        }
      });
      tbody.append(tr);
    }
    if (!tiendasCache.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" class="muted small">Sin tiendas. Creá la primera arriba.</td>';
      tbody.append(tr);
    }
    table.append(thead, tbody);
    tblWrap.append(table);
    colTiendas.append(tblWrap);
  };

  const paintCierres = () => {
    colCierres.replaceChildren();
    const h = document.createElement('h3');
    h.className = 'hnf-mod-finanzas__subcol-t';
    h.textContent = 'Cierres mensuales';
    colCierres.append(h);

    const toolbar = document.createElement('div');
    toolbar.className = 'hnf-mod-finanzas__cierre-toolbar';
    toolbar.innerHTML = `<label class="small muted">Período (YYYY-MM)
        <input type="text" class="hnf-mod-finanzas__inp" data-periodo value="${periodoCierre}" pattern="\\d{4}-\\d{2}" /></label>
      <button type="button" class="secondary-button hnf-mod-finanzas__mini" data-refresh-cierres>Actualizar</button>
      <button type="button" class="secondary-button hnf-mod-finanzas__mini" data-create-cierre>Nuevo cierre</button>`;
    colCierres.append(toolbar);

    const periodoInput = toolbar.querySelector('[data-periodo]');
    toolbar.querySelector('[data-refresh-cierres]')?.addEventListener('click', () => {
      periodoCierre = String(periodoInput.value || '').slice(0, 7) || periodoActual();
      void refreshFinanzasMensual();
    });
    toolbar.querySelector('[data-create-cierre]')?.addEventListener('click', async () => {
      if (integrationStatus === 'sin conexión') return;
      periodoCierre = String(periodoInput.value || '').slice(0, 7) || periodoActual();
      const clienteId = (window.prompt('ID cliente (opcional, para etiquetar el cierre):') || '').trim() || null;
      const tiendaId = (window.prompt('ID tienda maestro (opcional, ej. TND-0001):') || '').trim() || null;
      let tiendaNombreSnapshot = null;
      if (tiendaId) {
        const hit = tiendasCache.find((x) => x.id === tiendaId);
        tiendaNombreSnapshot = hit?.nombre || null;
      }
      try {
        const row = await finanzasHnfService.postCierre({
          periodo: periodoCierre,
          clienteId,
          tiendaId,
          tiendaNombreSnapshot,
        });
        selectedCierreId = row?.id || '';
        showFinFb(true, `Cierre ${row?.id || ''} creado.`);
        await refreshFinanzasMensual();
      } catch (e) {
        showFinFb(false, e?.message || 'No se pudo crear el cierre.');
      }
    });

    const listWrap = document.createElement('div');
    listWrap.className = 'hnf-mod-finanzas__table-wrap';
    const table = document.createElement('table');
    table.className = 'hnf-mod-finanzas__table';
    table.innerHTML =
      '<thead><tr><th>ID</th><th>Período</th><th>Estado</th><th>OT</th><th>Costo Σ</th><th>Val. ref. Σ</th><th>Util. est. Σ</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const c of cierresCache) {
      const tot = c.totales || {};
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      if (c.id === selectedCierreId) tr.classList.add('hnf-mod-finanzas__row--sel');
      tr.innerHTML = `<td>${c.id || '—'}</td><td>${c.periodo || '—'}</td><td>${CIERRE_ESTADO_LABEL[String(c.estado || '').toLowerCase()] || c.estado || '—'}</td>
        <td>${tot.cantidadOt ?? 0}</td><td>$${fmtMoney(tot.costoTotal)}</td><td>$${fmtMoney(tot.valorReferencialTotal)}</td><td>$${fmtMoney(tot.utilidadEstimadaTotal)}</td>`;
      tr.addEventListener('click', () => {
        selectedCierreId = c.id;
        if (c.periodo) periodoCierre = String(c.periodo).slice(0, 7);
        void refreshFinanzasMensual();
      });
      tbody.append(tr);
    }
    if (!cierresCache.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" class="muted small">Sin cierres. Creá uno para el período.</td>';
      tbody.append(tr);
    }
    table.append(tbody);
    listWrap.append(table);
    colCierres.append(listWrap);

    const detailHost = document.createElement('div');
    detailHost.className = 'hnf-mod-finanzas__cierre-detail';
    colCierres.append(detailHost);

    const paintDetail = async () => {
      detailHost.replaceChildren();
      if (!selectedCierreId || integrationStatus === 'sin conexión') return;
      let det;
      try {
        det = await finanzasHnfService.getCierre(selectedCierreId);
      } catch {
        return;
      }
      if (!det?.id) return;
      const est = String(det.estado || '').toLowerCase();
      const head = document.createElement('div');
      head.className = 'hnf-mod-finanzas__cierre-detail-head';
      head.innerHTML = `<p class="small"><strong>${det.id}</strong> · ${det.periodo} · <span class="muted">${CIERRE_ESTADO_LABEL[est] || est}</span></p>`;
      const acts = document.createElement('div');
      acts.className = 'hnf-mod-finanzas__acts';
      const bClose = document.createElement('button');
      bClose.type = 'button';
      bClose.className = 'secondary-button hnf-mod-finanzas__mini';
      bClose.textContent = 'Cerrar período';
      bClose.disabled = est !== 'borrador';
      bClose.addEventListener('click', async () => {
        try {
          await finanzasHnfService.postCerrarCierre(det.id);
          showFinFb(true, 'Período cerrado.');
          await refreshFinanzasMensual();
        } catch (e) {
          showFinFb(false, e?.message || 'No se pudo cerrar.');
        }
      });
      const bFact = document.createElement('button');
      bFact.type = 'button';
      bFact.className = 'secondary-button hnf-mod-finanzas__mini';
      bFact.textContent = 'Marcar facturado';
      bFact.disabled = est !== 'cerrado';
      bFact.addEventListener('click', async () => {
        if (!window.confirm('Se marcarán como facturadas las OT del cierre. ¿Continuar?')) return;
        try {
          await finanzasHnfService.postMarcarFacturado(det.id);
          showFinFb(true, 'Cierre marcado como facturado y OT actualizadas.');
          await refreshFinanzasMensual();
          await reloadApp?.();
        } catch (e) {
          showFinFb(false, e?.message || 'No se pudo marcar facturado.');
        }
      });
      acts.append(bClose, bFact);
      head.append(acts);
      detailHost.append(head);

      const otTable = document.createElement('table');
      otTable.className = 'hnf-mod-finanzas__table';
      otTable.innerHTML =
        '<thead><tr><th>OT</th><th>Cliente</th><th>Tienda</th><th>Costo</th><th>Val. ref.</th><th></th></tr></thead>';
      const otBody = document.createElement('tbody');
      const otsIn = Array.isArray(det.ots) ? det.ots : [];
      for (const o of otsIn) {
        const oid = otIdOf(o);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${oid}</td><td class="small">${String(o.cliente || '—').slice(0, 24)}</td><td class="small">${String(o.tiendaNombre || '—').slice(0, 20)}</td>
          <td>$${fmtMoney(o.costoTotal)}</td><td>$${fmtMoney(o.valorReferencialTienda)}</td><td></td>`;
        if (est === 'borrador') {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'secondary-button hnf-mod-finanzas__mini';
          b.textContent = 'Excluir';
          b.addEventListener('click', async () => {
            try {
              await finanzasHnfService.postExcluirOt(det.id, oid);
              showFinFb(true, `OT ${oid} excluida.`);
              await refreshFinanzasMensual();
            } catch (e) {
              showFinFb(false, e?.message || 'No se pudo excluir.');
            }
          });
          tr.lastElementChild.append(b);
        }
        otBody.append(tr);
      }
      if (!otsIn.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6" class="muted small">Ninguna OT incluida. Usá candidatas abajo.</td>';
        otBody.append(tr);
      }
      otTable.append(otBody);
      detailHost.append(otTable);

      if (est === 'borrador') {
        const cap = document.createElement('p');
        cap.className = 'small muted';
        cap.textContent = `Candidatas del período ${String(det.periodo || periodoCierre).slice(0, 7)} (facturación mensual, no facturadas)`;
        detailHost.append(cap);
        const ct = document.createElement('table');
        ct.className = 'hnf-mod-finanzas__table';
        ct.innerHTML =
          '<thead><tr><th>OT</th><th>Cliente</th><th>Costo</th><th>Val. ref. (est.)</th><th></th></tr></thead>';
        const cb = document.createElement('tbody');
        const inSet = new Set(otsIn.map(otIdOf));
        for (const o of candidatasCache) {
          const oid = otIdOf(o);
          if (!oid || inSet.has(oid)) continue;
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${oid}</td><td class="small">${String(o.cliente || '—').slice(0, 28)}</td>
            <td>$${fmtMoney(o.costoTotal)}</td><td>$${fmtMoney(o.valorReferencialTienda)}</td><td></td>`;
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'secondary-button hnf-mod-finanzas__mini';
          b.textContent = 'Incluir';
          b.addEventListener('click', async () => {
            try {
              await finanzasHnfService.postIncluirOt(det.id, oid);
              showFinFb(true, `OT ${oid} incluida.`);
              await refreshFinanzasMensual();
            } catch (e) {
              showFinFb(false, e?.message || 'No se pudo incluir.');
            }
          });
          tr.lastElementChild.append(b);
          cb.append(tr);
        }
        if (!cb.children.length) {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td colspan="5" class="muted small">No hay más candidatas para este período.</td>';
          cb.append(tr);
        }
        ct.append(cb);
        detailHost.append(ct);
      }
    };

    void paintDetail();
  };

  const refreshFinanzasMensual = async () => {
    if (integrationStatus === 'sin conexión') {
      finMensualOffline.hidden = false;
      finMensualOffline.textContent =
        'Sin conexión al API: el maestro de tiendas y los cierres no están disponibles.';
      paintTiendas();
      paintCierres();
      return;
    }
    finMensualOffline.hidden = true;
    try {
      const p = periodoCierre;
      const [tiendas, cierres, candidatas] = await Promise.all([
        finanzasHnfService.getTiendas(),
        finanzasHnfService.getCierres(),
        finanzasHnfService.getCandidatas(p),
      ]);
      tiendasCache = Array.isArray(tiendas) ? tiendas : [];
      cierresCache = Array.isArray(cierres) ? cierres : [];
      candidatasCache = Array.isArray(candidatas) ? candidatas : [];
      paintTiendas();
      paintCierres();
    } catch (e) {
      showFinFb(false, e?.message || 'Error al cargar finanzas OT mensual.');
      paintTiendas();
      paintCierres();
    }
  };

  if (integrationStatus === 'sin conexión') {
    finMensualOffline.hidden = false;
    finMensualOffline.textContent =
      'Sin conexión al API: el maestro de tiendas y los cierres no están disponibles.';
  }
  void refreshFinanzasMensual();

  const foot = document.createElement('p');
  foot.className = 'muted small hnf-mod-finanzas__foot';
  foot.textContent =
    'Los totales son referencia operativa. El circuito de gastos no bloquea a Romina, Gery ni técnicos al registrar.';

  const tool = document.createElement('div');
  tool.className = 'hnf-mod-finanzas__tool';
  const sync = document.createElement('button');
  sync.type = 'button';
  sync.className = 'primary-button';
  sync.textContent = 'Actualizar datos';
  sync.addEventListener('click', () => reloadApp?.());
  tool.append(sync);

  root.append(head, flowStrip, jarvisBox, grid, finKpiSection, otMensualSection, gastosSection, foot, tool);
  return root;
};

import { createCard } from '../components/card.js';
import {
  FLOTA_ESTADO_CHAIN,
  FLOTA_ESTADO_LABELS,
  flotaNextEstado,
} from '../constants/flotaPipeline.js';
import { buildFlotaOperationalBrief } from '../domain/operational-intelligence.js';
import { flotaSolicitudService } from '../services/flota-solicitud.service.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import { createHnfFlotaOpsIdentityCard } from '../components/hnf-brand-ops-strip.js';
import { getSessionBackendRole } from '../config/session-bridge.js';
import { filtrarOtsPorRolBackend } from '../domain/hnf-operativa-reglas.js';
import {
  costoTotalOperativo,
  flotaEconomicsLivePreview,
  tarifaBaseOperativa,
} from '../domain/flota-solicitud-economics.js';

const TIPO_SERVICIO_OPTS = [
  { value: 'traslado', label: 'Traslado' },
  { value: 'asistencia', label: 'Asistencia' },
  { value: 'otro', label: 'Otro' },
];

const labelTipo = (v) => TIPO_SERVICIO_OPTS.find((t) => t.value === v)?.label || v;
const labelEstado = (e) => FLOTA_ESTADO_LABELS[e] || e;

const flotaPipelineHint = (sel) => {
  const next = flotaNextEstado(sel.estado);
  if (!next) return 'Circuito completo: no quedan estados posteriores.';
  const parts = [`Próximo paso del flujo: «${FLOTA_ESTADO_LABELS[next]}».`];
  if (next === 'en_ruta') {
    parts.push('Antes de avanzar: conductor y vehículo distintos de «Por asignar».');
  }
  if (next === 'cerrada') {
    parts.push(
      'Para cerrar: conductor y vehículo reales, combustible + peaje + externo con total > 0, observación de cierre obligatoria. «Cerrar OT» guarda y cierra en un paso.'
    );
  }
  if (next === 'programada' || next === 'aprobada') {
    parts.push('Revisá que origen, destino y responsable estén claros para quien ejecuta.');
  }
  return parts.join(' ');
};

const monthPrefix = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const buildFlotaIntelChecklist = (sel, guidance) => {
  if (!sel) return [];
  const items = [];
  if (guidance?.codigo === 'FLO_SIN_INGRESO') {
    items.push({
      ok: costoTotalOperativo(sel) > 0 || round2(sel.costoTotal) > 0,
      label: 'Costo operativo (combustible + peaje + externo) > 0',
    });
  }
  if (guidance?.codigo === 'FLO_RUTA_STALE' && sel.estado === 'en_ruta') {
    items.push({
      ok: false,
      label: 'Registrar avance o cambiar estado (evitar ruta estancada)',
    });
  }
  const brief = buildFlotaOperationalBrief(sel);
  brief.blockers.forEach((b) => items.push({ ok: false, label: b.detail }));
  return items;
};

const buildFlotaTraceBubbles = (sel) => {
  const wrap = document.createElement('div');
  wrap.className = 'flota-trace-bubbles';
  const h = document.createElement('h4');
  h.className = 'flota-trace-bubbles__title';
  h.textContent = 'Trazabilidad 360° · Unidad';
  const grid = document.createElement('div');
  grid.className = 'flota-trace-bubbles__grid';
  const idx = FLOTA_ESTADO_CHAIN.indexOf(sel.estado);
  const ix = (id) => {
    const j = FLOTA_ESTADO_CHAIN.indexOf(id);
    return j < 0 ? 999 : j;
  };
  const neumOk = idx >= ix('programada');
  const motorOk = round2(sel.costoCombustible) > 0 || idx >= ix('en_ruta');
  const frenosOk = idx >= ix('completada');
  const motorWarn = !motorOk && idx >= ix('evaluacion');
  const mk = (emoji, title, tier, sub) => {
    const b = document.createElement('div');
    b.className = `flota-trace-bubble flota-trace-bubble--${tier}`;
    b.setAttribute('role', 'img');
    b.setAttribute('aria-label', `${title}: ${sub}`);
    const orb = document.createElement('span');
    orb.className = 'flota-trace-bubble__orb';
    orb.textContent = emoji;
    const body = document.createElement('div');
    body.className = 'flota-trace-bubble__body';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const small = document.createElement('small');
    small.textContent = sub;
    body.append(strong, small);
    b.append(orb, body);
    return b;
  };
  grid.append(
    mk('🛞', 'Neumáticos', neumOk ? 'ok' : 'pending', neumOk ? 'Listo para ruta' : 'Revisar asignación'),
    mk(
      '⚙',
      'Motor',
      motorOk ? 'ok' : motorWarn ? 'warn' : 'pending',
      motorOk ? 'Energía / combustible OK' : motorWarn ? 'Registrar combustible' : 'En espera'
    ),
    mk('🛑', 'Frenos', frenosOk ? 'ok' : 'pending', frenosOk ? 'Cierre operativo' : 'Pendiente etapa')
  );
  wrap.append(h, grid);
  return wrap;
};

const round2 = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

const MSG_CIERRE_FLOTA = 'Debes completar costos y observación antes de cerrar la OT';

const sumTresCostosForm = (el) => {
  if (!el) return 0;
  const q = (n) => round2(el.querySelector(`[name="${n}"]`)?.value);
  return round2(q('costoCombustible') + q('costoPeaje') + q('costoExterno'));
};

const asignadoReal = (v) => {
  const t = String(v ?? '').trim();
  return t.length > 0 && t.toLowerCase() !== 'por asignar' && t !== '—';
};

const createEstadoBadge = (estado) => {
  const badge = document.createElement('span');
  const safe = String(estado || 'recibida').replace(/_/g, '-');
  badge.className = `flota-estado-badge flota-estado-badge--${safe}`;
  badge.textContent = labelEstado(estado);
  return badge;
};

const defaultHora = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const flotaView = ({
  data,
  reloadApp,
  actions,
  flotaFeedback,
  selectedFlotaId,
  integrationStatus,
  flotaIntelFilter,
  intelGuidance,
  navigateToView,
} = {}) => {
  const section = document.createElement('section');
  section.className = 'flota-module hnf-op-view hnf-op-view--flota';

  const vehicles = data?.vehicles?.data || [];
  const expenses = data?.expenses?.data || [];
  const solicitudes = [...(data?.flotaSolicitudes || [])].sort((a, b) =>
    String(b.fecha).localeCompare(String(a.fecha))
  );

  const br = getSessionBackendRole() || 'admin';
  let otRaw = [...(data?.ots?.data || [])];
  otRaw = filtrarOtsPorRolBackend(otRaw, br);
  if (String(br || '').toLowerCase() === 'romina') {
    otRaw = [];
  }
  const otFlota = otRaw
    .filter((o) => String(o?.tipoServicio || '').toLowerCase() === 'flota')
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

  const plates = [
    ...new Set(vehicles.map((v) => String(v.plate || '').trim()).filter(Boolean)),
  ].sort();

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML =
    '<h2>Flota · solicitudes</h2><p class="muted">Módulo <strong class="hnf-accent-flota">logística móvil</strong> operativo: <strong>traslado</strong> usa tarifa base fija ($15.000) menos costos directos (combustible, peaje, externo). <strong>Guardar datos</strong> persiste el formulario; al <strong>cerrar</strong> se valida conductor, vehículo, costo total &gt; 0 y observación de cierre (backend y pantalla).</p>';

  const flowStrip = createHnfOperationalFlowStrip(3);
  const flotaIdentity = createHnfFlotaOpsIdentityCard();

  if (flotaFeedback?.message) {
    const notice = document.createElement('div');
    notice.className = `form-feedback form-feedback--${flotaFeedback.type} workspace-notice`;
    notice.setAttribute('role', 'status');
    notice.textContent = flotaFeedback.message;
    header.append(notice);
  }

  const cards = document.createElement('div');
  cards.className = 'cards';
  [
    {
      title: 'Vehículos',
      description: 'Referencia interna.',
      items: [`Registrados: ${vehicles.length}`, 'Podés elegir patente desde la lista al cargar'],
    },
    {
      title: 'Gastos',
      description: 'Otro módulo.',
      items: [`Registros: ${expenses.length}`, 'Los ves en Administración'],
    },
    {
      title: 'Solicitudes',
      description: 'En el sistema.',
      items: [
        `Activas en pantalla: ${solicitudes.length}`,
        'Orden típico: ' + FLOTA_ESTADO_CHAIN.map((e) => FLOTA_ESTADO_LABELS[e]).join(' → '),
      ],
    },
  ].forEach((item) => cards.append(createCard(item)));

  const otBandeja = document.createElement('div');
  otBandeja.className = 'flota-ot-bandeja';
  const otBandejaTitle = document.createElement('h3');
  otBandejaTitle.className = 'flota-section-title';
  otBandejaTitle.textContent = 'Bandeja OT Flota (Gery)';
  const otBandejaP = document.createElement('p');
  otBandejaP.className = 'muted small';
  otBandejaP.textContent =
    'Órdenes de trabajo con tipo Flota. La ejecución detallada (evidencias, cierre) sigue en el módulo Clima cuando compartís flujo OT unificado; acá ves el listado filtrado por línea Flota.';
  otBandeja.append(otBandejaTitle, otBandejaP);
  if (!otFlota.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No hay OT clasificadas como Flota en el servidor.';
    otBandeja.append(empty);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'flota-ot-bandeja__list';
    for (const o of otFlota.slice(0, 40)) {
      const li = document.createElement('li');
      li.className = 'flota-ot-bandeja__item';
      const st = String(o.estado || '—');
      li.innerHTML = `<strong>${o.id}</strong> · ${o.cliente || '—'} · <span class="muted">${st}</span> · ${o.fecha || '—'}`;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'secondary-button flota-ot-bandeja__open';
      open.textContent = 'Abrir en Clima';
      open.addEventListener('click', () => navigateToView?.('clima', { otId: o.id }));
      li.append(open);
      ul.append(li);
    }
    otBandeja.append(ul);
  }

  const runReload = async () => {
    if (typeof reloadApp === 'function') return await reloadApp();
    return false;
  };

  const notifyGlobal = (type, message) => {
    if (typeof actions?.setFlotaFeedback === 'function') {
      actions.setFlotaFeedback({ type, message });
    }
  };

  const resumenTitle = document.createElement('h3');
  resumenTitle.className = 'flota-section-title';
  resumenTitle.textContent = 'Resumen por cliente (mes en curso)';

  const resumenWrap = document.createElement('div');
  resumenWrap.className = 'plan-table-wrap';

  const ingresoRow = (s) => {
    const tb = tarifaBaseOperativa(s);
    if (tb > 0) return tb;
    return round2(s.ingresoEstimado) || round2(s.monto) || 0;
  };

  const renderResumen = () => {
    const pref = monthPrefix();
    const byCliente = new Map();
    for (const s of solicitudes) {
      if (!String(s.fecha || '').startsWith(pref)) continue;
      const c = String(s.cliente || '—').trim() || '—';
      if (!byCliente.has(c)) byCliente.set(c, { count: 0, ingreso: 0 });
      const o = byCliente.get(c);
      o.count += 1;
      o.ingreso += ingresoRow(s);
    }
    const table = document.createElement('table');
    table.className = 'plan-table flota-table';
    table.innerHTML =
      '<thead><tr><th>Cliente</th><th>Solicitudes en el mes</th><th>Tarifa traslado / ingreso ref. (suma)</th></tr></thead>';
    const tb = document.createElement('tbody');
    const rows = [...byCliente.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'muted';
      td.textContent = 'Sin solicitudes con fecha en el mes actual.';
      tr.append(td);
      tb.append(tr);
    } else {
      rows.forEach(([cliente, { count, ingreso }]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${cliente}</td><td>${count}</td><td>${ingreso.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>`;
        tb.append(tr);
      });
    }
    table.append(tb);
    resumenWrap.replaceChildren(table);
  };

  const solTitle = document.createElement('h3');
  solTitle.className = 'flota-section-title';
  solTitle.textContent = 'Nueva solicitud (campos obligatorios)';

  const form = document.createElement('form');
  form.className = 'flota-form flota-form--create';

  const addField = (name, label, el) => {
    const w = document.createElement('label');
    w.className = 'form-field';
    const lb = document.createElement('span');
    lb.className = 'form-field__label';
    lb.textContent = label;
    el.name = name;
    w.append(lb, el);
    return w;
  };

  const clienteIn = document.createElement('input');
  clienteIn.type = 'text';
  clienteIn.required = true;
  clienteIn.placeholder = 'Cliente';

  const tipoSel = document.createElement('select');
  tipoSel.required = true;
  tipoSel.append(new Option('— Tipo de servicio —', ''));
  TIPO_SERVICIO_OPTS.forEach((t) => tipoSel.append(new Option(t.label, t.value)));

  const fechaIn = document.createElement('input');
  fechaIn.type = 'date';
  fechaIn.required = true;

  const horaIn = document.createElement('input');
  horaIn.type = 'time';
  horaIn.required = true;
  horaIn.value = defaultHora();

  const origenIn = document.createElement('input');
  origenIn.type = 'text';
  origenIn.required = true;
  origenIn.placeholder = 'Origen';

  const destinoIn = document.createElement('input');
  destinoIn.type = 'text';
  destinoIn.required = true;
  destinoIn.placeholder = 'Destino';

  const conductorIn = document.createElement('input');
  conductorIn.type = 'text';
  conductorIn.required = true;
  conductorIn.placeholder = 'Conductor';

  const vehiculoIn = document.createElement('input');
  vehiculoIn.type = 'text';
  vehiculoIn.required = true;
  vehiculoIn.placeholder = 'Vehículo / patente';
  vehiculoIn.setAttribute('list', 'flota-vehiculos-datalist');
  const dl = document.createElement('datalist');
  dl.id = 'flota-vehiculos-datalist';
  plates.forEach((p) => dl.append(new Option(p)));

  const estadoCreate = document.createElement('select');
  estadoCreate.name = 'estado';
  FLOTA_ESTADO_CHAIN.forEach((e) => estadoCreate.append(new Option(FLOTA_ESTADO_LABELS[e], e)));
  estadoCreate.value = 'recibida';

  const detalleTa = document.createElement('textarea');
  detalleTa.rows = 2;
  detalleTa.placeholder = 'Detalle (opcional)';

  const responsableIn = document.createElement('input');
  responsableIn.type = 'text';
  responsableIn.placeholder = 'Responsable HNF (opcional)';

  form.append(
    addField('cliente', 'Cliente', clienteIn),
    addField('tipoServicio', 'Tipo de servicio', tipoSel),
    addField('fecha', 'Fecha', fechaIn),
    addField('hora', 'Hora', horaIn),
    addField('origen', 'Origen', origenIn),
    addField('destino', 'Destino', destinoIn),
    addField('conductor', 'Conductor', conductorIn),
    addField('vehiculo', 'Vehículo', vehiculoIn),
    addField('estado', 'Estado inicial', estadoCreate),
    addField('detalle', 'Detalle', detalleTa),
    addField('responsable', 'Responsable', responsableIn),
    dl
  );

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'primary-button';
  submit.textContent = 'Crear solicitud';
  form.append(submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await flotaSolicitudService.create({
        cliente: clienteIn.value.trim(),
        tipoServicio: tipoSel.value,
        fecha: fechaIn.value,
        hora: horaIn.value,
        origen: origenIn.value.trim(),
        destino: destinoIn.value.trim(),
        conductor: conductorIn.value.trim(),
        vehiculo: vehiculoIn.value.trim(),
        estado: estadoCreate.value,
        detalle: detalleTa.value.trim(),
        responsable: responsableIn.value.trim(),
        observacion: '',
        observacionCierre: '',
      });
      detalleTa.value = '';
      notifyGlobal('success', 'Solicitud creada correctamente.');
      await runReload();
    } catch (err) {
      notifyGlobal('error', err.message || 'No se pudo crear la solicitud.');
    }
  });

  const filtTitle = document.createElement('h3');
  filtTitle.className = 'flota-section-title';
  filtTitle.textContent = 'Listado y detalle operativo';

  const filtRow = document.createElement('div');
  filtRow.className = 'flota-filters';
  const fCliente = document.createElement('input');
  fCliente.type = 'search';
  fCliente.placeholder = 'Filtrar por cliente (contiene)';
  const fEstado = document.createElement('select');
  fEstado.append(new Option('Todos los estados', ''));
  FLOTA_ESTADO_CHAIN.forEach((e) => fEstado.append(new Option(FLOTA_ESTADO_LABELS[e], e)));
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.className = 'secondary-button';
  refresh.textContent = 'Actualizar datos';
  refresh.title = 'Vuelve a cargar solicitudes y vehículos desde el servidor.';
  refresh.addEventListener('click', async () => {
    notifyGlobal('neutral', 'Actualizando…');
    const ok = await runReload();
    notifyGlobal(
      ok ? 'success' : 'error',
      ok ? 'Listado actualizado desde el servidor.' : 'No se pudo actualizar. Revisá la conexión.'
    );
  });
  filtRow.append(fCliente, fEstado, refresh);

  const hasFlotaIntelFilter =
    flotaIntelFilter && typeof flotaIntelFilter === 'object' && Object.keys(flotaIntelFilter).length > 0;
  if (hasFlotaIntelFilter && flotaIntelFilter.estado) {
    fEstado.value = flotaIntelFilter.estado;
  }

  const overview = document.createElement('div');
  overview.className = 'hnf-cc-split-pane hnf-cc-split-pane--flota';

  const listCard = document.createElement('article');
  listCard.className = 'ot-list-card ot-list-card--split-rail hnf-cc-split-pane__rail hnf-cc-split-pane__rail--left';
  listCard.innerHTML =
    '<div class="ot-list-card__header"><h3>Solicitudes</h3><p class="muted">Elegí una fila para editar costos y avanzar el estado.</p></div>';

  const list = document.createElement('div');
  list.className = 'ot-list ot-list--split-pane';

  const contextRail = document.createElement('aside');
  contextRail.className = 'hnf-cc-split-pane__rail hnf-cc-split-pane__rail--right';
  contextRail.setAttribute('aria-label', 'Pipeline, contexto y trazabilidad');

  const detailCard = document.createElement('article');
  detailCard.className = 'ot-detail-card ot-detail-card--split-workspace hnf-cc-split-pane__center';

  const rowsMatchIntel = (() => {
    let r = [...solicitudes];
    if (flotaIntelFilter?.estado) {
      r = r.filter((s) => s.estado === flotaIntelFilter.estado);
    }
    return r;
  })();
  const effectiveFlotaId = rowsMatchIntel.some((s) => s.id === selectedFlotaId)
    ? selectedFlotaId
    : rowsMatchIntel[0]?.id ?? selectedFlotaId;
  const selected =
    solicitudes.find((s) => s.id === effectiveFlotaId) ||
    solicitudes.find((s) => s.id === selectedFlotaId) ||
    solicitudes[0] ||
    null;

  let intelStrip = null;
  const hasIntelGuide = Boolean(intelGuidance && (intelGuidance.why || intelGuidance.fix));
  if (hasFlotaIntelFilter || hasIntelGuide) {
    intelStrip = document.createElement('div');
    intelStrip.className = 'intel-guide-stack';
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
      intelStrip.append(g);
      const chkItems = buildFlotaIntelChecklist(selected, intelGuidance);
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
        intelStrip.append(box);
      }
    }
    if (hasFlotaIntelFilter) {
      const ban = document.createElement('div');
      ban.className = 'intel-filter-banner intel-filter-banner--nested';
      const lab = document.createElement('span');
      lab.className = 'intel-filter-banner__text';
      lab.textContent = 'Filtro desde inteligencia (también reflejado en el desplegable de estado).';
      ban.append(lab);
      intelStrip.append(ban);
    }
    const act = document.createElement('div');
    act.className = 'intel-guide-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'secondary-button';
    clr.textContent = hasFlotaIntelFilter ? 'Quitar filtro y guía' : 'Cerrar guía';
    clr.addEventListener('click', () =>
      hasFlotaIntelFilter ? actions?.clearIntelUiFilters?.() : actions?.dismissIntelGuidance?.()
    );
    act.append(clr);
    intelStrip.append(act);
  }

  const renderList = () => {
    list.innerHTML = '';
    const qCliente = fCliente.value.trim().toLowerCase();
    const qEst = fEstado.value;
    let rows = [...solicitudes];
    if (qCliente) rows = rows.filter((s) => String(s.cliente || '').toLowerCase().includes(qCliente));
    if (qEst) rows = rows.filter((s) => s.estado === qEst);

    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent =
        integrationStatus === 'sin conexión' && !solicitudes.length
          ? 'Sin conexión al servidor: no hay datos cargados. Revisá la red y tocá «Actualizar datos».'
          : 'No hay solicitudes con este criterio.';
      list.append(empty);
      return;
    }

    rows.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      const isTarget = intelGuidance?.recordLabel && item.id === intelGuidance.recordLabel;
      button.className = `ot-list__item ${selected?.id === item.id ? 'is-active' : ''} ${
        isTarget ? 'is-intel-target' : ''
      }`.trim();
      button.innerHTML = `
        <div>
          <span class="ot-list__id muted">${item.id}</span>
          <strong>${item.cliente}</strong>
          <span class="muted">${item.fecha} · ${labelTipo(item.tipoServicio || item.tipo)} · ${
        item.conductor || '—'
      } / ${item.vehiculo || '—'}</span>
        </div>
      `;
      button.append(createEstadoBadge(item.estado));
      button.addEventListener('click', () => actions?.selectFlota?.(item.id));
      list.append(button);
    });
    queueMicrotask(() => {
      const t = list.querySelector('.ot-list__item.is-intel-target') || list.querySelector('.ot-list__item.is-active');
      t?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
  };

  const mkInput = (name, type, value, opts = {}) => {
    const inp = document.createElement('input');
    inp.type = type;
    inp.name = name;
    if (type === 'number') {
      inp.min = '0';
      inp.step = 'any';
      inp.value = String(value ?? 0);
    } else {
      inp.value = value ?? '';
    }
    if (opts.list) inp.setAttribute('list', opts.list);
    if (opts.readOnly) {
      inp.readOnly = true;
      inp.className = 'ot-economics-readonly';
    }
    return inp;
  };

  const buildDetail = (sel) => {
    detailCard.replaceChildren();
    contextRail.replaceChildren();
    detailCard.classList.remove('is-intel-detail-focus');

    if (!sel) {
      detailCard.innerHTML =
        integrationStatus === 'sin conexión' && !solicitudes.length
          ? '<h3>Detalle</h3><p class="muted">Sin datos del servidor. No se puede mostrar el detalle hasta reconectar.</p>'
          : '<h3>Detalle</h3><p class="muted">Creá una solicitud o elegí una del listado a la izquierda.</p>';
      const emptyR = document.createElement('p');
      emptyR.className = 'flota-context-rail__empty';
      emptyR.textContent = 'Seleccioná una solicitud para ver pipeline, trazabilidad y contexto operativo.';
      contextRail.append(emptyR);
      return;
    }

    const titleRow = document.createElement('div');
    titleRow.className = 'ot-detail-card__header';
    const titleBlock = document.createElement('div');
    titleBlock.innerHTML = `<p class="muted">Espacio de trabajo · ${sel.id}</p><h3>${sel.cliente}</h3>`;
    titleRow.append(titleBlock, createEstadoBadge(sel.estado));
    if (intelGuidance?.recordLabel && sel.id === intelGuidance.recordLabel) {
      detailCard.classList.add('is-intel-detail-focus');
    }

    const idxCur = FLOTA_ESTADO_CHAIN.indexOf(sel.estado);
    const pipeWrap = document.createElement('div');
    pipeWrap.className = 'flota-pipeline-wrap';
    const pipeRow = document.createElement('div');
    pipeRow.className = 'flota-pipeline';
    pipeRow.setAttribute('role', 'list');
    FLOTA_ESTADO_CHAIN.forEach((st, stepIdx) => {
      const sp = document.createElement('span');
      sp.className = 'flota-pipeline__step';
      sp.setAttribute('role', 'listitem');
      if (sel.estado === st) sp.classList.add('flota-pipeline__step--current');
      else if (idxCur >= 0 && stepIdx < idxCur) sp.classList.add('flota-pipeline__step--past');
      sp.textContent = FLOTA_ESTADO_LABELS[st];
      pipeRow.append(sp);
    });
    const pipeHint = document.createElement('p');
    pipeHint.className = 'muted flota-pipeline-hint';
    pipeHint.textContent = flotaPipelineHint(sel);
    pipeWrap.append(pipeRow, pipeHint);
    const flotaMeta = document.createElement('p');
    flotaMeta.className = 'muted flota-detail-meta';
    const ua = sel.updatedAt
      ? new Date(sel.updatedAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    flotaMeta.textContent = `Última actualización en servidor: ${ua} · Alta por: ${sel.creadoPor || '—'} · Último cambio por: ${sel.actualizadoPor || '—'}`;

    const fBrief = buildFlotaOperationalBrief(sel);
    const opCtx = document.createElement('div');
    opCtx.className = 'hnf-operational-context hnf-operational-context--flota';
    opCtx.setAttribute('data-hnf-domain', 'flota-solicitud');
    opCtx.setAttribute('data-hnf-schema', fBrief.schema);
    const opTitle = document.createElement('h4');
    opTitle.className = 'hnf-operational-context__title';
    if (fBrief.flags.isTerminal) {
      opTitle.textContent = 'Circuito completado';
      const opP = document.createElement('p');
      opP.className = 'muted hnf-operational-context__lead';
      opP.textContent = 'Solicitud en estado cerrado. Los datos quedan solo lectura salvo que operaciones habilite corrección.';
      opCtx.append(opTitle, opP);
    } else {
      opTitle.textContent = 'Contexto operativo (siguiente paso)';
      const lead = document.createElement('p');
      lead.className = 'muted hnf-operational-context__lead';
      const nx = fBrief.nextEstado;
      lead.textContent = nx
        ? `Siguiente en circuito: «${FLOTA_ESTADO_LABELS[nx] || nx}». ${
            fBrief.blockers.length
              ? 'Antes de avanzar, resolvé lo siguiente:'
              : 'Sin bloqueos detectados en servidor para el siguiente paso (si cambiaste el formulario, usá Guardar datos).'
          }`
        : 'Sin siguiente estado.';
      opCtx.append(opTitle, lead);
      if (fBrief.blockers.length) {
        const ul = document.createElement('ul');
        ul.className = 'hnf-operational-context__list';
        fBrief.blockers.forEach((b) => {
          const li = document.createElement('li');
          li.textContent = b.detail;
          ul.append(li);
        });
        opCtx.append(ul);
      }
    }

    const ctxStack = document.createElement('div');
    ctxStack.className = 'flota-context-rail';
    ctxStack.append(pipeWrap, flotaMeta, opCtx, buildFlotaTraceBubbles(sel));
    contextRail.append(ctxStack);

    detailCard.append(titleRow);

    const formDetail = document.createElement('form');
    formDetail.className = 'flota-detail-form';
    formDetail.addEventListener('submit', (ev) => ev.preventDefault());

    const gridClass = 'ot-form__grid flota-op-grid--compact';
    const addGrid = (title, { panel = false } = {}) => {
      const wrap = document.createElement('div');
      wrap.className = 'flota-op-block';
      const h = document.createElement('h4');
      h.className = `flota-detail-subtitle${panel ? ' flota-detail-subtitle--panel' : ''}`.trim();
      h.textContent = title;
      const g = document.createElement('div');
      g.className = gridClass;
      wrap.append(h, g);
      return { wrap, grid: g };
    };

    const addLabeled = (grid, label, node) => {
      const w = document.createElement('label');
      w.className = 'form-field';
      const lb = document.createElement('span');
      lb.className = 'form-field__label';
      lb.textContent = label;
      w.append(lb, node);
      grid.append(w);
    };

    const topRow = document.createElement('div');
    topRow.className = 'flota-detail-form__blocks-row';

    const { wrap: w1, grid: g1 } = addGrid('1 · OPERACIÓN');
    addLabeled(g1, 'Cliente', mkInput('cliente', 'text', sel.cliente));
    const tipoD = document.createElement('select');
    tipoD.name = 'tipoServicio';
    TIPO_SERVICIO_OPTS.forEach((t) => tipoD.append(new Option(t.label, t.value)));
    tipoD.value = sel.tipoServicio || sel.tipo || 'traslado';
    addLabeled(g1, 'Tipo de servicio', tipoD);
    addLabeled(g1, 'Fecha', mkInput('fecha', 'date', sel.fecha));
    addLabeled(g1, 'Hora', mkInput('hora', 'time', sel.hora || '09:00'));
    addLabeled(g1, 'Origen', mkInput('origen', 'text', sel.origen));
    addLabeled(g1, 'Destino', mkInput('destino', 'text', sel.destino));
    addLabeled(g1, 'Conductor', mkInput('conductor', 'text', sel.conductor));
    const vehIn = mkInput('vehiculo', 'text', sel.vehiculo, { list: 'flota-vehiculos-datalist2' });
    addLabeled(g1, 'Vehículo', vehIn);
    const estadoD = document.createElement('select');
    estadoD.name = 'estado';
    FLOTA_ESTADO_CHAIN.forEach((e) => estadoD.append(new Option(FLOTA_ESTADO_LABELS[e], e)));
    estadoD.value = sel.estado || 'recibida';
    addLabeled(g1, 'Estado', estadoD);
    addLabeled(
      g1,
      'Detalle',
      (() => {
        const t = document.createElement('textarea');
        t.name = 'detalle';
        t.rows = 1;
        t.value = sel.detalle || '';
        return t;
      })()
    );
    addLabeled(g1, 'Responsable', mkInput('responsable', 'text', sel.responsable));
    addLabeled(
      g1,
      'Observación',
      (() => {
        const t = document.createElement('textarea');
        t.name = 'observacion';
        t.rows = 1;
        t.value = sel.observacion || '';
        return t;
      })()
    );

    const { wrap: w2, grid: g2 } = addGrid('2 · COSTOS', { panel: true });
    addLabeled(g2, 'Combustible', mkInput('costoCombustible', 'number', sel.costoCombustible ?? 0));
    addLabeled(g2, 'Peaje', mkInput('costoPeaje', 'number', sel.costoPeaje ?? 0));
    addLabeled(g2, 'Externo', mkInput('costoExterno', 'number', sel.costoExterno ?? 0));

    topRow.append(w1, w2);
    formDetail.append(topRow);

    const dl2 = document.createElement('datalist');
    dl2.id = 'flota-vehiculos-datalist2';
    plates.forEach((p) => dl2.append(new Option(p)));
    formDetail.append(dl2);

    const { wrap: wRes, grid: gRes } = addGrid('3 · RESULTADO (solo lectura)', { panel: true });
    const tarifaRO = mkInput('_tarifaBase', 'text', '0', { readOnly: true });
    const costoRO = mkInput('_costoTotalLive', 'text', '0', { readOnly: true });
    const utilRO = mkInput('_utilidadLive', 'text', '0', { readOnly: true });
    utilRO.setAttribute('aria-live', 'polite');
    addLabeled(gRes, 'Tarifa base', tarifaRO);
    addLabeled(gRes, 'Costo total', costoRO);
    addLabeled(gRes, 'Utilidad', utilRO);
    formDetail.append(wRes);

    const syncEconomics = () => {
      const partial = {
        tipoServicio: formDetail.querySelector('[name=tipoServicio]')?.value,
        costoCombustible: formDetail.querySelector('[name=costoCombustible]')?.value,
        costoPeaje: formDetail.querySelector('[name=costoPeaje]')?.value,
        costoExterno: formDetail.querySelector('[name=costoExterno]')?.value,
      };
      const { tarifaBase, costoTotal, utilidad } = flotaEconomicsLivePreview(partial, sel);
      tarifaRO.value = String(tarifaBase);
      costoRO.value = String(costoTotal);
      utilRO.value = String(utilidad);
      utilRO.classList.remove('flota-utilidad--pos', 'flota-utilidad--neg');
      if (utilidad > 0) utilRO.classList.add('flota-utilidad--pos');
      else if (utilidad < 0) utilRO.classList.add('flota-utilidad--neg');
    };
    syncEconomics();

    const collectPayload = () => ({
      cliente: formDetail.querySelector('[name=cliente]')?.value?.trim() || sel.cliente,
      tipoServicio: formDetail.querySelector('[name=tipoServicio]')?.value,
      fecha: formDetail.querySelector('[name=fecha]')?.value,
      hora: formDetail.querySelector('[name=hora]')?.value,
      origen: formDetail.querySelector('[name=origen]')?.value?.trim(),
      destino: formDetail.querySelector('[name=destino]')?.value?.trim(),
      conductor: formDetail.querySelector('[name=conductor]')?.value?.trim(),
      vehiculo: formDetail.querySelector('[name=vehiculo]')?.value?.trim(),
      estado: formDetail.querySelector('[name=estado]')?.value,
      detalle: formDetail.querySelector('[name=detalle]')?.value?.trim() ?? '',
      responsable: formDetail.querySelector('[name=responsable]')?.value?.trim() ?? '',
      observacion: formDetail.querySelector('[name=observacion]')?.value?.trim() ?? '',
      observacionCierre: formDetail.querySelector('[name=observacionCierre]')?.value?.trim() ?? '',
      costoCombustible: round2(formDetail.querySelector('[name=costoCombustible]')?.value),
      costoPeaje: round2(formDetail.querySelector('[name=costoPeaje]')?.value),
      costoExterno: round2(formDetail.querySelector('[name=costoExterno]')?.value),
    });

    const midBar = document.createElement('div');
    midBar.className = 'flota-detail-toolbar';
    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.className = 'primary-button';
    btnSave.textContent = 'Guardar datos';
    btnSave.title = 'Graba operación y costos en el servidor (tarifa, costo total y utilidad las recalcula el backend).';
    btnSave.addEventListener('click', async () => {
      if (btnSave.disabled) return;
      const prevLabel = btnSave.textContent;
      btnSave.disabled = true;
      btnSave.textContent = 'Guardando…';
      try {
        await flotaSolicitudService.patch(sel.id, collectPayload());
        notifyGlobal('success', `Solicitud ${sel.id} guardada en el servidor.`);
        await runReload();
      } catch (err) {
        notifyGlobal('error', err.message || 'No se pudo guardar.');
        btnSave.textContent = prevLabel;
        btnSave.disabled = false;
      }
    });
    midBar.append(btnSave);
    formDetail.append(midBar);

    const { wrap: w4, grid: g4 } = addGrid('4 · CIERRE', { panel: true });
    addLabeled(
      g4,
      'Observación de cierre',
      (() => {
        const t = document.createElement('textarea');
        t.name = 'observacionCierre';
        t.rows = 2;
        t.placeholder = 'Obligatoria para cerrar la OT';
        t.value = sel.observacionCierre || '';
        return t;
      })()
    );
    const closeBar = document.createElement('div');
    closeBar.className = 'flota-detail-toolbar flota-detail-toolbar--tight';
    const next = flotaNextEstado(sel.estado);
    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = next === 'cerrada' ? 'primary-button flota-btn-next' : 'secondary-button flota-btn-next';
    btnNext.textContent = next
      ? next === 'cerrada'
        ? 'Cerrar OT'
        : `Siguiente: ${FLOTA_ESTADO_LABELS[next]}`
      : 'Último estado alcanzado';
    btnNext.disabled = !next;

    const refreshNextGate = () => {
      const nxt = flotaNextEstado(sel.estado);
      syncEconomics();
      if (!nxt) {
        btnNext.disabled = true;
        btnNext.title = '';
        return;
      }
      let dis = false;
      let title = '';
      if (nxt === 'en_ruta') {
        const c = formDetail.querySelector('[name=conductor]')?.value;
        const v = formDetail.querySelector('[name=vehiculo]')?.value;
        if (!asignadoReal(c) || !asignadoReal(v)) {
          dis = true;
          title = 'Asigná conductor y vehículo reales antes de «En ruta».';
        }
      }
      if (nxt === 'cerrada') {
        const c = formDetail.querySelector('[name=conductor]')?.value;
        const v = formDetail.querySelector('[name=vehiculo]')?.value;
        const obsC = formDetail.querySelector('[name=observacionCierre]')?.value?.trim();
        const t = sumTresCostosForm(formDetail);
        if (!asignadoReal(c) || !asignadoReal(v) || t <= 0 || !obsC) {
          dis = true;
          title = MSG_CIERRE_FLOTA;
        }
      }
      btnNext.disabled = dis;
      btnNext.title = title
        ? title
        : nxt === 'cerrada'
          ? 'Guarda datos operativos y costos, y aplica estado cerrada (validado en servidor).'
          : `Cambia el estado a «${FLOTA_ESTADO_LABELS[nxt]}» (sin guardar el resto del formulario salvo al cerrar).`;
    };
    refreshNextGate();

    btnNext.addEventListener('click', async () => {
      if (!next || btnNext.disabled) return;
      const prevLabel = btnNext.textContent;
      btnNext.disabled = true;
      btnNext.textContent = next === 'cerrada' ? 'Cerrando…' : 'Avanzando…';
      try {
        if (next === 'cerrada') {
          await flotaSolicitudService.patch(sel.id, collectPayload());
        }
        await flotaSolicitudService.patch(sel.id, { estado: next });
        notifyGlobal('success', `Estado actualizado a «${FLOTA_ESTADO_LABELS[next]}».`);
        await runReload();
      } catch (err) {
        notifyGlobal('error', err.message || 'No se pudo cambiar el estado.');
        btnNext.textContent = prevLabel;
        refreshNextGate();
      }
    });

    closeBar.append(btnNext);
    w4.append(closeBar);
    formDetail.append(w4);

    const wireRefresh = () => refreshNextGate();
    [
      'conductor',
      'vehiculo',
      'tipoServicio',
      'costoCombustible',
      'costoPeaje',
      'costoExterno',
      'observacionCierre',
    ].forEach((nm) => {
      formDetail.querySelector(`[name=${nm}]`)?.addEventListener('input', wireRefresh);
      formDetail.querySelector(`[name=${nm}]`)?.addEventListener('change', wireRefresh);
    });

    const hist = sel.historial;
    if (Array.isArray(hist) && hist.length) {
      const hh = document.createElement('h4');
      hh.className = 'flota-detail-subtitle';
      hh.textContent = 'Historial y auditoría reciente';
      const ul = document.createElement('ul');
      ul.className = 'flota-historial';
      [...hist]
        .slice(-12)
        .reverse()
        .forEach((entry) => {
          const li = document.createElement('li');
          const at = entry.at ? new Date(entry.at).toLocaleString('es-CL') : '';
          const who = entry.actor ? ` · ${entry.actor}` : '';
          li.textContent = `${at} · ${entry.accion || '—'} · ${entry.detalle || ''}${who}`;
          ul.append(li);
        });
      formDetail.append(hh, ul);
    }

    detailCard.append(formDetail);
  };

  listCard.append(list);
  overview.append(listCard, detailCard, contextRail);

  fCliente.addEventListener('input', () => {
    renderList();
    buildDetail(selected);
  });
  fEstado.addEventListener('change', () => {
    renderList();
    buildDetail(selected);
  });

  renderList();
  buildDetail(selected);

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
  heroBand.className = 'hnf-flota__hero';
  heroBand.append(header, flowStrip, flotaIdentity, ...(offlineBanner ? [offlineBanner] : []), cards, otBandeja);

  const opsBand = document.createElement('div');
  opsBand.className = 'hnf-flota__ops';
  opsBand.append(resumenTitle, resumenWrap, solTitle, form);

  const deskBand = document.createElement('div');
  deskBand.className = 'hnf-flota__desk';
  deskBand.append(filtTitle, filtRow, ...(intelStrip ? [intelStrip] : []), overview);

  section.append(heroBand, opsBand, deskBand);
  renderResumen();

  return section;
};

import { createCard } from '../components/card.js';
import { flotaSolicitudService } from '../services/flota-solicitud.service.js';

const TIPO_SERVICIO_OPTS = [
  { value: 'traslado', label: 'Traslado' },
  { value: 'asistencia', label: 'Asistencia' },
  { value: 'otro', label: 'Otro' },
];

const ESTADO_CHAIN = [
  'recibida',
  'evaluacion',
  'cotizada',
  'aprobada',
  'programada',
  'en_ruta',
  'completada',
  'cerrada',
];

const ESTADO_LABELS = {
  recibida: 'Recibida',
  evaluacion: 'Evaluación',
  cotizada: 'Cotizada',
  aprobada: 'Aprobada',
  programada: 'Programada',
  en_ruta: 'En ruta',
  completada: 'Completada',
  cerrada: 'Cerrada',
};

const labelTipo = (v) => TIPO_SERVICIO_OPTS.find((t) => t.value === v)?.label || v;
const labelEstado = (e) => ESTADO_LABELS[e] || e;

const nextEstado = (e) => {
  const i = ESTADO_CHAIN.indexOf(e);
  if (i < 0 || i >= ESTADO_CHAIN.length - 1) return null;
  return ESTADO_CHAIN[i + 1];
};

const monthPrefix = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const round2 = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

const sumCostosForm = (el) => {
  if (!el) return 0;
  const q = (n) => round2(el.querySelector(`[name="${n}"]`)?.value);
  return round2(
    q('costoCombustible') +
      q('costoPeaje') +
      q('costoChofer') +
      q('costoExterno') +
      q('materiales') +
      q('manoObra') +
      q('costoTraslado') +
      q('otros')
  );
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
} = {}) => {
  const section = document.createElement('section');
  section.className = 'flota-module';

  const vehicles = data?.vehicles?.data || [];
  const expenses = data?.expenses?.data || [];
  const solicitudes = [...(data?.flotaSolicitudes || [])].sort((a, b) =>
    String(b.fecha).localeCompare(String(a.fecha))
  );

  const plates = [
    ...new Set(vehicles.map((v) => String(v.plate || '').trim()).filter(Boolean)),
  ].sort();

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML =
    '<h2>Flota · solicitudes de clientes</h2><p class="muted"><strong>Qué hacés acá:</strong> cargar pedidos (traslados u otros), llevar el estado paso a paso y registrar costos al cerrar. <strong>Guardar datos</strong> graba el formulario; <strong>Siguiente estado</strong> solo avanza el estado (si el servidor lo permite).</p>';

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
      items: [`Activas en pantalla: ${solicitudes.length}`, 'Orden típico: ' + ESTADO_CHAIN.map((e) => ESTADO_LABELS[e]).join(' → ')],
    },
  ].forEach((item) => cards.append(createCard(item)));

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

  const ingresoRow = (s) => round2(s.ingresoEstimado) || round2(s.monto) || 0;

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
      '<thead><tr><th>Cliente</th><th>Solicitudes en el mes</th><th>Ingreso estimado (suma)</th></tr></thead>';
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
  ESTADO_CHAIN.forEach((e) => estadoCreate.append(new Option(ESTADO_LABELS[e], e)));
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
  ESTADO_CHAIN.forEach((e) => fEstado.append(new Option(ESTADO_LABELS[e], e)));
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

  const overview = document.createElement('div');
  overview.className = 'ot-overview';

  const listCard = document.createElement('article');
  listCard.className = 'ot-list-card';
  listCard.innerHTML =
    '<div class="ot-list-card__header"><h3>Solicitudes</h3><p class="muted">Elegí una fila para editar costos y avanzar el estado.</p></div>';

  const list = document.createElement('div');
  list.className = 'ot-list';

  const detailCard = document.createElement('article');
  detailCard.className = 'ot-detail-card';

  const selected =
    solicitudes.find((s) => s.id === selectedFlotaId) || solicitudes[0] || null;

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
      empty.textContent = 'No hay solicitudes con este criterio.';
      list.append(empty);
      return;
    }

    rows.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ot-list__item ${selected?.id === item.id ? 'is-active' : ''}`.trim();
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
    detailCard.innerHTML = '';

    if (!sel) {
      detailCard.innerHTML =
        '<h3>Detalle</h3><p class="muted">Creá una solicitud o elegí una del listado.</p>';
      return;
    }

    const titleRow = document.createElement('div');
    titleRow.className = 'ot-detail-card__header';
    const titleBlock = document.createElement('div');
    titleBlock.innerHTML = `<p class="muted">Detalle · ${sel.id}</p><h3>${sel.cliente}</h3>`;
    titleRow.append(titleBlock, createEstadoBadge(sel.estado));
    detailCard.append(titleRow);

    const formDetail = document.createElement('form');
    formDetail.className = 'flota-detail-form';
    formDetail.addEventListener('submit', (ev) => ev.preventDefault());

    const gridClass = 'ot-form__grid';
    const addGrid = (title) => {
      const h = document.createElement('h4');
      h.className = 'flota-detail-subtitle';
      h.textContent = title;
      const g = document.createElement('div');
      g.className = gridClass;
      formDetail.append(h, g);
      return g;
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

    let g1 = addGrid('Servicio y ruta');
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
    ESTADO_CHAIN.forEach((e) => estadoD.append(new Option(ESTADO_LABELS[e], e)));
    estadoD.value = sel.estado || 'recibida';
    addLabeled(g1, 'Estado (selector libre)', estadoD);

    addLabeled(g1, 'Detalle', (() => {
      const t = document.createElement('textarea');
      t.name = 'detalle';
      t.rows = 2;
      t.value = sel.detalle || '';
      return t;
    })());
    addLabeled(g1, 'Responsable', mkInput('responsable', 'text', sel.responsable));
    addLabeled(g1, 'Observación', (() => {
      const t = document.createElement('textarea');
      t.name = 'observacion';
      t.rows = 2;
      t.value = sel.observacion || '';
      return t;
    })());
    addLabeled(g1, 'Observación de cierre', (() => {
      const t = document.createElement('textarea');
      t.name = 'observacionCierre';
      t.rows = 2;
      t.placeholder = 'Obligatoria al pasar a cerrada (o usá observación si ya está completa)';
      t.value = sel.observacionCierre || '';
      return t;
    })());

    const dl2 = document.createElement('datalist');
    dl2.id = 'flota-vehiculos-datalist2';
    plates.forEach((p) => dl2.append(new Option(p)));
    formDetail.append(dl2);

    let g2 = addGrid('Costos operación (combustible, peaje, chofer, externo)');
    addLabeled(g2, 'Combustible', mkInput('costoCombustible', 'number', sel.costoCombustible));
    addLabeled(g2, 'Peaje', mkInput('costoPeaje', 'number', sel.costoPeaje));
    addLabeled(g2, 'Chofer', mkInput('costoChofer', 'number', sel.costoChofer));
    addLabeled(g2, 'Externo', mkInput('costoExterno', 'number', sel.costoExterno));

    let g3 = addGrid('Costos agregados (materiales, MO, traslado, otros)');
    addLabeled(g3, 'Materiales', mkInput('materiales', 'number', sel.materiales));
    addLabeled(g3, 'Mano de obra', mkInput('manoObra', 'number', sel.manoObra));
    addLabeled(g3, 'Traslado', mkInput('costoTraslado', 'number', sel.costoTraslado));
    addLabeled(g3, 'Otros', mkInput('otros', 'number', sel.otros));

    let g4 = addGrid('Totales e ingresos (indicador interno)');
    addLabeled(
      g4,
      'Costo total (servidor)',
      mkInput('_costoTotal', 'text', String(sel.costoTotal ?? 0), { readOnly: true })
    );
    addLabeled(
      g4,
      'Utilidad (servidor)',
      mkInput('_utilidad', 'text', String(sel.utilidad ?? 0), { readOnly: true })
    );
    addLabeled(g4, 'Ingreso estimado', mkInput('ingresoEstimado', 'number', sel.ingresoEstimado));
    addLabeled(g4, 'Ingreso final', mkInput('ingresoFinal', 'number', sel.ingresoFinal));
    addLabeled(g4, 'Monto cobrado', mkInput('montoCobrado', 'number', sel.montoCobrado));
    addLabeled(g4, 'Monto (legacy)', mkInput('monto', 'number', sel.monto));

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
      costoChofer: round2(formDetail.querySelector('[name=costoChofer]')?.value),
      costoExterno: round2(formDetail.querySelector('[name=costoExterno]')?.value),
      materiales: round2(formDetail.querySelector('[name=materiales]')?.value),
      manoObra: round2(formDetail.querySelector('[name=manoObra]')?.value),
      costoTraslado: round2(formDetail.querySelector('[name=costoTraslado]')?.value),
      otros: round2(formDetail.querySelector('[name=otros]')?.value),
      ingresoEstimado: round2(formDetail.querySelector('[name=ingresoEstimado]')?.value),
      ingresoFinal: round2(formDetail.querySelector('[name=ingresoFinal]')?.value),
      montoCobrado: round2(formDetail.querySelector('[name=montoCobrado]')?.value),
      monto: round2(formDetail.querySelector('[name=monto]')?.value),
    });

    const toolbar = document.createElement('div');
    toolbar.className = 'flota-detail-toolbar';

    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.className = 'primary-button';
    btnSave.textContent = 'Guardar datos';
    btnSave.title = 'Graba en el servidor todo lo que figura en el formulario (incluye estado si lo cambiaste en el selector).';
    btnSave.addEventListener('click', async () => {
      try {
        await flotaSolicitudService.patch(sel.id, collectPayload());
        notifyGlobal('success', `Guardado ${sel.id}.`);
        await runReload();
      } catch (err) {
        notifyGlobal('error', err.message || 'No se pudo guardar.');
      }
    });

    const next = nextEstado(sel.estado);
    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'secondary-button flota-btn-next';
    btnNext.textContent = next ? `Siguiente: ${ESTADO_LABELS[next]}` : 'Último estado alcanzado';
    btnNext.title = next
      ? `Solo cambia el estado a «${ESTADO_LABELS[next]}». No guarda el resto del formulario: usá Guardar datos si cargaste costos u observaciones.`
      : '';
    btnNext.disabled = !next;

    const cond = formDetail.querySelector('[name=conductor]')?.value;
    const veh = formDetail.querySelector('[name=vehiculo]')?.value;
    if (next === 'en_ruta' && (!asignadoReal(cond) || !asignadoReal(veh))) {
      btnNext.disabled = true;
      btnNext.title = 'Asigná conductor y vehículo reales antes de «En ruta».';
    }

    const obsCierre = formDetail.querySelector('[name=observacionCierre]')?.value?.trim();
    const obs = formDetail.querySelector('[name=observacion]')?.value?.trim();
    const localTotal = sumCostosForm(formDetail);
    if (next === 'cerrada') {
      if (localTotal <= 0) {
        btnNext.disabled = true;
        btnNext.title = 'Registrá costos (total > 0) y guardá antes de cerrar, o completá los campos y usá Guardar datos.';
      }
      if (!(obsCierre || obs)) {
        btnNext.disabled = true;
        btnNext.title = 'Completá observación de cierre o observación antes de cerrar.';
      }
    }

    btnNext.addEventListener('click', async () => {
      if (!next) return;
      try {
        await flotaSolicitudService.patch(sel.id, { estado: next });
        notifyGlobal('success', `Estado avanzado a «${ESTADO_LABELS[next]}».`);
        await runReload();
      } catch (err) {
        notifyGlobal('error', err.message || 'No se pudo cambiar el estado.');
      }
    });

    [formDetail.querySelector('[name=conductor]'), formDetail.querySelector('[name=vehiculo]')].forEach(
      (inp) => {
        inp?.addEventListener('input', () => {
          const nxt = nextEstado(sel.estado);
          if (nxt !== 'en_ruta') return;
          const c = formDetail.querySelector('[name=conductor]')?.value;
          const v = formDetail.querySelector('[name=vehiculo]')?.value;
          btnNext.disabled = !asignadoReal(c) || !asignadoReal(v);
          btnNext.title = btnNext.disabled
            ? 'Asigná conductor y vehículo reales antes de «En ruta».'
            : '';
        });
      }
    );

    [
      'costoCombustible',
      'costoPeaje',
      'costoChofer',
      'costoExterno',
      'materiales',
      'manoObra',
      'costoTraslado',
      'otros',
      'observacionCierre',
      'observacion',
    ].forEach((nm) => {
      formDetail.querySelector(`[name=${nm}]`)?.addEventListener('input', () => {
        const nxt = nextEstado(sel.estado);
        if (nxt !== 'cerrada') return;
        const t = sumCostosForm(formDetail);
        const o1 = formDetail.querySelector('[name=observacionCierre]')?.value?.trim();
        const o2 = formDetail.querySelector('[name=observacion]')?.value?.trim();
        btnNext.disabled = t <= 0 || !(o1 || o2);
        btnNext.title = btnNext.disabled
          ? 'Para cerrar: costos con total > 0 y observación final.'
          : '';
      });
    });

    toolbar.append(btnSave, btnNext);
    formDetail.append(toolbar);

    const hist = sel.historial;
    if (Array.isArray(hist) && hist.length) {
      const hh = document.createElement('h4');
      hh.className = 'flota-detail-subtitle';
      hh.textContent = 'Historial reciente';
      const ul = document.createElement('ul');
      ul.className = 'flota-historial';
      [...hist]
        .slice(-12)
        .reverse()
        .forEach((entry) => {
          const li = document.createElement('li');
          const at = entry.at ? new Date(entry.at).toLocaleString('es-CL') : '';
          li.textContent = `${at} · ${entry.accion || '—'} · ${entry.detalle || ''}`;
          ul.append(li);
        });
      formDetail.append(hh, ul);
    }

    detailCard.append(formDetail);
  };

  listCard.append(list);
  overview.append(listCard, detailCard);

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

  section.append(
    header,
    cards,
    resumenTitle,
    resumenWrap,
    solTitle,
    form,
    filtTitle,
    filtRow,
    overview
  );
  renderResumen();

  return section;
};

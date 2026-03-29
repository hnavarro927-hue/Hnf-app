import {
  listIngresosOperativosDelDia,
  appendIngresoOperativo,
  setIngresoOperativoEstado,
  syncWhatsappFeedToIngresosOperativos,
  patchIngresoOperativo,
  INGRESO_PRIORIDADES,
  normalizePrioridadFromUi,
} from '../domain/ingreso-operativo-storage.js';
import {
  classifyWhatsappOperative,
  mapWhatsappEstadoToIngreso,
} from '../domain/whatsapp-operational-ingest.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import {
  HNF_OT_OPERATION_MODES,
  HNF_OT_TECNICOS_PRESETS,
} from '../constants/hnf-ot-operation.js';

const CASO_LABEL = {
  ot: 'OT',
  consulta: 'Consulta',
  cierre: 'Cierre',
  problema: 'Problema',
};

const URG_LABEL = { alta: 'Urgencia alta', media: 'Urgencia media', baja: 'Urgencia baja' };

const ORIGEN_LABEL = {
  whatsapp: 'WhatsApp',
  cliente_directo: 'Cliente directo',
  interno: 'Interno',
  email: 'Email',
  correo: 'Correo',
  llamada: 'Llamada',
  manual: 'Manual',
};

const PRIO_LABEL = {
  baja: 'Prioridad baja',
  media: 'Prioridad media',
  alta: 'Prioridad alta',
};

const SUBTIPO_BY_TIPO = {
  clima: [
    { value: 'Mantención preventiva', label: 'Mantención preventiva' },
    { value: 'Mantención correctiva', label: 'Mantención correctiva' },
    { value: 'Emergencia', label: 'Emergencia' },
    { value: 'Visita técnica', label: 'Visita técnica' },
  ],
  flota: [
    { value: 'Traslado', label: 'Traslado' },
    { value: 'Revisión técnica', label: 'Revisión técnica' },
    { value: 'Mantención', label: 'Mantención' },
    { value: 'Emergencia', label: 'Emergencia' },
    { value: 'Asistencia puntual', label: 'Asistencia puntual' },
  ],
};

const pad2 = (n) => String(n).padStart(2, '0');
const defaultFechaSolicitud = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const defaultHoraSolicitud = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const collectClientesNombres = (data) => {
  const set = new Set();
  const rawClients = data?.clients?.data ?? data?.clients;
  if (Array.isArray(rawClients)) {
    for (const c of rawClients) {
      const n = String(c?.nombre || c?.name || c?.cliente || '').trim();
      if (n) set.add(n);
    }
  }
  for (const o of data?.planOts || []) {
    const n = String(o?.cliente || '').trim();
    if (n) set.add(n);
  }
  const ots = data?.ots?.data ?? [];
  if (Array.isArray(ots)) {
    for (const o of ots) {
      const n = String(o?.cliente || '').trim();
      if (n) set.add(n);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
};

const resolveTecnicoIngreso = (form) => {
  const preset = form.elements.tecnicoPreset?.value;
  const otro = form.elements.tecnicoOtro?.value?.trim() || '';
  if (preset === '__otro__') return otro || 'Por asignar';
  return preset || 'Por asignar';
};

const buildOtPayloadFromIngresoForm = (form) => {
  const cliente = form.elements.cliente?.value?.trim() || '';
  const contacto = form.elements.contacto?.value?.trim() || '';
  const telefono = form.elements.telefono?.value?.trim() || '';
  const direccion = form.elements.direccion?.value?.trim() || '';
  const comuna = form.elements.comuna?.value?.trim() || '';
  const emailCorreo = form.elements.emailCorreo?.value?.trim() || '';
  const regionZona = form.elements.regionZona?.value?.trim() || '';
  const tipo = form.elements.tipo?.value || 'clima';
  const subtipo = form.elements.subtipo?.value?.trim() || '';
  const origen = form.elements.origen?.value || 'interno';
  const fechaSolicitud = form.elements.fechaSolicitud?.value || '';
  const horaSolicitud = form.elements.horaSolicitud?.value || '';
  const descripcion = form.elements.descripcion?.value?.trim() || '';
  const observaciones = form.elements.observaciones?.value?.trim() || '';
  const prioridadUi = form.elements.prioridad?.value || 'media';
  const whatsappNum = form.elements.whatsappNumero?.value?.trim() || '';
  const whatsappNom = form.elements.whatsappNombre?.value?.trim() || '';
  const fechaVisita = form.elements.fechaVisita?.value?.trim() || '';
  const horaVisita = form.elements.horaVisita?.value?.trim() || '';
  const operationMode = form.elements.operationMode?.value || 'manual';
  const otManualId = form.elements.otManualId?.value?.trim() || '';
  const tecnicoAsignado = resolveTecnicoIngreso(form);

  const prioridadLine = `Prioridad operativa: ${PRIO_LABEL[normalizePrioridadFromUi(prioridadUi)] || prioridadUi}`;
  const metaLines = [
    `[Ingreso HNF · origenSolicitud: ${origen} · registro solicitud ${fechaSolicitud} ${horaSolicitud || ''}]`,
    prioridadLine,
    emailCorreo && `Correo cliente: ${emailCorreo}`,
    regionZona && `Región / zona: ${regionZona}`,
    fechaVisita && `Preferencia de visita: ${fechaVisita}${horaVisita ? ` ${horaVisita}` : ''}`,
  ].filter(Boolean);

  const observacionesOt = [descripcion, observaciones, metaLines.join('\n')].filter(Boolean).join('\n\n');

  return {
    payload: {
      ...(otManualId ? { id: otManualId } : {}),
      cliente,
      direccion,
      comuna,
      contactoTerreno: contacto,
      telefonoContacto: telefono,
      tipoServicio: tipo,
      subtipoServicio: subtipo,
      operationMode: operationMode === 'automatic' ? 'automatic' : 'manual',
      origenSolicitud: origen,
      origenPedido: origen,
      prioridadOperativa: normalizePrioridadFromUi(prioridadUi),
      whatsappContactoNumero: origen === 'whatsapp' ? whatsappNum : '',
      whatsappContactoNombre: origen === 'whatsapp' ? whatsappNom : '',
      fecha: fechaSolicitud,
      hora: horaSolicitud || '09:00',
      observaciones: observacionesOt,
      resumenTrabajo: '',
      recomendaciones: '',
      tecnicoAsignado,
      equipos: [],
    },
    snapshot: {
      cliente,
      contacto,
      telefono,
      direccion,
      comuna,
      emailCorreo,
      regionZona,
      tipo,
      subtipo,
      origen,
      fechaSolicitud,
      horaSolicitud,
      descripcion,
      observaciones,
      prioridad: normalizePrioridadFromUi(prioridadUi),
      fechaVisita,
      horaVisita,
      operationMode: operationMode === 'automatic' ? 'automatic' : 'manual',
      tecnicoAsignadoOt: tecnicoAsignado,
    },
  };
};

/**
 * Punto de ingesta principal (Romina / Gery): guía clara + alta de OT en servidor.
 */
export const ingresoOperativoView = ({
  data,
  reloadApp,
  navigateToView,
  actions,
  ingresoFeedback,
  isSubmittingIngresoOt,
  integrationStatus,
} = {}) => {
  const root = document.createElement('section');
  root.className = 'hnf-cap-ingreso hnf-cap-ingreso--command hnf-op-view hnf-op-view--ingreso';

  const head = document.createElement('header');
  head.className = 'hnf-cap-ingreso__head';
  head.innerHTML = `
    <h1 class="hnf-cap-ingreso__title">Command Center · Ingreso omnicanal</h1>
    <p class="muted hnf-cap-ingreso__lead">
      Flujo guiado: <strong>origen → cliente → servicio → prioridad → asignación</strong>. La <strong>OT</strong> se crea en el servidor al finalizar; abajo tenés la <strong>bandeja del día</strong> (WhatsApp + altas).
    </p>
  `;

  const flowStrip = createHnfOperationalFlowStrip(0);

  const globalFb = document.createElement('div');
  globalFb.className = 'hnf-ingreso-global-feedback';
  globalFb.setAttribute('role', 'status');
  globalFb.hidden = true;

  const syncGlobalFeedback = () => {
    globalFb.replaceChildren();
    if (!ingresoFeedback?.message) {
      globalFb.hidden = true;
      return;
    }
    globalFb.hidden = false;
    globalFb.className = `hnf-ingreso-global-feedback form-feedback form-feedback--${ingresoFeedback.type || 'neutral'}`;
    const text = document.createElement('p');
    text.className = 'hnf-ingreso-global-feedback__text';
    text.textContent = ingresoFeedback.message;
    globalFb.append(text);
    if (ingresoFeedback.type === 'success' || ingresoFeedback.type === 'error') {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'secondary-button hnf-ingreso-global-feedback__close';
      close.textContent = 'Cerrar aviso';
      close.addEventListener('click', () => actions?.clearIngresoFeedback?.());
      globalFb.append(close);
    }
  };
  syncGlobalFeedback();

  const waSyncNote = document.createElement('p');
  waSyncNote.className = 'hnf-cap-ingreso__sync muted small';
  waSyncNote.setAttribute('role', 'status');
  waSyncNote.textContent = '';

  const formCard = document.createElement('div');
  formCard.className = 'hnf-cap-ingreso__form-card hnf-ingreso-intake';

  const formIntro = document.createElement('div');
  formIntro.className = 'hnf-ingreso-intake__intro';
  formIntro.innerHTML = `
    <h2 class="hnf-ingreso-intake__intro-title">Nueva solicitud → OT en el servidor</h2>
    <p class="muted small hnf-ingreso-intake__intro-text">
      <strong>Qué hacés acá:</strong> contás quién pidió el servicio, desde dónde llegó, qué necesita y cómo operarlo (modo / técnico).<br/>
      <strong>Por qué importa:</strong> la OT queda con trazabilidad para el equipo y para Jarvis.<br/>
      <strong>Después de guardar:</strong> la OT existe en <strong>Clima</strong> (ejecución técnica); podés abrirla desde el aviso o desde el listado del día abajo.
    </p>
  `;
  formCard.append(formIntro);

  const form = document.createElement('form');
  form.className = 'hnf-ingreso-intake-form';
  form.setAttribute('novalidate', 'true');

  const mkField = (name, label, type = 'text', extra = {}) => {
    const w = document.createElement('label');
    w.className = 'hnf-cap-ingreso__field';
    const lb = document.createElement('span');
    lb.className = 'hnf-cap-ingreso__label';
    lb.textContent = label;
    let el;
    if (type === 'select') {
      el = document.createElement('select');
      el.name = name;
      for (const o of extra.options || []) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        el.append(opt);
      }
    } else if (type === 'textarea') {
      el = document.createElement('textarea');
      el.name = name;
      el.rows = extra.rows || 3;
      el.autocomplete = 'on';
    } else {
      el = document.createElement('input');
      el.type = type;
      el.name = name;
      el.autocomplete = 'on';
    }
    el.className = 'hnf-cap-ingreso__input';
    if (extra.placeholder) el.placeholder = extra.placeholder;
    if (extra.required) el.required = true;
    w.append(lb, el);
    if (extra.hint) {
      const h = document.createElement('span');
      h.className = 'hnf-cap-ingreso__hint muted small';
      h.textContent = extra.hint;
      w.append(h);
    }
    return w;
  };

  const mkSection = (title, introHtml, className = '') => {
    const sec = document.createElement('section');
    sec.className = `hnf-ingreso-section ${className}`.trim();
    const hd = document.createElement('div');
    hd.className = 'hnf-ingreso-section__header';
    const ht = document.createElement('h3');
    ht.className = 'hnf-ingreso-section__title';
    ht.textContent = title;
    const intro = document.createElement('p');
    intro.className = 'hnf-ingreso-section__intro muted small';
    intro.innerHTML = introHtml;
    hd.append(ht, intro);
    const body = document.createElement('div');
    body.className = 'hnf-ingreso-section__body hnf-cap-ingreso__grid';
    sec.append(hd, body);
    return { sec, body };
  };

  const nombresClientes = collectClientesNombres(data);

  /* —— A · Origen —— */
  const secA = mkSection(
    'A · Origen de la solicitud',
    'Indicá <strong>cuándo</strong> te llegó el pedido y <strong>por qué canal</strong>. Así Jarvis y la operación entienden el contexto.'
  );
  const origenSel = document.createElement('select');
  origenSel.name = 'origen';
  origenSel.className = 'hnf-cap-ingreso__input';
  origenSel.required = true;
  [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'cliente_directo', label: 'Cliente directo' },
    { value: 'interno', label: 'Interno' },
    { value: 'email', label: 'Email' },
  ].forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    origenSel.append(opt);
  });
  const wOrigen = document.createElement('label');
  wOrigen.className = 'hnf-cap-ingreso__field';
  wOrigen.innerHTML = '<span class="hnf-cap-ingreso__label">Origen *</span>';
  const hintOrigen = document.createElement('span');
  hintOrigen.className = 'hnf-cap-ingreso__hint muted small';
  hintOrigen.textContent =
    'Seleccioná desde dónde llegó esta solicitud (no es el tipo de servicio; eso va más abajo).';
  wOrigen.append(origenSel, hintOrigen);

  const fechaSol = document.createElement('input');
  fechaSol.type = 'date';
  fechaSol.name = 'fechaSolicitud';
  fechaSol.className = 'hnf-cap-ingreso__input';
  fechaSol.required = true;
  fechaSol.value = defaultFechaSolicitud();
  const wFecha = document.createElement('label');
  wFecha.className = 'hnf-cap-ingreso__field';
  wFecha.innerHTML = '<span class="hnf-cap-ingreso__label">Fecha de la solicitud *</span>';
  const hF = document.createElement('span');
  hF.className = 'hnf-cap-ingreso__hint muted small';
  hF.textContent = 'Día en que el cliente te contactó o dejaste constancia del pedido.';
  wFecha.append(fechaSol, hF);

  const horaSol = document.createElement('input');
  horaSol.type = 'time';
  horaSol.name = 'horaSolicitud';
  horaSol.className = 'hnf-cap-ingreso__input';
  horaSol.value = defaultHoraSolicitud();
  const wHora = document.createElement('label');
  wHora.className = 'hnf-cap-ingreso__field';
  wHora.innerHTML = '<span class="hnf-cap-ingreso__label">Hora de la solicitud</span>';
  const hH = document.createElement('span');
  hH.className = 'hnf-cap-ingreso__hint muted small';
  hH.textContent = 'Referencia operativa; podés ajustar si no la tenés exacta.';
  wHora.append(horaSol, hH);

  const wWaNum = mkField('whatsappNumero', 'WhatsApp · número de contacto *', 'tel', {
    placeholder: 'Ej. +56 9 1234 5678',
    hint: 'Obligatorio si el origen es WhatsApp (entrada externa).',
  });
  const wWaNom = mkField('whatsappNombre', 'WhatsApp · nombre contacto *', 'text', {
    placeholder: 'Ej. Juan Pérez',
    hint: 'Quien escribió o recibe el seguimiento por ese número.',
  });
  const syncWaFields = () => {
    const on = origenSel.value === 'whatsapp';
    wWaNum.style.display = on ? '' : 'none';
    wWaNom.style.display = on ? '' : 'none';
  };
  origenSel.addEventListener('change', syncWaFields);
  syncWaFields();

  secA.body.append(wOrigen, wFecha, wHora, wWaNum, wWaNom);

  /* —— B · Cliente —— */
  const secB = mkSection(
    'B · Cliente y contacto',
    'Datos que van a la OT. Si ya está en el sistema, elegilo en la lista y se rellena el nombre. Contacto, teléfono, dirección y comuna van siempre visibles; correo y región son opcionales abajo.'
  );

  const presetSel = document.createElement('select');
  presetSel.name = 'clientePreset';
  presetSel.className = 'hnf-cap-ingreso__input';
  const optEmpty = document.createElement('option');
  optEmpty.value = '';
  optEmpty.textContent = '— Escribir nombre a mano abajo —';
  presetSel.append(optEmpty);
  for (const n of nombresClientes) {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    presetSel.append(opt);
  }
  const optNew = document.createElement('option');
  optNew.value = '__nuevo__';
  optNew.textContent = '✚ Cliente nuevo (mostrar ficha rápida)';
  presetSel.append(optNew);

  const wPreset = document.createElement('label');
  wPreset.className = 'hnf-cap-ingreso__field';
  wPreset.innerHTML = '<span class="hnf-cap-ingreso__label">Cliente existente (opcional)</span>';
  const hPr = document.createElement('span');
  hPr.className = 'hnf-cap-ingreso__hint muted small';
  hPr.textContent = 'Lista armada con clientes y OT recientes. Si no está, usá la ficha nueva.';
  wPreset.append(presetSel, hPr);

  const clienteInp = document.createElement('input');
  clienteInp.type = 'text';
  clienteInp.name = 'cliente';
  clienteInp.className = 'hnf-cap-ingreso__input';
  clienteInp.required = true;
  clienteInp.placeholder = 'Ej. Puma Chile · Bodega Maipú';
  const wCliente = document.createElement('label');
  wCliente.className = 'hnf-cap-ingreso__field';
  wCliente.innerHTML = '<span class="hnf-cap-ingreso__label">Nombre cliente / empresa *</span>';
  const hCl = document.createElement('span');
  hCl.className = 'hnf-cap-ingreso__hint muted small';
  hCl.textContent = 'Tal como lo reconoce operación (facturación / visitas).';
  wCliente.append(clienteInp, hCl);

  const coreContactGrid = document.createElement('div');
  coreContactGrid.className = 'hnf-cap-ingreso__grid';
  coreContactGrid.append(
    mkField('contacto', 'Contacto en terreno *', 'text', {
      placeholder: 'Ej. María González — jefa de tienda',
      hint: 'Quien recibe al técnico o coordina la visita / flota.',
      required: true,
    }),
    mkField('telefono', 'Teléfono *', 'tel', {
      placeholder: 'Ej. +56 9 8765 4321',
      hint: 'Obligatorio para crear la OT en el servidor.',
      required: true,
    }),
    mkField('direccion', 'Dirección / lugar *', 'text', {
      placeholder: 'Ej. Av. Los Pajaritos 1234, local 12',
      hint: 'Sitio de la visita o punto de retiro.',
      required: true,
    }),
    mkField('comuna', 'Comuna o ciudad *', 'text', {
      placeholder: 'Ej. Maipú',
      hint: 'Va tal cual a la OT.',
      required: true,
    })
  );

  const quickDetails = document.createElement('details');
  quickDetails.className = 'hnf-ingreso-quick-client';
  quickDetails.innerHTML =
    '<summary class="hnf-ingreso-quick-client__summary">Correo y región (opcional)</summary>';
  const quickGrid = document.createElement('div');
  quickGrid.className = 'hnf-cap-ingreso__grid hnf-ingreso-quick-client__grid';
  quickGrid.append(
    mkField('emailCorreo', 'Correo del cliente', 'email', {
      placeholder: 'Ej. operaciones@cliente.cl',
      hint: 'Se anexa al texto de la OT para que el equipo lo tenga a mano.',
    }),
    mkField('regionZona', 'Región / zona', 'text', {
      placeholder: 'Ej. RM · zona sur',
      hint: 'Opcional; útil para rutas y priorización.',
    })
  );
  quickDetails.append(quickGrid);

  presetSel.addEventListener('change', () => {
    const v = presetSel.value;
    if (v && v !== '__nuevo__') {
      clienteInp.value = v;
    } else if (v === '__nuevo__') {
      quickDetails.open = true;
      clienteInp.focus();
    }
  });

  secB.body.append(wPreset, wCliente, coreContactGrid, quickDetails);

  /* —— C · Tipo —— */
  const secC = mkSection(
    'C · Tipo de servicio',
    '<strong>Clima</strong> (Romina, mantenciones, visitas HVAC) vs <strong>Flota</strong> (Gery, traslados, asistencias). El subtipo cambia según lo que elijas.'
  );
  const tipoSel = document.createElement('select');
  tipoSel.name = 'tipo';
  tipoSel.className = 'hnf-cap-ingreso__input';
  tipoSel.required = true;
  [
    { value: 'clima', label: 'Clima (HVAC)' },
    { value: 'flota', label: 'Flota' },
  ].forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    tipoSel.append(opt);
  });
  const wTipo = document.createElement('label');
  wTipo.className = 'hnf-cap-ingreso__field';
  wTipo.innerHTML = '<span class="hnf-cap-ingreso__label">Tipo *</span>';
  wTipo.append(tipoSel);

  const subtipoSel = document.createElement('select');
  subtipoSel.name = 'subtipo';
  subtipoSel.className = 'hnf-cap-ingreso__input';
  subtipoSel.required = true;
  const fillSubtipo = (tipo) => {
    subtipoSel.replaceChildren();
    const opts = SUBTIPO_BY_TIPO[tipo] || SUBTIPO_BY_TIPO.clima;
    for (const o of opts) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      subtipoSel.append(opt);
    }
  };
  fillSubtipo('clima');
  tipoSel.addEventListener('change', () => fillSubtipo(tipoSel.value));
  const wSub = document.createElement('label');
  wSub.className = 'hnf-cap-ingreso__field';
  wSub.innerHTML = '<span class="hnf-cap-ingreso__label">Subtipo *</span>';
  const hSub = document.createElement('span');
  hSub.className = 'hnf-cap-ingreso__hint muted small';
  hSub.textContent = 'Elegí el tipo de trabajo; si no calza, usá el más cercano y detallá en descripción.';
  wSub.append(subtipoSel, hSub);

  secC.body.append(wTipo, wSub);

  /* —— D · Detalle —— */
  const secD = mkSection(
    'D · Detalle del pedido',
    'Contá el problema o el encargo con frases simples. Cuanto más claro, menos vueltas con el cliente y más rápido en terreno.'
  );
  secD.body.classList.add('hnf-cap-ingreso__group--full');
  secD.body.append(
    mkField('descripcion', 'Descripción del pedido *', 'textarea', {
      rows: 4,
      placeholder:
        'Ej: Emergencia cliente Puma por falla de aire en sucursal Maipú · cámara 2 no enfría desde ayer.',
      hint: 'Qué pasó, qué pidió el cliente, dónde, con qué urgencia percibida.',
      required: true,
    }),
    mkField('prioridad', 'Prioridad operativa *', 'select', {
      options: [
        { value: 'media', label: 'Media' },
        { value: 'baja', label: 'Baja' },
        { value: 'alta', label: 'Alta' },
      ],
      hint: 'Obligatoria para crear la OT en el servidor.',
      required: true,
    }),
    mkField('observaciones', 'Observaciones internas (opcional)', 'textarea', {
      rows: 2,
      placeholder: 'Ej. Coordinar acceso con conserje · pedir llave bodega B',
      hint: 'Notas para el equipo; no necesitan ir al cliente.',
    })
  );
  const visitRow = document.createElement('div');
  visitRow.className = 'hnf-cap-ingreso__grid';
  visitRow.style.marginTop = '8px';
  visitRow.append(
    mkField('fechaVisita', 'Preferencia fecha visita (opcional)', 'date', {
      hint: 'Si el cliente pidió un día; planificación puede ajustar.',
    }),
    mkField('horaVisita', 'Preferencia hora (opcional)', 'time', {
      hint: 'Franja aproximada.',
    })
  );
  secD.body.append(visitRow);

  /* —— E · Control —— */
  const secE = mkSection(
    'E · Control operativo',
    'Definí si la asignación la hace el equipo (<strong>manual</strong>) o si querés que el sistema proponga técnico (<strong>automático</strong> / Jarvis) cuando no elegís uno. El número de OT manual es solo para continuidad con tu libreta.'
  );
  const modeSel = document.createElement('select');
  modeSel.name = 'operationMode';
  modeSel.className = 'hnf-cap-ingreso__input';
  HNF_OT_OPERATION_MODES.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    modeSel.append(opt);
  });
  const wMode = document.createElement('label');
  wMode.className = 'hnf-cap-ingreso__field';
  wMode.innerHTML = '<span class="hnf-cap-ingreso__label">Modo operación</span>';
  const hM = document.createElement('span');
  hM.className = 'hnf-cap-ingreso__hint muted small';
  hM.textContent =
    'Manual: vos elegís técnico. Automático: si dejás «Por asignar», el servidor puede asignar (reglas Jarvis); siempre podés corregir en Clima.';
  wMode.append(modeSel, hM);

  const otMan = document.createElement('input');
  otMan.type = 'text';
  otMan.name = 'otManualId';
  otMan.className = 'hnf-cap-ingreso__input';
  otMan.placeholder = 'Ej. OT-042 (solo si necesitás ese número)';
  otMan.autocomplete = 'off';
  const wOt = document.createElement('label');
  wOt.className = 'hnf-cap-ingreso__field';
  wOt.innerHTML = '<span class="hnf-cap-ingreso__label">Número OT manual (opcional)</span>';
  const hOt = document.createElement('span');
  hOt.className = 'hnf-cap-ingreso__hint muted small';
  hOt.textContent =
    'Usar solo si deseas mantener la continuidad operativa actual con tu numeración. Si lo dejás vacío, el sistema asigna el siguiente OT-###.';
  wOt.append(otMan, hOt);

  const techWrap = document.createElement('div');
  techWrap.className = 'ot-tech-pick';
  const techSel = document.createElement('select');
  techSel.name = 'tecnicoPreset';
  techSel.className = 'hnf-cap-ingreso__input';
  HNF_OT_TECNICOS_PRESETS.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    techSel.append(opt);
  });
  const otroT = document.createElement('option');
  otroT.value = '__otro__';
  otroT.textContent = 'Otro (nombre libre)';
  techSel.append(otroT);
  const techOther = document.createElement('input');
  techOther.type = 'text';
  techOther.name = 'tecnicoOtro';
  techOther.className = 'ot-tech-pick__other hnf-cap-ingreso__input';
  techOther.placeholder = 'Nombre del técnico';
  techOther.hidden = true;
  techSel.addEventListener('change', () => {
    techOther.hidden = techSel.value !== '__otro__';
    if (!techOther.hidden) techOther.focus();
  });
  techWrap.append(techSel, techOther);
  const wTech = document.createElement('label');
  wTech.className = 'hnf-cap-ingreso__field';
  wTech.innerHTML = '<span class="hnf-cap-ingreso__label">Técnico asignado</span>';
  const hT = document.createElement('span');
  hT.className = 'hnf-cap-ingreso__hint muted small';
  hT.textContent =
    'En modo automático, si dejás «Por asignar», Jarvis puede asignar al crear la OT; si elegís nombre, queda registrado como decisión humana.';
  wTech.append(techWrap, hT);

  secE.body.append(wMode, wOt, wTech);

  const footer = document.createElement('div');
  footer.className = 'hnf-ingreso-intake__footer';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'primary-button hnf-cap-ingreso__submit hnf-ingreso-intake__submit';
  submit.textContent = 'Crear OT y registrar en el día';

  const offlineNote = document.createElement('p');
  offlineNote.className = 'muted small hnf-ingreso-intake__offline';
  offlineNote.hidden = integrationStatus !== 'sin conexión';
  offlineNote.textContent =
    'Sin conexión al servidor: no se puede crear la OT ahora. Revisá la red y reintentá; el resto del listado local sigue disponible.';

  const feedback = document.createElement('p');
  feedback.className = 'hnf-cap-ingreso__feedback';
  feedback.setAttribute('role', 'alert');
  feedback.hidden = true;

  footer.append(submit, feedback, offlineNote);

  let wizardStep = 0;
  const STEP_LABELS = ['Entrada', 'Cliente', 'Servicio', 'Prioridad y detalle', 'Asignación'];

  const wrapWizardPanel = (sectionEl, idx) => {
    const d = document.createElement('div');
    d.className = 'hnf-ingreso-wizard__panel';
    d.dataset.wizardStep = String(idx);
    d.hidden = idx !== 0;
    d.append(sectionEl);
    return d;
  };

  const stepsHost = document.createElement('div');
  stepsHost.className = 'hnf-ingreso-wizard__panels';
  stepsHost.append(
    wrapWizardPanel(secA.sec, 0),
    wrapWizardPanel(secB.sec, 1),
    wrapWizardPanel(secC.sec, 2),
    wrapWizardPanel(secD.sec, 3),
    wrapWizardPanel(secE.sec, 4)
  );

  const preview = document.createElement('aside');
  preview.className = 'hnf-ingreso-cc-preview';
  preview.setAttribute('aria-label', 'Vista previa de la OT');
  const previewInner = document.createElement('div');
  previewInner.className = 'hnf-ingreso-cc-preview__sticky';
  const previewTitle = document.createElement('h3');
  previewTitle.className = 'hnf-ingreso-cc-preview__title';
  previewTitle.textContent = 'Resumen de OT';
  const dl = document.createElement('dl');
  dl.className = 'hnf-ingreso-cc-preview__dl';
  previewInner.append(previewTitle, dl);
  preview.append(previewInner);

  const updatePreview = () => {
    const o = origenSel.value;
    const ol = ORIGEN_LABEL[o] || o || '—';
    const cli = clienteInp.value?.trim() || '—';
    const tp = tipoSel.value === 'flota' ? 'Flota' : 'Clima';
    const sub = subtipoSel.value || '—';
    const prUi = form.elements.prioridad?.value;
    const pr = PRIO_LABEL[prUi] || prUi || '—';
    const tech = resolveTecnicoIngreso(form);
    const rows = [
      ['Origen', ol],
      ['Cliente', cli],
      ['Servicio', `${tp} · ${sub}`],
      ['Prioridad', pr],
      ['Asignación', tech],
      ['Fecha solicitud', `${fechaSol.value || '—'} ${horaSol.value || ''}`.trim()],
    ];
    dl.replaceChildren();
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.className = 'hnf-ingreso-cc-preview__dt';
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.className = 'hnf-ingreso-cc-preview__dd';
      dd.textContent = v;
      dl.append(dt, dd);
    }
  };

  const validateWizardStep = (step) => {
    if (step === 0) {
      if (!fechaSol.value) return 'Completá la fecha de la solicitud (paso Entrada).';
      if (!origenSel.value) return 'Seleccioná el origen.';
      if (origenSel.value === 'whatsapp') {
        const wn = form.elements.whatsappNumero?.value?.trim();
        const wnm = form.elements.whatsappNombre?.value?.trim();
        if (!wn) return 'WhatsApp requiere número de contacto.';
        if (!wnm) return 'WhatsApp requiere nombre de contacto.';
      }
      return '';
    }
    if (step === 1) {
      if (!clienteInp.value?.trim()) return 'Indicá el cliente (paso Cliente).';
      if (!form.elements.contacto?.value?.trim()) return 'Indicá el contacto en terreno.';
      if (!form.elements.telefono?.value?.trim()) return 'Indicá el teléfono.';
      if (!form.elements.direccion?.value?.trim()) return 'Indicá la dirección.';
      if (!form.elements.comuna?.value?.trim()) return 'Indicá la comuna.';
      return '';
    }
    if (step === 2) {
      if (!tipoSel.value) return 'Elegí Clima o Flota (paso Servicio).';
      if (!subtipoSel.value?.trim()) return 'Elegí el subtipo de servicio.';
      return '';
    }
    if (step === 3) {
      const desc = form.elements.descripcion?.value?.trim() || '';
      if (desc.length < 8) return 'Completá la descripción del pedido (paso Prioridad y detalle).';
      const pr = form.elements.prioridad?.value;
      if (!pr) return 'Seleccioná la prioridad operativa.';
      return '';
    }
    return '';
  };

  const wizardErr = document.createElement('p');
  wizardErr.className = 'hnf-ingreso-wizard__err form-feedback form-feedback--error';
  wizardErr.setAttribute('role', 'alert');
  wizardErr.hidden = true;

  const nav = document.createElement('div');
  nav.className = 'hnf-ingreso-wizard__nav';
  const btnPrev = document.createElement('button');
  btnPrev.type = 'button';
  btnPrev.className = 'secondary-button';
  btnPrev.textContent = 'Anterior';
  const btnNext = document.createElement('button');
  btnNext.type = 'button';
  btnNext.className = 'secondary-button';
  btnNext.textContent = 'Siguiente';

  const syncWizard = () => {
    stepsHost.querySelectorAll('.hnf-ingreso-wizard__panel').forEach((p, i) => {
      p.hidden = i !== wizardStep;
    });
    stepper.querySelectorAll('.hnf-ingreso-wizard__rail-item').forEach((li, i) => {
      li.classList.toggle('hnf-ingreso-wizard__rail-item--active', i === wizardStep);
      li.classList.toggle('hnf-ingreso-wizard__rail-item--done', i < wizardStep);
    });
    btnPrev.disabled = wizardStep === 0;
    const last = wizardStep === STEP_LABELS.length - 1;
    btnNext.textContent = last ? 'Ir a crear OT' : 'Siguiente';
    btnNext.classList.toggle('primary-button', last);
    btnNext.classList.toggle('secondary-button', !last);
    updatePreview();
  };

  btnPrev.addEventListener('click', () => {
    if (wizardStep > 0) {
      wizardStep -= 1;
      syncWizard();
    }
  });
  btnNext.addEventListener('click', () => {
    wizardErr.hidden = true;
    const err = validateWizardStep(wizardStep);
    if (err) {
      wizardErr.textContent = err;
      wizardErr.hidden = false;
      return;
    }
    if (wizardStep < STEP_LABELS.length - 1) {
      wizardStep += 1;
      syncWizard();
    } else {
      submit.focus();
    }
  });

  nav.append(btnPrev, btnNext);

  const stepper = document.createElement('ol');
  stepper.className = 'hnf-ingreso-wizard__rail';
  STEP_LABELS.forEach((label, i) => {
    const li = document.createElement('li');
    li.className = 'hnf-ingreso-wizard__rail-item';
    li.dataset.stepIndex = String(i);
    li.innerHTML = `<span class="hnf-ingreso-wizard__rail-n">${i + 1}</span><span class="hnf-ingreso-wizard__rail-t">${label}</span>`;
    li.addEventListener('click', () => {
      wizardErr.hidden = true;
      wizardStep = i;
      syncWizard();
    });
    stepper.append(li);
  });

  const leftCol = document.createElement('div');
  leftCol.className = 'hnf-ingreso-wizard__col';
  leftCol.append(stepper, stepsHost, wizardErr, nav);

  const grid = document.createElement('div');
  grid.className = 'hnf-ingreso-cc';
  grid.append(leftCol, preview);

  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);

  form.append(grid, footer);
  syncWizard();

  formCard.append(form);

  const listHost = document.createElement('div');
  listHost.className = 'hnf-cap-ingreso__list';

  const renderList = () => {
    const sync = syncWhatsappFeedToIngresosOperativos(data?.whatsappFeed?.messages, {
      classify: classifyWhatsappOperative,
      mapEstado: mapWhatsappEstadoToIngreso,
    });
    waSyncNote.textContent =
      sync.added || sync.updated
        ? `WhatsApp → ingesta: ${sync.added} nueva(s), ${sync.updated} actualizada(s).`
        : '';

    listHost.replaceChildren();
    const h2 = document.createElement('h2');
    h2.className = 'hnf-cap-ingreso__list-title';
    h2.textContent = 'Registros de hoy (WhatsApp + altas desde Ingreso)';
    listHost.append(h2);

    const items = listIngresosOperativosDelDia();
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent =
        'Todavía no hay registros hoy. Cuando lleguen mensajes al WhatsApp o crees OT desde este formulario, aparecerán acá.';
      listHost.append(p);
      return;
    }

    for (const it of items) {
      const isWa = it.sourceKind === 'whatsapp_ingesta';
      const card = document.createElement('article');
      card.className = `hnf-cap-ingreso__row ${isWa ? 'hnf-cap-ingreso__row--wa' : ''}`.trim();

      const top = document.createElement('div');
      top.className = 'hnf-cap-ingreso__row-top';
      const badge = document.createElement('span');
      badge.className = `hnf-cap-ingreso__estado hnf-cap-ingreso__estado--${it.estado}`;
      badge.textContent =
        it.estado === 'completo' && isWa ? 'Resuelto / completo' : it.estado.replace('_', ' ');
      const meta = document.createElement('span');
      meta.className = 'muted small';
      meta.textContent = `${it.tipo} · ${ORIGEN_LABEL[it.origen] || it.origen}`;
      top.append(badge, meta);

      if (it.otIdRelacionado) {
        const otPill = document.createElement('span');
        otPill.className = 'hnf-cap-ingreso__pill hnf-cap-ingreso__pill--ot';
        otPill.textContent = it.otIdRelacionado;
        top.append(otPill);
      }

      if (isWa) {
        const pills = document.createElement('div');
        pills.className = 'hnf-cap-ingreso__pills';
        const caso = document.createElement('span');
        caso.className = `hnf-cap-ingreso__pill hnf-cap-ingreso__pill--caso-${it.casoTipo || 'consulta'}`;
        caso.textContent = CASO_LABEL[it.casoTipo] || 'Consulta';
        const urg = document.createElement('span');
        urg.className = `hnf-cap-ingreso__pill hnf-cap-ingreso__pill--urg-${it.urgencia || 'media'}`;
        urg.textContent = URG_LABEL[it.urgencia] || URG_LABEL.media;
        const ing = document.createElement('span');
        ing.className = 'hnf-cap-ingreso__pill hnf-cap-ingreso__pill--ingesta';
        ing.textContent = 'Ingesta automática';
        pills.append(caso, urg, ing);
        if (it.validadoPorUsuario) {
          const ok = document.createElement('span');
          ok.className = 'hnf-cap-ingreso__pill hnf-cap-ingreso__pill--ok';
          ok.textContent = 'Validado';
          pills.append(ok);
        }
        top.append(pills);
      }

      const main = document.createElement('div');
      main.className = 'hnf-cap-ingreso__row-main';
      const nm = document.createElement('strong');
      nm.textContent = it.cliente || '—';
      const dir = document.createElement('span');
      dir.className = 'muted';
      dir.textContent = [it.direccion, it.comuna].filter(Boolean).join(', ');
      const ct = document.createElement('span');
      ct.className = 'muted small';
      ct.textContent = [it.contacto, it.telefono].filter(Boolean).join(' · ');
      main.append(nm, dir, ct);

      const extras = [];
      if (it.fechaSolicitud || it.horaSolicitud) {
        extras.push(`Solicitud: ${[it.fechaSolicitud, it.horaSolicitud].filter(Boolean).join(' · ')}`);
      }
      if (it.subtipo) extras.push(`Subtipo: ${it.subtipo}`);
      if (it.prioridad && it.prioridad !== 'media') extras.push(PRIO_LABEL[it.prioridad] || it.prioridad);
      if (it.operationMode === 'automatic') extras.push('Modo: automático');
      if (it.tecnicoAsignadoOt && it.tecnicoAsignadoOt !== 'Por asignar') {
        extras.push(`Téc.: ${it.tecnicoAsignadoOt}`);
      }
      if (it.fechaVisita || it.horaVisita) {
        extras.push(`Preferencia visita: ${[it.fechaVisita, it.horaVisita].filter(Boolean).join(' · ')}`);
      }
      if (extras.length) {
        const ex = document.createElement('p');
        ex.className = 'muted small';
        ex.textContent = extras.join(' · ');
        main.append(ex);
      }
      if (it.descripcion) {
        const dx = document.createElement('p');
        dx.className = 'hnf-cap-ingreso__desc-snippet muted small';
        const snip =
          it.descripcion.length > 220 ? `${it.descripcion.slice(0, 220)}…` : it.descripcion;
        dx.textContent = `Descripción: ${snip}`;
        main.append(dx);
      }

      if (isWa && it.textoInterpretado) {
        const tx = document.createElement('p');
        tx.className = 'hnf-cap-ingreso__interpretado muted small';
        tx.textContent = `Texto interpretado: ${it.textoInterpretado}`;
        main.append(tx);
      }
      if (isWa && it.accionSugerida) {
        const ac = document.createElement('p');
        ac.className = 'hnf-cap-ingreso__accion-jarvis';
        ac.textContent = `Acción sugerida (Jarvis): ${it.accionSugerida}`;
        main.append(ac);
      }

      const rowActions = document.createElement('div');
      rowActions.className = 'hnf-cap-ingreso__row-actions';
      const mkEst = (lab, est) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary-button hnf-cap-ingreso__mini';
        b.textContent = lab;
        b.disabled = it.estado === est;
        b.addEventListener('click', () => {
          setIngresoOperativoEstado(it.id, est);
          renderList();
        });
        return b;
      };
      rowActions.append(
        mkEst('Pendiente', 'pendiente'),
        mkEst('En proceso', 'en_proceso'),
        mkEst('Completo', 'completo')
      );

      if (it.otIdRelacionado && typeof navigateToView === 'function') {
        const otBtn = document.createElement('button');
        otBtn.type = 'button';
        otBtn.className = 'secondary-button hnf-cap-ingreso__mini';
        otBtn.textContent = `Abrir en Clima · ${it.otIdRelacionado}`;
        otBtn.addEventListener('click', () => navigateToView('clima', { otId: it.otIdRelacionado }));
        rowActions.append(otBtn);
      }

      if (isWa) {
        const valBox = document.createElement('div');
        valBox.className = 'hnf-cap-ingreso__validate';
        const valTitle = document.createElement('p');
        valTitle.className = 'hnf-cap-ingreso__validate-title';
        valTitle.textContent = it.validadoPorUsuario
          ? 'Datos validados (podés corregir y volver a guardar)'
          : 'Validá o corregí los datos detectados';
        valBox.append(valTitle);

        const vg = document.createElement('div');
        vg.className = 'hnf-cap-ingreso__validate-grid';
        const mkValField = (name, label, value, fieldType = 'text') => {
          const lab = document.createElement('label');
          lab.className = 'hnf-cap-ingreso__field';
          const sp = document.createElement('span');
          sp.className = 'hnf-cap-ingreso__label';
          sp.textContent = label;
          let inp;
          if (fieldType === 'textarea') {
            inp = document.createElement('textarea');
            inp.rows = 3;
          } else {
            inp = document.createElement('input');
            inp.type = fieldType;
          }
          inp.className = 'hnf-cap-ingreso__input';
          inp.name = `${it.id}-${name}`;
          inp.value = value || '';
          lab.append(sp, inp);
          return lab;
        };
        const mkValSelect = (name, label, value, options) => {
          const lab = document.createElement('label');
          lab.className = 'hnf-cap-ingreso__field';
          const sp = document.createElement('span');
          sp.className = 'hnf-cap-ingreso__label';
          sp.textContent = label;
          const sel = document.createElement('select');
          sel.className = 'hnf-cap-ingreso__input';
          sel.name = `${it.id}-${name}`;
          const selVal = INGRESO_PRIORIDADES.includes(value) ? value : 'media';
          for (const o of options) {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            if (o.value === selVal) opt.selected = true;
            sel.append(opt);
          }
          lab.append(sp, sel);
          return lab;
        };
        vg.append(
          mkValField('cliente', 'Cliente', it.cliente),
          mkValField('direccion', 'Dirección', it.direccion),
          mkValField('comuna', 'Comuna', it.comuna),
          mkValField('contacto', 'Contacto', it.contacto),
          mkValField('telefono', 'Teléfono', it.telefono),
          mkValField('subtipo', 'Subtipo', it.subtipo),
          mkValSelect('prioridad', 'Prioridad', it.prioridad, [
            { value: 'baja', label: 'Baja' },
            { value: 'media', label: 'Media' },
            { value: 'alta', label: 'Alta' },
          ]),
          mkValField('fechaVisita', 'Fecha preferida', it.fechaVisita, 'date'),
          mkValField('horaVisita', 'Hora preferida', it.horaVisita, 'time'),
          mkValField('descripcion', 'Descripción del pedido', it.descripcion, 'textarea')
        );
        valBox.append(vg);

        const saveVal = document.createElement('button');
        saveVal.type = 'button';
        saveVal.className = 'primary-button hnf-cap-ingreso__mini';
        saveVal.textContent = 'Guardar validación';
        saveVal.addEventListener('click', () => {
          patchIngresoOperativo(it.id, {
            cliente: valBox.querySelector(`[name="${it.id}-cliente"]`)?.value,
            direccion: valBox.querySelector(`[name="${it.id}-direccion"]`)?.value,
            comuna: valBox.querySelector(`[name="${it.id}-comuna"]`)?.value,
            contacto: valBox.querySelector(`[name="${it.id}-contacto"]`)?.value,
            telefono: valBox.querySelector(`[name="${it.id}-telefono"]`)?.value,
            subtipo: valBox.querySelector(`[name="${it.id}-subtipo"]`)?.value,
            descripcion: valBox.querySelector(`[name="${it.id}-descripcion"]`)?.value,
            prioridad: valBox.querySelector(`[name="${it.id}-prioridad"]`)?.value,
            fechaVisita: valBox.querySelector(`[name="${it.id}-fechaVisita"]`)?.value,
            horaVisita: valBox.querySelector(`[name="${it.id}-horaVisita"]`)?.value,
            validadoPorUsuario: true,
          });
          renderList();
          if (typeof reloadApp === 'function') reloadApp();
        });
        valBox.append(saveVal);
        main.append(valBox);
      }

      card.append(top, main, rowActions);
      listHost.append(card);
    }
  };

  const resetFormPartial = () => {
    form.reset();
    fechaSol.value = defaultFechaSolicitud();
    horaSol.value = defaultHoraSolicitud();
    presetSel.value = '';
    tipoSel.value = 'clima';
    fillSubtipo('clima');
    techSel.value = 'Por asignar';
    techOther.value = '';
    techOther.hidden = true;
    modeSel.value = 'manual';
    origenSel.value = 'interno';
    syncWaFields();
    quickDetails.open = false;
  };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    feedback.hidden = true;
    feedback.className = 'hnf-cap-ingreso__feedback';

    if (integrationStatus === 'sin conexión') {
      feedback.hidden = false;
      feedback.classList.add('form-feedback--error');
      feedback.textContent =
        'Sin conexión: no se puede crear la OT. Revisá la red y probá de nuevo.';
      return;
    }

    if (typeof actions?.createOtFromIngreso !== 'function') {
      feedback.hidden = false;
      feedback.classList.add('form-feedback--error');
      feedback.textContent = 'Acción de servidor no disponible. Actualizá la página.';
      return;
    }

    const { payload, snapshot } = buildOtPayloadFromIngresoForm(form);

    const errs = [];
    if (!payload.cliente) errs.push('Nombre de cliente / empresa.');
    if (!payload.contactoTerreno) errs.push('Contacto en terreno.');
    if (!payload.telefonoContacto) errs.push('Teléfono.');
    if (!payload.direccion) errs.push('Dirección.');
    if (!payload.comuna) errs.push('Comuna o ciudad.');
    if (!payload.subtipoServicio) errs.push('Subtipo de servicio.');
    if (!payload.fecha) errs.push('Fecha de la solicitud.');
    if (!snapshot.descripcion || snapshot.descripcion.length < 8) {
      errs.push('Descripción del pedido (al menos una frase clara, ej. 8 caracteres o más).');
    }
    if (!payload.origenSolicitud) errs.push('Origen de solicitud.');
    if (!payload.prioridadOperativa) errs.push('Prioridad operativa.');
    if (payload.origenSolicitud === 'whatsapp') {
      if (!payload.whatsappContactoNumero) errs.push('Número WhatsApp.');
      if (!payload.whatsappContactoNombre) errs.push('Nombre contacto WhatsApp.');
    }

    if (errs.length) {
      feedback.hidden = false;
      feedback.classList.add('form-feedback--error');
      feedback.textContent = `Falta o revisá: ${errs.join(' · ')}`;
      return;
    }

    const result = await actions.createOtFromIngreso(payload);
    if (!result?.ok) {
      feedback.hidden = false;
      feedback.classList.add('form-feedback--error');
      feedback.textContent =
        result?.error ||
        'No se pudo crear la OT. Si el mensaje menciona un número duplicado, probá otro Nº OT manual o dejá el campo vacío.';
      return;
    }

    appendIngresoOperativo({
      ...snapshot,
      estado: 'completo',
      otIdRelacionado: result.ot?.id || null,
      validadoPorUsuario: true,
    });

    feedback.hidden = true;
    resetFormPartial();
    renderList();
  });

  const syncSubmitState = () => {
    submit.disabled = Boolean(isSubmittingIngresoOt) || integrationStatus === 'sin conexión';
    submit.textContent = isSubmittingIngresoOt ? 'Creando OT en servidor…' : 'Crear OT y registrar en el día';
  };
  syncSubmitState();

  root.append(head, flowStrip, globalFb, waSyncNote, formCard, listHost);
  renderList();

  return root;
};

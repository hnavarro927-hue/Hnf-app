import {
  listIngresosOperativosDelDia,
  appendIngresoOperativo,
  setIngresoOperativoEstado,
  syncWhatsappFeedToIngresosOperativos,
  patchIngresoOperativo,
  INGRESO_PRIORIDADES,
} from '../domain/ingreso-operativo-storage.js';
import {
  classifyWhatsappOperative,
  mapWhatsappEstadoToIngreso,
} from '../domain/whatsapp-operational-ingest.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';

const CASO_LABEL = {
  ot: 'OT',
  consulta: 'Consulta',
  cierre: 'Cierre',
  problema: 'Problema',
};

const URG_LABEL = { alta: 'Urgencia alta', media: 'Urgencia media', baja: 'Urgencia baja' };

const ORIGEN_LABEL = {
  whatsapp: 'WhatsApp',
  correo: 'Correo',
  llamada: 'Llamada',
  manual: 'Manual',
};

const PRIO_LABEL = { baja: 'Prioridad baja', media: 'Prioridad media', alta: 'Prioridad alta' };

/**
 * Capa 1 — Ingreso de datos (Romina / Gery).
 * WhatsApp alimenta ingestas automáticas; acá se validan y completan datos.
 */
export const ingresoOperativoView = ({ data, reloadApp, navigateToView } = {}) => {
  const root = document.createElement('section');
  root.className = 'hnf-cap-ingreso hnf-op-view hnf-op-view--ingreso';

  const head = document.createElement('header');
  head.className = 'hnf-cap-ingreso__head';
  head.innerHTML = `
    <h1 class="hnf-cap-ingreso__title">Ingreso operativo</h1>
    <p class="muted hnf-cap-ingreso__lead">
      Registrá pedidos que entran por <strong>WhatsApp</strong>, <strong>correo</strong>, <strong>llamada</strong> o <strong>manual</strong>.
      Las ingestas de WhatsApp aparecen abajo para validar; el formulario manual sirve cuando el cliente no escribió al bot o querés cargar todo de cero.
    </p>
  `;

  const flowStrip = createHnfOperationalFlowStrip(0);

  const waSyncNote = document.createElement('p');
  waSyncNote.className = 'hnf-cap-ingreso__sync muted small';
  waSyncNote.setAttribute('role', 'status');
  waSyncNote.textContent = '';

  const formCard = document.createElement('div');
  formCard.className = 'hnf-cap-ingreso__form-card';
  const formLegend = document.createElement('h2');
  formLegend.className = 'hnf-cap-ingreso__form-legend';
  formLegend.textContent = 'Registrar un pedido (paso a paso)';
  formCard.append(formLegend);

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
    w.append(lb, el);
    if (extra.hint) {
      const h = document.createElement('span');
      h.className = 'hnf-cap-ingreso__hint muted small';
      h.textContent = extra.hint;
      w.append(h);
    }
    return w;
  };

  const mkGroup = (legend, className = '') => {
    const fs = document.createElement('div');
    fs.className = `hnf-cap-ingreso__group ${className}`.trim();
    const lg = document.createElement('div');
    lg.className = 'hnf-cap-ingreso__group-legend';
    lg.textContent = legend;
    fs.append(lg);
    return fs;
  };

  const grid = document.createElement('div');
  grid.className = 'hnf-cap-ingreso__grid hnf-cap-ingreso__grid--stacked';

  const gCliente = mkGroup('Cliente y contacto');
  gCliente.append(
    mkField('cliente', 'Cliente *', 'text', {
      placeholder: 'Ej. Distribuidora Norte S.A.',
      hint: 'Nombre comercial o razón social tal como lo reconoce operación.',
    }),
    mkField('contacto', 'Persona de contacto', 'text', {
      placeholder: 'Ej. Juan Pérez — mantención',
      hint: 'Quién coordina visita o entrega del vehículo.',
    }),
    mkField('telefono', 'Teléfono', 'tel', {
      placeholder: 'Ej. +56 9 1234 5678',
      hint: 'Incluí código de área o celular.',
    })
  );

  const gUbic = mkGroup('Ubicación (si aplica)');
  gUbic.append(
    mkField('direccion', 'Dirección / lugar', 'text', {
      placeholder: 'Ej. Av. Principal 1234, bodega 2',
      hint: 'Para Clima: sitio de la OT. Para Flota: retiro o base.',
    }),
    mkField('comuna', 'Comuna / ciudad', 'text', {
      placeholder: 'Ej. Santiago, Providencia',
    })
  );

  const gCaso = mkGroup('Clasificación del pedido');
  gCaso.append(
    mkField('tipo', 'Tipo *', 'select', {
      options: [
        { value: 'clima', label: 'Clima (HVAC)' },
        { value: 'flota', label: 'Flota' },
      ],
      hint: 'Define si el trabajo va al módulo técnico Clima o logístico Flota.',
    }),
    mkField('subtipo', 'Subtipo', 'text', {
      placeholder: 'Ej. mantención preventiva · traslado refrigerado',
      hint: 'Detalle corto: tipo de servicio o categoría interna.',
    }),
    mkField('origen', 'Origen del contacto *', 'select', {
      options: [
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'correo', label: 'Correo' },
        { value: 'llamada', label: 'Llamada' },
        { value: 'manual', label: 'Manual / otro canal' },
      ],
      hint: 'Por dónde entró el pedido al equipo.',
    }),
    mkField('prioridad', 'Prioridad', 'select', {
      options: [
        { value: 'baja', label: 'Baja' },
        { value: 'media', label: 'Media' },
        { value: 'alta', label: 'Alta' },
      ],
      hint: 'Alta = riesgo operativo o cliente crítico; media es el estándar.',
    })
  );

  const gVisita = mkGroup('Ventana deseada (opcional)');
  gVisita.append(
    mkField('fechaVisita', 'Fecha preferida', 'date', {
      hint: 'Si el cliente pidió día concreto; podés dejar vacío.',
    }),
    mkField('horaVisita', 'Hora preferida', 'time', {
      hint: 'Franja aproximada; Planificación / agenda afinan después.',
    })
  );

  const gDesc = mkGroup('Descripción del pedido');
  gDesc.classList.add('hnf-cap-ingreso__group--full');
  gDesc.append(
    mkField('descripcion', 'Qué necesita el cliente', 'textarea', {
      rows: 4,
      placeholder:
        'Ej. «Falla en cámara 2, no enfría» · «Traslado de 3 pallets Maipú → Quilicura, camión con frío»',
      hint: 'Texto libre: síntomas, alcance, restricciones. Cuanto más claro, menos idas y vueltas en Bandeja y ejecución.',
    })
  );

  grid.append(gCliente, gUbic, gCaso, gVisita, gDesc);

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'primary-button hnf-cap-ingreso__submit';
  submit.textContent = 'Crear ingreso';

  const feedback = document.createElement('p');
  feedback.className = 'hnf-cap-ingreso__feedback muted';
  feedback.setAttribute('role', 'status');
  feedback.hidden = true;

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
    h2.textContent = 'Ingresos de hoy (WhatsApp + manual)';
    listHost.append(h2);

    const items = listIngresosOperativosDelDia();
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent =
        'Sin ingresos hoy. Cuando lleguen mensajes al feed WhatsApp, aparecerán aquí como tarjetas para validar.';
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
      if (it.subtipo) extras.push(`Subtipo: ${it.subtipo}`);
      if (it.prioridad && it.prioridad !== 'media') extras.push(PRIO_LABEL[it.prioridad] || it.prioridad);
      if (it.fechaVisita || it.horaVisita) {
        extras.push(`Ventana: ${[it.fechaVisita, it.horaVisita].filter(Boolean).join(' · ')}`);
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

      const actions = document.createElement('div');
      actions.className = 'hnf-cap-ingreso__row-actions';
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
      actions.append(
        mkEst('Pendiente', 'pendiente'),
        mkEst('En proceso', 'en_proceso'),
        mkEst('Completo', 'completo')
      );

      if (isWa && it.otIdRelacionado && typeof navigateToView === 'function') {
        const otBtn = document.createElement('button');
        otBtn.type = 'button';
        otBtn.className = 'secondary-button hnf-cap-ingreso__mini';
        otBtn.textContent = `Abrir OT ${it.otIdRelacionado}`;
        otBtn.addEventListener('click', () => navigateToView('clima', { otId: it.otIdRelacionado }));
        actions.append(otBtn);
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

      card.append(top, main, actions);
      listHost.append(card);
    }
  };

  submit.addEventListener('click', () => {
    feedback.hidden = true;
    const cliente = grid.querySelector('[name=cliente]')?.value?.trim();
    if (!cliente) {
      feedback.hidden = false;
      feedback.textContent = 'Completá al menos el cliente.';
      return;
    }
    appendIngresoOperativo({
      cliente,
      direccion: grid.querySelector('[name=direccion]')?.value,
      comuna: grid.querySelector('[name=comuna]')?.value,
      contacto: grid.querySelector('[name=contacto]')?.value,
      telefono: grid.querySelector('[name=telefono]')?.value,
      tipo: grid.querySelector('[name=tipo]')?.value,
      origen: grid.querySelector('[name=origen]')?.value,
      subtipo: grid.querySelector('[name=subtipo]')?.value,
      descripcion: grid.querySelector('[name=descripcion]')?.value,
      prioridad: grid.querySelector('[name=prioridad]')?.value,
      fechaVisita: grid.querySelector('[name=fechaVisita]')?.value,
      horaVisita: grid.querySelector('[name=horaVisita]')?.value,
    });
    grid.querySelectorAll('input:not([type=date]):not([type=time]), textarea').forEach((i) => {
      i.value = '';
    });
    const fd = grid.querySelector('[name=fechaVisita]');
    const tm = grid.querySelector('[name=horaVisita]');
    if (fd) fd.value = '';
    if (tm) tm.value = '';
    const tipoEl = grid.querySelector('[name=tipo]');
    const origenEl = grid.querySelector('[name=origen]');
    const prioEl = grid.querySelector('[name=prioridad]');
    if (tipoEl) tipoEl.value = 'clima';
    if (origenEl) origenEl.value = 'manual';
    if (prioEl) prioEl.value = 'media';
    feedback.hidden = false;
    feedback.textContent = 'Ingreso creado.';
    renderList();
    if (typeof reloadApp === 'function') reloadApp();
  });

  formCard.append(grid, submit, feedback);
  root.append(head, flowStrip, waSyncNote, formCard, listHost);
  renderList();

  return root;
};

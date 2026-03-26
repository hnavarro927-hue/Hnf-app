import {
  listIngresosOperativosDelDia,
  appendIngresoOperativo,
  setIngresoOperativoEstado,
  syncWhatsappFeedToIngresosOperativos,
  patchIngresoOperativo,
} from '../domain/ingreso-operativo-storage.js';
import {
  classifyWhatsappOperative,
  mapWhatsappEstadoToIngreso,
} from '../domain/whatsapp-operational-ingest.js';

const CASO_LABEL = {
  ot: 'OT',
  consulta: 'Consulta',
  cierre: 'Cierre',
  problema: 'Problema',
};

const URG_LABEL = { alta: 'Urgencia alta', media: 'Urgencia media', baja: 'Urgencia baja' };

/**
 * Capa 1 — Ingreso de datos (Romina / Gery).
 * WhatsApp alimenta ingestas automáticas; acá se validan y completan datos.
 */
export const ingresoOperativoView = ({ data, reloadApp, navigateToView } = {}) => {
  const root = document.createElement('section');
  root.className = 'hnf-cap-ingreso';

  const head = document.createElement('header');
  head.className = 'hnf-cap-ingreso__head';
  head.innerHTML = `
    <h1 class="hnf-cap-ingreso__title">Ingreso operativo</h1>
    <p class="muted hnf-cap-ingreso__lead">
      <strong>WhatsApp</strong> genera ingestas automáticas (clasificación Jarvis). Validá y completá datos; el manual sigue disponible abajo.
      Flujo: WhatsApp → ingesta → clasificación → OT → ejecución → cierre.
    </p>
  `;

  const waSyncNote = document.createElement('p');
  waSyncNote.className = 'hnf-cap-ingreso__sync muted small';
  waSyncNote.setAttribute('role', 'status');
  waSyncNote.textContent = '';

  const formCard = document.createElement('div');
  formCard.className = 'hnf-cap-ingreso__form-card';
  const formLegend = document.createElement('h2');
  formLegend.className = 'hnf-cap-ingreso__form-legend';
  formLegend.textContent = 'Ingreso manual (complementario)';
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
    } else {
      el = document.createElement('input');
      el.type = type;
      el.name = name;
      el.autocomplete = 'on';
    }
    el.className = 'hnf-cap-ingreso__input';
    w.append(lb, el);
    return w;
  };

  const grid = document.createElement('div');
  grid.className = 'hnf-cap-ingreso__grid';
  grid.append(
    mkField('cliente', 'Cliente'),
    mkField('direccion', 'Dirección'),
    mkField('comuna', 'Comuna'),
    mkField('contacto', 'Contacto'),
    mkField('telefono', 'Teléfono', 'tel'),
    mkField('tipo', 'Tipo', 'select', {
      options: [
        { value: 'clima', label: 'Clima (HVAC)' },
        { value: 'flota', label: 'Flota' },
      ],
    }),
    mkField('origen', 'Origen', 'select', {
      options: [
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'manual', label: 'Manual' },
      ],
    })
  );

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
      meta.textContent = `${it.tipo} · ${it.origen === 'whatsapp' ? 'WhatsApp' : it.origen}`;
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
        const mkValField = (name, label, value) => {
          const lab = document.createElement('label');
          lab.className = 'hnf-cap-ingreso__field';
          const sp = document.createElement('span');
          sp.className = 'hnf-cap-ingreso__label';
          sp.textContent = label;
          const inp = document.createElement('input');
          inp.className = 'hnf-cap-ingreso__input';
          inp.name = `${it.id}-${name}`;
          inp.value = value || '';
          lab.append(sp, inp);
          return lab;
        };
        vg.append(
          mkValField('cliente', 'Cliente', it.cliente),
          mkValField('direccion', 'Dirección', it.direccion),
          mkValField('comuna', 'Comuna', it.comuna),
          mkValField('contacto', 'Contacto', it.contacto),
          mkValField('telefono', 'Teléfono', it.telefono)
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
    });
    grid.querySelectorAll('input').forEach((i) => {
      i.value = '';
    });
    feedback.hidden = false;
    feedback.textContent = 'Ingreso creado.';
    renderList();
    if (typeof reloadApp === 'function') reloadApp();
  });

  formCard.append(grid, submit, feedback);
  root.append(head, waSyncNote, formCard, listHost);
  renderList();

  return root;
};

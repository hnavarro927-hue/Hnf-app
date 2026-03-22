import { generateClienteCalendarioPdfBlob } from '../services/pdf.service.js';
import { planificacionService } from '../services/planificacion.service.js';

const TIPOS = ['preventivo', 'correctivo'];
const ESTADOS = ['pendiente', 'programado', 'realizado'];

const openPdfBlob = (blob) => {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.append(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 180000);
};

const tabIds = [
  { id: 'clientes', label: 'Clientes' },
  { id: 'tiendas', label: 'Tiendas' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'plan', label: 'Planificación' },
];

export const planificacionView = ({ data, reloadApp } = {}) => {
  const section = document.createElement('section');
  section.className = 'planificacion-module';

  const clientes = data?.planClientes || [];
  const tiendas = data?.planTiendas || [];
  const mantenciones = data?.planMantenciones || [];

  const clienteById = Object.fromEntries(clientes.map((c) => [c.id, c]));
  const tiendaById = Object.fromEntries(tiendas.map((t) => [t.id, t]));

  let activeTab = 'clientes';
  const feedback = document.createElement('div');
  feedback.className = 'plan-feedback';

  const showFeedback = (type, message) => {
    feedback.className = `plan-feedback plan-feedback--${type}`;
    feedback.textContent = message;
    feedback.hidden = !message;
  };
  feedback.hidden = true;

  const header = document.createElement('div');
  header.innerHTML =
    '<h2>Planificación Clima</h2><p class="muted">Clientes, tiendas y calendario de mantenciones (preventivo / correctivo). PDF para entregar al cliente.</p>';

  const tabBar = document.createElement('div');
  tabBar.className = 'plan-tabs';

  const body = document.createElement('div');
  body.className = 'plan-tab-body';

  const runReload = async () => {
    if (typeof reloadApp === 'function') await reloadApp();
  };

  const renderBody = () => {
    body.replaceChildren();

    if (activeTab === 'clientes') {
      const card = document.createElement('article');
      card.className = 'plan-card';
      card.innerHTML = '<h3>Clientes (planificación)</h3><p class="muted">Registro operativo HNF para mantenciones. Independiente del listado legado <code>/clients</code> del dashboard.</p>';

      const form = document.createElement('form');
      form.className = 'plan-form-row';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.name = 'nombre';
      inp.placeholder = 'Nombre cliente (ej. Puma)';
      inp.required = true;
      const btn = document.createElement('button');
      btn.type = 'submit';
      btn.className = 'primary-button';
      btn.textContent = 'Crear cliente';
      form.append(inp, btn);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await planificacionService.postCliente({ nombre: inp.value.trim() });
          showFeedback('success', 'Cliente creado.');
          inp.value = '';
          await runReload();
        } catch (err) {
          showFeedback('error', err.message || 'No se pudo crear el cliente.');
        }
      });

      const list = document.createElement('ul');
      list.className = 'plan-list';
      if (!clientes.length) {
        const li = document.createElement('li');
        li.className = 'muted';
        li.textContent = 'Sin clientes aún.';
        list.append(li);
      } else {
        clientes.forEach((c) => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${c.nombre}</strong> <span class="muted">${c.id}</span>`;
          list.append(li);
        });
      }
      card.append(form, list);
      body.append(card);
    }

    if (activeTab === 'tiendas') {
      const card = document.createElement('article');
      card.className = 'plan-card';
      card.innerHTML = '<h3>Tiendas</h3><p class="muted">Asociar cada tienda a un cliente. Horarios AM/PM: texto libre (ej. Sí, 09:00–13:00).</p>';

      const form = document.createElement('form');
      form.className = 'plan-form-grid';

      const selCliente = document.createElement('select');
      selCliente.required = true;
      selCliente.append(new Option('— Cliente —', ''));
      clientes.forEach((c) => selCliente.append(new Option(`${c.nombre} (${c.id})`, c.id)));

      const nombre = document.createElement('input');
      nombre.type = 'text';
      nombre.placeholder = 'Nombre tienda / local';
      nombre.required = true;

      const direccion = document.createElement('input');
      direccion.type = 'text';
      direccion.placeholder = 'Dirección';
      direccion.required = true;

      const comuna = document.createElement('input');
      comuna.type = 'text';
      comuna.placeholder = 'Comuna';
      comuna.required = true;

      const horarioAM = document.createElement('input');
      horarioAM.type = 'text';
      horarioAM.placeholder = 'Horario AM (ej. Sí)';
      const horarioPM = document.createElement('input');
      horarioPM.type = 'text';
      horarioPM.placeholder = 'Horario PM (ej. Sí)';

      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'primary-button';
      submit.textContent = 'Agregar tienda';
      form.append(selCliente, nombre, direccion, comuna, horarioAM, horarioPM, submit);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await planificacionService.postTienda({
            clienteId: selCliente.value,
            nombre: nombre.value.trim(),
            direccion: direccion.value.trim(),
            comuna: comuna.value.trim(),
            horarioAM: horarioAM.value.trim(),
            horarioPM: horarioPM.value.trim(),
          });
          showFeedback('success', 'Tienda registrada.');
          nombre.value = '';
          direccion.value = '';
          comuna.value = '';
          horarioAM.value = '';
          horarioPM.value = '';
          await runReload();
        } catch (err) {
          showFeedback('error', err.message || 'No se pudo guardar la tienda.');
        }
      });

      const list = document.createElement('div');
      list.className = 'plan-table-wrap';
      const table = document.createElement('table');
      table.className = 'plan-table';
      table.innerHTML =
        '<thead><tr><th>Cliente</th><th>Tienda</th><th>Dirección</th><th>Comuna</th><th>AM</th><th>PM</th></tr></thead>';
      const tb = document.createElement('tbody');
      if (!tiendas.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.className = 'muted';
        td.textContent = 'Sin tiendas.';
        tr.append(td);
        tb.append(tr);
      } else {
        tiendas.forEach((t) => {
          const tr = document.createElement('tr');
          const c = clienteById[t.clienteId];
          tr.innerHTML = `<td>${c?.nombre || t.clienteId}</td><td>${t.nombre}</td><td>${t.direccion}</td><td>${t.comuna}</td><td>${t.horarioAM || '—'}</td><td>${t.horarioPM || '—'}</td>`;
          tb.append(tr);
        });
      }
      table.append(tb);
      list.append(table);
      card.append(form, list);
      body.append(card);
    }

    if (activeTab === 'calendario') {
      const card = document.createElement('article');
      card.className = 'plan-card';
      card.innerHTML = '<h3>Calendario</h3><p class="muted">Vista simple por fecha y técnico (filtro en pantalla).</p>';

      const filters = document.createElement('div');
      filters.className = 'plan-form-row';
      const fechaInp = document.createElement('input');
      fechaInp.type = 'date';
      const tecInp = document.createElement('input');
      tecInp.type = 'search';
      tecInp.placeholder = 'Filtrar por técnico (contiene)';
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'secondary-button';
      apply.textContent = 'Aplicar filtros';
      filters.append(fechaInp, tecInp, apply);

      const list = document.createElement('div');
      list.className = 'plan-table-wrap';

      const renderList = () => {
        const f = fechaInp.value;
        const tx = tecInp.value.trim().toLowerCase();
        let rows = [...mantenciones];
        if (f) rows = rows.filter((m) => m.fecha === f);
        if (tx) rows = rows.filter((m) => String(m.tecnico || '').toLowerCase().includes(tx));
        rows.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

        const table = document.createElement('table');
        table.className = 'plan-table';
        table.innerHTML =
          '<thead><tr><th>Fecha</th><th>Cliente</th><th>Tienda</th><th>Técnico</th><th>Tipo</th><th>Estado</th></tr></thead>';
        const tb = document.createElement('tbody');
        if (!rows.length) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 6;
          td.className = 'muted';
          td.textContent = 'Sin registros con ese criterio.';
          tr.append(td);
          tb.append(tr);
        } else {
          rows.forEach((m) => {
            const t = tiendaById[m.tiendaId];
            const c = t ? clienteById[t.clienteId] : null;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${m.fecha}</td><td>${c?.nombre || '—'}</td><td>${t?.nombre || m.tiendaId}</td><td>${m.tecnico}</td><td>${m.tipo}</td><td>${m.estado}</td>`;
            tb.append(tr);
          });
        }
        table.append(tb);
        list.replaceChildren(table);
      };

      apply.addEventListener('click', renderList);
      renderList();
      card.append(filters, list);
      body.append(card);
    }

    if (activeTab === 'plan') {
      const card = document.createElement('article');
      card.className = 'plan-card';
      card.innerHTML =
        '<h3>Planificación</h3><p class="muted">Alta y edición de mantenciones. Ideal para cuadros tipo cuenta Puma con fechas programadas.</p>';

      const pdfRow = document.createElement('div');
      pdfRow.className = 'plan-form-row plan-pdf-row';
      const pdfCliente = document.createElement('select');
      pdfCliente.append(new Option('— PDF: elegir cliente —', ''));
      clientes.forEach((c) => pdfCliente.append(new Option(c.nombre, c.id)));
      const pdfBtn = document.createElement('button');
      pdfBtn.type = 'button';
      pdfBtn.className = 'secondary-button';
      pdfBtn.textContent = 'Generar calendario cliente (PDF)';
      pdfBtn.addEventListener('click', () => {
        const cid = pdfCliente.value;
        if (!cid) {
          showFeedback('error', 'Elegí un cliente para el PDF.');
          return;
        }
        const c = clienteById[cid];
        const tds = tiendas.filter((t) => t.clienteId === cid);
        const tid = new Set(tds.map((t) => t.id));
        const rows = mantenciones
          .filter((m) => tid.has(m.tiendaId))
          .map((m) => {
            const t = tiendaById[m.tiendaId];
            return {
              tiendaNombre: t?.nombre || m.tiendaId,
              direccion: t?.direccion || '',
              comuna: t?.comuna || '',
              fecha: m.fecha,
              horarioAM: t?.horarioAM || '—',
              horarioPM: t?.horarioPM || '—',
              tecnico: m.tecnico,
              tipo: m.tipo,
              estado: m.estado,
            };
          });
        const { blob, fileName } = generateClienteCalendarioPdfBlob({
          clienteNombre: c?.nombre || cid,
          rows,
        });
        openPdfBlob(blob);
        showFeedback('success', `PDF generado: ${fileName}`);
      });
      pdfRow.append(pdfCliente, pdfBtn);

      const newForm = document.createElement('form');
      newForm.className = 'plan-form-grid plan-new-mant';
      newForm.innerHTML = '<p class="plan-subtitle">Nueva mantención</p>';

      const selT = document.createElement('select');
      selT.required = true;
      selT.append(new Option('— Tienda —', ''));
      tiendas.forEach((t) => {
        const c = clienteById[t.clienteId];
        selT.append(new Option(`${c?.nombre || ''} · ${t.nombre}`, t.id));
      });
      const fInp = document.createElement('input');
      fInp.type = 'date';
      fInp.required = true;
      const tInp = document.createElement('input');
      tInp.type = 'text';
      tInp.placeholder = 'Técnico';
      tInp.required = true;
      const tipoSel = document.createElement('select');
      TIPOS.forEach((t) => tipoSel.append(new Option(t, t)));
      const estSel = document.createElement('select');
      ESTADOS.forEach((t) => estSel.append(new Option(t, t)));
      estSel.value = 'programado';
      const addBtn = document.createElement('button');
      addBtn.type = 'submit';
      addBtn.className = 'primary-button';
      addBtn.textContent = 'Programar';
      newForm.append(selT, fInp, tInp, tipoSel, estSel, addBtn);
      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await planificacionService.postMantencion({
            tiendaId: selT.value,
            fecha: fInp.value,
            tecnico: tInp.value.trim(),
            tipo: tipoSel.value,
            estado: estSel.value,
          });
          showFeedback('success', 'Mantención creada.');
          await runReload();
        } catch (err) {
          showFeedback('error', err.message || 'No se pudo crear la mantención.');
        }
      });

      const wrap = document.createElement('div');
      wrap.className = 'plan-table-wrap';
      const table = document.createElement('table');
      table.className = 'plan-table plan-table--editable';
      table.innerHTML =
        '<thead><tr><th>Tienda</th><th>Fecha</th><th>Técnico</th><th>Tipo</th><th>Estado</th><th></th></tr></thead>';
      const tb = document.createElement('tbody');

      const sorted = [...mantenciones].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      if (!sorted.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.className = 'muted';
        td.textContent = 'Sin mantenciones.';
        tr.append(td);
        tb.append(tr);
      } else {
        sorted.forEach((m) => {
          const t = tiendaById[m.tiendaId];
          const tr = document.createElement('tr');

          const tdT = document.createElement('td');
          tdT.textContent = t ? `${clienteById[t.clienteId]?.nombre || ''} · ${t.nombre}` : m.tiendaId;

          const tdF = document.createElement('td');
          const fi = document.createElement('input');
          fi.type = 'date';
          fi.value = m.fecha;
          tdF.append(fi);

          const tdTe = document.createElement('td');
          const te = document.createElement('input');
          te.type = 'text';
          te.value = m.tecnico;
          tdTe.append(te);

          const tdTipo = document.createElement('td');
          const stTipo = document.createElement('select');
          TIPOS.forEach((x) => stTipo.append(new Option(x, x)));
          stTipo.value = m.tipo;
          tdTipo.append(stTipo);

          const tdEst = document.createElement('td');
          const stEst = document.createElement('select');
          ESTADOS.forEach((x) => stEst.append(new Option(x, x)));
          stEst.value = m.estado;
          tdEst.append(stEst);

          const tdGo = document.createElement('td');
          const save = document.createElement('button');
          save.type = 'button';
          save.className = 'secondary-button';
          save.textContent = 'Guardar';
          save.addEventListener('click', async () => {
            try {
              await planificacionService.patchMantencion(m.id, {
                fecha: fi.value,
                tecnico: te.value.trim(),
                tipo: stTipo.value,
                estado: stEst.value,
              });
              showFeedback('success', `Actualizado ${m.id}.`);
              await runReload();
            } catch (err) {
              showFeedback('error', err.message || 'No se pudo guardar.');
            }
          });
          tdGo.append(save);

          tr.append(tdT, tdF, tdTe, tdTipo, tdEst, tdGo);
          tb.append(tr);
        });
      }
      table.append(tb);
      wrap.append(table);

      card.append(pdfRow, newForm, wrap);
      body.append(card);
    }
  };

  tabIds.forEach(({ id, label }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'plan-tab';
    b.textContent = label;
    if (id === activeTab) b.classList.add('is-active');
    b.addEventListener('click', () => {
      activeTab = id;
      tabBar.querySelectorAll('.plan-tab').forEach((btn, i) => {
        btn.classList.toggle('is-active', tabIds[i].id === activeTab);
      });
      renderBody();
    });
    tabBar.append(b);
  });

  section.append(header, feedback, tabBar, body);
  renderBody();

  return section;
};

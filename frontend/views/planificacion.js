import { generateClienteCalendarioPdfBlob } from '../services/pdf.service.js';
import { planificacionService } from '../services/planificacion.service.js';

const pad2 = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const mondayOf = (d) => {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  return c;
};
const addDaysYmd = (ymd, delta) => {
  const [y, m, dd] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, dd + delta);
  return toYmd(dt);
};

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
  { id: 'plan', label: 'Mantenciones' },
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
  let weekAnchorYmd = toYmd(mondayOf(new Date()));
  const feedback = document.createElement('div');
  feedback.className = 'form-feedback';
  feedback.hidden = true;

  const showFeedback = (type, message) => {
    if (!message) {
      feedback.hidden = true;
      return;
    }
    feedback.className = `form-feedback form-feedback--${type}`;
    feedback.textContent = message;
    feedback.hidden = false;
  };

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML =
    '<h2>Planificación · climatización</h2><p class="muted"><strong>Qué hacés acá:</strong> dar de alta clientes de cuenta, sus tiendas, programar mantenciones y, si querés, sacar un PDF para el cliente. Estos clientes son solo para planificación (no reemplazan el listado general de Administración). Si no ves un cambio, tocá <strong>Actualizar datos</strong>.</p>';

  const tabBar = document.createElement('div');
  tabBar.className = 'plan-tabs';

  const body = document.createElement('div');
  body.className = 'plan-tab-body';

  const runReload = async () => {
    if (typeof reloadApp === 'function') return await reloadApp();
    return false;
  };

  const renderBody = () => {
    body.replaceChildren();

    if (activeTab === 'clientes') {
      const card = document.createElement('article');
      card.className = 'plan-card';
      card.innerHTML =
        '<h3>Clientes de planificación</h3><p class="muted">Son los clientes que usás acá para tiendas y mantenciones. Es independiente del listado general que ves en Inicio / Administración.</p>';

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
      btn.textContent = 'Guardar cliente';
      form.append(inp, btn);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await planificacionService.postCliente({ nombre: inp.value.trim() });
          showFeedback('success', 'Cliente guardado. El listado se actualizó.');
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
      const ordenRuta = document.createElement('input');
      ordenRuta.type = 'number';
      ordenRuta.min = '1';
      ordenRuta.step = '1';
      ordenRuta.placeholder = 'Orden ruta (1 = primero)';

      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'primary-button';
      submit.textContent = 'Guardar tienda';
      form.append(selCliente, nombre, direccion, comuna, horarioAM, horarioPM, ordenRuta, submit);

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
            ordenRuta: ordenRuta.value ? Number(ordenRuta.value) : undefined,
          });
          showFeedback('success', 'Tienda guardada. Datos actualizados.');
          nombre.value = '';
          direccion.value = '';
          comuna.value = '';
          horarioAM.value = '';
          horarioPM.value = '';
          ordenRuta.value = '';
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
        '<thead><tr><th>Cliente</th><th>Tienda</th><th>Dirección</th><th>Comuna</th><th>Ruta</th><th>AM</th><th>PM</th></tr></thead>';
      const tb = document.createElement('tbody');
      if (!tiendas.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.className = 'muted';
        td.textContent = 'Sin tiendas.';
        tr.append(td);
        tb.append(tr);
      } else {
        tiendas.forEach((t) => {
          const tr = document.createElement('tr');
          const c = clienteById[t.clienteId];
          tr.innerHTML = `<td>${c?.nombre || t.clienteId}</td><td>${t.nombre}</td><td>${t.direccion}</td><td>${t.comuna}</td><td>${t.ordenRuta ?? '—'}</td><td>${t.horarioAM || '—'}</td><td>${t.horarioPM || '—'}</td>`;
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
      card.innerHTML =
        '<h3>Calendario y semana operativa</h3><p class="muted">Vista semanal por día con técnico y tienda. Abajo, listado filtrable por fecha.</p>';

      const weekBar = document.createElement('div');
      weekBar.className = 'plan-form-row';
      const wkLabel = document.createElement('span');
      wkLabel.className = 'muted';
      wkLabel.textContent = 'Semana que inicia:';
      const wkPrev = document.createElement('button');
      wkPrev.type = 'button';
      wkPrev.className = 'secondary-button';
      wkPrev.textContent = '← Semana anterior';
      const wkNext = document.createElement('button');
      wkNext.type = 'button';
      wkNext.className = 'secondary-button';
      wkNext.textContent = 'Semana siguiente →';
      const wkToday = document.createElement('button');
      wkToday.type = 'button';
      wkToday.className = 'secondary-button';
      wkToday.textContent = 'Esta semana';
      weekBar.append(wkLabel, wkPrev, wkNext, wkToday);

      const weekGridHost = document.createElement('div');
      const weekLoadHost = document.createElement('div');
      weekLoadHost.className = 'dashboard-row';

      const renderWeek = () => {
        weekGridHost.replaceChildren();
        const days = [];
        for (let i = 0; i < 7; i += 1) days.push(addDaysYmd(weekAnchorYmd, i));
        const grid = document.createElement('div');
        grid.className = 'plan-week-grid';
        const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const loadMap = new Map();

        days.forEach((ymd, idx) => {
          const col = document.createElement('div');
          col.className = 'plan-week-col';
          const h = document.createElement('h4');
          h.textContent = `${dayNames[idx]} ${ymd}`;
          col.append(h);
          const dayM = mantenciones.filter((m) => m.fecha === ymd);
          dayM.sort((a, b) => String(a.tecnico || '').localeCompare(String(b.tecnico || '')));
          if (!dayM.length) {
            const p = document.createElement('p');
            p.className = 'muted';
            p.style.fontSize = '11px';
            p.textContent = 'Sin visitas.';
            col.append(p);
          } else {
            dayM.forEach((m) => {
              const t = tiendaById[m.tiendaId];
              const c = t ? clienteById[t.clienteId] : null;
              const tech = (m.tecnico || '').trim();
              if (tech) {
                loadMap.set(tech, (loadMap.get(tech) || 0) + 1);
              }
              const win =
                m.horaInicio && m.horaFin ? `${m.horaInicio}–${m.horaFin}` : 'Día completo';
              const div = document.createElement('div');
              div.className = 'plan-week-item';
              div.innerHTML = `<strong>${win}</strong><br>${tech || '—'}<br><span class="muted">${c?.nombre || ''} · ${t?.nombre || m.tiendaId}</span>`;
              col.append(div);
            });
          }
          grid.append(col);
        });
        weekGridHost.append(grid);

        weekLoadHost.replaceChildren();
        weekLoadHost.innerHTML = '<h3>Carga de trabajo en la semana (cantidad de mantenciones)</h3>';
        const ul = document.createElement('ul');
        ul.className = 'dashboard-list';
        const sortedLoad = [...loadMap.entries()].sort((a, b) => b[1] - a[1]);
        if (!sortedLoad.length) {
          const li = document.createElement('li');
          li.className = 'muted';
          li.textContent = 'Sin asignaciones en esta semana.';
          ul.append(li);
        } else {
          sortedLoad.forEach(([name, n]) => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${name}</strong> · ${n} trabajo(s)`;
            ul.append(li);
          });
        }
        weekLoadHost.append(ul);
      };

      wkPrev.addEventListener('click', () => {
        weekAnchorYmd = addDaysYmd(weekAnchorYmd, -7);
        renderWeek();
      });
      wkNext.addEventListener('click', () => {
        weekAnchorYmd = addDaysYmd(weekAnchorYmd, 7);
        renderWeek();
      });
      wkToday.addEventListener('click', () => {
        weekAnchorYmd = toYmd(mondayOf(new Date()));
        renderWeek();
      });

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
          '<thead><tr><th>Fecha</th><th>Franja</th><th>Cliente</th><th>Tienda</th><th>Técnico</th><th>Tipo</th><th>Estado</th></tr></thead>';
        const tb = document.createElement('tbody');
        if (!rows.length) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 7;
          td.className = 'muted';
          td.textContent = 'Sin registros con ese criterio.';
          tr.append(td);
          tb.append(tr);
        } else {
          rows.forEach((m) => {
            const t = tiendaById[m.tiendaId];
            const c = t ? clienteById[t.clienteId] : null;
            const tr = document.createElement('tr');
            const win =
              m.horaInicio && m.horaFin ? `${m.horaInicio}–${m.horaFin}` : '—';
            tr.innerHTML = `<td>${m.fecha}</td><td>${win}</td><td>${c?.nombre || '—'}</td><td>${t?.nombre || m.tiendaId}</td><td>${m.tecnico}</td><td>${m.tipo}</td><td>${m.estado}</td>`;
            tb.append(tr);
          });
        }
        table.append(tb);
        list.replaceChildren(table);
      };

      apply.addEventListener('click', renderList);
      renderWeek();
      renderList();
      card.append(weekBar, weekGridHost, weekLoadHost, filters, list);
      body.append(card);
    }

    if (activeTab === 'plan') {
      const card = document.createElement('article');
      card.className = 'plan-card';
      card.innerHTML =
        '<h3>Mantenciones programadas</h3><p class="muted">Agendá visitas, cambiá estado o técnico, y generá un PDF limpio para enviar al cliente.</p>';

      const pdfRow = document.createElement('div');
      pdfRow.className = 'plan-form-row plan-pdf-row';
      const pdfCliente = document.createElement('select');
      pdfCliente.append(new Option('— PDF: elegir cliente —', ''));
      clientes.forEach((c) => pdfCliente.append(new Option(c.nombre, c.id)));
      const pdfBtn = document.createElement('button');
      pdfBtn.type = 'button';
      pdfBtn.className = 'secondary-button';
      pdfBtn.textContent = 'PDF para el cliente (calendario)';
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
              ordenRuta: t?.ordenRuta ?? 999,
              fecha: m.fecha,
              horarioAM: t?.horarioAM || '—',
              horarioPM: t?.horarioPM || '—',
              horaInicio: m.horaInicio || '',
              horaFin: m.horaFin || '',
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
        showFeedback('success', `PDF listo (${fileName}). Se abrió en una nueva pestaña.`);
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
      const hiInp = document.createElement('input');
      hiInp.type = 'text';
      hiInp.placeholder = 'Hora inicio (HH:MM) opcional';
      const hfInp = document.createElement('input');
      hfInp.type = 'text';
      hfInp.placeholder = 'Hora fin (HH:MM) opcional';
      const tipoSel = document.createElement('select');
      TIPOS.forEach((t) => tipoSel.append(new Option(t, t)));
      const estSel = document.createElement('select');
      ESTADOS.forEach((t) => estSel.append(new Option(t, t)));
      estSel.value = 'programado';
      const addBtn = document.createElement('button');
      addBtn.type = 'submit';
      addBtn.className = 'primary-button';
      addBtn.textContent = 'Agregar mantención';
      newForm.append(selT, fInp, tInp, hiInp, hfInp, tipoSel, estSel, addBtn);
      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await planificacionService.postMantencion({
            tiendaId: selT.value,
            fecha: fInp.value,
            tecnico: tInp.value.trim(),
            horaInicio: hiInp.value.trim(),
            horaFin: hfInp.value.trim(),
            tipo: tipoSel.value,
            estado: estSel.value,
          });
          showFeedback('success', 'Mantención agregada. Listado actualizado.');
          hiInp.value = '';
          hfInp.value = '';
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
        '<thead><tr><th>Tienda</th><th>Fecha</th><th>Técnico</th><th>Inicio</th><th>Fin</th><th>Tipo</th><th>Estado</th><th></th></tr></thead>';
      const tb = document.createElement('tbody');

      const sorted = [...mantenciones].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      if (!sorted.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 8;
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

          const tdHi = document.createElement('td');
          const hi = document.createElement('input');
          hi.type = 'text';
          hi.placeholder = 'HH:MM';
          hi.value = m.horaInicio || '';
          tdHi.append(hi);

          const tdHf = document.createElement('td');
          const hf = document.createElement('input');
          hf.type = 'text';
          hf.placeholder = 'HH:MM';
          hf.value = m.horaFin || '';
          tdHf.append(hf);

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
                horaInicio: hi.value.trim(),
                horaFin: hf.value.trim(),
                tipo: stTipo.value,
                estado: stEst.value,
              });
              showFeedback('success', `Cambios guardados para ${m.id}.`);
              await runReload();
            } catch (err) {
              showFeedback('error', err.message || 'No se pudo guardar.');
            }
          });
          tdGo.append(save);

          tr.append(tdT, tdF, tdTe, tdHi, tdHf, tdTipo, tdEst, tdGo);
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

  const toolBar = document.createElement('div');
  toolBar.className = 'plan-toolbar';
  const reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.className = 'secondary-button';
  reloadBtn.textContent = 'Actualizar datos';
  reloadBtn.title = 'Vuelve a pedir clientes, tiendas y mantenciones al servidor.';
  reloadBtn.addEventListener('click', async () => {
    showFeedback('neutral', 'Actualizando información…');
    const ok = await runReload();
    showFeedback(
      ok ? 'success' : 'error',
      ok ? 'Listo: datos actualizados desde el servidor.' : 'No se pudo actualizar. Revisá la conexión o el servidor.'
    );
  });
  const toolHint = document.createElement('span');
  toolHint.className = 'muted plan-toolbar-hint';
  toolHint.textContent = 'Hace lo mismo que entrar de nuevo al módulo: trae la última versión guardada.';
  toolBar.append(reloadBtn, toolHint);

  section.append(header, feedback, tabBar, toolBar, body);
  renderBody();

  return section;
};

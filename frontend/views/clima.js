const badge = (status = '') => `<span class="status-badge status-badge--${String(status).replace(/\s+/g, '-').toLowerCase()}">${status}</span>`;

export const climaView = ({ data, actions, feedback } = {}) => {
  const payload = data?.data || {};
  const tiendas = payload.tiendas || [];
  const calendario = payload.calendario || [];
  const informes = payload.informes || [];
  const ots = payload.ots || [];

  const section = document.createElement('section');
  section.innerHTML = `
    <h2>Puma Clima</h2>
    <p class="muted">Mantenimiento preventivo bimensual nacional. Recarga de refrigerante fuera de preventivo.</p>
    <article class="card"><h3>Dashboard Puma</h3>
      <p>Tiendas: <strong>${tiendas.length}</strong> · Informes: <strong>${informes.length}</strong> · OT: <strong>${ots.length}</strong></p>
      <div class="table-filters">
        <input id="f-region" placeholder="Filtrar por región" />
        <input id="f-type" placeholder="Filtrar tipo tienda" />
        <select id="f-status"><option value="">Todos estados</option><option value="activa">Activa</option><option value="en pausa">En pausa</option></select>
      </div>
      <div id="stores-wrap"></div>
    </article>

    <article class="card"><h3>Calendario Preventivo</h3>
      <div class="table-grid-wrap">${calendario.length ? `<table class="table-grid"><thead><tr><th>Tienda</th><th>Fecha</th><th>Ventana</th><th>Técnico</th><th>Estado</th></tr></thead><tbody>${calendario
        .map((c) => `<tr><td>${c.tiendaId}</td><td>${c.fechaProgramada}</td><td>${c.ventanaHoraria}</td><td>${c.tecnicoAsignado}</td><td>${badge(c.estado)}</td></tr>`)
        .join('')}</tbody></table>` : '<p class="muted">Sin mantenimientos programados.</p>'}</div>
      <form id="cal-form" class="inline-form">
        <input name="tiendaId" placeholder="Tienda ID" required />
        <input name="fechaProgramada" type="date" required />
        <input name="ventanaHoraria" placeholder="09:00-12:00" required />
        <input name="tecnicoAsignado" placeholder="Técnico" required />
        <button class="primary-button" type="submit">Programar</button>
      </form>
    </article>

    <article class="card"><h3>Ejecución / Informe / OT</h3>
      <form id="visit-form" class="inline-form inline-form--ot">
        <input name="tiendaId" placeholder="Tienda ID" required />
        <input name="fechaVisita" type="date" required />
        <input name="tecnico" placeholder="Técnico" required />
        <input name="resumen" placeholder="Resumen" required />
        <input name="correctivos" placeholder="Correctivos sugeridos" />
        <input name="costoTotal" type="number" placeholder="Costo preventivo CLP" required />
        <button class="primary-button" type="submit">Generar informe + OT</button>
      </form>
      ${ots.length ? `<div class="ot-board">${ots.map((ot) => `<article class="ot-block"><div class="ot-block__top"><strong>${ot.numeroOt}</strong>${badge(ot.estado)}</div><p>${ot.tienda} · ${ot.tipoServicio}</p><p>Técnico: ${ot.tecnico}</p><p>Costo: $${Number(ot.costoTotal).toLocaleString('es-CL')}</p></article>`).join('')}</div>` : '<p class="muted">Sin OT clima.</p>'}
    </article>
  `;

  const renderStores = () => {
    const r = section.querySelector('#f-region').value.toLowerCase();
    const t = section.querySelector('#f-type').value.toLowerCase();
    const s = section.querySelector('#f-status').value.toLowerCase();
    const filtered = tiendas.filter((row) => (!r || row.region.toLowerCase().includes(r)) && (!t || row.storeType.toLowerCase().includes(t)) && (!s || row.estadoOperativo.toLowerCase() === s));
    section.querySelector('#stores-wrap').innerHTML = filtered.length
      ? `<table class="table-grid"><thead><tr><th>ID</th><th>Región</th><th>Tipo</th><th>Tienda</th><th>Equipos</th><th>Frecuencia</th><th>Valor CLP</th><th>Estado</th></tr></thead><tbody>${filtered
          .map((row) => `<tr><td>${row.id}</td><td>${row.region}</td><td>${row.storeType}</td><td>${row.nombreTienda}</td><td>${row.cantidadEquipos}</td><td>${row.frecuenciaMantencion}</td><td>$${Number(row.valorPreventivoClp).toLocaleString('es-CL')}</td><td>${badge(row.estadoOperativo)}</td></tr>`)
          .join('')}</tbody></table>`
      : '<p class="muted">Sin tiendas para ese filtro.</p>';
  };

  ['#f-region', '#f-type', '#f-status'].forEach((sel) => section.querySelector(sel).addEventListener('input', renderStores));
  renderStores();

  section.querySelector('#cal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    await actions.createClimaCalendario({
      tiendaId: f.tiendaId.value,
      fechaProgramada: f.fechaProgramada.value,
      ventanaHoraria: f.ventanaHoraria.value,
      tecnicoAsignado: f.tecnicoAsignado.value,
      estado: 'pendiente',
      requierePermiso: true,
      permisoEnviado: false,
      permisoAprobado: false,
    });
  });

  section.querySelector('#visit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    await actions.executeClimaVisit({
      tiendaId: f.tiendaId.value,
      fechaVisita: f.fechaVisita.value,
      tecnico: f.tecnico.value,
      resumen: f.resumen.value,
      correctivosSugeridos: f.correctivos.value,
      costoTotal: Number(f.costoTotal.value),
    });
  });

  if (feedback?.message) {
    const alert = document.createElement('p');
    alert.className = `form-feedback form-feedback--${feedback.type}`;
    alert.textContent = feedback.message;
    section.prepend(alert);
  }

  return section;
};

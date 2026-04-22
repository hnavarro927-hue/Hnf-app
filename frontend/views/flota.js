const badge = (status = '') => `<span class="status-badge status-badge--${String(status).replace(/\s+/g, '-').toLowerCase()}">${status}</span>`;

export const flotaView = ({ data, actions, feedback } = {}) => {
  const payload = data?.data || {};
  const gestiones = payload.gestionDiaria || [];
  const ots = payload.ots || [];

  const section = document.createElement('section');
  section.innerHTML = `
    <h2>Flota Operacional</h2>
    <article class="card">
      <h3>Gestión diaria (Excel ERP)</h3>
      ${gestiones.length ? `<table class="table-grid"><thead><tr><th>Fecha</th><th>Cliente</th><th>Patente</th><th>Servicio</th><th>Tipo</th><th>Técnico</th><th>Estado</th></tr></thead><tbody>${gestiones.map((g) => `<tr><td>${g.fecha}</td><td>${g.cliente}</td><td>${g.patente}</td><td>${g.servicio}</td><td>${g.tipoServicio}</td><td>${g.tecnico}</td><td>${badge(g.estado)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sin gestiones.</p>'}
      <form id="flota-gestion-form" class="inline-form">
        <input name="fecha" type="date" required />
        <input name="cliente" placeholder="Cliente" required />
        <input name="patente" placeholder="Patente" required />
        <input name="servicio" placeholder="Servicio" required />
        <input name="tipoServicio" placeholder="RT/traslado/mantención" required />
        <input name="tecnico" placeholder="Técnico" required />
        <button class="primary-button" type="submit">Agregar gestión</button>
      </form>
    </article>

    <article class="card">
      <h3>OT Flota desde gestión</h3>
      <form id="flota-ot-form" class="inline-form inline-form--ot">
        <input name="creadoDesdeGestionId" placeholder="ID gestión" />
        <input name="cliente" placeholder="Cliente" required />
        <input name="patente" placeholder="Patente" required />
        <input name="tecnico" placeholder="Técnico" required />
        <input name="tipoServicio" placeholder="Tipo servicio" required />
        <input name="fecha" type="date" required />
        <input name="horaInicio" type="time" required />
        <input name="horaTermino" type="time" required />
        <input name="descripcionServicio" placeholder="Descripción" required />
        <input name="totalNeto" type="number" placeholder="Total neto" required />
        <button class="primary-button" type="submit">Crear OT Flota</button>
      </form>
      ${ots.length ? `<div class="ot-board">${ots.map((ot) => `<article class="ot-block"><div class="ot-block__top"><strong>${ot.numeroOt}</strong>${badge(ot.estado)}</div><p>${ot.cliente} · ${ot.patente}</p><p>Técnico: ${ot.tecnico}</p><p>Total neto: $${Number(ot.totalNeto).toLocaleString('es-CL')}</p><p>Recibido conforme: ${ot.recibidoConforme ? 'Sí' : 'No'}</p></article>`).join('')}</div>` : '<p class="muted">Sin OT flota.</p>'}
    </article>
  `;

  section.querySelector('#flota-gestion-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    await actions.createFlotaGestion({
      fecha: f.fecha.value,
      cliente: f.cliente.value,
      patente: f.patente.value,
      servicio: f.servicio.value,
      tipoServicio: f.tipoServicio.value,
      tecnico: f.tecnico.value,
      estado: 'pendiente',
      observaciones: '',
      origen: 'manual',
    });
  });

  section.querySelector('#flota-ot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    await actions.createFlotaOT({
      creadoDesdeGestionId: f.creadoDesdeGestionId.value || null,
      cliente: f.cliente.value,
      direccion: '',
      contacto: '',
      correo: '',
      rut: '',
      patente: f.patente.value,
      marca: '',
      modelo: '',
      anio: '',
      kilometraje: '',
      chasis: '',
      tecnico: f.tecnico.value,
      tipoServicio: f.tipoServicio.value,
      lugarOrigen: '',
      lugarDestino: '',
      fecha: f.fecha.value,
      horaInicio: f.horaInicio.value,
      horaTermino: f.horaTermino.value,
      duracion: `${f.horaInicio.value}-${f.horaTermino.value}`,
      descripcionServicio: f.descripcionServicio.value,
      itemsServicio: [],
      itemsInsumos: [],
      totalManoObra: Number(f.totalNeto.value),
      totalInsumos: 0,
      totalNeto: Number(f.totalNeto.value),
      plazoPago: '30 días',
      plazoEntrega: 'inmediato',
      solicitadoPor: '',
      nombreResponsablePpu: '',
      recibidoConforme: false,
      evidenciaFotos: [],
      estado: 'abierta',
      creadoDesde: 'gestion',
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

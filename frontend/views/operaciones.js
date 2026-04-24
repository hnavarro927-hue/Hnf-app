const badge = (status = '') => `<span class="status-badge status-badge--${status.replace(/\s+/g, '-')}">${status}</span>`;

const renderMessages = (messages = []) => {
  if (!messages.length) return '<p class="muted">Sin mensajes en inbox.</p>';
  return `<div class="inbox-list">${messages
    .map(
      (item) => `<article class="inbox-item">
          <div><strong>${item.nombre}</strong> <span class="muted">${item.remitente}</span></div>
          <p>${item.mensaje}</p>
          <div class="inbox-item__meta">
            <span class="muted">${item.fuente} · ${new Date(item.fechaHora).toLocaleString('es-CL')}</span>
            ${badge(item.estado)}
          </div>
        </article>`,
    )
    .join('')}</div>`;
};

const renderGestiones = (gestiones = []) => {
  if (!gestiones.length) return '<p class="muted">Sin registros de gestión diaria.</p>';

  return `<table class="table-grid"><thead><tr><th>Fecha</th><th>Cliente</th><th>Patente</th><th>Servicio</th><th>Tipo</th><th>Técnico</th><th>Estado</th></tr></thead>
    <tbody>${gestiones
      .map(
        (item) => `<tr><td>${item.fecha}</td><td>${item.cliente}</td><td>${item.patente}</td><td>${item.servicio}</td><td>${item.tipo}</td><td>${item.tecnico}</td><td>${badge(item.estado)}</td></tr>`,
      )
      .join('')}</tbody></table>`;
};

const renderOTCards = (ots = []) => {
  if (!ots.length) return '<p class="muted">Sin OT creadas.</p>';

  return `<div class="ot-board">${ots
    .map(
      (item) => `<article class="ot-block">
      <div class="ot-block__top"><strong>${item.id}</strong>${badge(item.control.estado)}</div>
      <p><strong>Cliente:</strong> ${item.cliente.nombre}</p>
      <p><strong>Servicio:</strong> ${item.servicio.tipoServicio} - ${item.servicio.descripcion}</p>
      <p><strong>Técnico:</strong> ${item.servicio.tecnico}</p>
      <p><strong>Tiempo:</strong> ${item.servicio.horaInicio} a ${item.servicio.horaTermino} (${item.servicio.duracion})</p>
      <p><strong>Total:</strong> $${item.costos.totalNeto.toLocaleString('es-CL')}</p>
    </article>`,
    )
    .join('')}</div>`;
};

const renderMatriz = (rows = []) => {
  if (!rows.length) return '<p class="muted">Matriz vacía. Se llena al crear OT.</p>';
  return `<table class="table-grid"><thead><tr><th>ID</th><th>Cliente</th><th>Servicio</th><th>Fecha</th><th>Técnico</th><th>Total</th><th>Estado</th><th>Origen</th></tr></thead><tbody>${rows
    .map(
      (item) => `<tr><td>${item.otId}</td><td>${item.cliente}</td><td>${item.servicio}</td><td>${item.fecha}</td><td>${item.tecnico}</td><td>$${item.total.toLocaleString('es-CL')}</td><td>${badge(item.estado)}</td><td>${item.origen}</td></tr>`,
    )
    .join('')}</tbody></table>`;
};

export const operacionesView = ({ data, actions, feedback } = {}) => {
  const section = document.createElement('section');
  const messages = data?.messages?.data || [];
  const gestiones = data?.gestiones?.data || [];
  const ots = data?.ots?.data || [];
  const matriz = data?.matriz?.data || [];

  section.innerHTML = `
    <h2>ERP Operacional HNF</h2>
    <p class="muted">Flujo real: Mensaje → Gestión diaria → OT (manual) → Matriz general.</p>

    <article class="card"><h3>Inbox (WhatsApp / Email)</h3>${renderMessages(messages)}</article>

    <article class="card">
      <h3>Gestión diaria - Flota</h3>
      ${renderGestiones(gestiones)}
      <form id="gestion-form" class="inline-form">
        <input name="fecha" type="date" required />
        <input name="cliente" placeholder="Cliente" required />
        <input name="patente" placeholder="Patente" required />
        <input name="servicio" placeholder="Servicio" required />
        <select name="tipo"><option>RT</option><option>traslado</option><option>mantencion</option></select>
        <input name="tecnico" placeholder="Técnico" required />
        <button class="primary-button" type="submit">Agregar gestión</button>
      </form>
    </article>

    <article class="card">
      <h3>OT Dashboard</h3>
      ${renderOTCards(ots)}
      <form id="ot-form" class="inline-form inline-form--ot">
        <input name="cliente" placeholder="Cliente" required />
        <input name="direccion" placeholder="Dirección" required />
        <input name="contacto" placeholder="Contacto" required />
        <input name="patente" placeholder="Patente" required />
        <input name="tipoServicio" placeholder="Tipo servicio" required />
        <input name="descripcion" placeholder="Descripción" required />
        <input name="fecha" type="date" required />
        <input name="horaInicio" type="time" required />
        <input name="horaTermino" type="time" required />
        <input name="tecnico" placeholder="Técnico" required />
        <input name="total" type="number" min="0" placeholder="Total neto" required />
        <select name="origen"><option value="manual">manual</option><option value="mensaje">mensaje</option><option value="gestion">gestion</option></select>
        <input name="origenId" placeholder="ID origen (opcional)" />
        <button class="primary-button" type="submit">Crear OT</button>
      </form>
    </article>

    <article class="card"><h3>Matriz de control general</h3>${renderMatriz(matriz)}</article>
  `;

  if (feedback?.message) {
    const info = document.createElement('p');
    info.className = `form-feedback form-feedback--${feedback.type}`;
    info.textContent = feedback.message;
    section.prepend(info);
  }

  section.querySelector('#gestion-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    await actions.createGestion({
      fecha: form.fecha.value,
      cliente: form.cliente.value.trim(),
      patente: form.patente.value.trim().toUpperCase(),
      servicio: form.servicio.value.trim(),
      tipo: form.tipo.value,
      tecnico: form.tecnico.value.trim(),
      estado: 'pendiente',
    });
  });

  section.querySelector('#ot-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const start = form.horaInicio.value;
    const end = form.horaTermino.value;

    await actions.createOT({
      cliente: { nombre: form.cliente.value.trim(), direccion: form.direccion.value.trim(), contacto: form.contacto.value.trim() },
      vehiculo: { patente: form.patente.value.trim().toUpperCase(), marca: '', modelo: '', anio: null, kilometraje: null },
      servicio: {
        tipoServicio: form.tipoServicio.value.trim(),
        descripcion: form.descripcion.value.trim(),
        fecha: form.fecha.value,
        horaInicio: start,
        horaTermino: end,
        duracion: `${start} - ${end}`,
        tecnico: form.tecnico.value.trim(),
      },
      costos: {
        items: [{ descripcion: 'Servicio', cantidad: 1, precioUnitario: Number(form.total.value), total: Number(form.total.value) }],
        totalManoObra: Number(form.total.value),
        totalInsumos: 0,
        totalNeto: Number(form.total.value),
      },
      evidencia: { fotos: { frontal: [], trasera: [], laterales: [], kilometraje: [], documentos: [] } },
      control: { estado: 'abierta' },
      creadoDesde: { tipo: form.origen.value, referenciaId: form.origenId.value.trim() || null },
    });
  });

  return section;
};

const badge = (status) => `<span class="status-badge status-badge--${String(status).replace(/\s+/g, '-').toLowerCase()}">${status}</span>`;

export const approvalLynView = ({ data, actions, feedback } = {}) => {
  const messages = (data?.messages?.data || []).filter((m) => m.estado === 'reviewed_by_gery');
  const gestiones = data?.gestiones?.data || [];

  const section = document.createElement('section');
  section.innerHTML = `
    <h2>Approval Panel (Lyn)</h2>
    <p class="muted">Aprobación obligatoria antes de crear o ejecutar OT.</p>

    <article class="card"><h3>Mensajes pendientes de aprobación</h3>
      ${messages.length ? messages
        .map(
          (m) => `<div class="inbox-item"><strong>${m.id} · ${m.nombre}</strong><p>${m.mensaje}</p><div class="status-actions__buttons"><button class="primary-button" data-approve-msg="${m.id}">Aprobar mensaje</button></div></div>`,
        )
        .join('') : '<p class="muted">No hay mensajes pendientes para Lyn.</p>'}
    </article>

    <article class="card"><h3>Crear OT aprobada (desde gestión)</h3>
      <form id="ot-approve-form" class="inline-form inline-form--ot">
        <input name="gestionId" placeholder="ID gestión" required />
        <select name="unidad"><option value="flota">Flota</option><option value="clima">Clima</option></select>
        <input name="cliente" placeholder="Cliente" required />
        <input name="tecnico" placeholder="Técnico" required />
        <input name="fecha" type="date" required />
        <input name="horaInicio" type="time" required />
        <input name="horaTermino" type="time" required />
        <input name="tipoServicio" placeholder="Tipo servicio" required />
        <input name="costo" type="number" placeholder="Costo/Total neto" required />
        <button class="primary-button" type="submit">Aprobar + Crear OT</button>
      </form>
      <p class="muted">Gestiones disponibles: ${gestiones.map((g) => g.id).join(', ') || 'sin gestiones'}</p>
    </article>
  `;

  section.querySelectorAll('[data-approve-msg]').forEach((btn) => btn.addEventListener('click', async () => actions.approveMessage(btn.dataset.approveMsg)));
  section.querySelector('#ot-approve-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    await actions.createApprovedOT({
      unidad: f.unidad.value,
      gestionId: f.gestionId.value,
      cliente: f.cliente.value,
      tecnico: f.tecnico.value,
      fecha: f.fecha.value,
      horaInicio: f.horaInicio.value,
      horaTermino: f.horaTermino.value,
      tipoServicio: f.tipoServicio.value,
      costo: Number(f.costo.value),
    });
  });

  if (feedback?.message) {
    const p = document.createElement('p');
    p.className = `form-feedback form-feedback--${feedback.type}`;
    p.textContent = feedback.message;
    section.prepend(p);
  }
  return section;
};

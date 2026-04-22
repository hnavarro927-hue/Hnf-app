const badge = (status) => `<span class="status-badge status-badge--${String(status).replace(/\s+/g, '-').toLowerCase()}">${status}</span>`;

export const inboxView = ({ data, actions, feedback } = {}) => {
  const messages = data?.messages?.data || [];
  const gestiones = data?.gestiones?.data || [];

  const section = document.createElement('section');
  section.innerHTML = `
    <h2>Inbox Unificado (Gery)</h2>
    <p class="muted">WhatsApp + Email. Gery revisa y clasifica. Solo crea gestión, no OT.</p>
    <article class="card">
      <h3>Mensajes entrantes</h3>
      ${messages.length ? `<div class="inbox-list">${messages
        .map(
          (m) => `<article class="inbox-item">
            <div class="inbox-item__meta"><strong>${m.nombre}</strong>${badge(m.estado)}</div>
            <p>${m.mensaje}</p>
            <small class="muted">${m.fuente} · ${m.remitente}</small>
            <div class="status-actions__buttons">
              <button class="secondary-button" data-review="${m.id}">Revisar (Gery)</button>
              <button class="secondary-button" data-gestion="${m.id}">Convertir a gestión</button>
            </div>
          </article>`,
        )
        .join('')}</div>` : '<p class="muted">Sin mensajes.</p>'}
    </article>

    <article class="card">
      <h3>Gestión diaria creada por Gery</h3>
      ${gestiones.length ? `<table class="table-grid"><thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Patente</th><th>Servicio</th><th>Estado</th></tr></thead><tbody>${gestiones.map((g) => `<tr><td>${g.id}</td><td>${g.fecha}</td><td>${g.cliente}</td><td>${g.patente}</td><td>${g.servicio}</td><td>${badge(g.estado)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sin gestiones.</p>'}
    </article>
  `;

  section.querySelectorAll('[data-review]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await actions.reviewMessage(btn.dataset.review);
    });
  });

  section.querySelectorAll('[data-gestion]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await actions.convertToGestion(btn.dataset.gestion);
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

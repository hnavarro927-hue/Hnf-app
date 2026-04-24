const badge = (status = '') => `<span class="status-badge status-badge--${String(status).replace(/\s+/g, '-').toLowerCase()}">${status}</span>`;

export const gerenciaView = ({ data } = {}) => {
  const approvals = data?.approvals?.data || [];
  const matriz = data?.matriz?.data || [];

  const section = document.createElement('section');
  section.innerHTML = `
    <h2>Gerencia / Matrix</h2>
    <p class="muted">Panel de aprobación exclusivo para Hernan y Lyn.</p>
    <article class="card"><h3>Aprobaciones</h3>
      ${approvals.length ? `<table class="table-grid"><thead><tr><th>ID</th><th>Referencia</th><th>Acción</th><th>Solicitó</th><th>Estado</th><th>Aprobador</th></tr></thead><tbody>${approvals.map((a) => `<tr><td>${a.id}</td><td>${a.referenciaTipo}:${a.referenciaId}</td><td>${a.accion}</td><td>${a.solicitadoPor}</td><td>${badge(a.estado)}</td><td>${a.aprobador || '-'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sin solicitudes.</p>'}
    </article>
    <article class="card"><h3>Matriz general mensual</h3>
      ${matriz.length ? `<table class="table-grid"><thead><tr><th>Módulo</th><th>OT</th><th>Cliente</th><th>Servicio</th><th>Fecha</th><th>Técnico</th><th>Total</th><th>Estado</th></tr></thead><tbody>${matriz.map((m) => `<tr><td>${m.modulo}</td><td>${m.numeroOt || m.otId}</td><td>${m.cliente}</td><td>${m.servicio}</td><td>${m.fecha}</td><td>${m.tecnico}</td><td>$${Number(m.total).toLocaleString('es-CL')}</td><td>${badge(m.estado)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sin datos en matriz.</p>'}
    </article>
  `;
  return section;
};

const badge = (status) => `<span class="status-badge status-badge--${String(status).replace(/\s+/g, '-').toLowerCase()}">${status}</span>`;

export const managerView = ({ data } = {}) => {
  const matriz = data?.matriz?.data || [];
  const approvals = data?.approvals?.data || [];
  const logs = data?.logs?.data || [];

  const section = document.createElement('section');
  section.innerHTML = `
    <h2>Manager Panel (Hernan)</h2>
    <p class="muted">Control total, trazabilidad completa y posibilidad de override.</p>
    <article class="card"><h3>Matriz general</h3>
      ${matriz.length ? `<table class="table-grid"><thead><tr><th>Módulo</th><th>OT</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead><tbody>${matriz.map((r) => `<tr><td>${r.modulo}</td><td>${r.numeroOt || r.otId}</td><td>${r.cliente}</td><td>${badge(r.estado)}</td><td>$${Number(r.total || 0).toLocaleString('es-CL')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sin filas en matriz.</p>'}
    </article>
    <article class="card"><h3>Aprobaciones</h3>
      ${approvals.length ? `<table class="table-grid"><thead><tr><th>ID</th><th>Referencia</th><th>Acción</th><th>Estado</th><th>Aprobador</th></tr></thead><tbody>${approvals.map((a) => `<tr><td>${a.id}</td><td>${a.referenciaTipo}:${a.referenciaId}</td><td>${a.accion}</td><td>${badge(a.estado)}</td><td>${a.aprobador || '-'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sin aprobaciones.</p>'}
    </article>
    <article class="card"><h3>Action Log</h3>
      ${logs.length ? `<table class="table-grid"><thead><tr><th>Fecha</th><th>Acción</th><th>Actor</th><th>Referencia</th></tr></thead><tbody>${logs.map((l) => `<tr><td>${new Date(l.timestamp).toLocaleString('es-CL')}</td><td>${l.action}</td><td>${l.actor || '-'}</td><td>${l.referenceId || '-'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sin logs.</p>'}
    </article>
  `;
  return section;
};

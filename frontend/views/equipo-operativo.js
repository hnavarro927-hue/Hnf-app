/**
 * Equipo — carga por persona (OT + flota) sin jerga técnica agresiva.
 */

const norm = (s) => String(s ?? '').trim().toLowerCase();

export const equipoOperativoView = ({ data, navigateToView, reloadApp } = {}) => {
  const root = document.createElement('div');
  root.className = 'hnf-mod-equipo';

  const ots = data?.planOts || data?.ots?.data || [];
  const sol = Array.isArray(data?.flotaSolicitudes) ? data.flotaSolicitudes : [];

  const byTech = new Map();
  const bump = (name, field) => {
    const k = name || 'Sin asignar';
    if (!byTech.has(k)) byTech.set(k, { tecnico: k, otAbiertas: 0, otCriticas: 0, flota: 0 });
    const row = byTech.get(k);
    row[field] += 1;
  };

  for (const o of ots) {
    if (['terminado', 'cerrada', 'cerrado'].includes(norm(o?.estado))) continue;
    const t = String(o?.tecnicoAsignado || '').trim() || 'Sin técnico';
    bump(t, 'otAbiertas');
    if (norm(o?.prioridad) === 'critica') {
      const row = byTech.get(t);
      if (row) row.otCriticas += 1;
    }
  }

  for (const s of sol) {
    if (norm(s?.estado) === 'cerrada') continue;
    const r = String(s?.responsable || s?.conductor || '').trim() || 'Sin responsable';
    bump(r, 'flota');
  }

  const rows = [...byTech.values()].sort((a, b) => b.otAbiertas + b.flota - (a.otAbiertas + a.flota));

  const head = document.createElement('header');
  head.className = 'hnf-mod-equipo__head';
  head.innerHTML = `<h1 class="hnf-mod-equipo__title">Equipo</h1>
    <p class="hnf-mod-equipo__sub muted">Carga viva por responsable · Clima y Flota</p>`;

  const tbl = document.createElement('div');
  tbl.className = 'hnf-mod-equipo__table-wrap';
  const table = document.createElement('table');
  table.className = 'hnf-mod-equipo__table';
  table.innerHTML = `<thead><tr>
    <th>Persona</th>
    <th>OT abiertas</th>
    <th>OT prioridad crítica</th>
    <th>Flota activa</th>
  </tr></thead>`;
  const tb = document.createElement('tbody');
  for (const r of rows.slice(0, 40)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(r.tecnico)}</td>
      <td>${r.otAbiertas}</td>
      <td>${r.otCriticas}</td>
      <td>${r.flota}</td>`;
    tb.append(tr);
  }
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" class="muted">Sin asignaciones abiertas en este corte.</td>`;
    tb.append(tr);
  }
  table.append(tb);
  tbl.append(table);

  const nav = document.createElement('div');
  nav.className = 'hnf-mod-equipo__nav';
  const b1 = document.createElement('button');
  b1.type = 'button';
  b1.className = 'secondary-button';
  b1.textContent = 'Ir a Clima';
  b1.addEventListener('click', () => navigateToView?.('clima'));
  const b2 = document.createElement('button');
  b2.type = 'button';
  b2.className = 'secondary-button';
  b2.textContent = 'Ir a Flota';
  b2.addEventListener('click', () => navigateToView?.('flota'));
  const sync = document.createElement('button');
  sync.type = 'button';
  sync.className = 'primary-button';
  sync.textContent = 'Actualizar';
  sync.addEventListener('click', () => reloadApp?.());
  nav.append(b1, b2, sync);

  root.append(head, tbl, nav);
  return root;
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

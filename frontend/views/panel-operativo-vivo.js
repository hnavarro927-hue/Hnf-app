import {
  filterPanelDatasetForRole,
  getEffectiveOperationalRole,
  HNF_OPERATIONAL_ROLES,
  roleLabel,
  setOperationalRole,
} from '../domain/hnf-operational-roles.js';
import { ESTADOS_FLUJO_OPERATIVO } from '../domain/hnf-operational-workflow.js';
import { operationalEventsService } from '../services/operational-events.service.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null && text !== '') n.textContent = text;
  return n;
};

function renderEventRows(tbody, list, { canPatchEstado, onPatched }) {
  tbody.replaceChildren();
  const rows = Array.isArray(list) ? list : [];
  if (!rows.length) {
    const tr = el('tr', '');
    const td = el('td', 'muted', '—');
    td.colSpan = 7;
    tr.append(td);
    tbody.append(tr);
    return;
  }
  for (const ev of rows.slice(0, 80)) {
    const tr = el('tr', '');
    tr.append(
      el('td', 'mono small', String(ev.id || '').slice(0, 18)),
      el('td', '', String(ev.tipo_evento || '—')),
      el('td', '', String(ev.cliente || ev.contacto || '—')),
      el('td', '', String(ev.estado || '—')),
      el('td', '', String(ev.urgencia || '—')),
      el('td', 'small', String(ev.resumen_interpretado || '').slice(0, 80))
    );
    if (canPatchEstado && ev.id) {
      const tdAct = el('td', '');
      const sel = document.createElement('select');
      sel.className = 'hnf-panel-vivo__estado';
      const cur = String(ev.estado || '');
      for (const st of ESTADOS_FLUJO_OPERATIVO) {
        const o = document.createElement('option');
        o.value = st;
        o.textContent = st;
        if (st === cur) o.selected = true;
        sel.append(o);
      }
      const go = el('button', 'secondary-button', 'Aplicar');
      go.type = 'button';
      go.addEventListener('click', async () => {
        const next = sel.value;
        if (next === cur) return;
        const r = await operationalEventsService.patchEstado(ev.id, { estado: next });
        const ok = r && r.success;
        if (ok) onPatched?.();
        else go.textContent = 'Error';
        setTimeout(() => {
          go.textContent = 'Aplicar';
        }, 1600);
      });
      tdAct.append(sel, go);
      tr.append(tdAct);
    } else {
      tr.append(el('td', 'muted small', '—'));
    }
    tbody.append(tr);
  }
}

function sectionTable(title, subtitle, list, ctx) {
  const sec = el('section', 'hnf-panel-vivo__section tarjeta');
  sec.append(el('h3', 'hnf-panel-vivo__h3', title));
  if (subtitle) sec.append(el('p', 'muted small', subtitle));
  const wrap = el('div', 'table-wrap');
  const table = el('table', 'data-table');
  const thead = el('thead', '');
  const hr = el('tr', '');
  hr.append(
    el('th', '', 'Id'),
    el('th', '', 'Tipo'),
    el('th', '', 'Cliente'),
    el('th', '', 'Estado'),
    el('th', '', 'Urgencia'),
    el('th', '', 'Resumen'),
    el('th', '', 'Acción')
  );
  thead.append(hr);
  const tbody = el('tbody', '');
  table.append(thead, tbody);
  wrap.append(table);
  sec.append(wrap);
  renderEventRows(tbody, list, ctx);
  return { sec, tbody };
}

export const panelOperativoVivoView = ({ data, integrationStatus, reloadApp } = {}) => {
  const root = el('section', 'hnf-panel-vivo');
  const header = el('div', 'module-header');
  header.append(
    el('h2', '', 'Panel operativo vivo'),
    el(
      'p',
      'muted',
      'Consolidación diaria real desde GET /operational-panel/daily. Eventos persistidos en servidor (hnf_operational_events.json). Trazabilidad por audit en cada evento.'
    )
  );

  const roleRow = el('div', 'module-toolbar');
  const lab = el('span', 'muted small', 'Rol de vista (UI; auth en backend pendiente): ');
  const sel = document.createElement('select');
  sel.className = 'hnf-panel-vivo__role';
  for (const r of Object.values(HNF_OPERATIONAL_ROLES)) {
    const o = document.createElement('option');
    o.value = r;
    o.textContent = roleLabel(r);
    sel.append(o);
  }
  sel.value = getEffectiveOperationalRole();
  sel.addEventListener('change', () => {
    setOperationalRole(sel.value);
    reloadApp?.();
  });
  roleRow.append(lab, sel);
  root.append(header, roleRow);

  if (integrationStatus === 'sin conexión') {
    const off = el('div', 'integration-banner integration-banner--offline');
    off.textContent = 'Sin conexión: el panel requiere API.';
    root.append(off);
    return root;
  }

  const panelRaw = data?.operationalPanelDaily;
  const role = getEffectiveOperationalRole();
  const panel = filterPanelDatasetForRole(panelRaw, role);

  if (!panel) {
    const card = el('div', 'tarjeta');
    card.append(el('p', '', 'No hay dataset de panel (fallo de red o servidor).'));
    const b = el('button', 'secondary-button', 'Reintentar');
    b.type = 'button';
    b.addEventListener('click', () => reloadApp?.());
    card.append(b);
    root.append(card);
    return root;
  }

  root.append(
    el(
      'p',
      'muted small',
      `Día panel (UTC): ${panel.meta?.panelDayUtc || '—'} · generado ${panel.meta?.generatedAt || '—'}`
    )
  );

  const counts = el('div', 'hnf-panel-vivo__counts');
  const c = panel.conteos || {};
  for (const [k, v] of [
    ['Eventos hoy', c.eventos_hoy],
    ['OT activas', c.ots_activas],
    ['Traslados activos', c.traslados_activos],
  ]) {
    const card = el('div', 'tarjeta hnf-panel-vivo__count');
    card.append(el('span', 'muted small', k), el('strong', '', String(v ?? '—')));
    counts.append(card);
  }
  root.append(counts);

  if (panel.cuellos_de_botella?.length) {
    const sec = el('section', 'hnf-panel-vivo__section');
    sec.append(el('h3', '', 'Cuellos de botella'));
    const ul = el('ul', 'hnf-panel-vivo__list');
    for (const b of panel.cuellos_de_botella) {
      ul.append(el('li', '', b.texto || b.code || '—'));
    }
    sec.append(ul);
    root.append(sec);
  }

  if (panel.responsables_criticos?.length) {
    const sec = el('section', 'hnf-panel-vivo__section');
    sec.append(el('h3', '', 'Responsables con carga urgente'));
    const ul = el('ul', 'hnf-panel-vivo__list');
    for (const r of panel.responsables_criticos) {
      ul.append(el('li', '', `${r.responsable}: ${r.count} evento(s)`));
    }
    sec.append(ul);
    root.append(sec);
  }

  const canPatch =
    role === HNF_OPERATIONAL_ROLES.EJECUTIVO || role === HNF_OPERATIONAL_ROLES.REVISION_OPERATIVA;
  const onPatched = () => reloadApp?.();

  const s1 = sectionTable(
    'Entradas del día',
    'Eventos operativos con fecha del día (UTC) o creados hoy.',
    panel.entradas_del_dia,
    { canPatchEstado: canPatch, onPatched }
  );
  root.append(s1.sec);

  const s2 = sectionTable(
    'Autorizaciones / aprobación pendiente',
    'Eventos que requieren revisión ejecutiva.',
    panel.autorizaciones_pendientes,
    { canPatchEstado: canPatch, onPatched }
  );
  root.append(s2.sec);

  const s3 = sectionTable(
    'Evidencias pendientes (clasificación)',
    'Eventos marcados como evidencia pendiente.',
    panel.evidencias_pendientes,
    { canPatchEstado: canPatch, onPatched }
  );
  root.append(s3.sec);

  const otSec = el('section', 'hnf-panel-vivo__section tarjeta');
  otSec.append(el('h3', '', 'OT activas (muestra)'));
  const otList = el('ul', 'hnf-panel-vivo__list');
  for (const o of (panel.ots_activas || []).slice(0, 12)) {
    otList.append(
      el('li', '', `${o.id || '—'} · ${o.cliente || '—'} · estado ${o.estado || '—'}`)
    );
  }
  if (!(panel.ots_activas || []).length) otList.append(el('li', 'muted', '—'));
  otSec.append(otList);
  root.append(otSec);

  const trSec = el('section', 'hnf-panel-vivo__section tarjeta');
  trSec.append(el('h3', '', 'Traslados activos (muestra)'));
  const trList = el('ul', 'hnf-panel-vivo__list');
  for (const t of (panel.traslados_activos || []).slice(0, 12)) {
    trList.append(
      el('li', '', `${t.id || '—'} · ${t.cliente || '—'} · ${t.estado || '—'} · ${t.origen || ''} → ${t.destino || ''}`)
    );
  }
  if (!(panel.traslados_activos || []).length) trList.append(el('li', 'muted', '—'));
  trSec.append(trList);
  root.append(trSec);

  const manual = el('section', 'hnf-panel-vivo__section tarjeta');
  manual.append(el('h3', '', 'Ingreso manual estructurado (crea evento en servidor)'));
  const ta = el('textarea', 'hnf-panel-vivo__textarea');
  ta.rows = 3;
  ta.placeholder = 'Texto del mensaje / pedido (obligatorio)';
  const sub = el('button', 'primary-button', 'Registrar evento manual');
  sub.type = 'button';
  sub.addEventListener('click', async () => {
    const text = ta.value.trim();
    if (!text) return;
    const r = await operationalEventsService.createManual({ mensaje_original: text, canal: 'manual_ui' });
    if (r?.success) {
      ta.value = '';
      reloadApp?.();
    } else {
      sub.textContent = 'Error al guardar';
      setTimeout(() => {
        sub.textContent = 'Registrar evento manual';
      }, 2000);
    }
  });
  manual.append(ta, sub);
  root.append(manual);

  return root;
};

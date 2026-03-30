/**
 * Matriz HNF — centro de control gerencial (Hernán / Lyn).
 * Solo decisiones y agregados; el detalle operativo vive en otros módulos.
 */

import { expenseService } from '../services/expense.service.js';
import { ocDocumentosService } from '../services/oc-documentos.service.js';
import { createHnfDisciplinaTecnicosPanel } from '../components/hnf-disciplina-tecnicos.js';
import {
  buildMatrizActividad,
  buildMatrizKpis,
  countGastosPendientesAprobacion,
  countLeadsSinRespuesta,
  countOtFueraSla,
  countRendicionesPendientes,
  listGastosPendientesAprobacion,
  listOcRecientes,
  unidadNegocioResumen,
} from '../domain/hnf-matriz-snapshot.js';
import { buildDisciplinaTecnicosSnapshot } from '../domain/hnf-tecnico-evidencia-disciplina.js';

const fmtMoney = (n) =>
  Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

const el = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = text;
  return x;
};

const pill = (label, value, variant = '') => {
  const d = el('div', `hnf-matriz-pill${variant ? ` ${variant}` : ''}`);
  d.append(el('span', 'hnf-matriz-pill__k', label), el('strong', 'hnf-matriz-pill__v', String(value)));
  return d;
};

const section = (title, subtitle) => {
  const s = el('section', 'hnf-matriz-section');
  const h = el('h2', 'hnf-matriz-section__title', title);
  s.append(h);
  if (subtitle) s.append(el('p', 'hnf-matriz-section__sub muted', subtitle));
  return s;
};

const canModule = (modules, id) =>
  Array.isArray(modules) && (modules.includes('*') || modules.includes(id));

export const matrizHnfView = ({
  data = {},
  navigateToView,
  reloadApp,
  integrationStatus,
  apiBaseLabel,
  allowedModules = [],
  authLabel = '—',
} = {}) => {
  const root = el('div', 'hnf-matriz');
  const m = data?.matriz || {};
  const ots = m.ots;
  const expenses = m.expenses;
  const leads = m.leads || [];
  const solicitudes = m.solicitudes || [];
  const ocList = m.ocList || [];
  const events = m.events || [];
  const auditRows = m.auditRows || [];
  const tiendas = Array.isArray(m.tiendas) ? m.tiendas : [];
  const otsList = Array.isArray(ots) ? ots : [];
  const snapDisciplina = buildDisciplinaTecnicosSnapshot(otsList);

  const userLabel = authLabel || '—';
  const sysOk = integrationStatus === 'conectado';

  /* —— Header —— */
  const head = el('header', 'hnf-matriz-head');
  head.append(el('h1', 'hnf-matriz-head__title', 'HNF Servicios Integrales'));
  const sub = el('p', 'hnf-matriz-head__subtitle', 'Centro de Control Operativo');
  head.append(sub);
  const meta = el('div', 'hnf-matriz-head__meta');
  meta.append(
    el('span', 'hnf-matriz-head__user', `Usuario: ${userLabel}`),
    el(
      'span',
      `hnf-matriz-head__sys hnf-matriz-head__sys--${sysOk ? 'ok' : 'bad'}`,
      sysOk ? 'Sistema en línea' : 'Sin conexión con API'
    ),
    el('span', 'hnf-matriz-head__api muted small', apiBaseLabel || '')
  );
  head.append(meta);
  root.append(head);

  /* —— Alertas —— */
  const alerts = section(
    'Alertas críticas',
    'Conteos en tiempo real desde datos cargados; no incluye umbrales SLA personalizados por contrato.'
  );
  const ag = el('div', 'hnf-matriz-alerts');
  ag.append(
    pill('OT fuera de agenda / SLA (heurística)', countOtFueraSla(ots), 'hnf-matriz-pill--alert'),
    pill(
      'Técnicos · evidencia incompleta (bajo umbral Clima)',
      snapDisciplina.alertasBajoCumplimiento.length,
      snapDisciplina.alertasBajoCumplimiento.length ? 'hnf-matriz-pill--alert' : ''
    ),
    pill('Gastos pendientes de aprobación', countGastosPendientesAprobacion(expenses)),
    pill('Rendiciones / solicitudes en revisión', countRendicionesPendientes(solicitudes)),
    pill('Leads sin respuesta (+72 h)', countLeadsSinRespuesta(leads))
  );
  alerts.append(ag);
  root.append(alerts);

  /* —— KPIs —— */
  const kpis = buildMatrizKpis({ ots, expenses });
  const ksec = section(
    'KPIs gerenciales',
    'Basados en OT y gastos registrados en HNF. Período mes = calendario local.'
  );
  const kg = el('div', 'hnf-matriz-kpis');
  const kpiDefs = [
    ['Ingresos estimados hoy', `$${fmtMoney(kpis.ingresosEstimadosHoy)}`, 'OT con visita hoy y monto cobrado'],
    ['Ingresos en proceso', `$${fmtMoney(kpis.ingresosEnProceso)}`, 'OT abiertas · monto cobrado declarado'],
    ['Ingresos cerrados (mes)', `$${fmtMoney(kpis.ingresosCerradosMes)}`, 'OT cerradas en el mes'],
    ['Gastos hoy', `$${fmtMoney(kpis.gastosHoy)}`, 'Por fecha de gasto'],
    ['Gastos mes', `$${fmtMoney(kpis.gastosMes)}`, 'Mismo mes calendario'],
    [
      'Utilidad estimada (mes)',
      `$${fmtMoney(kpis.utilidadEstimada)}`,
      'Utilidad OT cerradas mes − gastos mes (aprox.)',
    ],
    ['Ticket promedio (mes)', `$${fmtMoney(kpis.ticketPromedioMes)}`, 'Solo OT cerradas con cobro > 0'],
  ];
  for (const [label, value, hint] of kpiDefs) {
    const c = el('div', 'hnf-matriz-kpi');
    c.append(el('span', 'hnf-matriz-kpi__k', label), el('strong', 'hnf-matriz-kpi__v', value));
    c.append(el('span', 'hnf-matriz-kpi__hint muted small', hint));
    kg.append(c);
  }
  ksec.append(kg);
  root.append(ksec);

  /* —— Unidades —— */
  const un = section('Unidades de negocio', 'Resumen por tipo de servicio en OT.');
  const ug = el('div', 'hnf-matriz-units');
  for (const [id, label, viewId] of [
    ['clima', 'Clima', 'clima'],
    ['flota', 'Flota', 'flota'],
  ]) {
    const r = unidadNegocioResumen(ots, id);
    const card = el('article', 'hnf-matriz-unit');
    card.append(el('h3', 'hnf-matriz-unit__title', label));
    const ul = el('ul', 'hnf-matriz-unit__stats');
    ul.append(
      el('li', '', `OT abiertas: ${r.abiertas}`),
      el('li', '', `Fuera de agenda (heurística): ${r.fueraSla}`),
      el('li', '', `Total seguimiento: ${r.total}`)
    );
    card.append(ul);
    const go = el(
      'button',
      'primary-button hnf-matriz-unit__go',
      id === 'clima' ? 'Entrar a Clima' : 'Entrar a Flota'
    );
    if (canModule(allowedModules, viewId)) {
      go.addEventListener('click', () => navigateToView?.(viewId));
    } else {
      go.disabled = true;
      go.classList.add('hnf-matriz-unit__go--disabled');
      go.title = 'Sin acceso a este módulo';
    }
    card.append(go);
    ug.append(card);
  }
  un.append(ug);
  root.append(un);

  /* —— Disciplina técnica (evidencia Clima) —— */
  const discSec = section(
    'Disciplina técnica (evidencia Clima)',
    'Por técnico: OT con fotos antes, durante y después completas vs incompletas. Misma regla que el cierre de OT.'
  );
  discSec.append(createHnfDisciplinaTecnicosPanel(otsList, { navigateToView }));
  root.append(discSec);

  /* —— Finanzas —— */
  const fin = section(
    'Control financiero',
    'Solo lo que existe en datos HNF; el resto se indica explícitamente.'
  );
  const fg = el('div', 'hnf-matriz-fin-grid');
  const sumRef = tiendas.reduce((a, t) => a + (Number(t.valorReferencialTienda) || 0), 0);
  const caja = el('div', 'hnf-matriz-fin-item');
  caja.append(
    el('strong', '', 'Caja entregada'),
    el('p', 'muted small', 'No hay registro de «caja entregada» en el modelo actual.')
  );
  fg.append(caja);
  const saldo = el('div', 'hnf-matriz-fin-item');
  saldo.append(
    el('strong', '', 'Saldo por rendir'),
    el(
      'p',
      'muted small',
      tiendas.length
        ? `Suma valor referencial tiendas: $${fmtMoney(sumRef)} (referencia, no es rendición).`
        : 'Sin tiendas financieras cargadas.'
    )
  );
  fg.append(saldo);
  const tec = el('div', 'hnf-matriz-fin-item');
  tec.append(el('strong', '', 'Disciplina evidencia (Clima)'));
  if (snapDisciplina.global.totalOts === 0) {
    tec.append(el('p', 'muted small', 'Sin OT Clima con técnico asignado.'));
  } else {
    tec.append(
      el(
        'p',
        'muted small',
        `Global: ${snapDisciplina.global.porcentajeCumplimiento}% (${snapDisciplina.global.completas}/${snapDisciplina.global.totalOts} OT completas).`
      )
    );
    if (snapDisciplina.alertasBajoCumplimiento.length) {
      const w = el(
        'p',
        'hnf-matriz-disciplina-warn small',
        `Alerta: ${snapDisciplina.alertasBajoCumplimiento.length} técnico(s) bajo el umbral de cumplimiento.`
      );
      tec.append(w);
    }
  }
  fg.append(tec);
  const comp = el('div', 'hnf-matriz-fin-item');
  const recentOc = listOcRecientes(ocList, 4);
  comp.append(el('strong', '', 'Compras recientes (OC)'));
  if (!recentOc.length) {
    comp.append(el('p', 'muted small', 'Sin OC registradas.'));
  } else {
    const ul = el('ul', 'hnf-matriz-fin-list');
    for (const c of recentOc) {
      const li = el('li', '', `${c.id || '—'} · ${c.numeroOc || '—'} · ${c.estadoExtraccion || '—'}`);
      ul.append(li);
    }
    comp.append(ul);
  }
  fg.append(comp);
  const inv = el('div', 'hnf-matriz-fin-item');
  inv.append(
    el('strong', '', 'Inventario crítico'),
    el('p', 'muted small', 'Sin módulo de inventario conectado a la Matriz.')
  );
  fg.append(inv);
  fin.append(fg);
  root.append(fin);

  /* —— Aprobaciones —— */
  const ap = section('Aprobaciones', 'Acciones que impactan finanzas u OC.');
  const apBox = el('div', 'hnf-matriz-approvals');

  const pend = listGastosPendientesAprobacion(expenses);
  if (!pend.length) {
    apBox.append(el('p', 'muted', 'No hay gastos pendientes de aprobación.'));
  } else {
    const ul = el('ul', 'hnf-matriz-approval-list');
    for (const g of pend.slice(0, 12)) {
      const li = el('li', 'hnf-matriz-approval-item');
      li.append(
        el(
          'span',
          'hnf-matriz-approval-txt',
          `${g.id} · $${fmtMoney(g.monto)} · ${String(g.descripcion || '').slice(0, 72)}`
        )
      );
      const actions = el('span', 'hnf-matriz-approval-actions');
      const ok = el('button', 'secondary-button', 'Aprobar');
      ok.addEventListener('click', async () => {
        ok.disabled = true;
        try {
          await expenseService.patch(g.id, { estadoAprobacion: 'aprobado' });
          await reloadApp?.();
        } catch (e) {
          ok.disabled = false;
          window.alert(e?.message || 'No se pudo aprobar');
        }
      });
      const bad = el('button', 'secondary-button', 'Rechazar');
      bad.addEventListener('click', async () => {
        bad.disabled = true;
        try {
          await expenseService.patch(g.id, { estadoAprobacion: 'rechazado' });
          await reloadApp?.();
        } catch (e) {
          bad.disabled = false;
          window.alert(e?.message || 'No se pudo rechazar');
        }
      });
      actions.append(ok, bad);
      li.append(actions);
      ul.append(li);
    }
    apBox.append(ul);
  }

  const ocPend = ocList.filter((c) => {
    const e = String(c.estadoExtraccion || '').toLowerCase();
    return e && e !== 'validada';
  });
  const ocSlice = ocPend.slice(0, 6);
  apBox.append(el('h4', 'hnf-matriz-subhead', 'OC pendientes de validar'));
  if (!ocSlice.length) {
    apBox.append(el('p', 'muted small', 'No hay OC pendientes de validación en la lista.'));
  } else {
    const ul2 = el('ul', 'hnf-matriz-approval-list');
    for (const c of ocSlice) {
      const li = el('li', 'hnf-matriz-approval-item');
      li.append(el('span', '', `${c.id} · ${c.numeroOc || '—'}`));
      const v = el('button', 'secondary-button', 'Validar OC');
      v.addEventListener('click', async () => {
        v.disabled = true;
        try {
          await ocDocumentosService.validar(c.id);
          await reloadApp?.();
        } catch (e) {
          v.disabled = false;
          window.alert(e?.message || 'No se pudo validar');
        }
      });
      li.append(v);
      ul2.append(li);
    }
    apBox.append(ul2);
  }

  const cajaNote = el('p', 'muted small', 'Aprobar caja: sin flujo dedicado en API; usar Finanzas / tiendas.');
  apBox.append(cajaNote);

  ap.append(apBox);
  root.append(ap);

  /* —— Actividad —— */
  const act = section('Actividad reciente', 'Mezcla OT, gastos, eventos operativos y auditoría.');
  const tl = el('ol', 'hnf-matriz-timeline');
  const items = buildMatrizActividad({ ots, expenses, events, auditRows, limit: 20 });
  if (!items.length) {
    tl.append(el('li', 'muted', 'Sin eventos recientes.'));
  } else {
    for (const it of items) {
      const li = el('li', 'hnf-matriz-tl-item');
      const dt = new Date(it.t);
      li.append(
        el('time', 'hnf-matriz-tl-time', dt.toLocaleString('es-CL')),
        el('span', 'hnf-matriz-tl-label', it.label),
        el('span', 'hnf-matriz-tl-detail muted small', it.detail)
      );
      tl.append(li);
    }
  }
  act.append(tl);
  root.append(act);

  /* —— Accesos —— */
  const acc = section('Accesos', 'Atajos a módulos gerenciales.');
  const grid = el('div', 'hnf-matriz-quick');
  const links = [
    ['oportunidades', 'Comercial'],
    ['finanzas', 'Finanzas'],
    ['base-maestra', 'Base maestra'],
    ['ordenes-compra', 'Órdenes de compra'],
    ['usuarios', 'Usuarios'],
    ['auditoria', 'Auditoría'],
  ];
  for (const [view, label] of links) {
    if (!canModule(allowedModules, view)) continue;
    const b = el('button', 'hnf-matriz-quick__btn', label);
    b.addEventListener('click', () => navigateToView?.(view));
    grid.append(b);
  }
  acc.append(grid);
  if (!grid.children.length) {
    acc.append(el('p', 'muted small', 'No tenés accesos secundarios visibles con tu rol actual.'));
  }
  root.append(acc);

  return root;
};
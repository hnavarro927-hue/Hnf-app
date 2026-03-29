/**
 * Finanzas — lectura ejecutiva + aprobación de gastos (sin bloquear operación: estado inicial «Registrado»).
 */

import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import { resolveOperatorRole } from '../domain/hnf-operator-role.js';

const fmtMoney = (n) => {
  const x = Math.round(Number(n) || 0);
  return x.toLocaleString('es-CL', { maximumFractionDigits: 0 });
};

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const ESTADO_LABEL = {
  registrado: 'Registrado',
  aprobado: 'Aprobado',
  observado: 'Observado',
  rechazado: 'Rechazado',
};

export const finanzasOperativoView = ({ data, navigateToView, reloadApp, actions } = {}) => {
  const root = document.createElement('div');
  root.className = 'hnf-mod-finanzas hnf-op-view hnf-op-view--finanzas';

  const opRole = resolveOperatorRole();
  const canFinanceApprove = opRole === 'admin' || opRole === 'control';

  const adn = data?.hnfAdn || {};
  const ots = data?.planOts || data?.ots?.data || [];
  const sol = Array.isArray(data?.flotaSolicitudes) ? data.flotaSolicitudes : [];
  const expenses = data?.expenses?.data || [];

  let climaAbierto = 0;
  let climaMonto = 0;
  for (const o of ots) {
    if (['terminado', 'cerrada', 'cerrado'].includes(String(o?.estado || '').toLowerCase())) continue;
    const st = String(o?.tipoServicio || '').toLowerCase();
    if (st === 'flota' || st === 'comercial') continue;
    climaAbierto += 1;
    climaMonto += roundMoney(o.montoPresupuestado ?? o.montoEstimado ?? o.montoCobrado ?? o.monto ?? 0);
  }

  let flotaAbierta = 0;
  let flotaMonto = 0;
  for (const s of sol) {
    if (String(s?.estado || '').toLowerCase() === 'cerrada') continue;
    flotaAbierta += 1;
    flotaMonto += roundMoney(s.ingresoFinal || s.ingresoEstimado || s.monto || 0);
  }

  const gastosMes = expenses.reduce((acc, e) => acc + roundMoney(e?.monto ?? e?.amount ?? 0), 0);

  const sinComprobante = expenses.filter((e) => !e?.comprobante).length;
  const pendientesReg = expenses.filter((e) => (e?.estadoAprobacion || 'registrado') === 'registrado').length;
  const observados = expenses.filter((e) => e?.estadoAprobacion === 'observado').length;

  const head = document.createElement('header');
  head.className = 'hnf-mod-finanzas__head';
  head.innerHTML = `<h1 class="hnf-mod-finanzas__title">Finanzas</h1>
    <p class="hnf-mod-finanzas__sub muted">Revisión de gastos y lectura ejecutiva. Los gastos nuevos quedan <strong>Registrado</strong>: la operación no se detiene.</p>`;

  const flowStrip = createHnfOperationalFlowStrip(4);

  const jarvisBox = document.createElement('div');
  jarvisBox.className = 'tarjeta hnf-mod-finanzas__jarvis';
  jarvisBox.innerHTML = `<p class="small muted"><strong>Resumen:</strong> ${pendientesReg} gasto(s) pendientes de revisión · ${observados} observado(s) · ${sinComprobante} sin comprobante.</p>
    <p class="small muted"><strong>Recomendaciones:</strong> priorizá observados y montos altos. <strong>Información importante:</strong> al aprobar u observar queda trazabilidad en el registro.</p>`;

  const grid = document.createElement('div');
  grid.className = 'hnf-mod-finanzas__grid';

  const card = (t, v, hint, nav) => {
    const c = document.createElement('section');
    c.className = 'hnf-mod-finanzas__card tarjeta';
    c.innerHTML = `<h2 class="hnf-mod-finanzas__card-t">${t}</h2>
      <p class="hnf-mod-finanzas__card-v">$${fmtMoney(v)}</p>
      <p class="hnf-mod-finanzas__card-h muted small">${hint}</p>`;
    if (nav) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary-button';
      b.textContent = 'Ver módulo';
      b.addEventListener('click', () => navigateToView?.(nav));
      c.append(b);
    }
    return c;
  };

  grid.append(
    card(
      'Dinero en operación (referencia)',
      adn.dineroEnRiesgo || climaMonto + flotaMonto,
      'Suma orientativa de OT abiertas (Clima / administrativo) + pipeline Flota.',
      'clima'
    ),
    card('Clima / admin — OT abiertas (monto ref.)', climaMonto, `${climaAbierto} orden(es) sin cerrar.`, 'clima'),
    card('Flota — pipeline abierto (monto ref.)', flotaMonto, `${flotaAbierta} solicitud(es) activas.`, 'flota'),
    card('Egresos cargados (total listado)', gastosMes, 'Incluye todos los estados de aprobación.', null)
  );

  const gastosSection = document.createElement('section');
  gastosSection.className = 'tarjeta hnf-mod-finanzas__gastos';
  const gh = document.createElement('h2');
  gh.className = 'hnf-mod-finanzas__gastos-t';
  gh.textContent = 'Gastos · aprobación';
  const gsub = document.createElement('p');
  gsub.className = 'muted small';
  gsub.textContent = canFinanceApprove
    ? 'Podés marcar Aprobado, Observado o Rechazado. Si observás, indicá devolución a Romina o Gery en la observación.'
    : 'Solo lectura de estados. Lyn y Hernán aprueban desde su sesión.';
  gastosSection.append(gh, gsub);

  const fb = document.createElement('p');
  fb.className = 'form-feedback';
  fb.hidden = true;
  gastosSection.append(fb);

  const tblWrap = document.createElement('div');
  tblWrap.className = 'hnf-mod-finanzas__table-wrap';

  if (!expenses.length) {
    const empty = document.createElement('p');
    empty.className = 'muted small';
    empty.textContent = 'No hay gastos cargados aún.';
    tblWrap.append(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'hnf-mod-finanzas__table';
    const thead = document.createElement('thead');
    thead.innerHTML =
      '<tr><th>ID</th><th>Fecha</th><th>Monto</th><th>Estado</th><th>Observación</th><th>Acciones</th></tr>';
    const tbody = document.createElement('tbody');
    for (const e of expenses) {
      const tr = document.createElement('tr');
      const est = String(e.estadoAprobacion || 'registrado').toLowerCase();
      const obs = e.observacionFinanzas || '—';
      tr.innerHTML = `<td>${e.id || '—'}</td><td>${e.fecha || '—'}</td><td>$${fmtMoney(e.monto)}</td><td>${ESTADO_LABEL[est] || est}</td><td class="muted small">${String(obs).slice(0, 80)}${String(obs).length > 80 ? '…' : ''}</td>`;
      const tdAct = document.createElement('td');
      tdAct.className = 'hnf-mod-finanzas__acts';
      if (canFinanceApprove && e.id) {
        const run = async (payload, okMsg) => {
          fb.hidden = true;
          try {
            await actions?.patchExpenseEstado?.(e.id, payload);
            fb.className = 'form-feedback form-feedback--success';
            fb.textContent = okMsg;
            fb.hidden = false;
          } catch (err) {
            fb.className = 'form-feedback form-feedback--error';
            fb.textContent = err?.message || 'No se pudo actualizar el gasto.';
            fb.hidden = false;
          }
        };
        const bOk = document.createElement('button');
        bOk.type = 'button';
        bOk.className = 'secondary-button hnf-mod-finanzas__mini';
        bOk.textContent = 'Aprobado';
        bOk.addEventListener('click', () =>
          run({ estadoAprobacion: 'aprobado' }, 'Aprobado. Registro actualizado.')
        );
        const bObs = document.createElement('button');
        bObs.type = 'button';
        bObs.className = 'secondary-button hnf-mod-finanzas__mini';
        bObs.textContent = 'Observado';
        bObs.addEventListener('click', () => {
          const observacionFinanzas =
            window.prompt('Observación para quien cargó el gasto (obligatorio):') || '';
          if (!observacionFinanzas.trim()) {
            fb.className = 'form-feedback form-feedback--error';
            fb.textContent = 'Falta texto de observación.';
            fb.hidden = false;
            return;
          }
          const devolverA =
            (window.prompt('¿Devolver a Romina o Gery? (opcional, texto libre):') || '').trim() || null;
          run(
            { estadoAprobacion: 'observado', observacionFinanzas, devolverA },
            'Observado. Quedó trazabilidad para corrección.'
          );
        });
        const bRej = document.createElement('button');
        bRej.type = 'button';
        bRej.className = 'secondary-button hnf-mod-finanzas__mini';
        bRej.textContent = 'Rechazado';
        bRej.addEventListener('click', () => {
          const observacionFinanzas =
            (window.prompt('Motivo del rechazo (opcional):') || '').trim() || null;
          run(
            { estadoAprobacion: 'rechazado', observacionFinanzas },
            'Rechazado. Registro actualizado.'
          );
        });
        tdAct.append(bOk, bObs, bRej);
      } else {
        tdAct.textContent = '—';
      }
      tr.append(tdAct);
      tbody.append(tr);
    }
    table.append(thead, tbody);
    tblWrap.append(table);
  }
  gastosSection.append(tblWrap);

  const foot = document.createElement('p');
  foot.className = 'muted small hnf-mod-finanzas__foot';
  foot.textContent =
    'Los totales son referencia operativa. El circuito de gastos no bloquea a Romina, Gery ni técnicos al registrar.';

  const tool = document.createElement('div');
  tool.className = 'hnf-mod-finanzas__tool';
  const sync = document.createElement('button');
  sync.type = 'button';
  sync.className = 'primary-button';
  sync.textContent = 'Actualizar datos';
  sync.addEventListener('click', () => reloadApp?.());
  tool.append(sync);

  root.append(head, flowStrip, jarvisBox, grid, gastosSection, foot, tool);
  return root;
};

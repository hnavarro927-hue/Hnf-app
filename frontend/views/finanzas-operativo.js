/**
 * Finanzas — panel ejecutivo (caja, riesgo, flujo) desde snapshot operativo unificado.
 */

const fmtMoney = (n) => {
  const x = Math.round(Number(n) || 0);
  return x.toLocaleString('es-CL', { maximumFractionDigits: 0 });
};

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

export const finanzasOperativoView = ({ data, navigateToView, reloadApp } = {}) => {
  const root = document.createElement('div');
  root.className = 'hnf-mod-finanzas';

  const adn = data?.hnfAdn || {};
  const ots = data?.planOts || data?.ots?.data || [];
  const sol = Array.isArray(data?.flotaSolicitudes) ? data.flotaSolicitudes : [];
  const expenses = data?.expenses?.data || [];

  let climaAbierto = 0;
  let climaMonto = 0;
  for (const o of ots) {
    if (String(o?.estado || '').toLowerCase() === 'terminado') continue;
    if (String(o?.tipoServicio || 'clima') === 'flota') continue;
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

  const head = document.createElement('header');
  head.className = 'hnf-mod-finanzas__head';
  head.innerHTML = `<h1 class="hnf-mod-finanzas__title">Finanzas</h1>
    <p class="hnf-mod-finanzas__sub muted">Lectura ejecutiva · montos referenciales de operación abierta</p>`;

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
      'Suma orientativa de OT Clima abiertas + ingresos referencia Flota.',
      'clima'
    ),
    card('Clima — OT abiertas (monto ref.)', climaMonto, `${climaAbierto} orden(es) sin cerrar.`, 'clima'),
    card('Flota — pipeline abierto (monto ref.)', flotaMonto, `${flotaAbierta} solicitud(es) activas.`, 'flota'),
    card('Egresos cargados (total listado)', gastosMes, 'Desde registro de gastos; depura en administración si aplica.', null)
  );

  const foot = document.createElement('p');
  foot.className = 'muted small hnf-mod-finanzas__foot';
  foot.textContent =
    'Los totales dependen de datos cargados en el sistema. Para cierre contable usá tu proceso oficial de facturación.';

  const tool = document.createElement('div');
  tool.className = 'hnf-mod-finanzas__tool';
  const sync = document.createElement('button');
  sync.type = 'button';
  sync.className = 'primary-button';
  sync.textContent = 'Actualizar datos';
  sync.addEventListener('click', () => reloadApp?.());
  tool.append(sync);

  root.append(head, grid, foot, tool);
  return root;
};

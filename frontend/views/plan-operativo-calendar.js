import { operationalCalendarService } from '../services/operational-calendar.service.js';
import {
  buildOperationalCalendarReportPreview,
  computeOperationalCalendarAlerts,
  parsePlanningBlock,
} from '../domain/operational-calendar.js';

const TIPOS_UNIDAD = ['UI', 'UE', 'UI+UE'];

/**
 * Pestaña «Calendario operativo» — tablero semanal HNF.
 * @param {object} opts
 * @param {() => string} opts.getWeekStart - YYYY-MM-DD lunes actual
 * @param {(ymd: string) => void} opts.setWeekStart
 * @param {(ymd: string, n: number) => string} opts.addDaysYmd
 * @param {(d: Date) => Date} opts.mondayOf
 * @param {(d: Date) => string} opts.toYmd
 */
export function buildPlanOperativoCalendarSection({
  getWeekStart,
  setWeekStart,
  addDaysYmd,
  mondayOf,
  toYmd,
  data,
  clientes,
  tiendas,
  clienteById,
  tiendaById,
  showFeedback,
  runReload,
  intelNavigate,
}) {
  const card = document.createElement('article');
  card.className = 'plan-card opcal-root';

  const entriesList = () => {
    const oc = data?.operationalCalendar || { entries: [] };
    return Array.isArray(oc.entries) ? oc.entries : [];
  };

  const alertsList = () => {
    const entries = entriesList();
    return (
      data?.operationalCalendarAlerts ||
      computeOperationalCalendarAlerts({
        entries,
        ots: data?.planOts || [],
        mantenciones: data?.planMantenciones || [],
        tiendas,
        clientes,
      })
    );
  };

  card.innerHTML =
    '<h3>Calendario operativo Clima</h3><p class="muted">Programación semanal por tienda con <strong>UI / UE</strong>, franja y técnico. Combina registros propios con <strong>mantenciones plan</strong> (sin duplicar por ID). Podés crear visitas antes de tener OT; el vínculo aparece cuando el sistema encuentra coincidencia por cliente + fecha.</p>';

  const alerts = alertsList();
  if (alerts.length) {
    const ban = document.createElement('div');
    ban.className = 'opcal-alerts';
    const h = document.createElement('h4');
    h.className = 'opcal-alerts__h';
    h.textContent = 'Alertas operativas';
    const ul = document.createElement('ul');
    ul.className = 'opcal-alerts__ul';
    alerts.slice(0, 14).forEach((a) => {
      const li = document.createElement('li');
      li.className = `opcal-alerts__li opcal-alerts__li--${a.severity}`;
      li.innerHTML = `<strong>${a.code}</strong> · ${a.mensaje}${a.detalle ? ` <span class="muted">(${a.detalle})</span>` : ''}`;
      ul.append(li);
    });
    ban.append(h, ul);
    card.append(ban);
  }

  const weekBar = document.createElement('div');
  weekBar.className = 'plan-form-row opcal-weekbar';
  const wkLabel = document.createElement('span');
  wkLabel.className = 'muted';
  wkLabel.textContent = 'Semana (lunes):';
  const wkPrev = document.createElement('button');
  wkPrev.type = 'button';
  wkPrev.className = 'secondary-button';
  wkPrev.textContent = '← Anterior';
  const wkNext = document.createElement('button');
  wkNext.type = 'button';
  wkNext.className = 'secondary-button';
  wkNext.textContent = 'Siguiente →';
  const wkToday = document.createElement('button');
  wkToday.type = 'button';
  wkToday.className = 'secondary-button';
  wkToday.textContent = 'Esta semana';
  const wkReload = document.createElement('button');
  wkReload.type = 'button';
  wkReload.className = 'secondary-button';
  wkReload.textContent = 'Refrescar datos';
  wkReload.title = 'Recarga el módulo desde el servidor (merge calendario + plan)';
  weekBar.append(wkLabel, wkPrev, wkNext, wkToday, wkReload);

  const gridHost = document.createElement('div');
  gridHost.className = 'opcal-week-grid-host';

  const reportHost = document.createElement('div');
  reportHost.className = 'opcal-report muted';

  const renderWeek = () => {
    const entries = entriesList();
    gridHost.replaceChildren();
    const anchor = getWeekStart();
    const days = [];
    for (let i = 0; i < 7; i += 1) days.push(addDaysYmd(anchor, i));
    const grid = document.createElement('div');
    grid.className = 'opcal-week-grid';
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    days.forEach((ymd, idx) => {
      const col = document.createElement('div');
      col.className = 'opcal-day-col';
      const h = document.createElement('h4');
      h.className = 'opcal-day-h';
      h.textContent = `${dayNames[idx]} · ${ymd}`;
      col.append(h);
      const dayE = entries.filter((e) => String(e.fecha).slice(0, 10) === ymd);
      dayE.sort((a, b) => String(a.horaInicio || '').localeCompare(String(b.horaInicio || '')));
      if (!dayE.length) {
        const p = document.createElement('p');
        p.className = 'muted opcal-empty';
        p.textContent = 'Sin bloques.';
        col.append(p);
      } else {
        dayE.forEach((e) => {
          const slot = document.createElement('div');
          const st = String(e.estado || 'programado');
          slot.className = `opcal-card opcal-card--${st.replace(/_/g, '-')}`;
          const unit = String(e.tipoUnidad || 'UE').toUpperCase();
          let unitClass = 'opcal-unit opcal-unit--ue';
          if (unit.includes('UI+UE') || unit === 'UI+UE') unitClass = 'opcal-unit opcal-unit--both';
          else if (unit.includes('UI')) unitClass = 'opcal-unit opcal-unit--ui';

          const src = e.virtual ? 'Plan' : 'Calendario';
          const win = e.bloqueHorario || `${e.horaInicio || '—'}–${e.horaFin || '—'}`;
          slot.innerHTML = `
            <div class="opcal-card__top">
              <span class="${unitClass}">${e.tipoUnidad || 'UE'}</span>
              <span class="opcal-card__estado">${st}</span>
            </div>
            <p class="opcal-card__time">${win}</p>
            <p class="opcal-card__tienda">${e.tiendaNombre || e.tiendaId}</p>
            <p class="opcal-card__cliente muted">${e.cliente || '—'}</p>
            <p class="opcal-card__tech"><strong>Téc.</strong> ${e.tecnicoAsignado || '—'}</p>
            <p class="opcal-card__meta muted">${src}${e.referenciaOtId ? ` · OT ${e.referenciaOtId}` : ''}${e.referenciaMantencionId ? ` · MNT ${e.referenciaMantencionId}` : ''}</p>
          `;
          const actions = document.createElement('div');
          actions.className = 'opcal-card__actions';
          if (e.referenciaOtId && typeof intelNavigate === 'function') {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'secondary-button opcal-mini';
            b.textContent = 'OT';
            b.addEventListener('click', () =>
              intelNavigate({ view: 'clima', otId: e.referenciaOtId })
            );
            actions.append(b);
          }
          const idStr = String(e.id || '');
          if (idStr.startsWith('CAL-')) {
            const ex = document.createElement('button');
            ex.type = 'button';
            ex.className = 'secondary-button opcal-mini';
            ex.textContent = 'Ejecutado';
            ex.addEventListener('click', async () => {
              try {
                await operationalCalendarService.patch(e.id, { estado: 'ejecutado' });
                showFeedback('success', `${e.id} marcado ejecutado.`);
                await runReload();
              } catch (err) {
                showFeedback('error', err.message || 'No se pudo actualizar.');
              }
            });
            actions.append(ex);
          }
          slot.append(actions);
          col.append(slot);
        });
      }
      grid.append(col);
    });
    gridHost.append(grid);

    const wkEnd = days[6];
    const preview = buildOperationalCalendarReportPreview(entries, { desde: days[0], hasta: wkEnd });
    reportHost.innerHTML = `<h4 class="opcal-report__h">Vista comercial (semana · base para reportes)</h4>
      <p>Visitas en rango: <strong>${preview.totales.visitas}</strong> · Ejecutadas: <strong>${preview.totales.ejecutado}</strong> · Programadas/en ruta: <strong>${preview.totales.programadoOEnRuta}</strong></p>
      <p>UI / UE / mixtos: <strong>${preview.coberturaUnidad.ui}</strong> / <strong>${preview.coberturaUnidad.ue}</strong> / <strong>${preview.coberturaUnidad.uiMasUe}</strong></p>`;
  };

  wkPrev.addEventListener('click', () => {
    setWeekStart(addDaysYmd(getWeekStart(), -7));
    renderWeek();
  });
  wkNext.addEventListener('click', () => {
    setWeekStart(addDaysYmd(getWeekStart(), 7));
    renderWeek();
  });
  wkToday.addEventListener('click', () => {
    setWeekStart(toYmd(mondayOf(new Date())));
    renderWeek();
  });
  wkReload.addEventListener('click', async () => {
    showFeedback('neutral', 'Actualizando…');
    const ok = await runReload();
    showFeedback(ok ? 'success' : 'error', ok ? 'Listo.' : 'Error de conexión.');
  });

  const formCard = document.createElement('div');
  formCard.className = 'opcal-form-card';
  formCard.innerHTML = '<h4>Nueva visita (carga manual)</h4><p class="muted">Cliente, tienda, fecha, franja, tipo unidad, técnico.</p>';

  const form = document.createElement('form');
  form.className = 'opcal-form-grid';

  const selC = document.createElement('select');
  selC.required = true;
  selC.append(new Option('— Cliente —', ''));
  clientes.forEach((c) => selC.append(new Option(c.nombre, c.id)));

  const selT = document.createElement('select');
  selT.required = true;
  selT.append(new Option('— Tienda —', ''));
  const fillTiendas = (clienteId) => {
    selT.replaceChildren(new Option('— Tienda —', ''));
    tiendas
      .filter((t) => !clienteId || t.clienteId === clienteId)
      .forEach((t) => {
        const c = clienteById[t.clienteId];
        selT.append(new Option(`${c?.nombre || ''} · ${t.nombre}`, t.id));
      });
  };
  fillTiendas('');
  selC.addEventListener('change', () => fillTiendas(selC.value));

  const fInp = document.createElement('input');
  fInp.type = 'date';
  fInp.required = true;
  const hi = document.createElement('input');
  hi.type = 'text';
  hi.placeholder = 'Inicio HH:MM';
  const hf = document.createElement('input');
  hf.type = 'text';
  hf.placeholder = 'Fin HH:MM';
  const selU = document.createElement('select');
  TIPOS_UNIDAD.forEach((u) => selU.append(new Option(u, u)));
  const tec = document.createElement('input');
  tec.type = 'text';
  tec.placeholder = 'Técnico';
  const obs = document.createElement('input');
  obs.type = 'text';
  obs.placeholder = 'Observación (opcional)';
  const sub = document.createElement('button');
  sub.type = 'submit';
  sub.className = 'primary-button';
  sub.textContent = 'Guardar visita';

  form.append(selC, selT, fInp, hi, hf, selU, tec, obs, sub);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const t = tiendaById[selT.value];
    const c = t ? clienteById[t.clienteId] : null;
    try {
      await operationalCalendarService.create({
        tiendaId: selT.value,
        cliente: c?.nombre || selC.options[selC.selectedIndex]?.text || '',
        tiendaNombre: t?.nombre,
        fecha: fInp.value,
        horaInicio: hi.value.trim(),
        horaFin: hf.value.trim(),
        tipoUnidad: selU.value,
        tecnicoAsignado: tec.value.trim(),
        observacion: obs.value.trim(),
        fuente: 'romina',
        estado: 'programado',
      });
      showFeedback('success', 'Visita registrada en calendario operativo.');
      obs.value = '';
      await runReload();
    } catch (err) {
      showFeedback('error', err.message || 'No se pudo guardar.');
    }
  });
  formCard.append(form);

  const parseCard = document.createElement('div');
  parseCard.className = 'opcal-parse-card';
  parseCard.innerHTML =
    '<h4>Importación futura (texto / tabla / imagen)</h4><p class="muted">Pegá un bloque; hoy solo se analiza estructura. OCR y Excel → <code>parsePlanningBlock</code>.</p>';
  const ta = document.createElement('textarea');
  ta.className = 'opcal-parse-ta';
  ta.rows = 4;
  ta.placeholder = 'Pegá filas de la planilla o lista de WhatsApp…';
  const parseBtn = document.createElement('button');
  parseBtn.type = 'button';
  parseBtn.className = 'secondary-button';
  parseBtn.textContent = 'Probar parseo (sin guardar)';
  const parseOut = document.createElement('pre');
  parseOut.className = 'opcal-parse-out muted';
  parseBtn.addEventListener('click', () => {
    const r = parsePlanningBlock(ta.value);
    parseOut.textContent = JSON.stringify(r, null, 2);
  });
  parseCard.append(ta, parseBtn, parseOut);

  card.append(weekBar, gridHost, reportHost, formCard, parseCard);

  renderWeek();

  return card;
}

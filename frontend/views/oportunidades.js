import { buildMailtoUrl } from '../domain/jarvis-commercial-brain.js';
import { commercialOpportunitiesService } from '../services/commercial-opportunities.service.js';

const PRIORIDAD_CLASS = { alta: 'opp-prio--alta', media: 'opp-prio--media', baja: 'opp-prio--baja' };

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0, minimumFractionDigits: 0 });

export const oportunidadesView = ({
  data,
  reloadApp,
  navigateToView,
  actions,
  commercialIntelContext,
} = {}) => {
  const section = document.createElement('section');
  section.className = 'opp-module';

  const raw = Array.isArray(data?.commercialOpportunities) ? data.commercialOpportunities : [];
  let filterCliente = '';
  let filterPrioridad = 'todos';
  let filterEstado = 'todos';

  const ctx = commercialIntelContext;
  if (ctx?.mode === 'list' && ctx.filterCliente) {
    filterCliente = String(ctx.filterCliente).trim();
  }

  const focusOppId =
    ctx?.mode === 'focus' && ctx.opportunityId ? String(ctx.opportunityId).trim() : null;

  const clientes = [...new Set(raw.map((o) => String(o.cliente || '').trim()).filter(Boolean))].sort();

  const feedback = document.createElement('div');
  feedback.className = 'form-feedback';
  feedback.hidden = true;

  const showFb = (type, msg) => {
    if (!msg) {
      feedback.hidden = true;
      return;
    }
    feedback.className = `form-feedback form-feedback--${type}`;
    feedback.textContent = msg;
    feedback.hidden = false;
  };

  const runReload = async () => {
    if (typeof reloadApp === 'function') return await reloadApp();
    return false;
  };

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML =
    '<h2>Oportunidades comerciales</h2><p class="muted">Propuestas concretas desde operación (Jarvis) y reglas de documentos. Gestioná estados y cierre.</p>';

  const draftSlot = document.createElement('div');
  draftSlot.className = 'opp-jarvis-draft-slot';

  if (ctx?.mode === 'draft') {
    const card = document.createElement('div');
    card.className = 'opp-jarvis-draft tarjeta';
    const h = document.createElement('h3');
    h.className = 'opp-jarvis-draft__title';
    h.textContent = 'Propuesta lista (Jarvis)';
    const sub = document.createElement('p');
    sub.className = 'opp-jarvis-draft__sub muted small';
    sub.textContent = `${ctx.cliente || '—'} · ${ctx.servicioLabel || ctx.servicioTipo || '—'} · ref. $${formatMoney(ctx.valorEstimado)} + IVA`;

    const det = document.createElement('details');
    det.className = 'opp-jarvis-draft__details';
    const sum = document.createElement('summary');
    sum.className = 'opp-jarvis-draft__sum';
    sum.textContent = 'Ver texto del correo';
    const ta = document.createElement('textarea');
    ta.className = 'opp-jarvis-draft__body';
    ta.readOnly = true;
    ta.rows = 5;
    ta.value = ctx.cuerpoCorreo || '';
    det.append(sum, ta);

    const emailRow = document.createElement('div');
    emailRow.className = 'opp-jarvis-draft__email';
    const lab = document.createElement('label');
    lab.className = 'opp-jarvis-draft__lab';
    lab.textContent = 'Correo (opcional)';
    const emailIn = document.createElement('input');
    emailIn.type = 'email';
    emailIn.className = 'opp-jarvis-draft__in';
    emailIn.placeholder = 'Chip o vacío = abrir mail con asunto/cuerpo';
    emailIn.value = ctx.clienteEmail || '';
    lab.setAttribute('for', 'opp-jarvis-draft-email');
    emailIn.id = 'opp-jarvis-draft-email';
    emailRow.append(lab, emailIn);

    const row = document.createElement('div');
    row.className = 'opp-jarvis-draft__actions';
    const mk = (cls, text, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = text;
      b.addEventListener('click', fn);
      return b;
    };
    row.append(
      mk('secondary-button', 'Copiar', async () => {
        try {
          await navigator.clipboard.writeText(ctx.cuerpoCorreo || '');
          showFb('success', 'Copiado.');
        } catch {
          showFb('error', 'No se pudo copiar.');
        }
      }),
      mk('secondary-button', 'Mail sin destinatario', () => {
        window.location.href = buildMailtoUrl('', ctx.asunto || '', ctx.cuerpoCorreo || '');
      }),
      mk('secondary-button', 'Enviar', () => {
        window.location.href = buildMailtoUrl(emailIn.value.trim(), ctx.asunto || '', ctx.cuerpoCorreo || '');
      }),
      mk('primary-button', 'Listo · cerrar', () => actions?.dismissCommercialIntel?.())
    );

    card.append(h, sub, det, emailRow, row);
    draftSlot.append(card);
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'opp-toolbar';

  const selCli = document.createElement('select');
  selCli.className = 'opp-filter';
  selCli.append(new Option('Todos los clientes', ''));
  clientes.forEach((c) => selCli.append(new Option(c, c)));
  if (filterCliente && clientes.includes(filterCliente)) selCli.value = filterCliente;

  const selPri = document.createElement('select');
  selPri.className = 'opp-filter';
  ['todos', 'alta', 'media', 'baja'].forEach((p) => selPri.append(new Option(p === 'todos' ? 'Todas prioridades' : p, p)));

  const selEst = document.createElement('select');
  selEst.className = 'opp-filter';
  ['todos', 'pendiente', 'cotizado', 'ganado', 'perdido'].forEach((e) =>
    selEst.append(new Option(e === 'todos' ? 'Todos estados' : e, e))
  );

  const btnRel = document.createElement('button');
  btnRel.type = 'button';
  btnRel.className = 'secondary-button';
  btnRel.textContent = 'Actualizar';
  btnRel.addEventListener('click', async () => {
    showFb('neutral', 'Actualizando…');
    const ok = await runReload();
    showFb(ok ? 'success' : 'error', ok ? 'Listo.' : 'Error de conexión.');
  });

  const onFilter = () => {
    filterCliente = selCli.value;
    filterPrioridad = selPri.value;
    filterEstado = selEst.value;
    renderTable();
  };
  selCli.addEventListener('change', onFilter);
  selPri.addEventListener('change', onFilter);
  selEst.addEventListener('change', onFilter);

  toolbar.append(selCli, selPri, selEst, btnRel);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'opp-table-wrap';

  const renderTable = () => {
    tableWrap.replaceChildren();
    let rows = [...raw];
    if (filterCliente) rows = rows.filter((o) => String(o.cliente || '').trim() === filterCliente);
    if (filterPrioridad !== 'todos') rows = rows.filter((o) => String(o.prioridad) === filterPrioridad);
    if (filterEstado !== 'todos') rows = rows.filter((o) => String(o.estado) === filterEstado);
    rows.sort((a, b) => String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || '')));

    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No hay oportunidades con estos filtros.';
      tableWrap.append(p);
      return;
    }

    const table = document.createElement('table');
    table.className = 'opp-table';
    table.innerHTML = `<thead><tr>
      <th>ID</th><th>Cliente</th><th>Tipo</th><th>Prioridad</th><th>Monto est.</th><th>Estado</th><th>Documento</th><th>Acción</th>
    </tr></thead>`;
    const tb = document.createElement('tbody');

    rows.forEach((o) => {
      const tr = document.createElement('tr');
      const priClass = PRIORIDAD_CLASS[String(o.prioridad)] || '';
      tr.title = String(o.descripcion || '').slice(0, 500);
      tr.dataset.oppId = String(o.id || '');
      if (focusOppId && String(o.id) === focusOppId) tr.classList.add('opp-row--focus');
      tr.innerHTML = `
        <td><strong>${escapeHtml(o.id)}</strong></td>
        <td>${escapeHtml(o.cliente || '—')}</td>
        <td>${escapeHtml(o.tipoServicio || '—')}</td>
        <td><span class="opp-prio ${priClass}">${escapeHtml(o.prioridad || '—')}</span></td>
        <td>$ ${formatMoney(o.estimacionMonto)}</td>
        <td><span class="opp-estado opp-estado--${escapeHtml(o.estado || '')}">${escapeHtml(o.estado || '—')}</span></td>
        <td>${escapeHtml(o.technicalDocumentId || '—')}</td>
        <td class="opp-actions"></td>`;
      const short = String(o.descripcion || '').slice(0, 72);
      const tdTipo = tr.children[2];
      tdTipo.innerHTML = `${escapeHtml(o.tipoServicio || '—')}<br><span class="muted opp-inline-desc">${escapeHtml(short)}${(o.descripcion || '').length > 72 ? '…' : ''}</span>`;

      const tdAct = tr.querySelector('.opp-actions');
      const sel = document.createElement('select');
      sel.className = 'opp-status-sel';
      ['pendiente', 'cotizado', 'ganado', 'perdido'].forEach((st) => sel.append(new Option(st, st)));
      sel.value = o.estado || 'pendiente';
      sel.addEventListener('change', async () => {
        try {
          await commercialOpportunitiesService.patchStatus(o.id, { estado: sel.value });
          showFb('success', `Estado ${o.id} actualizado.`);
          o.estado = sel.value;
          await runReload();
        } catch (e) {
          showFb('error', e.message || 'Error');
          sel.value = o.estado;
        }
      });
      tdAct.append(sel);

      tb.append(tr);
    });

    table.append(tb);
    tableWrap.append(table);

    if (focusOppId) {
      requestAnimationFrame(() => {
        const hits = tableWrap.querySelectorAll('tbody tr[data-opp-id]');
        for (const hit of hits) {
          if (hit.dataset.oppId === focusOppId) {
            hit.scrollIntoView({ behavior: 'smooth', block: 'center' });
            hit.classList.add('opp-row--flash');
            setTimeout(() => hit.classList.remove('opp-row--flash'), 2400);
            break;
          }
        }
      });
    }
  };

  const back = document.createElement('div');
  back.className = 'opp-back';
  const bDash = document.createElement('button');
  bDash.type = 'button';
  bDash.className = 'secondary-button';
  bDash.textContent = '← Jarvis';
  bDash.addEventListener('click', () => typeof navigateToView === 'function' && navigateToView('jarvis'));
  back.append(bDash);

  section.append(header, draftSlot, feedback, back, toolbar, tableWrap);
  renderTable();

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return section;
};

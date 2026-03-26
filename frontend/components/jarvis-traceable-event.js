/**
 * Fila de evento Infinity con identidad de contacto, trazabilidad y acciones directas.
 */
import { saveContact } from '../domain/jarvis-contact-memory.js';
import { enrichOperationalEvent, timeAgoShort, waMeUrl } from '../domain/jarvis-event-traceability.js';
import { rememberJarvisAction } from '../domain/jarvis-memory.js';
import {
  appendMemoriaOperativa,
  iconForOrigenTipo,
} from '../domain/jarvis-multi-source-intelligence.js';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openAssignModal({ phone, email, onDone }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'jarvis-trace-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Asignar contacto');

  const box = document.createElement('div');
  box.className = 'jarvis-trace-modal';

  const needPhone = !String(phone || '').trim() && !String(email || '').trim();

  const form = document.createElement('form');
  form.className = 'jarvis-trace-modal__form';
  form.innerHTML = `
    <h3 class="jarvis-trace-modal__title">Asignar contacto</h3>
    ${needPhone ? `<label class="jarvis-trace-modal__field"><span>Teléfono (WhatsApp)</span><input type="tel" name="phone" class="jarvis-trace-modal__input" placeholder="+56912345678" /></label>` : ''}
    <label class="jarvis-trace-modal__field"><span>Nombre</span><input type="text" name="name" class="jarvis-trace-modal__input" required /></label>
    <label class="jarvis-trace-modal__field"><span>Empresa</span><input type="text" name="company" class="jarvis-trace-modal__input" /></label>
    <label class="jarvis-trace-modal__field"><span>Nota / contexto</span><textarea name="note" class="jarvis-trace-modal__textarea" rows="2"></textarea></label>
    <div class="jarvis-trace-modal__actions">
      <button type="button" class="secondary-button jarvis-trace-modal__cancel">Cancelar</button>
      <button type="submit" class="primary-button jarvis-trace-modal__save">Guardar</button>
    </div>
  `;
  box.append(form);
  backdrop.append(box);
  document.body.append(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close();
  });
  form.querySelector('.jarvis-trace-modal__cancel')?.addEventListener('click', close);

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const p = needPhone ? String(fd.get('phone') || '').trim() : String(phone || '').trim();
    const em = String(email || '').trim();
    const name = String(fd.get('name') || '').trim();
    const company = String(fd.get('company') || '').trim();
    const note = String(fd.get('note') || '').trim();
    if (!name) return;
    if (needPhone && !p && !em) return;
    saveContact({ phone: p, email: em, name, company, note });
    close();
    if (typeof onDone === 'function') onDone();
  });

  requestAnimationFrame(() => form.querySelector('input[name="name"]')?.focus());
}

function renderContactBlock(ext, onAssign) {
  const wrap = document.createElement('div');
  wrap.className = 'jarvis-trace-ev__contact';
  const h = document.createElement('div');
  h.className = 'jarvis-trace-ev__contact-title';
  h.textContent = '📍 Contacto';
  const ul = document.createElement('ul');
  ul.className = 'jarvis-trace-ev__contact-ul';

  const hasName = ext.contact_name && String(ext.contact_name).trim() && ext.contact_name !== '—';
  if (hasName) {
    const liN = document.createElement('li');
    liN.textContent = ext.contact_name;
    ul.append(liN);
  }
  if (ext.contact_company) {
    const liC = document.createElement('li');
    liC.textContent = ext.contact_company;
    ul.append(liC);
  }
  if (ext.contact_note) {
    const liNo = document.createElement('li');
    liNo.className = 'muted small';
    liNo.textContent = ext.contact_note;
    ul.append(liNo);
  }
  const line = ext.contact_phone || ext.contact_email || '';
  if (line) {
    const liL = document.createElement('li');
    liL.className = 'jarvis-trace-ev__contact-line';
    liL.textContent = line;
    ul.append(liL);
  }

  if (!ul.children.length && !line) {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = 'Sin teléfono ni correo en el texto del evento';
    ul.append(li);
  }

  wrap.append(h, ul);

  if (!hasName) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button jarvis-trace-ev__assign';
    b.textContent = 'Asignar contacto';
    b.addEventListener('click', () =>
      openAssignModal({
        phone: ext.contact_phone || '',
        email: ext.contact_email || '',
        onDone: onAssign,
      })
    );
    wrap.append(b);
  }

  return wrap;
}

function mkAct(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'secondary-button jarvis-trace-ev__ch-act';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function logMem(origen, accion, resultado, onRefresh) {
  appendMemoriaOperativa({ origen, accion_tomada: accion, resultado });
  rememberJarvisAction(accion, 'tomada', 'msi_memoria');
  if (typeof onRefresh === 'function') onRefresh();
}

function renderMsiOriginStrip(ext, compact) {
  const wrap = document.createElement('div');
  wrap.className = 'jarvis-msi-origen';
  const ot = ext.origen_tipo || 'sistema';
  const { emoji, label } = iconForOrigenTipo(ot);
  const row = document.createElement('div');
  row.className = 'jarvis-msi-origen__row';
  const bubble = document.createElement('span');
  bubble.className = `jarvis-msi-origen__ico jarvis-msi-origen__ico--${ot}`;
  bubble.setAttribute('aria-hidden', 'true');
  bubble.textContent = emoji;
  const meta = document.createElement('div');
  meta.className = 'jarvis-msi-origen__meta';
  const l1 = document.createElement('div');
  l1.className = 'jarvis-msi-origen__line jarvis-msi-origen__line--strong';
  l1.textContent = `${label} · ${ext.origen_nombre || '—'}`;
  const l2 = document.createElement('div');
  l2.className = 'jarvis-msi-origen__line muted small';
  l2.textContent = compact
    ? `${ext.origen_contacto || '—'}`
    : `Contacto origen: ${ext.origen_contacto || '—'} · Alias: ${ext.origen_alias || '—'}`;
  meta.append(l1, l2);
  row.append(bubble, meta);
  wrap.append(row);
  return wrap;
}

function renderEstadoChip(ext) {
  const st = ext.estado_tarjeta || 'OK';
  const el = document.createElement('div');
  el.className = `jarvis-msi-estado jarvis-msi-estado--${String(st).toLowerCase()}`;
  el.textContent = st === 'CRITICO' ? 'CRÍTICO' : st === 'ALERTA' ? 'ALERTA' : 'OK';
  el.setAttribute('aria-label', `Estado ${st}`);
  return el;
}

function renderTrazabilidadOperativa(ext, compact) {
  const intr = ext.interpretacion_struct;
  if (!intr || compact) return null;
  const box = document.createElement('div');
  box.className = 'jarvis-msi-traz';
  const h = document.createElement('div');
  h.className = 'jarvis-msi-traz__title';
  h.textContent = 'TRAZABILIDAD OPERATIVA';
  const ul = document.createElement('ul');
  ul.className = 'jarvis-msi-traz__ul';
  const rows = [
    ['Técnico / persona', intr.tecnico],
    ['Cliente', intr.cliente],
    ['Ubicación', intr.ubicacion],
    ['Tipo evento', intr.tipo_evento],
    ['Hora (texto)', intr.horaTexto],
    ['Ejecución', ext.ejecucion_rol || '—'],
  ];
  for (const [k, v] of rows) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="jarvis-msi-traz__k">${esc(k)}</span> <span class="jarvis-msi-traz__v">${esc(v)}</span>`;
    ul.append(li);
  }
  if (intr.alerta) {
    const al = document.createElement('p');
    al.className = 'jarvis-msi-traz__alerta';
    al.textContent = `ALERTA · Faltan: ${intr.faltantes.join(', ') || 'datos'}`;
    box.append(h, ul, al);
  } else {
    box.append(h, ul);
  }
  return box;
}

function renderImpactoDinero(ext, compact) {
  if (compact) return null;
  const box = document.createElement('div');
  box.className = 'jarvis-msi-money';
  box.innerHTML = `<div class="jarvis-msi-money__title">IMPACTO</div>
    <div class="jarvis-msi-money__grid">
      <div class="jarvis-msi-money__cell"><span class="jarvis-msi-money__k">💰 Detenido</span><span class="jarvis-msi-money__v">$${Number(ext.money_detenido || 0).toLocaleString('es-CL')}</span></div>
      <div class="jarvis-msi-money__cell"><span class="jarvis-msi-money__k">⚠️ Riesgo</span><span class="jarvis-msi-money__v jarvis-msi-money__v--wrap">${esc(ext.money_riesgo_label || '—')}</span></div>
      <div class="jarvis-msi-money__cell"><span class="jarvis-msi-money__k">📈 Oportunidad</span><span class="jarvis-msi-money__v jarvis-msi-money__v--wrap">${esc(ext.money_oportunidad_label || '—')}</span></div>
    </div>`;
  return box;
}

function renderVerOrigen(ext, navigateToView) {
  const row = document.createElement('div');
  row.className = 'jarvis-msi-ver-origen';
  const go = (v) => {
    if (typeof navigateToView === 'function') navigateToView(v);
  };
  if (ext.origen_tipo === 'whatsapp') {
    row.append(
      mkAct('Abrir conversación (simulado)', () => {
        rememberJarvisAction('Abrir conversación WhatsApp (simulado)', 'sugerida', 'msi_ver_origen');
        go('whatsapp');
      })
    );
  }
  if (ext.origen_tipo === 'correo') {
    row.append(mkAct('Ver correo', () => go('jarvis-intake')));
  }
  if (ext.source_type === 'ot' || /ot/i.test(String(ext.stableKey || ''))) {
    row.append(mkAct('Ir a OT', () => go('clima')));
  }
  if (!row.children.length) {
    row.append(mkAct('Ver comando', () => go('jarvis')));
  }
  return row;
}

function renderExtraOps(ext, ctx) {
  const { navigateToView, onRefresh } = ctx;
  const row = document.createElement('div');
  row.className = 'jarvis-msi-extra-ops';
  const go = (v) => navigateToView?.(v);
  const o = ext.origen_nombre || 'evento';
  row.append(
    mkAct('Crear OT', () => {
      logMem(o, 'Crear OT desde tarjeta', 'Pendiente en Clima', onRefresh);
      go('clima');
    }),
    mkAct('Asociar a OT', () => logMem(o, 'Asociar a OT existente', 'Registrado', onRefresh)),
    mkAct('Marcar ingreso/salida', () => logMem(o, 'Marcar ingreso/salida', 'Registrado', onRefresh)),
    mkAct('Solicitar evidencia', () => {
      logMem(o, 'Solicitar evidencia', 'Solicitado', onRefresh);
      go('clima');
    }),
    mkAct('Aprobar', () => logMem(o, 'Aprobar paso', 'Aprobado (local)', onRefresh)),
    mkAct('Escalar', () => {
      logMem(o, 'Escalar a Hernan', 'Escalado', onRefresh);
      rememberJarvisAction('Escalar evento MSI', 'sugerida', 'msi_escalar');
    })
  );
  return row;
}

function renderOrigenOperativo(ext, compact) {
  const sec = document.createElement('div');
  sec.className = 'jarvis-trace-ev__origen';
  const h = document.createElement('div');
  h.className = 'jarvis-trace-ev__origen-title';
  h.textContent = 'ORIGEN OPERATIVO';
  const ul = document.createElement('ul');
  ul.className = 'jarvis-trace-ev__origen-ul';
  const rows = compact
    ? [[`${ext.channel_name || '—'} · ${ext.operational_badge || ext.event_kind || ''}`]]
    : [
        ['Canal', ext.channel_name || '—'],
        ['Cliente', ext.channel_client || ext.contact_company || '—'],
        ['Función', ext.channel_function || '—'],
        ['Contacto o técnico', ext.contact_name || '—'],
        ['Tipo de evento', ext.operational_badge || ext.event_kind || '—'],
      ];
  for (const r of rows) {
    const li = document.createElement('li');
    if (compact) {
      li.textContent = r[0];
    } else {
      li.innerHTML = `<span class="jarvis-trace-ev__origen-k">${esc(r[0])}</span> <span class="jarvis-trace-ev__origen-v">${esc(r[1])}</span>`;
    }
    ul.append(li);
  }
  sec.append(h, ul);
  return sec;
}

function renderChannelActions(ext, ctx) {
  const { navigateToView, onRefresh } = ctx;
  const row = document.createElement('div');
  row.className = 'jarvis-trace-ev__ch-actions';
  const go = (v) => {
    if (typeof navigateToView === 'function') navigateToView(v);
  };
  const mem = (msg) => {
    rememberJarvisAction(msg, 'tomada', 'channel_action');
    appendMemoriaOperativa({
      origen: ext.origen_nombre || 'canal',
      accion_tomada: msg,
      resultado: 'registrado',
    });
    if (typeof onRefresh === 'function') onRefresh();
  };

  const cid = String(ext.channel_id || '');

  if (cid === 'wa_reportes_clima') {
    row.append(
      mkAct('Ver trazabilidad', () =>
        document.getElementById('hnf-terreno-trace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      ),
      mkAct('Ver tienda / OT', () => go('clima')),
      mkAct('Registrar ingreso/salida', () =>
        mem('Registrar marca ingreso/salida terreno — completar en sistema')
      )
    );
  } else if (cid === 'wa_central_ops') {
    row.append(
      mkAct('Ver informe', () => go('technical-documents')),
      mkAct('Marcar aprobado', () => mem('Marcar informe aprobado (Central Operaciones)')),
      mkAct('Pendiente revisión', () => mem('Informe pendiente de revisión — asignar revisión')),
      mkAct('Preparar envío a cliente', () => mem('Preparar envío de informe a cliente'))
    );
  } else if (cid === 'wa_granleasing' || cid === 'wa_west' || cid === 'mail_granleasing') {
    row.append(
      mkAct('Abrir canal', () => (cid === 'mail_granleasing' ? go('jarvis-intake') : go('whatsapp'))),
      mkAct('Registrar solicitud', () => mem('Registrar solicitud cliente en pipeline')),
      mkAct('Asignar a Gery', () => mem('Asignar seguimiento a Gery')),
      mkAct('Crear seguimiento', () => go('oportunidades'))
    );
  } else if (cid === 'doc_tecnico_hnf') {
    row.append(
      mkAct('Documentos técnicos', () => go('technical-documents')),
      mkAct('Escalar a Lyn', () => mem('Escalar revisión documental a Lyn'))
    );
  } else {
    row.append(
      mkAct('Abrir comando', () => go('jarvis')),
      mkAct('Registrar acción', () => mem(`Acción operativa: ${ext.descripcion || 'evento'}`))
    );
  }

  return row;
}

function renderActions(ext, navigateToView) {
  const row = document.createElement('div');
  row.className = 'jarvis-trace-ev__direct';

  const go = (view) => {
    if (typeof navigateToView === 'function') navigateToView(view);
  };

  if (ext.source_type === 'ot') {
    row.append(
      mkAct('Abrir OT', () => go('clima'))
    );
  }
  if (ext.source_type === 'correo') {
    row.append(mkAct('Abrir correo', () => go('jarvis-intake')));
  }
  if (ext.source_type === 'whatsapp') {
    row.append(
      mkAct('Abrir WhatsApp', () => {
        const u = waMeUrl(ext.contact_phone);
        if (u) window.open(u, '_blank', 'noopener,noreferrer');
        else go('whatsapp');
      })
    );
  }

  return row;
}

/**
 * @param {object} e — evento Infinity (activo o histórico)
 * @param {object} ctx
 */
export function buildTraceableInfinityEventRow(e, ctx) {
  const {
    tiempoLabel,
    onRefresh,
    navigateToView,
    markResolved,
    compact = false,
    stale = false,
    friction = null,
    infinity = null,
  } = ctx;
  const ext = enrichOperationalEvent(e, {
    friction,
    controlVivo: infinity?.controlVivo,
  });
  const pri = String(e.prioridad || 'NORMAL').toLowerCase();

  const li = document.createElement('li');
  li.className = `jarvis-trace-ev jarvis-op-eventos__item jarvis-op-eventos__item--${pri} jarvis-msi-card${compact ? ' jarvis-msi-card--compact' : ''}`;

  li.append(renderMsiOriginStrip(ext, compact));
  li.append(renderEstadoChip(ext));

  const line1 = document.createElement('div');
  line1.className = 'jarvis-trace-ev__line1';
  const prob = esc(e.descripcion || '—');
  const typeShown = ext.display_source_label || ext.source_label || '—';
  line1.innerHTML = `<span class="jarvis-trace-ev__type">${esc(typeShown)} — ${prob}</span>`;

  const meta = document.createElement('div');
  meta.className = 'jarvis-trace-ev__meta';
  const ta = timeAgoShort(ext.timestamp);
  meta.textContent = `⏱ ${tiempoLabel && tiempoLabel !== '—' ? `${tiempoLabel} · ${ta}` : ta} · 👤 ${ext.responsible || '—'}`;

  li.append(line1, meta);

  if (ext.operational_badge && ext.operational_badge !== 'Evento operativo') {
    const bd = document.createElement('div');
    bd.className = 'jarvis-trace-ev__badge';
    bd.textContent = ext.operational_badge;
    li.append(bd);
  }

  if (ext.channel_name || ext.channel_id) {
    li.append(renderOrigenOperativo(ext, compact));
  }

  if (!compact) {
    const imp = document.createElement('p');
    imp.className = 'jarvis-op-eventos__impacto';
    imp.innerHTML = `<strong>Impacto:</strong> ${esc(e.impacto || '—')}`;
    const resp = document.createElement('p');
    resp.className = 'jarvis-op-eventos__accion';
    resp.innerHTML = `<strong>Siguiente paso:</strong> ${esc(e.accion || '—')}`;
    li.append(imp, resp);
  }

  const ownerRow = document.createElement('div');
  ownerRow.className = 'jarvis-op-eventos__owner';
  if (!String(e.assignee || '').trim()) {
    ownerRow.classList.add('jarvis-op-eventos__owner--error');
    ownerRow.innerHTML =
      '<strong>ERROR SISTEMA — SIN RESPONSABLE</strong> <span class="muted small">Asignación obligatoria.</span>';
  } else if (!compact) {
    ownerRow.innerHTML = `<strong>Responsable:</strong> ${esc(e.assignee)}`;
  }
  if (!compact) li.append(ownerRow);

  if (stale && !compact) {
    const st = document.createElement('p');
    st.className = 'jarvis-op-eventos__stale';
    st.textContent = 'SIN MOVIMIENTO — REQUIERE ACCIÓN (prioridad elevada automáticamente).';
    li.append(st);
  }

  li.append(
    renderContactBlock(ext, () => {
      if (typeof onRefresh === 'function') onRefresh();
    })
  );
  li.append(renderChannelActions(ext, { navigateToView, onRefresh }));
  li.append(renderActions(ext, navigateToView));
  if (!compact) li.append(renderExtraOps(ext, { navigateToView, onRefresh }));

  if (markResolved && !compact) {
    const tool = document.createElement('div');
    tool.className = 'jarvis-op-eventos__tools';
    const bRes = document.createElement('button');
    bRes.type = 'button';
    bRes.className = 'secondary-button jarvis-op-eventos__resolve';
    bRes.textContent = 'Marcar resuelto (condición cerrada)';
    bRes.addEventListener('click', () => {
      markResolved(e.stableKey);
      if (typeof onRefresh === 'function') onRefresh();
    });
    tool.append(bRes);
    li.append(tool);
  }

  return li;
}

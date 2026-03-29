import { buildJarvisDailyBrief, getJarvisUnifiedState } from '../domain/jarvis-core.js';
import {
  buildOutlookFollowUpSignals,
  classifyOutlookMessage,
  detectInternalPending,
} from '../domain/outlook-intelligence.js';
import {
  getOutlookFollowUpMemorySummary,
  rememberOutlookIntakeEvent,
} from '../domain/jarvis-memory.js';
import { outlookIntakeService } from '../services/outlook-intake.service.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';

const fmtAt = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
};

const hoursSince = (iso) => {
  const t = new Date(iso || 0).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3600000;
};

const inboxClientLogoClass = (hint) => {
  const h = String(hint || '').toLowerCase();
  if (h.includes('entel')) return 'hnf-inbox-card__logo--entel';
  if (h.includes('walmart')) return 'hnf-inbox-card__logo--walmart';
  if (h.includes('agrosuper')) return 'hnf-inbox-card__logo--agrosuper';
  return 'hnf-inbox-card__logo--generic';
};

const inboxChannelKey = (m) => {
  const t = `${m.subject || ''} ${m.bodyText || ''} ${m.clientHint || ''}`.toLowerCase();
  if (/\bwhatsapp\b|wa\.me/i.test(t)) return 'whatsapp';
  if (/\b(tel[ée]fono|llamada|llamar)\b|\+56\s*9\d/i.test(t)) return 'telefono';
  return 'correo';
};

const inboxLogoLabel = (hint) => {
  const h = String(hint || '').trim();
  if (!h) return 'CL';
  if (/entel/i.test(h)) return 'Entel';
  if (/walmart/i.test(h)) return 'Walmart';
  if (/agrosuper/i.test(h)) return 'Agrosuper';
  return h.slice(0, 3).toUpperCase();
};

const channelUi = (key) => {
  if (key === 'whatsapp') {
    return { cls: 'hnf-inbox-channel--whatsapp', icon: '⌁', label: 'WhatsApp' };
  }
  if (key === 'telefono') {
    return { cls: 'hnf-inbox-channel--telefono', icon: '☎', label: 'Teléfono' };
  }
  return { cls: 'hnf-inbox-channel--correo', icon: '✉', label: 'Correo' };
};

export const jarvisIntakeHubView = ({
  data,
  integrationStatus,
  reloadApp,
  intelNavigate,
  lastDataRefreshAt,
} = {}) => {
  const root = document.createElement('section');
  root.className = 'jarvis-intake hnf-op-view hnf-op-view--bandeja';

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML = `
    <h2>Bandeja · correo e histórico</h2>
    <p class="jarvis-intake__read-only-badge" role="status">Solo lectura · sin envío automático</p>
    <p class="muted">Cola de <strong>revisión y validación</strong> antes de ejecutar: correo e histórico clasificados para el equipo. Sin respuestas automáticas ni envío desde esta pantalla. Las señales priorizan trabajo de Hernán y Lyn.</p>
  `;
  const flowStrip = createHnfOperationalFlowStrip(1);
  root.append(header, flowStrip);

  const toolbar = document.createElement('div');
  toolbar.className = 'module-toolbar';
  const ref = document.createElement('button');
  ref.type = 'button';
  ref.className = 'secondary-button';
  ref.textContent = 'Actualizar feed';
  ref.addEventListener('click', () => reloadApp?.());
  const bJarvis = document.createElement('button');
  bJarvis.type = 'button';
  bJarvis.className = 'secondary-button';
  bJarvis.textContent = 'Jarvis HQ';
  bJarvis.addEventListener('click', () => intelNavigate?.({ view: 'jarvis' }));
  toolbar.append(ref, bJarvis);
  root.append(toolbar);

  if (integrationStatus === 'sin conexión') {
    const off = document.createElement('div');
    off.className = 'integration-banner integration-banner--offline';
    off.textContent =
      'Sin conexión al servidor: no se puede leer ni guardar el estado del feed Outlook simulado.';
    root.append(off);
    return root;
  }

  const feed = data?.outlookFeed || { messages: [], historicalImports: [], lastIngestAt: null };
  const messages = Array.isArray(feed.messages) ? feed.messages : [];
  const imports = Array.isArray(feed.historicalImports) ? feed.historicalImports : [];
  const unified = getJarvisUnifiedState(data || {});
  const ofu = unified.outlookFollowUp || {};
  const delayAlerts = ofu.delayAlerts || [];
  const signals = ofu.signals || [];
  const pending = ofu.pendingByOwner || {};
  const hooks = feed.futureOutlookHooks || {};

  const hero = document.createElement('div');
  hero.className = 'jarvis-intake__hero';
  const nuevos = messages.filter((m) => m.status === 'nuevo').length;
  const venc = delayAlerts.filter((a) => a.severity === 'warning' || a.severity === 'critical').length;
  const perm = delayAlerts.filter((a) => a.code === 'OUT_PERMISO_PROG').length;
  const filesAbs = imports.reduce((n, im) => n + (Array.isArray(im.files) ? im.files.length : 0), 0);
  hero.innerHTML = `
    <div class="jarvis-intake__hero-grid">
      <div class="jarvis-intake__stat"><span class="jarvis-intake__stat-v">${nuevos}</span><span class="muted">Correos nuevos</span></div>
      <div class="jarvis-intake__stat"><span class="jarvis-intake__stat-v">${venc}</span><span class="muted">Alertas demora / críticas</span></div>
      <div class="jarvis-intake__stat"><span class="jarvis-intake__stat-v">${perm}</span><span class="muted">Permisos detenidos (señal)</span></div>
      <div class="jarvis-intake__stat"><span class="jarvis-intake__stat-v">${filesAbs}</span><span class="muted">Archivos en históricos</span></div>
      <div class="jarvis-intake__stat jarvis-intake__stat--wide"><span class="muted">Última ingesta</span><strong>${fmtAt(feed.lastIngestAt)}</strong><span class="muted small">Datos: ${fmtAt(lastDataRefreshAt)}</span></div>
    </div>
    <p class="muted small">Hooks futuros (desactivados): inboxSync=${hooks.inboxSync}, replyDraft=${hooks.replyDraft}, threadSync=${hooks.threadSync}</p>
  `;
  root.append(hero);

  const hooksNote = document.createElement('p');
  hooksNote.className = 'jarvis-intake__note';
  hooksNote.textContent =
    'Modo operativo: LECTURA + clasificación + seguimiento interno. Sin respuesta automática al cliente.';
  root.append(hooksNote);

  const secHL = document.createElement('section');
  secHL.className = 'jarvis-intake__panel';
  secHL.innerHTML = '<h3>Alertas a Hernán y Lyn</h3>';
  const ulHL = document.createElement('ul');
  ulHL.className = 'jarvis-intake__alert-list';
  const hl = delayAlerts.filter((a) => a.reportarAHernan || a.reportarALyn);
  if (!hl.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin alertas con bandera directiva en este corte.';
    ulHL.append(li);
  } else {
    hl.slice(0, 20).forEach((a) => {
      const li = document.createElement('li');
      li.className = `jarvis-intake__alert jarvis-intake__alert--${a.severity || 'info'}`;
      li.innerHTML = `<strong>${a.title}</strong> <span class="muted">(${a.owner || '—'} · ${a.ageHours != null ? `${a.ageHours}h` : '—'})</span><br/><span class="small">${a.detail || ''}</span><br/><span class="small">Hernán: ${a.reportarAHernan ? 'sí' : 'no'} · Lyn: ${a.reportarALyn ? 'sí' : 'no'}</span>`;
      if (a.nav?.view) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'link-button small';
        b.textContent = 'Abrir vista';
        b.addEventListener('click', () => intelNavigate?.(a.nav));
        li.append(b);
      }
      ulHL.append(li);
    });
  }
  secHL.append(ulHL);
  root.append(secHL);

  const secMail = document.createElement('section');
  secMail.className = 'jarvis-intake__panel';
  secMail.innerHTML =
    '<h3>Inbox inteligente · solicitudes</h3><p class="muted small">Vista en tarjetas; canal inferido por texto (WhatsApp / teléfono / correo). Clasificación heurística; editable vía ingesta API.</p>';
  const grid = document.createElement('div');
  grid.className = 'hnf-inbox-live-grid';
  const sorted = [...messages].sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
  sorted.slice(0, 40).forEach((m) => {
    const h = hoursSince(m.lastActivityAt || m.receivedAt);
    const ch = inboxChannelKey(m);
    const cu = channelUi(ch);
    const card = document.createElement('article');
    card.className = 'hnf-inbox-live-card';
    const top = document.createElement('div');
    top.className = 'hnf-inbox-live-card__top';
    const logo = document.createElement('div');
    logo.className = `hnf-inbox-card__logo ${inboxClientLogoClass(m.clientHint)}`;
    logo.textContent = inboxLogoLabel(m.clientHint);
    logo.setAttribute('aria-hidden', 'true');
    const meta = document.createElement('div');
    meta.className = 'hnf-inbox-live-card__meta';
    const subj = document.createElement('p');
    subj.className = 'hnf-inbox-live-card__subject';
    subj.textContent = (m.subject || 'Sin asunto').slice(0, 120);
    const idP = document.createElement('p');
    idP.className = 'hnf-inbox-live-card__id';
    idP.textContent = `ID ${m.id} · ${fmtAt(m.receivedAt)}`;
    meta.append(subj, idP);
    top.append(logo, meta);
    const channels = document.createElement('div');
    channels.className = 'hnf-inbox-channels';
    const chEl = document.createElement('span');
    chEl.className = `hnf-inbox-channel ${cu.cls}`;
    const ico = document.createElement('span');
    ico.className = 'hnf-inbox-channel__ico';
    ico.setAttribute('aria-hidden', 'true');
    ico.textContent = cu.icon;
    chEl.append(ico, document.createTextNode(` ${cu.label}`));
    channels.append(chEl);
    const row = document.createElement('div');
    row.className = 'hnf-inbox-live-card__row';
    const mkSpan = (label, val) => {
      const s = document.createElement('span');
      const b = document.createElement('strong');
      b.textContent = label;
      s.append(b, document.createTextNode(` ${val}`));
      return s;
    };
    row.append(
      mkSpan('Cliente', m.clientHint || '—'),
      mkSpan('Módulo', m.moduleHint || '—'),
      mkSpan('Prioridad', m.priorityHint || '—'),
      mkSpan('Owner', m.internalOwner || '—'),
      mkSpan('Sin gestión', h != null ? `${Math.round(h)} h` : '—'),
      mkSpan('Estado', m.status || '—'),
      mkSpan(
        'H/L',
        `${m.reportarAHernan ? 'H' : ''}${m.reportarALyn ? 'L' : ''}`.trim() || '—'
      )
    );
    card.append(top, channels, row);
    grid.append(card);
  });
  secMail.append(grid);
  const foot = document.createElement('p');
  foot.className = 'muted small';
  foot.textContent = '* Horas sin gestión: aproximado desde última actividad o recepción.';
  secMail.append(foot);
  root.append(secMail);

  const secOwn = document.createElement('section');
  secOwn.className = 'jarvis-intake__panel';
  secOwn.innerHTML = `<h3>Seguimiento interno</h3>
    <ul class="jarvis-intake__metrics">
      <li>Romina: <strong>${pending.Romina?.length ?? 0}</strong> abierto(s)</li>
      <li>Gery: <strong>${pending.Gery?.length ?? 0}</strong> abierto(s)</li>
      <li>Lyn: <strong>${pending.Lyn?.length ?? 0}</strong> abierto(s)</li>
      <li>Sin dueño: <strong>${pending.sin_dueño?.length ?? 0}</strong></li>
    </ul>`;
  const sigUl = document.createElement('ul');
  sigUl.className = 'jarvis-intake__signals';
  buildOutlookFollowUpSignals(feed, { technicalDocuments: data?.technicalDocuments }).signals.forEach((s) => {
    const li = document.createElement('li');
    li.textContent = s;
    sigUl.append(li);
  });
  secOwn.append(sigUl);
  root.append(secOwn);

  const secHist = document.createElement('section');
  secHist.className = 'jarvis-intake__panel';
  secHist.innerHTML = '<h3>Ingesta histórica (carpeta / lote)</h3><p class="muted small">Pegá JSON con <code>folderName</code>, <code>monthHint</code> y <code>files[]</code> (name, type, contentText o extractedText). Sin OCR: usá texto ya extraído.</p>';
  const ta = document.createElement('textarea');
  ta.className = 'jarvis-intake__textarea';
  ta.rows = 8;
  ta.placeholder = `Ejemplo:\n{\n  "folderName": "Febrero_2026",\n  "monthHint": "febrero",\n  "files": [\n    { "name": "correo_export.txt", "type": "text/plain", "contentText": "Asunto: ... From: ..." },\n    { "name": "planilla.csv", "type": "text/csv", "extractedText": "fecha,tienda,..." }\n  ]\n}`;
  const btnHist = document.createElement('button');
  btnHist.type = 'button';
  btnHist.className = 'primary-button';
  btnHist.textContent = 'Absorber lote (servidor)';
  const histFb = document.createElement('div');
  histFb.className = 'form-feedback';
  histFb.hidden = true;
  btnHist.addEventListener('click', async () => {
    histFb.hidden = true;
    try {
      const payload = JSON.parse(ta.value || '{}');
      const out = await outlookIntakeService.ingestFolder(payload);
      const imp = out?.import;
      histFb.className = 'form-feedback form-feedback--success';
      histFb.textContent = imp?.summary
        ? `OK · ${JSON.stringify(imp.summary)}`
        : JSON.stringify(out);
      histFb.hidden = false;
      rememberOutlookIntakeEvent({
        tipo: 'historico_carpeta',
        detalle: imp?.folderName,
        sourceId: imp?.id,
      });
      await reloadApp?.();
    } catch (e) {
      histFb.className = 'form-feedback form-feedback--error';
      histFb.textContent = e.message || 'Error al procesar JSON o servidor.';
      histFb.hidden = false;
    }
  });
  secHist.append(ta, btnHist, histFb);

  const impLast = imports[imports.length - 1];
  if (impLast?.summary) {
    const pre = document.createElement('pre');
    pre.className = 'jarvis-intake__pre';
    pre.textContent = `Último resumen importado:\n${JSON.stringify(impLast.summary, null, 2)}`;
    secHist.append(pre);
  }
  root.append(secHist);

  const secCore2 = document.createElement('section');
  secCore2.className = 'jarvis-intake__panel';
  const br = buildJarvisDailyBrief(unified);
  const ol = br.outlook || {};
  const sigHtml = (signals || []).slice(0, 6).map((s) => `<li>${s}</li>`).join('');
  secCore2.innerHTML = `<h3>Alimentación de Jarvis Core</h3>
    <p class="muted">El estado unificado incorpora <code>outlookFeed</code>, <code>outlookFollowUp</code> (señales, alertas de demora, pendientes por owner) y el daily brief ya resume correo crítico e históricos.</p>
    <p class="muted small">Corte brief: ${ol.correosNuevos ?? 0} correo(s) nuevo(s), ${ol.alertasDemora ?? 0} alerta(s) demora, ${ol.historicosCargados ?? 0} lote(s) histórico(s) en feed, ${ol.absorbidosHoy ?? 0} ingesta(s) con fecha hoy.</p>
    <ul class="jarvis-intake__signals">${sigHtml}</ul>`;
  root.append(secCore2);

  const secRisk = document.createElement('section');
  secRisk.className = 'jarvis-intake__panel';
  secRisk.innerHTML = '<h3>Riesgos detectados (correo + contexto)</h3>';
  const rUl = document.createElement('ul');
  rUl.className = 'jarvis-intake__signals';
  messages.slice(0, 15).forEach((m) => {
    const rel = { technicalDocuments: data?.technicalDocuments };
    const pend = detectInternalPending(m, rel);
    pend.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = `${m.id}: ${p.texto} [${p.severidad}]`;
      rUl.append(li);
    });
  });
  if (!rUl.childElementCount) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin pendientes internos detectados en el subconjunto mostrado.';
    rUl.append(li);
  }
  secRisk.append(rUl);
  root.append(secRisk);

  const secMem = document.createElement('section');
  secMem.className = 'jarvis-intake__panel';
  const mem = getOutlookFollowUpMemorySummary();
  secMem.innerHTML = `<h3>Memoria Outlook (local)</h3><p class="muted small">Eventos: ${mem.totalEventos}</p>`;
  const memUl = document.createElement('ul');
  memUl.className = 'jarvis-intake__mini';
  mem.ultimas.slice(0, 10).forEach((e) => {
    const li = document.createElement('li');
    li.textContent = `${fmtAt(e.at)} · ${e.tipo} · ${e.detalle || e.sourceId || ''}`;
    memUl.append(li);
  });
  secMem.append(memUl);
  root.append(secMem);

  const secBatch = document.createElement('section');
  secBatch.className = 'jarvis-intake__panel';
  secBatch.innerHTML =
    '<h3>Ingesta manual / simulada (mensaje o lote)</h3><p class="muted small">Array JSON de mensajes o un solo objeto. Usa la API del servidor (deduplicación por hash).</p>';
  const taB = document.createElement('textarea');
  taB.className = 'jarvis-intake__textarea';
  taB.rows = 6;
  taB.placeholder = '[{ "subject": "...", "bodyText": "...", "fromEmail": "a@b.com" }]';
  const row = document.createElement('div');
  row.className = 'jarvis-intake__btn-row';
  const b1 = document.createElement('button');
  b1.type = 'button';
  b1.className = 'secondary-button';
  b1.textContent = 'Ingestar lote';
  const b2 = document.createElement('button');
  b2.type = 'button';
  b2.className = 'secondary-button';
  b2.textContent = 'Clasificar solo (local)';
  const fb = document.createElement('div');
  fb.className = 'form-feedback';
  fb.hidden = true;
  b1.addEventListener('click', async () => {
    fb.hidden = true;
    try {
      const parsed = JSON.parse(taB.value || '[]');
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const out = await outlookIntakeService.ingestBatch(arr);
      fb.className = 'form-feedback form-feedback--success';
      fb.textContent = `Procesados: ${out?.count ?? arr.length}. Ver consola para detalle.`;
      fb.hidden = false;
      rememberOutlookIntakeEvent({ tipo: 'ingesta_batch', detalle: `${arr.length} mensajes` });
      console.info('outlook batch', out);
      await reloadApp?.();
    } catch (e) {
      fb.className = 'form-feedback form-feedback--error';
      fb.textContent = e.message || 'Error';
      fb.hidden = false;
    }
  });
  b2.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(taB.value || '{}');
      const one = Array.isArray(parsed) ? parsed[0] : parsed;
      const c = classifyOutlookMessage(one, {});
      fb.className = 'form-feedback form-feedback--success';
      fb.textContent = JSON.stringify(c, null, 2);
      fb.hidden = false;
    } catch (e) {
      fb.className = 'form-feedback form-feedback--error';
      fb.textContent = e.message || 'JSON inválido';
      fb.hidden = false;
    }
  });
  row.append(b1, b2);
  secBatch.append(taB, row, fb);
  root.append(secBatch);

  return root;
};

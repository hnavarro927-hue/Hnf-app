import { formatApiBaseLabel, getAppAccessContext } from '../config/app.config.js';
import { probeBackendHealth } from '../domain/hnf-connectivity.js';

const VITE_DEFAULT_DEV_PORT = '5173';
const POLL_MS = 18000;
const FETCH_TIMEOUT_MS = 5500;

const fmtTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
};

const fmtAtShort = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
};

const healthUrl = () => {
  const base = String(appConfig.apiBaseUrl || '').replace(/\/$/, '');
  return base ? `${base}/health` : '/health';
};

function clearNode(n) {
  while (n.firstChild) n.removeChild(n.firstChild);
}

function appendExecAlert(container, { servicio, impacto, accion }) {
  const box = document.createElement('div');
  box.className = 'hnf-env-continuity__exec';
  const p1 = document.createElement('p');
  p1.className = 'hnf-env-continuity__exec-line';
  const s1 = document.createElement('strong');
  s1.textContent = 'Servicio afectado: ';
  p1.append(s1, document.createTextNode(servicio));
  const p2 = document.createElement('p');
  p2.className = 'hnf-env-continuity__exec-line';
  const s2 = document.createElement('strong');
  s2.textContent = 'Impacto: ';
  p2.append(s2, document.createTextNode(impacto));
  const p3 = document.createElement('p');
  p3.className = 'hnf-env-continuity__exec-line hnf-env-continuity__exec-line--action';
  const s3 = document.createElement('strong');
  s3.textContent = 'Qué hacer: ';
  const act = document.createElement('span');
  act.innerHTML = accion;
  p3.append(s3, document.createTextNode(' '), act);
  box.append(p1, p2, p3);
  container.append(box);
}

/**
 * Panel Entorno técnico + Continuidad del sistema (polling /health, sin dependencias).
 * El intervalo se cancela solo cuando el nodo deja de estar en el DOM.
 */
export function createHnfEnvironmentContinuityPanel({
  lastDataRefreshAt,
  integrationStatus: _integrationStatus,
  compact,
} = {}) {
  /* _integrationStatus: API estable con Jarvis HQ; el panel no usa el prop — solo probeBackendHealth en runCheck. */
  const wrap = document.createElement('section');
  wrap.className = 'hnf-env-continuity hnf-env-continuity--technical-slab tarjeta';
  if (compact) wrap.classList.add('hnf-env-continuity--compact');
  wrap.setAttribute('aria-label', 'Continuidad y entorno técnico');

  const title = document.createElement('h2');
  title.className = 'hnf-env-continuity__title';
  title.textContent = 'CONTINUIDAD DEL SISTEMA';

  const stateRow = document.createElement('div');
  stateRow.className = 'hnf-env-continuity__state';
  const stateBadge = document.createElement('span');
  stateBadge.className = 'hnf-env-continuity__badge';
  const stateMsg = document.createElement('p');
  stateMsg.className = 'hnf-env-continuity__state-msg';

  const alertBox = document.createElement('div');
  alertBox.className = 'hnf-env-continuity__alerts';
  alertBox.hidden = true;

  const subTitle = document.createElement('h3');
  subTitle.className = 'hnf-env-continuity__subtitle';
  subTitle.textContent = 'ENTORNO TÉCNICO';

  const grid = document.createElement('dl');
  grid.className = 'hnf-env-continuity__grid';

  const mkRow = (k, vId) => {
    const dt = document.createElement('dt');
    dt.className = 'hnf-env-continuity__k';
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.className = 'hnf-env-continuity__v';
    dd.id = vId;
    return { dt, dd };
  };

  const rEst = mkRow('Estado general', 'hnf-env-estado');
  const rFe = mkRow('Frontend', 'hnf-env-fe');
  const rBe = mkRow('Backend (API)', 'hnf-env-be');
  const rNet = mkRow('Conectividad local', 'hnf-env-net');
  const rHost = mkRow('IP / host activo', 'hnf-env-host');
  const rOrigin = mkRow('URL actual', 'hnf-env-origin');
  const rVal = mkRow('Última validación técnica', 'hnf-env-val');
  const rSync = mkRow('Última sincronización datos', 'hnf-env-sync');
  const rApi = mkRow('Resolución API (UI)', 'hnf-env-api');

  grid.append(
    rEst.dt,
    rEst.dd,
    rFe.dt,
    rFe.dd,
    rBe.dt,
    rBe.dd,
    rNet.dt,
    rNet.dd,
    rHost.dt,
    rHost.dd,
    rOrigin.dt,
    rOrigin.dd,
    rVal.dt,
    rVal.dd,
    rSync.dt,
    rSync.dd,
    rApi.dt,
    rApi.dd
  );

  if (compact) {
    subTitle.hidden = true;
    for (const n of [rOrigin.dt, rOrigin.dd, rSync.dt, rSync.dd, rApi.dt, rApi.dd]) {
      n.hidden = true;
    }
  }

  const portNote = document.createElement('p');
  portNote.className = 'hnf-env-continuity__portnote muted small';
  portNote.hidden = true;

  const portAction = document.createElement('p');
  portAction.className = 'hnf-env-continuity__port-action';
  portAction.hidden = true;

  const lanHint = document.createElement('div');
  lanHint.className = 'hnf-env-continuity__lan-hint';
  lanHint.hidden = true;

  const hintEl = document.createElement('p');
  hintEl.setAttribute('data-hnf-health-hint', '1');
  hintEl.className = 'muted small hnf-env-continuity__server-hint';
  hintEl.hidden = true;

  const recovery = document.createElement('details');
  recovery.className = 'hnf-env-continuity__recovery';
  const sum = document.createElement('summary');
  sum.className = 'hnf-env-continuity__recovery-sum';
  sum.textContent = 'RECUPERACIÓN RÁPIDA';
  const recBody = document.createElement('div');
  recBody.className = 'hnf-env-continuity__recovery-body';
  recBody.innerHTML = `
    <p class="hnf-env-continuity__recovery-p"><strong>“Sin conexión al servidor”</strong> — Servicio: API. Impacto: sin datos ERP. Acción: en la raíz del repo <code>npm run start:backend</code> o <code>npm run start:all</code> (Windows: <code>start-hnf.cmd</code>). Probar <code>http://127.0.0.1:4000/health</code>.</p>
    <p class="hnf-env-continuity__recovery-p"><strong>No abre en iPad</strong> — Misma Wi‑Fi, URL con IP del notebook (no localhost). Acción: <code>ipconfig</code> → IPv4 → <code>http://&lt;IP&gt;:5173</code>. Si la UI carga y los datos no: revisá <code>frontend/public/env.js</code> → <code>API_BASE_URL</code> al notebook en :4000.</p>
    <p class="hnf-env-continuity__recovery-p"><strong>Cambió la IP</strong> — Acción: actualizar favorito en iPad y, si usás IP fija en <code>env.js</code>, actualizar <code>API_BASE_URL</code>. Firewall: permitir puertos Vite y 4000 en red privada.</p>
    <p class="hnf-env-continuity__recovery-p muted small">Documento completo: <strong>OPERACION-LOCAL.md</strong> en la raíz del repo.</p>
  `;
  recovery.append(sum, recBody);

  const toolbar = document.createElement('div');
  toolbar.className = 'hnf-env-continuity__toolbar';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'secondary-button hnf-env-continuity__btn';
  btn.textContent = 'Revalidar ahora';
  toolbar.append(btn);

  stateRow.append(stateBadge, stateMsg);
  wrap.append(
    title,
    stateRow,
    alertBox,
    subTitle,
    grid,
    portNote,
    portAction,
    lanHint,
    hintEl,
    recovery,
    toolbar
  );

  const el = {
    estado: rEst.dd,
    fe: rFe.dd,
    be: rBe.dd,
    net: rNet.dd,
    host: rHost.dd,
    origin: rOrigin.dd,
    val: rVal.dd,
    sync: rSync.dd,
    api: rApi.dd,
  };

  let lastValidationAt = null;

  const setBadge = (phase) => {
    stateBadge.className = 'hnf-env-continuity__badge';
    if (phase === 'completo') {
      stateBadge.textContent = 'COMPLETO';
      stateBadge.classList.add('hnf-env-continuity__badge--ok');
      el.estado.textContent = 'COMPLETO — listo para operar';
    } else if (phase === 'incompleto') {
      stateBadge.textContent = 'INCOMPLETO';
      stateBadge.classList.add('hnf-env-continuity__badge--warn');
      el.estado.textContent = 'INCOMPLETO — falta servicio o conexión';
    } else if (phase === 'critico') {
      stateBadge.textContent = 'CRÍTICO';
      stateBadge.classList.add('hnf-env-continuity__badge--crit');
      el.estado.textContent = 'CRÍTICO — no se puede validar continuidad';
    } else {
      stateBadge.textContent = '…';
      stateBadge.classList.add('hnf-env-continuity__badge--pending');
      el.estado.textContent = 'Validando…';
    }
  };

  const showBackendDownAlerts = () => {
    clearNode(alertBox);
    appendExecAlert(alertBox, {
      servicio: 'API backend (Node, típico puerto 4000)',
      impacto: 'Jarvis y vistas no consolidan datos del servidor en vivo.',
      accion:
        'En la raíz del repo: <code>npm run start:backend</code> o <code>npm run start:all</code>. En Windows: doble clic en <code>start-hnf.cmd</code>. Verificar <code>http://127.0.0.1:4000/health</code>.',
    });
    alertBox.hidden = false;
  };

  const renderStatic = () => {
    const ctx = getAppAccessContext();
    const loc = typeof globalThis.location !== 'undefined' ? globalThis.location : null;
    const host = loc?.hostname ? String(loc.hostname) : '—';
    const origin = loc?.origin ? String(loc.origin) : '—';
    const port = loc?.port ? String(loc.port) : '';

    el.fe.textContent = 'ACTIVO';
    el.host.textContent = host;
    el.origin.textContent = origin;
    el.sync.textContent = fmtAtShort(lastDataRefreshAt);
    el.api.textContent = formatApiBaseLabel();

    if (port && port !== VITE_DEFAULT_DEV_PORT) {
      portNote.hidden = false;
      portNote.textContent = `Frontend en puerto distinto al típico de Vite (${VITE_DEFAULT_DEV_PORT}). URL detectada: ${origin}`;
      portAction.hidden = false;
      portAction.innerHTML = `<strong>Acción:</strong> actualizar acceso en iPad / favoritos con esta URL exacta. Si compartís el enlace, usá el mismo puerto que muestra el navegador.`;
    } else {
      portNote.hidden = true;
      portAction.hidden = true;
    }

    if (ctx.isLanHost) {
      lanHint.hidden = false;
      clearNode(lanHint);
      const p = document.createElement('p');
      p.className = 'hnf-env-continuity__lan-hint-text';
      p.innerHTML = `<strong>IP / iPad:</strong> estás en LAN (<code>${host}</code>). En el iPad usá la misma URL que ves arriba. <strong>Si cambió la IP del notebook:</strong> acción — revisar URL en iPad y, si aplica, <code>frontend/public/env.js</code> → <code>API_BASE_URL</code> con la IP actual y puerto <code>4000</code>.`;
      lanHint.append(p);
    } else {
      lanHint.hidden = true;
    }
    /* Estado backend/conectividad: solo lo fija runCheck() vía probeBackendHealth (misma regla que el shell). */
  };

  const runCheck = async () => {
    if (!wrap.isConnected) return;

    renderStatic();

    const failHint = () => {
      hintEl.textContent = '';
      hintEl.hidden = true;
    };

    const { ok, status, body } = await probeBackendHealth({ timeoutMs: FETCH_TIMEOUT_MS });
    const cont = body?.data?.continuity || null;

    if (ok) {
      lastValidationAt = new Date().toISOString();
      el.be.textContent = 'ACTIVO';
      el.net.textContent = 'OK';
      el.val.textContent = fmtTime(lastValidationAt);
      setBadge('completo');
      stateMsg.textContent = 'Entorno completo. Jarvis puede operar con continuidad técnica.';
      clearNode(alertBox);
      alertBox.hidden = true;
      if (cont?.serverTime) {
        hintEl.textContent = `Reloj servidor (health): ${fmtAtShort(cont.serverTime)} · API escuchando en :${cont.listenPort ?? '—'}`;
        hintEl.hidden = false;
      } else {
        failHint();
      }
    } else if (status >= 200 && status < 300 && body) {
      lastValidationAt = new Date().toISOString();
      el.be.textContent = 'RESPUESTA ANÓMALA';
      el.net.textContent = 'INCIERTA';
      el.val.textContent = fmtTime(lastValidationAt);
      setBadge('critico');
      stateMsg.textContent = 'Entorno crítico. El health no confirma estado OK.';
      clearNode(alertBox);
      appendExecAlert(alertBox, {
        servicio: 'Endpoint /health (API)',
        impacto: 'No se puede certificar continuidad; datos podrían estar inconsistentes.',
        accion: 'Revisá consola del backend y base de datos. Reiniciá con <code>npm run start:backend</code> si hace falta.',
      });
      alertBox.hidden = false;
      failHint();
    } else {
      lastValidationAt = new Date().toISOString();
      el.be.textContent = 'CAÍDO';
      el.net.textContent = 'FALLANDO';
      el.val.textContent = fmtTime(lastValidationAt);
      setBadge('incompleto');
      stateMsg.textContent = 'Entorno incompleto. La API no responde correctamente.';
      showBackendDownAlerts();
      failHint();
    }
  };

  setBadge('checking');
  stateMsg.textContent = 'Validando entorno…';
  el.be.textContent = '…';
  el.net.textContent = '…';
  renderStatic();
  queueMicrotask(() => {
    void runCheck().catch((e) => console.error('[HNF] continuidad runCheck', e));
  });

  btn.addEventListener('click', () => {
    void runCheck().catch((e) => console.error('[HNF] continuidad runCheck', e));
  });

  const intervalId = setInterval(() => {
    if (!wrap.isConnected) {
      clearInterval(intervalId);
      return;
    }
    void runCheck().catch((e) => console.error('[HNF] continuidad runCheck', e));
  }, POLL_MS);

  return wrap;
}

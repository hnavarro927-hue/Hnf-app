import { whatsappFeedService } from '../services/whatsapp-feed.service.js';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const defaultClientList = () => [
  {
    name: 'Arauco Chillán',
    aliases: ['arauco ch', 'mall arauco chillan', 'arauco chillan', 'arauco chillán'],
  },
  { name: 'Cliente Demo' },
];

const EST_OP_LABEL = {
  capturado: 'Capturado',
  en_proceso: 'En proceso',
  terminado_tecnico: 'Terminado (técnico)',
  pendiente_cierre_admin: 'Pendiente cierre admin.',
  pendiente_cobro: 'Pendiente cobro',
  cerrado: 'Cerrado',
};

function badgeImpacto(nivel) {
  const n = nivel || 'atencion';
  if (n === 'critico') return '🔴 crítico';
  if (n === 'correcto') return '🟢 correcto';
  return '🟡 atención';
}

function badgeClass(nivel) {
  const n = nivel || 'atencion';
  if (n === 'critico') return 'wa-feed-badge wa-feed-badge--critico';
  if (n === 'correcto') return 'wa-feed-badge wa-feed-badge--ok';
  return 'wa-feed-badge wa-feed-badge--warn';
}

function buildResolveNavigation(m) {
  const prob = m.impactoOperacional?.problema;
  const otId = m.otIdRelacionado;
  const baseWhy = 'Resolución guiada desde el motor operacional WhatsApp → ERP.';

  if (prob === 'sin_costo' && otId) {
    return {
      view: 'clima',
      otId,
      guidance: {
        codigo: 'WA_RESOLVE',
        recordLabel: otId,
        why: baseWhy,
        fix: 'Completá costo total en la OT terminada.',
        unlock: 'Costo > 0 y reglas de cierre HNF.',
      },
    };
  }
  if (prob === 'sin_pdf' && otId) {
    return {
      view: 'clima',
      otId,
      guidance: {
        codigo: 'WA_RESOLVE',
        recordLabel: otId,
        why: baseWhy,
        fix: 'Generá y adjuntá el informe PDF de cierre.',
        unlock: 'PDF asociado a la OT.',
      },
    };
  }
  if (prob === 'sin_cobro' && otId) {
    return {
      view: 'clima',
      otId,
      guidance: {
        codigo: 'WA_RESOLVE',
        recordLabel: otId,
        why: baseWhy,
        fix: 'Registrá monto cobrado / facturación.',
        unlock: 'Ingreso alineado con PDF e informada.',
      },
    };
  }
  if (m.cliente === 'desconocido' || m.tecnicoId === 'tecnico_no_identificado' || (m.errores || []).includes('multiple_match')) {
    return {
      view: 'whatsapp',
      guidance: {
        codigo: 'WA_RESOLVE',
        recordLabel: m.id,
        why: baseWhy,
        fix: 'Actualizá diccionario de clientes / roster de técnicos o asigná OT manualmente en Clima.',
        unlock: 'Identidad y vínculo OT sin ambigüedad.',
      },
    };
  }
  if (otId) {
    return {
      view: 'clima',
      otId,
      guidance: {
        codigo: 'WA_FEED',
        recordLabel: otId,
        why: 'Revisión general del registro WhatsApp vinculado.',
        fix: 'Completá evidencias, economía e informe si aplica.',
        unlock: 'OT conforme a reglas HNF.',
      },
    };
  }
  return {
    view: 'whatsapp',
    guidance: {
      codigo: 'WA_RESOLVE',
      recordLabel: m.id,
      why: baseWhy,
      fix: 'Revisá el mensaje y la cola de errores del feed.',
      unlock: 'Registro operacional consistente.',
    },
  };
}

const demoPresets = (clientList) => [
  {
    label: 'Simular · Clima + técnico roster (Juan)',
    payload: {
      clientList,
      message: {
        id: `sim-roster-${Date.now()}`,
        body: 'Cliente Demo · técnico: Juan · limpieza de filtros y split en sala. Filtro sucio reemplazado.',
        timestamp: Date.now(),
        attachments: [{ name: 'filtro.jpg', type: 'image/jpeg', url: TINY_PNG }],
      },
    },
  },
  {
    label: 'Simular · Cliente parcial (Arauco)',
    payload: {
      clientList,
      message: {
        id: `sim-arauco-${Date.now()}`,
        body: 'mall arauco chillan · técnico: Ana · mantención conductos OK',
        timestamp: Date.now(),
      },
    },
  },
  {
    label: 'Simular · Flota + patente',
    payload: {
      clientList,
      message: {
        id: `sim-flota-${Date.now()}`,
        body: 'Cliente Demo · técnico: Ana · revisión técnica vehículo patente ABCD12 listo ✔️',
        timestamp: Date.now(),
        attachments: [{ name: 'doc.pdf', type: 'application/pdf', url: TINY_PNG }],
      },
    },
  },
  {
    label: 'Simular · Incompleto (solo foto)',
    payload: {
      clientList,
      message: {
        id: `sim-incomp-${Date.now()}`,
        body: '',
        timestamp: Date.now(),
        attachments: [{ name: 'foto.jpg', type: 'image/jpeg', url: TINY_PNG }],
      },
    },
  },
];

function bucketMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const nuevos = list.filter((m) => !m.procesado);
  const conErrores = list.filter(
    (m) => m.procesado && ((m.errores && m.errores.length > 0) || m.resultadoIngesta === 'error')
  );
  const procesados = list.filter(
    (m) =>
      m.procesado &&
      !(m.errores && m.errores.length > 0) &&
      m.resultadoIngesta !== 'error'
  );
  return { nuevos, procesados, conErrores, all: list };
}

function rowCard(m, intelNavigate) {
  const el = document.createElement('article');
  el.className = 'wa-feed-card';
  const err = (m.errores || []).join(', ') || '—';
  const nivel = m.impactoNivel || 'atencion';
  const estOp = m.estadoOperacional || '—';
  const estLabel = EST_OP_LABEL[estOp] || estOp;
  const impact = m.impactoOperacional;
  const impactLine = impact
    ? `puedeCerrar: ${impact.puedeCerrar} · problema: ${impact.problema ?? '—'}`
    : '—';

  el.innerHTML = `
    <div class="wa-feed-card__top">
      <span class="wa-feed-card__id">${m.id}</span>
      <span class="${badgeClass(nivel)}">${badgeImpacto(nivel)}</span>
      <span class="wa-feed-card__tipo">${m.tipo || '—'}</span>
      <span class="wa-feed-card__est">${m.estado || '—'}</span>
    </div>
    <p class="wa-feed-card__line"><strong>Estado operacional</strong> · <code class="wa-feed-code">${estLabel}</code></p>
    <p class="wa-feed-card__line"><strong>Cliente</strong> · ${m.cliente || '—'}</p>
    <p class="wa-feed-card__line"><strong>Técnico</strong> · ${m.tecnico || '—'} <span class="muted">(${m.tecnicoId || '—'})</span></p>
    <p class="wa-feed-card__line muted wa-feed-card__desc">${(m.descripcion || '').slice(0, 220) || '—'}</p>
    <p class="wa-feed-card__line muted"><strong>Impacto cierre</strong> · ${impactLine}</p>
    <p class="wa-feed-card__line wa-feed-card__err"><strong>Errores / avisos</strong> · ${err}</p>
    <p class="wa-feed-card__line muted"><strong>OT</strong> · ${m.otIdRelacionado || '—'} · <strong>Ingesta</strong> · ${m.resultadoIngesta || '—'}</p>
  `;
  const foot = document.createElement('div');
  foot.className = 'wa-feed-card__actions';
  if (typeof intelNavigate === 'function') {
    const nav = buildResolveNavigation(m);
    const r = document.createElement('button');
    r.type = 'button';
    r.className = 'secondary-button';
    r.textContent = 'Resolver problema';
    r.addEventListener('click', () => intelNavigate(nav));
    foot.append(r);
  }
  if (m.otIdRelacionado && typeof intelNavigate === 'function') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'primary-button';
    b.textContent = 'Abrir OT';
    b.addEventListener('click', () =>
      intelNavigate({
        view: 'clima',
        otId: m.otIdRelacionado,
        guidance: {
          codigo: 'WA_FEED',
          recordLabel: m.otIdRelacionado,
          why: 'Abrís esta OT desde el feed de ingesta WhatsApp (trazabilidad WA → ERP).',
          fix: 'Completá dirección, evidencias y economía si el mensaje era incompleto.',
          unlock: 'OT alineada con reglas de cierre HNF.',
        },
      })
    );
    foot.append(b);
  }
  el.append(foot);
  return el;
}

function section(title, items, intelNavigate) {
  const wrap = document.createElement('section');
  wrap.className = 'wa-feed-section';
  const h = document.createElement('h3');
  h.className = 'wa-feed-section__title';
  h.textContent = title;
  wrap.append(h);
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Sin ítems.';
    wrap.append(p);
    return wrap;
  }
  const grid = document.createElement('div');
  grid.className = 'wa-feed-grid';
  items.forEach((m) => grid.append(rowCard(m, intelNavigate)));
  wrap.append(grid);
  return wrap;
}

export const whatsappFeedView = ({
  data,
  integrationStatus,
  reloadApp,
  intelNavigate,
} = {}) => {
  const sectionRoot = document.createElement('section');
  sectionRoot.className = 'wa-feed-module';

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML = `
    <h2>WhatsApp · motor operacional</h2>
    <p class="muted">Identidad de técnico (roster), normalización de cliente, estados operacionales, impacto de cierre, matching OT (patente → cliente+fecha → técnico+hora) y alertas en <code>whatsapp_feed.errors</code>. API: <code>GET /whatsapp/feed</code>, <code>POST /whatsapp/ingest</code>. El snapshot de Inteligencia incorpora este feed vía <code>whatsappFeed</code> en la carga unificada.</p>
  `;

  const toolbar = document.createElement('div');
  toolbar.className = 'module-toolbar';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.className = 'secondary-button';
  refresh.textContent = 'Actualizar feed';
  refresh.addEventListener('click', async () => {
    await reloadApp?.();
  });
  toolbar.append(refresh);

  const simWrap = document.createElement('div');
  simWrap.className = 'wa-feed-sim';
  const simLab = document.createElement('span');
  simLab.className = 'muted';
  simLab.textContent = 'Simulación:';
  simWrap.append(simLab);

  const clientList = defaultClientList();
  const dupTs = Date.now();
  const dupPayload = {
    clientList,
    message: {
      id: 'dup-a',
      body: 'Cliente Demo · técnico: Pedro · limpieza filtro única frase duplicado',
      timestamp: dupTs,
    },
  };

  demoPresets(clientList).forEach(({ label, payload }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button';
    b.textContent = label;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await whatsappFeedService.ingest(payload);
        await reloadApp?.();
      } catch (e) {
        alert(e.message || String(e));
      } finally {
        b.disabled = false;
      }
    });
    simWrap.append(b);
  });

  const dupBtn = document.createElement('button');
  dupBtn.type = 'button';
  dupBtn.className = 'secondary-button';
  dupBtn.textContent = 'Simular · Duplicado (2× mismo texto)';
  dupBtn.addEventListener('click', async () => {
    dupBtn.disabled = true;
    try {
      await whatsappFeedService.ingest({ ...dupPayload, message: { ...dupPayload.message, id: 'dup-1' } });
      await whatsappFeedService.ingest({ ...dupPayload, message: { ...dupPayload.message, id: 'dup-2' } });
      await reloadApp?.();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      dupBtn.disabled = false;
    }
  });
  simWrap.append(dupBtn);

  const body = document.createElement('div');
  body.className = 'wa-feed-body';

  const feed = data?.feed || { messages: [], ingestLogs: [], errors: [] };
  const summary = feed.operationalSummary;
  if (summary) {
    const sum = document.createElement('div');
    sum.className = 'wa-feed-summary';
    sum.innerHTML = `
      <strong>Resumen operacional</strong>
      · mensajes: ${summary.mensajesRegistrados ?? '—'}
      · crítico: ${summary.impactoCritico ?? '—'}
      · atención: ${summary.impactoAtencion ?? '—'}
      · técnicos identificados: ${summary.tecnicosIdentificados ?? '—'}
    `;
    body.append(sum);
  }

  const { nuevos, procesados, conErrores } = bucketMessages(feed.messages);

  body.append(
    section('1 · Nuevos (sin procesar)', nuevos, intelNavigate),
    section('2 · Procesados', procesados, intelNavigate),
    section('3 · Con errores / avisos', conErrores, intelNavigate)
  );

  const errSec = document.createElement('section');
  errSec.className = 'wa-feed-section';
  const errH = document.createElement('h3');
  errH.className = 'wa-feed-section__title';
  errH.textContent = 'Cola whatsapp_feed.errors (alertas automáticas)';
  errSec.append(errH);
  const waErrs = feed.errors || [];
  if (!waErrs.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Sin alertas en cola.';
    errSec.append(p);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'wa-feed-log';
    waErrs
      .slice(-40)
      .reverse()
      .forEach((e) => {
        const li = document.createElement('li');
        li.textContent = `${e.timestamp || ''} · ${e.type || '—'} · ${e.messageId || '—'} · ${e.detalle || ''}`;
        ul.append(li);
      });
    errSec.append(ul);
  }
  body.append(errSec);

  const logSec = document.createElement('section');
  logSec.className = 'wa-feed-section';
  const logH = document.createElement('h3');
  logH.className = 'wa-feed-section__title';
  logH.textContent = 'Log operacional (últimos)';
  logSec.append(logH);
  const logUl = document.createElement('ul');
  logUl.className = 'wa-feed-log';
  const logs = (feed.ingestLogs || []).slice(-24).reverse();
  if (!logs.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Sin entradas aún.';
    logSec.append(p);
  } else {
    logs.forEach((l) => {
      const li = document.createElement('li');
      li.textContent = `${l.timestamp || ''} · ${l.messageId} · ${l.resultado} · OT ${l.otId || '—'}`;
      logUl.append(li);
    });
    logSec.append(logUl);
  }
  body.append(logSec);

  if (integrationStatus === 'sin conexión') {
    const off = document.createElement('div');
    off.className = 'integration-banner integration-banner--offline';
    off.textContent = 'Sin conexión: no se puede cargar el feed ni simular ingesta.';
    sectionRoot.append(header, off);
    return sectionRoot;
  }

  sectionRoot.append(header, toolbar, simWrap, body);

  if (typeof window !== 'undefined') {
    const prevHooks =
      window.hnfWhatsAppData?.hooks && typeof window.hnfWhatsAppData.hooks === 'object'
        ? window.hnfWhatsAppData.hooks
        : {};
    const ni = async () => ({ ok: false, reason: 'not_implemented' });
    window.hnfWhatsAppData = {
      ...(window.hnfWhatsAppData || {}),
      feed,
      ingest: (msg, clients) => whatsappFeedService.ingest({ message: msg, clientList: clients }),
      reload: () => reloadApp?.(),
      hooks: {
        runOCR: prevHooks.runOCR ?? (async (document) => {
          void document;
          return ni();
        }),
        analyzeImages: prevHooks.analyzeImages ?? (async (images) => {
          void images;
          return ni();
        }),
        suggestCompletion: prevHooks.suggestCompletion ?? (async (record) => {
          void record;
          return ni();
        }),
        autoCompleteOT: prevHooks.autoCompleteOT ?? (async (record) => {
          void record;
          return ni();
        }),
      },
    };
  }

  return sectionRoot;
};

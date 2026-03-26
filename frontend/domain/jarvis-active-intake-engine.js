/**
 * Jarvis ingesta activa — clasifica entradas locales, persiste eventos y alimenta supervisión/expansión.
 * Prepara integración futura con Outlook / WhatsApp / OT / archivos (sin backend obligatorio).
 */

import { analyzeJarvisImage } from './jarvis-image-intelligence.js';
import { buildJarvisOperativeBrainSnapshot } from './jarvis-operational-interpretation.js';
import { normalizeToEvento } from './evento-operativo.js';

export const JARVIS_ACTIVE_INTAKE_VERSION = '2026-03-22';

const LS_CENTRO = 'hnf_jarvis_centro_ingesta_v1';
const MAX_EVENTS = 32;

export function getCentroIngestaState() {
  try {
    const raw = localStorage.getItem(LS_CENTRO);
    if (!raw) return { events: [], last: null };
    const j = JSON.parse(raw);
    const events = Array.isArray(j.events) ? j.events : [];
    return { events, last: events[0] || null };
  } catch {
    return { events: [], last: null };
  }
}

/**
 * @param {object} event - payload enriquecido (sin at/id)
 */
export function appendCentroIngestaEvent(event) {
  const ev = {
    ...event,
    at: event.at || new Date().toISOString(),
    id: event.id || `ing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    version: event.version || JARVIS_ACTIVE_INTAKE_VERSION,
  };
  const { events: prev } = getCentroIngestaState();
  const events = [ev, ...prev.filter((x) => x.id !== ev.id)].slice(0, MAX_EVENTS);
  localStorage.setItem(LS_CENTRO, JSON.stringify({ events }));
  return ev;
}

/**
 * Fusiona eventos del servidor con memoria local (dedupe por id).
 * @param {object[]} serverEvents
 */
export function mergeJarvisOperativeStoresFromServer(serverEvents) {
  try {
    const prev = getCentroIngestaState().events;
    const byId = new Map();
    for (const e of serverEvents || []) {
      if (e && e.id) {
        const loc = prev.find((x) => x.id === e.id);
        const keepBrain =
          loc?.jarvisOperativoBrain && !e.jarvisOperativoBrain
            ? { jarvisOperativoBrain: loc.jarvisOperativoBrain }
            : {};
        byId.set(e.id, { ...e, ...keepBrain, persistencia: e.persistencia || 'servidor' });
      }
    }
    for (const e of prev) {
      if (e && e.id && !byId.has(e.id)) byId.set(e.id, e);
    }
    const merged = [...byId.values()].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, MAX_EVENTS);
    localStorage.setItem(LS_CENTRO, JSON.stringify({ events: merged }));
  } catch {
    /* noop */
  }
}

export function detectClienteFromText(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const headNom = t.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s*[\/.|]/);
  if (headNom) return headNom[1].trim();
  const m1 = t.match(
    /cliente\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s]{1,48}?)(?=\s+solicita|\s+pide|\s+informa|\s+pregunta|,|\.|$)/i
  );
  if (m1) return m1[1].trim().replace(/\s+/g, ' ');
  const brands = /\b(Puma|Jumbo|L[ií]der|Walmart|Tottus|Cencosud|Unimarc|Sodimac)\b/i;
  const m2 = t.match(brands);
  if (m2) return m2[1];
  return null;
}

export function mapIntakeToTipoClasificado(classification, kind) {
  const c = classification || {};
  const canal = c.canalSalida || c.canal;
  if (kind === 'imagen') return 'documento';
  if (canal === 'correo') return 'correo';
  if (canal === 'whatsapp') return 'whatsapp';
  if (c.tipo === 'ot' || canal === 'ot') return 'ot';
  if (c.tipoSalida === 'oportunidad' || c.tipo === 'comercial') return 'comercial';
  if (c.tipoSalida === 'problema' && (c.urgencia === 'alta' || c.generaRiesgo)) return 'incidente';
  if (c.tipoSalida === 'riesgo') return 'incidente';
  return 'documento';
}

export function mapIntakeToPrioridad(classification) {
  const c = classification || {};
  const narr = String(c.narrativaRiesgo || '');
  if (c.tipoSalida === 'riesgo' && /reclamo|legal|judicial|multa/i.test(narr)) return 'CRITICO';
  if (c.urgencia === 'alta' && (c.tipoSalida === 'oportunidad' || c.generaIngreso)) return 'CRITICO';
  if (c.urgencia === 'alta' || c.tipoSalida === 'problema') return 'ALTO';
  if (c.tipoSalida === 'oportunidad' || c.tipo === 'comercial') return 'ALTO';
  return 'NORMAL';
}

export function buildJarvisOperativePayload(classification, meta = {}) {
  const raw = meta.rawText || classification.excerpt || '';
  const cliente = meta.clienteDetectado ?? detectClienteFromText(raw);
  return {
    rawExcerpt: String(raw).slice(0, 2000),
    tipoClasificado: mapIntakeToTipoClasificado(classification, meta.kind),
    prioridad: mapIntakeToPrioridad(classification),
    clienteDetectado: cliente,
    responsableSugerido: classification.responsable || 'sin dueño',
    impactoEconomicoHeuristico: classification.impactoEconomicoEstimado || 0,
    accionInmediata: String(classification.accionInmediata || 'Revisar y asignar dueño.').slice(0, 2000),
    canalSalida: classification.canalSalida || classification.canal || 'manual',
    tipoSalida: classification.tipoSalida || classification.tipo,
    fuente: meta.fuente || 'hq',
    archivo: meta.archivo || null,
    generaIngreso: classification.generaIngreso,
    generaRiesgo: classification.generaRiesgo,
    generaOportunidad: classification.generaOportunidad,
    vinculoSugerido: classification.vinculoSugerido,
    kind: meta.kind,
  };
}

/**
 * Persiste en backend si hay postFn; siempre refleja en localStorage.
 * @param {Function} [postFn] async (payload) => response body con .event
 */
export async function persistJarvisOperativeIngest(classification, meta = {}, postFn) {
  const payload = buildJarvisOperativePayload(classification, meta);
  const brain = buildJarvisOperativeBrainSnapshot(payload);
  const fireBrain = (snap) => {
    try {
      window.dispatchEvent(
        new CustomEvent('hnf-jarvis-operative-brain', { detail: { brain: snap.jarvisOperativoBrain } })
      );
    } catch {
      /* no window */
    }
  };
  if (typeof postFn === 'function') {
    try {
      const res = await postFn(payload);
      const serverEv = res?.event;
      if (serverEv && serverEv.id) {
        const merged = { ...payload, ...serverEv };
        const brainMerged = buildJarvisOperativeBrainSnapshot(merged);
        const ev = appendCentroIngestaEvent({
          ...classification,
          ...serverEv,
          ...brainMerged,
          persistencia: 'servidor',
          eventoOperativo: normalizeToEvento(
            { ...classification, ...payload, ...serverEv, ...brainMerged },
            'jarvis_operativo'
          ),
        });
        fireBrain(brainMerged);
        return ev;
      }
    } catch {
      /* solo local */
    }
  }
  const ev = appendCentroIngestaEvent({
    ...classification,
    ...payload,
    ...brain,
    persistencia: 'local',
    eventoOperativo: normalizeToEvento({ ...classification, ...payload, ...brain }, 'jarvis_operativo'),
  });
  fireBrain(brain);
  return ev;
}

/**
 * @param {string} text
 * @param {string} [sourceLabel]
 */
export function classifyIntakeText(text, sourceLabel) {
  const t = String(text || '').slice(0, 120_000);
  const lower = t.toLowerCase();

  let canal = 'archivo_texto';
  if (/asunto:|from:|outlook|correo|@\w+\.|email/.test(lower)) canal = 'outlook';
  if (/whatsapp|wa\.me|wsp|mensaje de/.test(lower)) canal = 'whatsapp';
  if (/\bot\b|orden de trabajo|orden trabajo|ot[\s_-]*#?\d|servicio técnico|visit(a|é) técn/.test(lower)) {
    canal = 'ot_sistema';
  }

  let tipo = 'contexto';
  if (canal === 'ot_sistema' || /\b(ot|orden)\s*#?\s*[\w-]+/i.test(t)) tipo = 'ot';
  else if (/cliente|razón social|rut\s|empresa\s/i.test(t)) tipo = 'cliente';
  else if (/cotiz|propuesta|pipeline|oportunidad|comercial|contrato mensual/i.test(t)) tipo = 'comercial';
  else if (
    /falla|error|no enfría|no calienta|urgencia|emergencia|parada/i.test(t) ||
    /sin\s+evidencia|sin\s+cierre|retir\w+|sin\s+cerrar|cierre\s*ot/i.test(lower)
  ) {
    tipo = 'problema';
  }

  const riesgoLegal = /reclamo|demanda|multa|judicial|notificaci|infracci|sindicat/i.test(lower);

  /** Salida estándar: cliente | problema | oportunidad | riesgo */
  let tipoSalida = 'cliente';
  if (tipo === 'comercial') tipoSalida = 'oportunidad';
  else if (tipo === 'problema') tipoSalida = 'problema';
  else if (riesgoLegal) tipoSalida = 'riesgo';
  else if (tipo === 'ot') tipoSalida = 'problema';

  const canalSalida =
    canal === 'outlook' ? 'correo' : canal === 'whatsapp' ? 'whatsapp' : canal === 'ot_sistema' ? 'ot' : 'manual';

  let responsable = 'sin dueño';
  if (/\bgery\b|gerardo/i.test(t)) responsable = 'Gery';
  else if (/romina/i.test(t)) responsable = 'Romina';
  else if (/\blyn\b/i.test(t)) responsable = 'Lyn';
  else if (/hernan|hernán/i.test(t)) responsable = 'Hernán';
  else if (canal === 'outlook') responsable = 'Romina';
  else if (tipo === 'comercial') responsable = 'Gery';
  else if (tipo === 'problema' || tipo === 'ot') responsable = 'Lyn';

  let urgencia = 'media';
  if (/urgente|emergencia|crític|critico|hoy mismo|ya\b|inmediat/i.test(lower)) urgencia = 'alta';
  if (/24\s*h|esta mañana|en menos de/i.test(lower)) urgencia = 'alta';

  let impactoEconomicoEstimado = 0;
  const big = t.match(/\$\s*([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]+)?|[\d]{4,})/g);
  if (big && big.length) {
    const vals = big
      .map((s) => parseInt(s.replace(/\D/g, ''), 10))
      .filter((n) => n > 5000);
    if (vals.length) impactoEconomicoEstimado = Math.max(...vals);
  }
  if (!impactoEconomicoEstimado && tipo === 'comercial') impactoEconomicoEstimado = 250_000;
  if (!impactoEconomicoEstimado && tipo === 'ot') impactoEconomicoEstimado = 185_000;
  if (!impactoEconomicoEstimado && tipo === 'problema') impactoEconomicoEstimado = 95_000;

  const generaIngreso = tipo === 'comercial' || tipo === 'ot' || impactoEconomicoEstimado > 50_000;
  const generaRiesgo = tipo === 'problema' || urgencia === 'alta' || riesgoLegal || tipoSalida === 'riesgo';
  const generaOportunidad = tipo === 'comercial' || /mantenc|contrato|recurrent|mensual/i.test(lower);

  let vinculoSugerido = 'Registrar número de OT o RUT cliente en ERP para empalme formal.';
  const otM = t.match(/\bOT[\s#:_-]*([A-Z0-9-]{2,})/i);
  if (otM) vinculoSugerido = `Empalme sugerido: OT / ref ${otM[1]}`;

  const ingresoPotencial = Math.round(impactoEconomicoEstimado);
  const narrativaRiesgo = generaRiesgo
    ? 'Si no cerrás el ciclo operativo/comercial, sube exposición a reclamo, retrabajo o fuga de cobro.'
    : 'Riesgo acotado si se ejecuta la acción inmediata.';
  const narrativaOportunidad = generaOportunidad
    ? 'Hay palanca de upsell, contrato o visita vendible si asignás dueño hoy.'
    : 'Sin palanca comercial explícita en este texto — buscar contexto de cliente o OT.';

  const accionInmediataPorTipo = () => {
    if (tipoSalida === 'oportunidad')
      return 'Dueño comercial: monto tentativo + llamada + siguiente paso con fecha ≤48h.';
    if (tipoSalida === 'problema')
      return 'Lyn/técnico: priorizar visita o cierre de diagnóstico; cliente con ventana clara.';
    if (tipoSalida === 'riesgo')
      return 'Hernán: contención y registro; si es legal, abogado externo antes de responder en caliente.';
    return `${responsable}: validar cliente, último contacto y un solo próximo paso (cobro o venta).`;
  };

  return {
    canal,
    canalSalida,
    tipo,
    tipoSalida,
    responsable,
    urgencia,
    impactoEconomicoEstimado: ingresoPotencial,
    ingresoPotencial,
    generaIngreso,
    generaRiesgo,
    generaOportunidad,
    narrativaRiesgo,
    narrativaOportunidad,
    accionInmediata: accionInmediataPorTipo(),
    vinculoSugerido,
    excerpt: t.slice(0, 280),
    source: sourceLabel || 'texto_pegar',
  };
}

/**
 * Texto o JSON (objeto/array) pegado.
 */
export function classifyIntakePayload(raw) {
  const s = String(raw || '').trim();
  if (!s) return classifyIntakeText('', 'vacío');
  try {
    const j = JSON.parse(s);
    if (Array.isArray(j.messages)) {
      const c = classifyIntakeText(`outlook lote ${j.messages.length} mensajes`, 'json_outlook');
      return {
        ...c,
        canal: 'outlook',
        canalSalida: 'correo',
        tipo: 'contexto',
        tipoSalida: 'cliente',
        accionInmediata: 'Procesar lote en Intake Hub y asignar dueño por hilo (Romina/Gery).',
        vinculoSugerido: `Lote JSON: ${j.messages.length} mensaje(s) — procesar en Intake Hub servidor si aplica.`,
        source: 'json_outlook',
      };
    }
    if (Array.isArray(j.files)) {
      const c = classifyIntakeText(`archivos lote ${j.files.length}`, 'json_historico');
      return {
        ...c,
        canal: 'archivo_texto',
        canalSalida: 'manual',
        accionInmediata: 'Ejecutar “Absorber lote” en Intake Hub y validar extracción de texto.',
        vinculoSugerido: 'Enviar lote vía Intake Hub “Absorber lote” para indexar en servidor.',
        source: 'json_historico',
      };
    }
    return classifyIntakeText(s, 'json_generico');
  } catch {
    return classifyIntakeText(s, 'texto_pegar');
  }
}

function classificationFromImageIntel(img, fileName) {
  if (!img || img.ok === false) {
    return {
      canal: 'imagen',
      tipo: 'problema',
      responsable: 'Lyn',
      urgencia: 'media',
      impactoEconomicoEstimado: 0,
      generaIngreso: false,
      generaRiesgo: true,
      generaOportunidad: false,
      vinculoSugerido: img?.error || 'Reintentar con otra imagen.',
      excerpt: fileName,
      source: fileName,
    };
  }
  const cn = img.clasificacionNucleo;
  const tipo =
    cn === 'oportunidad' ? 'comercial' : cn === 'problema' ? 'problema' : cn === 'OT' ? 'ot' : 'cliente';
  const tipoSalida =
    cn === 'oportunidad' ? 'oportunidad' : cn === 'problema' ? 'problema' : cn === 'OT' ? 'problema' : 'cliente';
  const ip = img.impactoEconomicoEstimado || 0;

  return {
    canal: 'imagen',
    canalSalida: 'manual',
    tipo,
    tipoSalida,
    responsable: cn === 'problema' ? 'Lyn' : cn === 'oportunidad' ? 'Gery' : 'Lyn',
    urgencia: img.urgencia || 'media',
    impactoEconomicoEstimado: ip,
    ingresoPotencial: ip,
    generaIngreso: img.generaIngreso ?? (cn === 'oportunidad' || cn === 'OT'),
    generaRiesgo: img.generaRiesgo ?? cn === 'problema',
    generaOportunidad: img.generaOportunidad ?? cn === 'oportunidad',
    narrativaRiesgo: img.riesgoAsociado || 'Riesgo si la evidencia no se amarra a OT u oportunidad.',
    narrativaOportunidad: img.oportunidadComercial || 'Oportunidad vía visita o mantención según contexto.',
    accionInmediata: img.accionRecomendada || 'Clasificar imagen en OT o pipeline y asignar dueño.',
    vinculoSugerido: img.resumenOperativo || img.cadenaCausal || 'Adjuntar a OT u oportunidad.',
    excerpt: (img.interpretacionTecnica || '').slice(0, 240),
    source: fileName,
    resumenImagen: img.resumenEjecutivo || img.resumenOperativo || null,
    riesgoTecnicoImagen: img.riesgoTecnico || null,
  };
}

/**
 * @param {File} file
 */
export async function processIntakeFile(file) {
  const name = file?.name || 'archivo';
  const type = file?.type || '';

  if (type.startsWith('image/')) {
    const img = await analyzeJarvisImage(file);
    const classification = classificationFromImageIntel(img, name);
    return { kind: 'imagen', name, fileType: type, classification, imageIntel: img };
  }

  const textLike =
    type.startsWith('text/') ||
    /\.(txt|json|csv|md|log|xml|html)$/i.test(name) ||
    type === 'application/json';

  if (textLike) {
    let text = '';
    try {
      text = await file.text();
    } catch {
      text = '';
    }
    const classification = classifyIntakePayload(text);
    return { kind: 'texto', name, fileType: type, classification, bytes: text.length };
  }

  return {
    kind: 'binario',
    name,
    fileType: type,
    classification: {
      canal: 'archivo_cargado',
      canalSalida: 'manual',
      tipo: 'contexto',
      tipoSalida: 'riesgo',
      responsable: 'sin dueño',
      urgencia: 'baja',
      impactoEconomicoEstimado: 0,
      ingresoPotencial: 0,
      generaIngreso: false,
      generaRiesgo: true,
      generaOportunidad: false,
      narrativaRiesgo: 'Sin texto extraíble: ceguera operativa hasta indexar en backend.',
      narrativaOportunidad: 'No hay palanca hasta humanizar el contenido.',
      accionInmediata: 'Subir a Intake Hub o exportar texto; no operar decisiones sobre el binario solo.',
      vinculoSugerido:
        'Archivo no leído como texto en el navegador — extraer texto o subir a Intake Hub backend.',
      excerpt: name,
      source: name,
    },
  };
}

/**
 * @param {FileList|File[]} files
 */
export async function processIntakeFiles(files) {
  const list = Array.from(files || []);
  const out = [];
  for (const f of list) {
    out.push(await processIntakeFile(f));
  }
  return out;
}

/**
 * Vacíos críticos con impacto de omisión y acción concreta (autoalimentación del cerebro).
 * @returns {{ mensajeCorto: string, vacio: string, impactoSiNo: string, accion: string }[]}
 */
export function buildAutoalimentacionRich(unified) {
  const u = unified || {};
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities.length : 0;
  const ots = Array.isArray(u.planOts) ? u.planOts.length : 0;
  const docs = Array.isArray(u.technicalDocuments) ? u.technicalDocuments.length : 0;
  const msgs = Array.isArray(u.outlookFeed?.messages) ? u.outlookFeed.messages.length : 0;
  const wa = u.whatsappFeed && typeof u.whatsappFeed === 'object';

  /** @type {{ mensajeCorto: string, vacio: string, impactoSiNo: string, accion: string }[]} */
  const items = [];
  if (!opps) {
    items.push({
      mensajeCorto: 'Pipeline vacío: riesgo de estancamiento inmediato.',
      vacio: 'No hay oportunidades comerciales cargadas o visibles.',
      impactoSiNo:
        'Sin palanca de mes: fijos y operación corren sin contrapeso de venta — el hueco se nota en 2–4 semanas.',
      accion: 'Registrar oportunidades en ERP o absorber correo comercial (Centro de Ingesta / Intake Hub).',
    });
  }
  if (!ots) {
    items.push({
      mensajeCorto: 'Sin OT: el cerebro no ve flujo de obra.',
      vacio: 'No hay órdenes de trabajo en la vista unificada.',
      impactoSiNo: 'Decisiones de prioridad técnica y cobro se vuelven teóricas.',
      accion: 'Activar toggle “Datos operativos” y sincronizar ERP o cargar export mínimo.',
    });
  }
  if (!docs) {
    items.push({
      mensajeCorto: 'Sin documentos técnicos: riesgo de cierre sin evidencia.',
      vacio: 'No hay documentos técnicos ingestados.',
      impactoSiNo: 'Retrabajo, demoras de aprobación y facturación tardía.',
      accion: 'Activar ingesta de documentos y empujar cola “aprobado sin envío”.',
    });
  }
  if (!msgs) {
    items.push({
      mensajeCorto: 'Sin correo analizado: ceguera sobre conversaciones con cliente.',
      vacio: 'Outlook simulado / feed sin mensajes.',
      impactoSiNo: 'Promesas y cuellos de correo no entran al tablero de decisión.',
      accion: 'Pegar JSON de mensajes o usar Intake Hub “Absorber lote”.',
    });
  }
  if (!wa) {
    items.push({
      mensajeCorto: 'WhatsApp ausente en datos.',
      vacio: 'No hay feed WhatsApp conectado en esta vista.',
      impactoSiNo: 'Pérdida de trazabilidad operativa cliente–técnico en canal rápido.',
      accion: 'Conectar feed cuando esté disponible; mientras tanto registrar acuerdos en OT.',
    });
  }
  if (u.jarvisOperador?.jarvisModo === 'inferencial') {
    items.push({
      mensajeCorto: 'Modo inferencial: decidís con mapa incompleto.',
      vacio: 'Datos finos insuficientes para certeza.',
      impactoSiNo: 'Prioridades pueden estar bien intencionadas y mal calibradas.',
      accion: 'Alimentar Centro de Ingesta con texto/archivo en cada bloque de trabajo.',
    });
  }
  if (!items.length) {
    items.push({
      mensajeCorto: 'Señal mínima OK — no relajar presión de cierre.',
      vacio: 'Sin vacío crítico declarado en este corte.',
      impactoSiNo: 'El riesgo pasa a ser complacencia, no ceguera.',
      accion: 'Un cierre con cobro y un avance comercial explícito hoy.',
    });
  }
  return items.slice(0, 7);
}

/** @deprecated usar buildAutoalimentacionRich; se mantiene para compat. */
export function buildAutoalimentacionPrompts(unified) {
  return buildAutoalimentacionRich(unified).map((x) => x.mensajeCorto);
}

/** Alertas de supervisión total (lectura). */
export function buildJarvisSupervisionAlerts(unified) {
  const u = unified || {};
  const fi = u.jarvisFlowIntelligence || {};
  const flow = fi.flowState || {};
  const econ = fi.economicState || {};
  const meta = flow._meta || {};
  const op = u.jarvisOperador || {};
  const hidden = op.hiddenErrors || { items: [] };

  /** @type {{ titulo: string, detalle?: string, severidad: string }[]} */
  const a = [];

  if ((meta.openCount || 0) > 0 && flow.ritmo === 'bajo') {
    a.push({
      titulo: 'Cola OT abierta con ritmo de cierre bajo',
      detalle: `${meta.openCount} abiertas · tiempo muerto medio ~${meta.avgIdleOpenDays ?? '—'} d`,
      severidad: 'warning',
    });
  }
  const pendMail =
    (u.outlookFollowUp?.pendingByOwner?.Romina?.length || 0) +
    (u.outlookFollowUp?.pendingByOwner?.Gery?.length || 0);
  if (pendMail >= 4) {
    a.push({
      titulo: 'Correos / cola interna sin cerrar',
      detalle: `~${pendMail} ítems con dueño en seguimiento`,
      severidad: 'warning',
    });
  }
  const stale = econ.oportunidadNoTomada || 0;
  if (stale > 0) {
    a.push({
      titulo: 'Oportunidades sin gestión (alta prioridad >72h)',
      detalle: `${stale} en ventana crítica`,
      severidad: 'critical',
    });
  }
  for (const it of (hidden.items || []).slice(0, 4)) {
    a.push({ titulo: it.titulo, detalle: it.detalle, severidad: it.severidad || 'info' });
  }
  if (flow.inactividadCritica) {
    a.push({ titulo: 'Inactividad crítica en OT abiertas', severidad: 'critical' });
  }
  return a.slice(0, 10);
}

/** Motor de expansión — acciones concretas. */
export function buildJarvisExpansionActions(unified) {
  const u = unified || {};
  const disc = u.jarvisOperador?.opportunityDiscovery?.oportunidades || [];
  const comm = u.jarvisCommercialIntelAdvanced || {};
  const zonas = comm.zonasSubexplotadas || [];

  /** @type {string[]} */
  const lines = [];
  for (const z of zonas.slice(0, 2)) {
    if (z?.comuna) lines.push(`Expansión: ronda comercial en ${z.comuna} (baja penetración vs potencial).`);
  }
  for (const d of disc.filter((x) => x.tipo === 'contrato_recurrencia').slice(0, 2)) {
    lines.push(`Contrato: ${d.accionSugerida || d.titulo}`);
  }
  for (const d of disc.filter((x) => x.tipo === 'expansion_zona').slice(0, 1)) {
    lines.push(d.accionSugerida || d.titulo);
  }
  if (!lines.length) {
    lines.push('Definir 1 cliente actual “explotable” y agendar llamada de expansión + propuesta estándar.');
  }
  return lines.slice(0, 5);
}

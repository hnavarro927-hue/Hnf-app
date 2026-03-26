/**
 * Jarvis — cerebro operativo vivo: REALIDAD / IMPACTO / DECISIÓN / CONSECUENCIA + presión directa.
 * Modo agente: busca vacíos, no normaliza el silencio, empuja ingesta.
 */

import { buildAutoalimentacionRich } from './jarvis-active-intake-engine.js';

export const JARVIS_LIVE_BRAIN_VERSION = '2026-03-23';

/**
 * Modo búsqueda: qué falta, por qué importa, cómo cargarlo.
 * @param {object} ctx
 */
function buildModoBusqueda(ctx) {
  const { msgs, opps, ots, docs, openCount, waTieneMensajes } = ctx;
  /** @type {{ falta: string, porQueImporta: string, comoCargarlo: string }[]} */
  const items = [];
  if (!msgs) {
    items.push({
      falta: 'Correo analizado (Outlook / export en sistema)',
      porQueImporta: 'Sin conversaciones indexadas, cuellos de cliente y promesas quedan fuera del cierre diario.',
      comoCargarlo: 'Conectar Outlook cuando exista, o pegar JSON de mensajes / usar Intake Hub “Absorber lote” / Centro de Ingesta.',
    });
  }
  if (!opps) {
    items.push({
      falta: 'Pipeline comercial visible (mínimo 3 oportunidades con dueño)',
      porQueImporta: 'Sin oportunidades no hay palanca de mes: operás a ciegas sobre facturación futura.',
      comoCargarlo: 'Registrar en ERP o cargar al menos 3 oportunidades con monto tentativo y responsable comercial.',
    });
  } else if (opps < 3) {
    items.push({
      falta: 'Densidad de pipeline (subir a ≥3 oportunidades activas)',
      porQueImporta: 'Con menos de tres palancas el riesgo de mes en blanco sube aunque haya trabajo en obra.',
      comoCargarlo: 'Agregar oportunidades desde correo, visitas o renovaciones antes del cierre de semana.',
    });
  }
  if (!ots && !openCount) {
    items.push({
      falta: 'OT o cola operativa en vista',
      porQueImporta: 'Sin OT no hay secuencia técnica ni cobro anclado a hechos.',
      comoCargarlo: 'Activar toggle “Datos operativos”, sincronizar ERP o pegar export mínimo en Centro de Ingesta.',
    });
  }
  if (!docs) {
    items.push({
      falta: 'Documentos técnicos ingestados',
      porQueImporta: 'Cierre y cobro sin evidencia documental = más retrabajo y demora.',
      comoCargarlo: 'Activar ingesta de documentos y empujar cola “aprobado / pendiente envío”.',
    });
  }
  if (!waTieneMensajes) {
    items.push({
      falta: 'WhatsApp operativo trazado (feed o registro en OT)',
      porQueImporta: 'Acuerdos en canal rápido sin registro generan conflictos y fugas de cobro.',
      comoCargarlo: 'Conectar feed cuando exista; mientras tanto volcar acuerdos a notas de OT o Centro de Ingesta.',
    });
  }
  if (!items.length) {
    items.push({
      falta: 'Refresco de señal (correo + comercial en ventana 24–48h)',
      porQueImporta: 'Datos viejos producen decisiones correctas sobre un mundo que ya cambió.',
      comoCargarlo: 'Forzar una pasada de ingesta (correo / archivo) antes de la reunión de cierre.',
    });
  }
  return items.slice(0, 6);
}

/**
 * @param {object} unified - estado con jarvisOperador, jarvisFlowIntelligence, jarvisAlienCore opcional
 * @param {object} [unified.hnfIntegrationStatus] - 'conectado' | 'sin conexión' | etc. (inyectado desde HQ/shell)
 */
export function buildJarvisLiveBrain(unified) {
  const u = unified || {};
  const op = u.jarvisOperador || {};
  const fi = u.jarvisFlowIntelligence || {};
  const alien = u.jarvisAlienCore || {};
  const flow = fi.flowState || {};
  const econ = fi.economicState || {};
  const jd = op.jarvisDecide || {};
  const dec = op.decision || {};
  const ml = op.moneyLeaks || {};
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities.length : 0;
  const ots = Array.isArray(u.planOts) ? u.planOts.length : 0;
  const msgs = Array.isArray(u.outlookFeed?.messages) ? u.outlookFeed.messages.length : 0;
  const docs = Array.isArray(u.technicalDocuments) ? u.technicalDocuments.length : 0;
  const openCount = Number(flow._meta?.openCount ?? 0);
  const integ = u.hnfIntegrationStatus || 'conectado';
  const sinConexion = integ === 'sin conexión';
  const waTieneMensajes = Array.isArray(u.whatsappFeed?.messages) && u.whatsappFeed.messages.length > 0;

  const sistemaCiego = msgs === 0 && opps === 0 && ots === 0 && openCount === 0;
  const entradaMuerta = sistemaCiego;

  let alertaModoAgente = null;
  if (sinConexion && sistemaCiego) {
    alertaModoAgente =
      'Sin conexión al servidor y sin datos locales visibles: doble ceguera. Reconectá o cargá ingesta manual (texto, archivos, imágenes) ahora.';
  } else if (sinConexion) {
    alertaModoAgente =
      'Sin conexión: no hay consolidación de fuentes ERP en vivo. Jarvis sigue en modo agente con escenarios simulados y presión de carga local.';
  } else if (entradaMuerta) {
    alertaModoAgente =
      'El sistema está ciego. No hay datos entrando: 0 correo analizado, 0 oportunidades, 0 OT/cola visible. Eso no es “día tranquilo”, es ausencia de señal.';
  }

  const modoBusqueda = buildModoBusqueda({ msgs, opps, ots, docs, openCount, waTieneMensajes });

  const perdidaSim = Math.round(520_000 + (entradaMuerta ? 280_000 : 0) + (opps < 3 && opps > 0 ? 120_000 : 0));
  /** @type {{ activa: boolean, perdidaOportunidadEstimada: number, riesgoOperativoEstimado: string, decision: string, nota: string } | null} */
  let autoingestaSimulada = null;
  if (sinConexion || sistemaCiego) {
    autoingestaSimulada = {
      activa: true,
      perdidaOportunidadEstimada: perdidaSim,
      riesgoOperativoEstimado: entradaMuerta || sinConexion ? 'alto' : 'medio',
      decision: sinConexion
        ? 'Documentá decisiones en Centro de Ingesta hasta volver online; no congeles el negocio por falta de API.'
        : 'Activar ingesta ya: Outlook (manual si hace falta), export OT, o 3 oportunidades mínimas con dueño.',
      nota: sinConexion
        ? 'Autoingesta simulada: se estima oportunidad perdida y riesgo para no paralizar el comando sin backend.'
        : 'Sin flujo de entrada, las decisiones “óptimas” son teatro: primero cablear datos.',
    };
  }

  const infer = op.jarvisModo === 'inferencial';
  const ritmoBajo = flow.ritmo === 'bajo';
  const bloqueo = Math.round(ml.ingresoBloqueado ?? econ.ingresoBloqueado ?? 0);
  const fuga = Math.round(ml.fugaDinero ?? econ.fugaDinero ?? 0);
  const fr = u.jarvisFrictionPressure || {};
  const cr = fr.capaRealidad || {};

  const realidadParts = [
    alertaModoAgente,
    cr.otAbiertas != null
      ? `Jarvis interviene — capa realidad: ~$${(cr.ingresoBloqueado || 0).toLocaleString('es-CL')} bloqueado · ~$${(cr.fugaDinero || 0).toLocaleString('es-CL')} fuga · ${cr.otAbiertas} OT abiertas · riesgo operativo ${cr.riesgoOperativo || '—'} · señales upsell/nuevos cierres: ${cr.oportunidadUpsell ?? 0}.`
      : null,
    fr.fricciones?.length
      ? `Fricción detectada (${fr.fricciones.length}): modo presión ${fr.modoPresion?.nivel || '—'} — no alcanza con observar.`
      : null,
    infer
      ? 'La operación se está leyendo con huecos: Jarvis completa con hipótesis — no es excusa para posponer carga de datos.'
      : entradaMuerta
        ? null
        : 'Hay señal operativa en datos cargados; el cuello está en ejecución, no en ausencia total de información.',
    `Freno operativo declarado: ${jd.queFrena || dec.focoPrincipal || 'sin focalizar'}.`,
    `Ritmo de cierre: ${flow.ritmo || '—'} · OT abiertas (señal): ${flow._meta?.openCount ?? '—'}.`,
    opps === 0 ? 'Pipeline comercial no visible en sistema: eso define techo de facturación próximo.' : null,
  ].filter(Boolean);

  const realidad = realidadParts.join(' ');

  const impacto = [
    `Dinero en tensión: ~$${bloqueo.toLocaleString('es-CL')} bloqueado · ~$${fuga.toLocaleString('es-CL')} fuga estimada por demora.`,
    jd.riesgoOculto || alien.salidaObligatoria?.riesgoOculto
      ? `Riesgo oculto priorizado: ${(jd.riesgoOculto || alien.salidaObligatoria?.riesgoOculto || '').slice(0, 220)}`
      : 'Riesgo residual: omisión de seguimiento en cola viva.',
  ].join(' ');

  let decision =
    dec.accionInmediata ||
    jd.accionMasDinero ||
    alien.salidaObligatoria?.accionInmediata ||
    'Definí un solo dueño y un solo próximo paso con fecha para el ítem #1 de la cola (cobro u oportunidad).';
  const pushAuto =
    fr.autoacciones?.hacerHoy?.[0] &&
    (fr.modoPresion?.nivel === 'alta' || fr.modoPresion?.nivel === 'media');
  if (pushAuto) {
    decision = `${fr.autoacciones.hacerHoy[0]} · ${decision}`.slice(0, 420);
  }

  let consecuencia =
    'Si no movés la aguja en 48–72h, el sistema vuelve al mismo semáforo con menos margen de maniobra y más ruido interno.';
  if (ml.urgencia === 'critica' || alien.nucleusState === 'critico') {
    consecuencia =
      'Sin acción hoy: se profundiza fuga de ingreso, se acorta tiempo de respuesta al cliente y sube probabilidad de reclamo o reproceso.';
  } else if (!opps && ots > 0) {
    consecuencia =
      'Sin pipeline: trabajás reactivo a punta de OT sin palanca de mes — el estancamiento es predecible, no accidental.';
  } else if (ritmoBajo && (flow._meta?.openCount || 0) > 2) {
    consecuencia =
      'Ritmo bajo con cola abierta: cada día suma costo de oportunidad y desgaste de equipo sin cierre visible.';
  }

  /** @type {string[]} */
  const presionDirecta = [];

  if (fr.modoPresion?.alertaDirecta) presionDirecta.push(fr.modoPresion.alertaDirecta);
  for (const fx of (fr.fricciones || []).slice(0, 4)) {
    presionDirecta.push(
      `${fx.severidad === 'critica' ? 'CRÍTICO: ' : ''}${fx.texto}`
    );
  }

  if (entradaMuerta && !sinConexion) {
    presionDirecta.push(
      'Conectar correo Outlook o cargar correos manualmente (JSON / Centro de Ingesta / Intake Hub). Sin eso, seguís operando en teatro.'
    );
  }
  if (sinConexion) {
    presionDirecta.push(
      'Reconectar backend o, mientras tanto, volcar correo, OT y acuerdos en Centro de Ingesta — el silencio de red no es excusa para cero carga.'
    );
  }
  if (!opps) {
    presionDirecta.push(
      'Falta pipeline comercial. Cargá al menos 3 oportunidades con dueño y monto tentativo — sin eso no hay palanca de mes.'
    );
  } else if (opps < 3) {
    presionDirecta.push(`Tenés ${opps} oportunidad(es): subí a mínimo 3 para que el mes tenga contrapeso comercial real.`);
  }
  if (infer) {
    presionDirecta.push(
      'Operás con inferencia: cada hora sin alimentar correo, OT u oportunidades es decisión tomada a ciegas.'
    );
  }
  if (!msgs && !opps) {
    presionDirecta.push('No hay correos analizados ni oportunidades: el cerebro está razonando sobre silencio — cargá señal en Centro de Ingesta.');
  }
  if (ritmoBajo && (flow._meta?.openCount || 0) >= 3) {
    presionDirecta.push(
      `Ritmo bajo con ${flow._meta.openCount} OT abiertas: la empresa no está “tranquila”, está frenada con trabajo encima.`
    );
  }
  if (alien.erroresSistema?.some((e) => e.severidad === 'critical')) {
    presionDirecta.push('Hay errores operativos críticos en órbita: corregí cierre/cobro o documentación antes de sumar volumen.');
  }
  if (!presionDirecta.length) {
    presionDirecta.push('Mantener presión: un cierre con cobro y un avance comercial explícito hoy — sin negociación interna interminable.');
  }

  const autoalimentacion = buildAutoalimentacionRich(u);

  return {
    version: JARVIS_LIVE_BRAIN_VERSION,
    computedAt: new Date().toISOString(),
    modoAgenteConectado: true,
    hnfIntegrationStatus: integ,
    sistemaCiego: entradaMuerta,
    sinConexionBackend: sinConexion,
    alertaModoAgente,
    modoBusqueda,
    autoingestaSimulada,
    cicloEntrada: {
      flujoRevisado: 'Correo · WhatsApp · OT · archivos/imágenes · manual',
      vaciosDetectados: modoBusqueda.length,
      accionInmediataCiclo:
        autoingestaSimulada?.decision ||
        decision ||
        'Abrir Centro de Ingesta y registrar la siguiente señal disponible en los próximos 30 minutos.',
    },
    mantra:
      'Jarvis no observa: interviene. Presión, fricción y autoacción atadas a dinero y riesgo — lo demás no cuenta.',
    realidad,
    impacto,
    decision,
    consecuencia,
    presionDirecta: presionDirecta.slice(0, 10),
    autoalimentacion,
    intervencion: {
      capaRealidad: cr,
      fricciones: fr.fricciones || [],
      modoPresion: fr.modoPresion || null,
      autoacciones: fr.autoacciones || null,
      reglaDeOro: fr.reglaDeOro || null,
    },
  };
}

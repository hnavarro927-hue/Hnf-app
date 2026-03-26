/**
 * Jarvis Núcleo Alien — estado del negocio como sistema operativo (energía / flujo / expansión / inestabilidad).
 */

export const JARVIS_ALIEN_CORE_VERSION = '2026-03-22';

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const parseTs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const t = new Date(String(raw)).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const hoursSince = (iso) => {
  const t = parseTs(iso);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3600000;
};

function countOportunidadesSinGestion72h(opps) {
  const list = Array.isArray(opps) ? opps : [];
  let n = 0;
  for (const o of list) {
    if (!['pendiente', 'cotizado'].includes(String(o.estado || '').toLowerCase())) continue;
    const h = hoursSince(o.fechaCreacion || o.creadoEn || o.createdAt || o.actualizadoEn);
    if (h != null && h > 72) n += 1;
  }
  return n;
}

function coberturaDatosPct(u) {
  const ot = (Array.isArray(u.planOts) ? u.planOts : []).length;
  const doc = (Array.isArray(u.technicalDocuments) ? u.technicalDocuments : []).length;
  const opp = (Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities : []).length;
  return Math.min(100, Math.round(18 + ot * 4 + doc * 2 + opp * 6));
}

/** Evita lectura pasiva “todo en cero”: el núcleo siempre muestra energía de sistema. */
function saludNucleoMostrada(healthRaw, nucleusState) {
  const h = Number(healthRaw);
  const base = Number.isFinite(h) && h > 0 ? Math.round(h) : 0;
  if (base >= 18) return Math.min(100, base);
  if (nucleusState === 'critico') return 26;
  if (nucleusState === 'presion') return 44;
  return 58;
}

function coberturaMostrada(pct, inferencial) {
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  if (inferencial) return Math.max(p, 28);
  return Math.max(p, 12);
}

function visionExternaSimulada(u, fi, op) {
  const ots = Array.isArray(u.planOts) ? u.planOts : [];
  const zonas = new Set(ots.map((o) => String(o.comuna || o.zona || '').trim()).filter(Boolean));
  const comm = u.jarvisCommercialIntelAdvanced || {};
  const hot = comm.oportunidadesCalientes?.[0];

  /** @type {string[]} */
  const lineas = [];
  if (hot?.cliente) {
    lineas.push(
      `Mercado simulado: perfil similar a ${hot.cliente} suele aceptar upsell de mantenimiento tras 2+ visitas (HNF clima).`
    );
  } else {
    lineas.push(
      'Mercado simulado: en instalaciones clima B2B, el margen suele recuperarse en contratos anuales tras picos reactivos.'
    );
  }
  if (zonas.size >= 3) {
    lineas.push(`Expansión sugerida: ${zonas.size} zonas activas — priorizar la de menor cierre relativo en datos.`);
  } else {
    lineas.push('Expansión sugerida: abrir 1 zona nueva con visita técnica + propuesta estándar (sin esperar pipeline perfecto).');
  }
  const ritmo = fi?.flowState?.ritmo;
  if (ritmo === 'bajo') {
    lineas.push('Presión externa simulada: competencia típica gana por tiempo de respuesta < 24h en emergencias.');
  } else {
    lineas.push('Potencial comercial simulado: bundle “diagnóstico + plan” eleva ticket medio en ~15–25% (heurística sector).');
  }
  if (op?.jarvisModo === 'inferencial') {
    lineas.push('Visión con incertidumbre alta: completar ingesta para bajar error de proyección de ingresos.');
  }
  return lineas.slice(0, 5);
}

/**
 * @param {object} unified - estado post getJarvisUnifiedState (o merge con operador pulse)
 */
export function buildJarvisAlienCore(unified) {
  const u = unified || {};
  const op = u.jarvisOperador || {};
  const fi = u.jarvisFlowIntelligence || {};
  const econ = fi.economicState || {};
  const flow = fi.flowState || {};
  const hs = fi.humanSignals || {};
  const ml = op.moneyLeaks || {};
  const hidden = op.hiddenErrors || { items: [] };
  const disc = op.opportunityDiscovery || { oportunidades: [] };
  const evo = u.jarvisEvolution || {};
  const jd = op.jarvisDecide || {};
  const dec = op.decision || {};

  const urg = ml.urgencia || 'media';
  const critErr = (hidden.items || []).filter((e) => e.severidad === 'critical').length;
  const health = Number(u.systemHealth ?? 0);

  let nucleusState = 'estable';
  if (urg === 'critica' || critErr >= 2 || health < 28) nucleusState = 'critico';
  else if (urg === 'alta' || op.jarvisModo === 'inferencial' || flow.ritmo === 'bajo' || critErr >= 1) {
    nucleusState = 'presion';
  }

  const fp = u.jarvisFrictionPressure;
  if (fp?.modoPresion?.activo) {
    const fn = fp.modoPresion.nivel;
    const critN = (fp.fricciones || []).filter((x) => x.severidad === 'critica').length;
    if (fn === 'alta') {
      if (nucleusState === 'estable') nucleusState = 'presion';
      if (nucleusState === 'presion' && (critN >= 2 || urg === 'critica')) nucleusState = 'critico';
    } else if (fn === 'media' && nucleusState === 'estable' && (fp.fricciones || []).length >= 2) {
      nucleusState = 'presion';
    }
  }

  const nucleusLabel =
    nucleusState === 'critico'
      ? 'CRÍTICO — núcleo inestable'
      : nucleusState === 'presion'
        ? 'EN PRESIÓN — energía retenida'
        : 'ESTABLE — flujo sostenido';

  const potMes = roundMoney(u.commercialSummary?.potencialTotalMes ?? 0);
  const stale72 = countOportunidadesSinGestion72h(u.commercialOpportunities);
  const oportunidadesMotor = (disc.oportunidades || []).slice(0, 5).map((x) => ({
    titulo: x.titulo,
    valorEstimado: x.valorEstimado,
    probabilidad: x.probabilidad,
    accion: x.accionSugerida,
  }));

  const coberturaRaw = coberturaDatosPct(u);
  const saludM = saludNucleoMostrada(health, nucleusState);
  const coberturaM = coberturaMostrada(coberturaRaw, op.jarvisModo === 'inferencial');

  const sinCobroRegistrado = (hidden.items || []).some((i) => i.codigo === 'CIERRE_SIN_FACTURACION');

  const orbitas = {
    dinero: {
      ingresoProyectado: roundMoney(econ.ingresoProyectadoHoy ?? 0),
      ingresoBloqueado: roundMoney(ml.ingresoBloqueado ?? econ.ingresoBloqueado ?? 0),
      fugaDinero: roundMoney(ml.fugaDinero ?? econ.fugaDinero ?? 0),
      potencialMensual: potMes,
    },
    riesgo: {
      operativo: flow.inactividadCritica
        ? 'Inactividad crítica en cola abierta'
        : `Ritmo ${flow.ritmo || '—'} · saturación ${flow.saturacion ?? '—'}% · tiempo muerto medio ~${flow._meta?.avgIdleOpenDays ?? '—'} días (OT abiertas)`,
      comercial: `${!(u.commercialOpportunities || []).length
        ? 'Pipeline comercial vacío o no ingestado'
        : stale72 > 0
          ? `${stale72} oportunidad(es) sin gestión >72h`
          : 'Pipeline visible sin alertas de estancamiento >72h'}${sinCobroRegistrado ? ' · Trabajo ejecutado sin cobro reflejado (revisar facturación)' : ''}`,
      dependenciaPersonas: hs.dependenciaCritica
        ? `Dependencia: ${hs.dependenciaCritica}`
        : 'Sin dependencia crítica explícita',
    },
    oportunidad: {
      clientesActivosSinUpsell: (op.opportunityEngine?._detalle?.clientesActivosSinUpsell || []).length,
      zonasSinActividadHint: (op.opportunityEngine?._detalle?.zonas || []).slice(0, 2).map((z) => z.comuna || z),
      serviciosRepetidosContrato: (disc.oportunidades || []).filter((x) => x.tipo === 'contrato_recurrencia').length,
      oportunidadesSinGestion72h: stale72,
      motor: oportunidadesMotor,
    },
    sistema: {
      saludGeneral: saludM,
      saludRaw: Number.isFinite(Number(health)) ? Math.round(Number(health)) : null,
      aprendizaje: op.jarvisModo === 'inferencial' ? 'Heurístico activo (inferencia)' : 'Aprendizaje guiado por datos operativos',
      coberturaDatosPct: coberturaM,
      coberturaRaw: coberturaRaw,
      evolucion: (evo.sugerencias || [])[0] || 'Evolución estable en este corte.',
    },
  };

  const erroresSistema = (hidden.items || []).map((e) => ({
    codigo: e.codigo,
    titulo: e.titulo,
    detalle: e.detalle,
    severidad: e.severidad,
  }));

  const decision = {
    focoPrincipal:
      dec.focoPrincipal ||
      jd.queFrena ||
      fi.jarvisDecisionLayer?.focoPrincipal ||
      'Priorizar un solo desbloqueo de dinero: cerrar facturación o avanzar la oportunidad más caliente.',
    accionInmediata:
      dec.accionInmediata ||
      jd.accionMasDinero ||
      fi.jarvisDecisionLayer?.accionRecomendada ||
      'Definir dueño y próximo paso con fecha para la OT u oportunidad #1 de la cola.',
    impactoEsperado:
      dec.impacto ||
      fi.jarvisDecisionLayer?.impactoEsperado ||
      'Recuperación de flujo de caja y reducción de riesgo operativo en 24–72h si se ejecuta.',
    urgenciaReal: dec.prioridadReal || ml.urgencia || op.urgencyEngine?.nivel || 'media',
  };

  const ue = op.urgencyEngine || {};
  const RAZ_ES = {
    ritmo_operativo_bajo: 'Ritmo operativo bajo — el núcleo sube presión',
    modo_inferencial: 'Inferencia activa — decidir con heurística hasta completar datos',
    pipeline_visible_vacio: 'Pipeline comercial vacío o invisible',
    backlog_oculto_alto: 'Backlog / pendientes ocultos elevados',
    errores_criticos: 'Errores críticos detectados en órbita',
    presión_base_operador: 'Línea base del operador — mantener dirección',
  };
  const razonesCodigo =
    Array.isArray(ue.razones) && ue.razones.length ? ue.razones : ['presión_base_operador'];
  let presionNivel = ue.nivel || ml.urgencia || 'media';
  let presionMensaje =
    ue.nivel === 'critica' || ml.urgencia === 'critica'
      ? 'Presión máxima: el núcleo exige decisión hoy.'
      : ue.nivel === 'alta' || ml.urgencia === 'alta'
        ? 'Presión alta: acotar agenda a cierre + cobro + pipeline.'
        : 'Presión moderada: mantener ritmo y eliminar un cuello de botella.';
  if (fp?.modoPresion?.alertaDirecta) {
    presionMensaje = `${fp.modoPresion.alertaDirecta} ${presionMensaje}`.trim();
  }
  if (fp?.modoPresion?.nivel === 'alta' && presionNivel !== 'critica') presionNivel = 'alta';
  if (fp?.modoPresion?.nivel === 'media' && presionNivel === 'media' && (fp.fricciones || []).length)
    presionMensaje = `${presionMensaje} · Fricción detectada: intervení hoy.`;

  const presion = {
    nivel: presionNivel,
    razones: razonesCodigo,
    razonesLegibles: razonesCodigo.map((r) => RAZ_ES[r] || r),
    mensaje: presionMensaje,
    modoPresionJarvis: fp?.modoPresion || null,
  };

  const visionExterna = visionExternaSimulada(u, fi, op);

  const salidaObligatoria = {
    estadoNucleo: nucleusLabel,
    dineroEnJuego: `Bloqueado ~$${Math.round(orbitas.dinero.ingresoBloqueado).toLocaleString('es-CL')} · fuga ~$${Math.round(orbitas.dinero.fugaDinero).toLocaleString('es-CL')} · proyección hoy ~$${Math.round(orbitas.dinero.ingresoProyectado).toLocaleString('es-CL')}`,
    oportunidadDetectada:
      op.opportunityEngine?.oportunidadDetectada ||
      disc.oportunidades?.[0]?.titulo ||
      'Oportunidad latente: cargar pipeline o ejecutar upsell sobre cliente con OT reciente.',
    riesgoOculto:
      jd.riesgoOculto ||
      erroresSistema[0]?.titulo ||
      'Riesgo de ceguera operativa: datos incompletos o cola sin dueño explícito.',
    accionInmediata: decision.accionInmediata,
  };

  return {
    version: JARVIS_ALIEN_CORE_VERSION,
    computedAt: new Date().toISOString(),
    mantra: 'Dinero = energía · OT = flujo · Clientes = expansión · Riesgo = inestabilidad',
    nucleusState,
    nucleusLabel,
    orbitas,
    decision,
    presion,
    erroresSistema,
    visionExterna,
    salidaObligatoria,
    meta: {
      opportunityStale72h: stale72,
      frictionPressureNivel: fp?.modoPresion?.nivel || null,
      frictionPressureIntensidad: fp?.modoPresion?.intensidadNucleo ?? null,
    },
  };
}

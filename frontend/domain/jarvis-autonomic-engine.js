/**
 * HNF Jarvis — motor autónomo (MAPE: Monitor → Analyze → Plan → Execute → Memory opcional).
 * Los módulos (Vault, Outlook, OT, etc.) son sensores; este motor integra señales sin UI.
 */

import { detectInternalPending } from './outlook-intelligence.js';
import { groupHistoricalByMonth } from './historical-vault-intelligence.js';
import { getJarvisRecurringPatterns, rememberAutonomicCycle } from './jarvis-memory.js';

export const JARVIS_AUTONOMIC_VERSION = '2026-03-23';

const pad2 = (n) => String(n).padStart(2, '0');

const hoursBetween = (fromIso, toIso = new Date().toISOString()) => {
  const a = new Date(fromIso || 0).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 3600000;
};

const isOtClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

/**
 * @param {object} unifiedBase - Resultado de assembleJarvisUnifiedBase (sin autonomicState).
 */
export function buildMonitorSnapshot(unifiedBase) {
  const u = unifiedBase || {};
  const messages = Array.isArray(u.outlookFeed?.messages) ? u.outlookFeed.messages : [];
  const delayAlerts = u.outlookFollowUp?.delayAlerts || [];
  const planOts = u.planOts || [];
  const otsClima = planOts.filter(isOtClima);
  const docs = u.technicalDocuments || [];
  const opps = u.commercialOpportunities || [];
  const vaultRecords = u.historicalVault?.records || [];

  const pendientes24h = delayAlerts.filter(
    (a) => a.code === 'OUT_PEND_24H' || (a.ageHours != null && a.ageHours >= 24)
  ).length;
  const criticos4h = delayAlerts.filter((a) => a.code === 'OUT_CRITICO_4H' || a.severity === 'critical').length;

  const aprobNoEnv = docs.filter((d) => d.estadoDocumento === 'aprobado' && !d.enviadoClienteEn).length;
  const observados = docs.filter((d) => d.estadoDocumento === 'observado').length;
  const enRevision = docs.filter((d) => d.estadoDocumento === 'en_revision').length;

  const opPendienteSinCotiz = opps.filter(
    (o) => String(o.estado) === 'pendiente' && !roundMoney(o.estimacionMonto)
  ).length;
  const opSeguimientoViejo = opps.filter((o) => {
    if (!['pendiente', 'cotizado'].includes(String(o.estado))) return false;
    const h = hoursBetween(o.actualizadoEn || o.creadoEn || o.createdAt);
    return h != null && h > 72;
  }).length;

  const otAbiertas = otsClima.filter((o) => o.estado !== 'terminado').length;
  const otIncompleta = otsClima.filter(
    (o) => o.estado !== 'terminado' && (!o.equipos?.length || !String(o.visitaTexto || '').trim())
  ).length;

  const calSobrecarga = (u.operationalCalendarAlerts || []).filter((a) => a.code === 'CAL_TEC_SOBRECARGA').length;

  const rominaPend = u.outlookFollowUp?.pendingByOwner?.Romina?.length ?? 0;
  const geryPend = u.outlookFollowUp?.pendingByOwner?.Gery?.length ?? 0;

  return {
    version: JARVIS_AUTONOMIC_VERSION,
    computedAt: new Date().toISOString(),
    outlook: {
      messageCount: messages.length,
      delayAlertCount: delayAlerts.length,
      pendientes24h,
      criticos4h,
      rominaPendientes: rominaPend,
      geryPendientes: geryPend,
    },
    documents: {
      aprobadosSinEnvio: aprobNoEnv,
      observados,
      enRevision,
    },
    commercial: {
      oportunidadesTotal: opps.length,
      pendienteSinCotizacion: opPendienteSinCotiz,
      seguimientoEstancado: opSeguimientoViejo,
      potencialMes: u.commercialSummary?.potencialTotalMes ?? 0,
      urgentesMes: u.commercialSummary?.urgentesPendientesMes ?? 0,
      countMes: u.commercialSummary?.countMes ?? 0,
    },
    operation: {
      otAbiertas,
      otIncompletasEstimadas: otIncompleta,
      calendarioSobrecarga: calSobrecarga,
    },
    vault: {
      recordCount: vaultRecords.length,
      patternCount: (u.historicalPatterns || []).length,
      alertCount: (u.historicalAlerts || []).length,
    },
    intel: {
      critQueue: (u.intelBrief?.executionQueue || []).filter((i) => i.tipo === 'CRITICO').length,
      issuesTotal: (u.intelBrief?.issues || []).length,
    },
  };
}

/**
 * Fallas atribuibles a proceso interno / datos / ownership.
 * @param {object} unifiedBase
 */
export function detectInternalFailures(unifiedBase) {
  const u = unifiedBase || {};
  const failures = [];
  const push = (f) => failures.push(f);

  const messages = Array.isArray(u.outlookFeed?.messages) ? u.outlookFeed.messages : [];
  const ctx = { technicalDocuments: u.technicalDocuments || [], planOts: u.planOts || [] };

  for (const m of messages) {
    const pend = detectInternalPending(m, ctx);
    for (const p of pend) {
      push({
        code: p.code || 'MAIL_INTERNO',
        severity: p.severidad === 'alta' ? 'critical' : p.severidad === 'media' ? 'warning' : 'info',
        title: p.texto || p.code,
        detail: `${m.subject || m.id || '—'} · owner ${m.internalOwner || '—'}`,
        nav: { view: 'jarvis-intake' },
        owner: m.internalOwner,
      });
    }
  }

  const geryStall = messages.filter(
    (m) =>
      m.internalOwner === 'Gery' &&
      m.moduleHint === 'comercial' &&
      m.status === 'seguimiento' &&
      hoursBetween(m.lastActivityAt || m.receivedAt) != null &&
      hoursBetween(m.lastActivityAt || m.receivedAt) > 36
  );
  if (geryStall.length) {
    push({
      code: 'FAIL_GERY_SIN_CONTINUIDAD',
      severity: 'warning',
      title: 'Gery: solicitudes comerciales sin continuidad >36h',
      detail: `${geryStall.length} hilo(s) en seguimiento.`,
      nav: { view: 'jarvis-intake' },
      owner: 'Gery',
    });
  }

  const rominaStall = messages.filter(
    (m) =>
      m.internalOwner === 'Romina' &&
      m.status !== 'cerrado' &&
      hoursBetween(m.receivedAt) != null &&
      hoursBetween(m.receivedAt) > 24
  );
  if (rominaStall.length >= 2) {
    push({
      code: 'FAIL_ROMINA_COLA',
      severity: 'warning',
      title: 'Romina: cola de seguimientos >24h',
      detail: `${rominaStall.length} mensaje(s) sin cerrar.`,
      nav: { view: 'jarvis-intake' },
      owner: 'Romina',
    });
  }

  const docs = u.technicalDocuments || [];
  const aprobNoEnv = docs.filter((d) => d.estadoDocumento === 'aprobado' && !d.enviadoClienteEn);
  if (aprobNoEnv.length) {
    push({
      code: 'FAIL_DOC_APROB_SIN_ENVIO',
      severity: 'info',
      title: 'Documento aprobado sin envío al cliente',
      detail: `${aprobNoEnv.length} informe(s) en ERP.`,
      nav: { view: 'technical-documents' },
    });
  }

  const planOts = u.planOts || [];
  const otsClima = planOts.filter(isOtClima);
  const incompletas = otsClima.filter(
    (o) => o.estado !== 'terminado' && (!o.equipos?.length || !String(o.visitaTexto || '').trim())
  );
  if (incompletas.length >= 2) {
    push({
      code: 'FAIL_OT_INCOMPLETA',
      severity: 'warning',
      title: 'OT abiertas con ficha incompleta (equipos / visita)',
      detail: `${incompletas.length} caso(s).`,
      nav: { view: 'clima' },
    });
  }

  const opps = u.commercialOpportunities || [];
  const sinCotizar = opps.filter((o) => String(o.estado) === 'pendiente' && !roundMoney(o.estimacionMonto));
  if (sinCotizar.length >= 3) {
    push({
      code: 'FAIL_OP_SIN_COTIZ',
      severity: 'info',
      title: 'Oportunidades pendientes sin monto estimado',
      detail: `${sinCotizar.length} registro(s).`,
      nav: { view: 'oportunidades' },
    });
  }

  const vaultRecords = u.historicalVault?.records || [];
  const byMonth = groupHistoricalByMonth(vaultRecords);
  const now = new Date();
  const last3 = [];
  for (let i = 0; i < 3; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last3.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }
  const emptyVaultMonths = last3.filter((pm) => !byMonth[pm] || byMonth[pm].length === 0);
  if (emptyVaultMonths.length >= 2 && vaultRecords.length < 5) {
    push({
      code: 'FAIL_VAULT_SPARSE',
      severity: 'info',
      title: 'Poca memoria histórica en meses recientes',
      detail: `Meses con vacío o muy pocos eventos: ${emptyVaultMonths.join(', ')}.`,
      nav: { view: 'jarvis-vault' },
    });
  }

  const dupHashes = new Map();
  for (const r of vaultRecords) {
    const h = r.hash || '';
    if (!h) continue;
    dupHashes.set(h, (dupHashes.get(h) || 0) + 1);
  }
  const dupN = [...dupHashes.values()].filter((c) => c > 1).length;
  if (dupN >= 2) {
    push({
      code: 'FAIL_VAULT_DUPLICATES',
      severity: 'info',
      title: 'Posibles duplicados en Historical Vault (hash repetido)',
      detail: `${dupN} grupo(s) de hash repetido.`,
      nav: { view: 'jarvis-vault' },
    });
  }

  return { version: JARVIS_AUTONOMIC_VERSION, failures: failures.slice(0, 35) };
}

/**
 * @param {ReturnType<typeof buildMonitorSnapshot>} monitor
 * @param {object} unifiedBase
 */
export function analyzeSystemState(monitor, unifiedBase = {}) {
  const findings = [];
  const push = (f) => findings.push(f);

  if (monitor.outlook.pendientes24h > 0) {
    push({
      code: 'ANA_PEND_24H',
      severity: monitor.outlook.pendientes24h >= 4 ? 'warning' : 'info',
      title: 'Pendientes internos >24h en correo',
      detail: `${monitor.outlook.pendientes24h} alerta(s) en ventana.`,
      metric: monitor.outlook.pendientes24h,
    });
  }
  if (monitor.outlook.criticos4h > 0) {
    push({
      code: 'ANA_CRIT_4H',
      severity: 'critical',
      title: 'Correos críticos sin gestión >4h',
      detail: `${monitor.outlook.criticos4h} caso(s).`,
      metric: monitor.outlook.criticos4h,
    });
  }
  if (monitor.documents.aprobadosSinEnvio > 0) {
    push({
      code: 'ANA_DOC_NO_ENV',
      severity: 'warning',
      title: 'Informes aprobados sin envío',
      detail: `${monitor.documents.aprobadosSinEnvio} documento(s).`,
      metric: monitor.documents.aprobadosSinEnvio,
    });
  }
  if (monitor.documents.observados >= 3) {
    push({
      code: 'ANA_DOC_OBS_COLA',
      severity: 'warning',
      title: 'Cola alta de documentos observados',
      detail: `${monitor.documents.observados} en estado observado.`,
      metric: monitor.documents.observados,
    });
  }
  if (monitor.commercial.seguimientoEstancado > 0) {
    push({
      code: 'ANA_OP_STALL',
      severity: 'warning',
      title: 'Oportunidades sin movimiento >72h',
      detail: `${monitor.commercial.seguimientoEstancado} oportunidad(es).`,
      metric: monitor.commercial.seguimientoEstancado,
    });
  }
  if (monitor.commercial.countMes === 0 && monitor.documents.enRevision + monitor.documents.observados >= 2) {
    push({
      code: 'ANA_BAJA_CONV_COM',
      severity: 'info',
      title: 'Baja conversión comercial del mes vs trabajo documental',
      detail: 'Pocas oportunidades nuevas con documentos en flujo.',
    });
  }
  if (monitor.operation.calendarioSobrecarga > 0) {
    push({
      code: 'ANA_CAL_SOBRE',
      severity: 'warning',
      title: 'Sobrecarga técnica en calendario',
      detail: `${monitor.operation.calendarioSobrecarga} alerta(s) CAL_TEC_SOBRECARGA.`,
      metric: monitor.operation.calendarioSobrecarga,
    });
  }
  if (monitor.vault.patternCount >= 2) {
    push({
      code: 'ANA_VAULT_PATRON',
      severity: 'info',
      title: 'Patrones repetidos en Historical Vault',
      detail: `${monitor.vault.patternCount} patrón(es) detectado(s) en archivo.`,
      metric: monitor.vault.patternCount,
    });
  }
  if (monitor.vault.alertCount >= 2) {
    push({
      code: 'ANA_VAULT_ALERT',
      severity: 'info',
      title: 'Alertas de memoria histórica activas',
      detail: `${monitor.vault.alertCount} alerta(s) del vault.`,
      metric: monitor.vault.alertCount,
    });
  }
  if (monitor.intel.critQueue >= 3) {
    push({
      code: 'ANA_INTEL_CRIT_COLA',
      severity: 'critical',
      title: 'Cola ejecutable Intel con varios ítems críticos',
      detail: `${monitor.intel.critQueue} ítem(s) CRITICO.`,
      metric: monitor.intel.critQueue,
    });
  }

  const recurring = getJarvisRecurringPatterns();
  if ((recurring.cuellosRepetidos || []).length >= 2) {
    push({
      code: 'ANA_MEM_RECURRENTE',
      severity: 'info',
      title: 'Errores / bloqueos recurrentes en memoria Jarvis',
      detail: 'Varias frases de bloqueo repetidas en ventana reciente.',
    });
  }

  return { version: JARVIS_AUTONOMIC_VERSION, findings, monitorSummary: monitor };
}

function bucketForFailure(f) {
  if (f.code?.includes('GERY') || f.code === 'FAIL_OP_SIN_COTIZ') return 'escalar_a_hernan';
  if (f.code?.includes('ROMINA') || f.code?.includes('DOC') || f.code === 'FAIL_OT_INCOMPLETA')
    return 'escalar_a_lyn';
  return 'revisar_hoy';
}

/**
 * @param {ReturnType<typeof analyzeSystemState>} analysis
 * @param {ReturnType<typeof detectInternalFailures>} failurePack
 */
export function buildActionPlan(analysis, failurePack) {
  /** @type {Record<string, object[]>} */
  const buckets = {
    ejecutar_hoy: [],
    revisar_hoy: [],
    aprobar_hoy: [],
    cobrar_hoy: [],
    vender_hoy: [],
    escalar_a_hernan: [],
    escalar_a_lyn: [],
  };

  let seq = 0;
  const nextId = () => `AUTO-${Date.now().toString(36)}-${(seq += 1)}`;

  const add = (bucket, row) => {
    if (!buckets[bucket]) buckets[bucket] = [];
    buckets[bucket].push(row);
  };

  for (const f of analysis.findings) {
    let bucket = 'revisar_hoy';
    if (f.code === 'ANA_CRIT_4H' || f.code === 'ANA_INTEL_CRIT_COLA') bucket = 'ejecutar_hoy';
    if (f.code === 'ANA_DOC_NO_ENV' || f.code === 'ANA_DOC_OBS_COLA') bucket = 'revisar_hoy';
    if (f.code === 'ANA_OP_STALL' || f.code === 'ANA_BAJA_CONV_COM') bucket = 'vender_hoy';
    if (f.code === 'ANA_CAL_SOBRE') bucket = 'ejecutar_hoy';
    add(bucket, {
      id: nextId(),
      titulo: f.title,
      motivo: f.detail,
      prioridad: f.severity === 'critical' ? 1 : f.severity === 'warning' ? 2 : 3,
      origen: 'autonomic_analyze',
      codigo: f.code,
      nav: inferNavForFinding(f.code),
    });
  }

  for (const fail of failurePack.failures || []) {
    const bucket = bucketForFailure(fail);
    add(bucket, {
      id: nextId(),
      titulo: fail.title,
      motivo: fail.detail || '',
      prioridad: fail.severity === 'critical' ? 1 : 2,
      origen: 'autonomic_internal_failure',
      codigo: fail.code,
      nav: fail.nav || { view: 'jarvis-hq' },
    });
  }

  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => (a.prioridad || 9) - (b.prioridad || 9));
  }

  return { version: JARVIS_AUTONOMIC_VERSION, buckets };
}

function inferNavForFinding(code) {
  const map = {
    ANA_PEND_24H: { view: 'jarvis-intake' },
    ANA_CRIT_4H: { view: 'jarvis-intake' },
    ANA_DOC_NO_ENV: { view: 'technical-documents' },
    ANA_DOC_OBS_COLA: { view: 'technical-documents' },
    ANA_OP_STALL: { view: 'oportunidades' },
    ANA_BAJA_CONV_COM: { view: 'oportunidades' },
    ANA_CAL_SOBRE: { view: 'planificacion' },
    ANA_VAULT_PATRON: { view: 'jarvis-vault' },
    ANA_VAULT_ALERT: { view: 'jarvis-vault' },
    ANA_INTEL_CRIT_COLA: { view: 'operacion-control' },
    ANA_MEM_RECURRENTE: { view: 'jarvis-hq' },
  };
  return map[code] || { view: 'jarvis-hq' };
}

function computeScores(analysis, failures, unifiedBase) {
  let health = 100;
  for (const f of analysis.findings) {
    if (f.severity === 'critical') health -= 14;
    else if (f.severity === 'warning') health -= 7;
    else health -= 3;
  }
  for (const fail of failures.failures || []) {
    if (fail.severity === 'critical') health -= 10;
    else if (fail.severity === 'warning') health -= 5;
    else health -= 2;
  }
  health = Math.max(0, Math.min(100, Math.round(health)));

  const critN =
    analysis.findings.filter((f) => f.severity === 'critical').length +
    (failures.failures || []).filter((f) => f.severity === 'critical').length;

  let riskLevel = 'low';
  if (critN >= 3 || health < 38) riskLevel = 'critical';
  else if (critN >= 1 || health < 58) riskLevel = 'high';
  else if (health < 78) riskLevel = 'medium';

  const pot = unifiedBase.commercialSummary?.potencialTotalMes || 0;
  const urg = unifiedBase.commercialSummary?.urgentesPendientesMes || 0;
  const opportunityScore = Math.min(
    100,
    Math.round(28 + Math.min(pot / 800, 42) + urg * 10 + (unifiedBase.historicalPatterns?.length || 0) * 2)
  );

  const friction =
    (unifiedBase.technicalDocumentAlerts?.length || 0) +
    (unifiedBase.outlookFollowUp?.delayAlerts?.length || 0) +
    (analysis.findings?.length || 0);
  const efficiencyScore = Math.max(0, Math.min(100, health - Math.min(friction * 2, 40)));

  return {
    systemHealth: health,
    riskLevel,
    opportunityScore,
    efficiencyScore,
  };
}

/**
 * @param {ReturnType<typeof buildActionPlan>} plan
 * @param {object} unifiedBase
 */
export function executeAutonomicPlan(plan, unifiedBase) {
  const alerts = [];
  const tasks = [];
  const priorities = [];

  const ingestBucket = (name) => {
    for (const item of plan.buckets[name] || []) {
      const alert = {
        code: item.codigo,
        severity: item.prioridad <= 1 ? 'critical' : item.prioridad === 2 ? 'warning' : 'info',
        title: item.titulo,
        detail: item.motivo,
        nav: item.nav,
        bucket: name,
      };
      alerts.push(alert);
      tasks.push({
        id: item.id,
        bucket: name,
        titulo: item.titulo,
        modulo: 'jarvis_autonomic',
        prioridad: item.prioridad,
        motivo: item.motivo,
        nav: item.nav,
        origen: item.origen,
      });
      priorities.push({ score: 100 - (item.prioridad || 3) * 20, taskId: item.id, bucket: name });
    }
  };

  for (const b of [
    'ejecutar_hoy',
    'escalar_a_hernan',
    'escalar_a_lyn',
    'revisar_hoy',
    'vender_hoy',
    'aprobar_hoy',
    'cobrar_hoy',
  ]) {
    ingestBucket(b);
  }

  priorities.sort((a, b) => b.score - a.score);

  return {
    version: JARVIS_AUTONOMIC_VERSION,
    alerts: alerts.slice(0, 40),
    tasks: tasks.slice(0, 40),
    priorities: priorities.slice(0, 25),
    navigationHints: [...new Set(tasks.map((t) => t.nav?.view).filter(Boolean))].map((view) => ({ view })),
  };
}

export function buildSelfReport(payload) {
  const scores = payload.scores || {};
  const analysis = payload.analysis || {};
  const failures = payload.failures || {};
  const executed = payload.executed || {};
  const lines = [
    'Estado sistema HNF (Jarvis autonomic):',
    `- Salud estimada: ${scores.systemHealth ?? '—'}/100`,
    `- Riesgo operativo: ${scores.riskLevel ?? '—'}`,
    `- Eficiencia proceso: ${scores.efficiencyScore ?? '—'}/100`,
    `- Oportunidad comercial (score): ${scores.opportunityScore ?? '—'}/100`,
    `- Hallazgos análisis: ${(analysis.findings || []).length}`,
    `- Fallas internas: ${(failures.failures || []).length}`,
    `- Tareas generadas (execute): ${(executed.tasks || []).length}`,
    `- Alertas sintéticas: ${(executed.alerts || []).length}`,
  ];
  return lines.join('\n');
}

export function suggestSystemImprovements(analysis, failures, unifiedBase) {
  const out = [];
  const findings = analysis.findings || [];
  if (findings.some((f) => f.code === 'ANA_PEND_24H')) {
    out.push('Automatizar recordatorio diario de correos >24h sin owner o estado actualizado en Intake Hub.');
  }
  if (findings.some((f) => f.code === 'ANA_DOC_NO_ENV')) {
    out.push('Checklist post-aprobación: envío al cliente + marca en ERP en el mismo bloque de tiempo Lyn.');
  }
  if (findings.some((f) => f.code === 'ANA_OP_STALL')) {
    out.push('SLA comercial: tocar oportunidades cotizadas/pendientes cada 48h con estado explícito en pipeline.');
  }
  if (findings.some((f) => f.code === 'ANA_CAL_SOBRE')) {
    out.push('Redistribuir visitas en planificación cuando CAL_TEC_SOBRECARGA aparezca más de una vez por semana.');
  }
  if ((failures.failures || []).some((f) => f.code === 'FAIL_VAULT_SPARSE')) {
    out.push('Rutina mensual de absorción Historical Vault (carpeta o JSON) para no operar a ciegas en cuenta clave.');
  }
  if ((unifiedBase.autopilot?.pendingApprovals || []).length > 5) {
    out.push('Revisar cola Autopilot en bloque: muchas aprobaciones pendientes degradan eficiencia percibida.');
  }
  if (!out.length) {
    out.push('Mantener ritmo: sin mejoras críticas sugeridas en este ciclo — seguir monitoreo MAPE.');
  }
  return { version: JARVIS_AUTONOMIC_VERSION, suggestions: out };
}

/**
 * Ciclo MAPE completo sobre base unificada (sin campos autonomicState previos).
 */
export function computeJarvisAutonomicEnvelope(unifiedBase) {
  const monitor = buildMonitorSnapshot(unifiedBase);
  const failures = detectInternalFailures(unifiedBase);
  const analysis = analyzeSystemState(monitor, unifiedBase);
  const plan = buildActionPlan(analysis, failures);
  const executed = executeAutonomicPlan(plan, unifiedBase);
  const scores = computeScores(analysis, failures, unifiedBase);
  const improvements = suggestSystemImprovements(analysis, failures, unifiedBase);
  const selfReport = buildSelfReport({ scores, analysis, failures, executed });

  return {
    version: JARVIS_AUTONOMIC_VERSION,
    phase: 'MAPE',
    computedAt: new Date().toISOString(),
    monitor,
    analysis,
    internalFailures: failures.failures,
    plan,
    execute: executed,
    improvements: improvements.suggestions,
    selfReport,
    systemHealth: scores.systemHealth,
    riskLevel: scores.riskLevel,
    opportunityScore: scores.opportunityScore,
    efficiencyScore: scores.efficiencyScore,
  };
}

/**
 * @param {object} unifiedBase - assembleJarvisUnifiedBase(viewData)
 * @param {object} [options]
 * @param {boolean} [options.persistMemory]
 */
export function runJarvisAutonomicCycle(unifiedBase, options = {}) {
  const envelope = computeJarvisAutonomicEnvelope(unifiedBase || {});
  if (options.persistMemory) {
    rememberAutonomicCycle(envelope);
  }
  return envelope;
}

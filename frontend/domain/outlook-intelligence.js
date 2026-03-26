/**
 * HNF Outlook Intake + Follow-up Brain (solo lectura / clasificación / señales).
 * Sin envío de correo ni integración Outlook real en esta fase.
 */

export const OUTLOOK_INTELLIGENCE_VERSION = '2026-03-23';

const ACTORS = {
  hernan: 'Hernán',
  lyn: 'Lyn',
  romina: 'Romina',
  gery: 'Gery',
};

const KEY_CLIENT_REGEX = /\b(puma|nike|adidas|falabella|cencosud|walmart|cliente\s+clave)\b/i;

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const hoursBetween = (fromIso, toIso = new Date().toISOString()) => {
  const a = new Date(fromIso || 0).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 3600000;
};

/**
 * @param {object} message - Correo o borrador (subject, bodyText, fromEmail, …)
 * @param {object} [context] - { clientNames?: string[], ots?: object[], docs?: object[] }
 */
export function classifyOutlookMessage(message, context = {}) {
  const m = message || {};
  const text = `${m.subject || ''} ${m.bodyText || ''} ${m.bodyHtml || ''}`.toLowerCase();

  let clientHint = m.clientHint || null;
  if (!clientHint && KEY_CLIENT_REGEX.test(text)) {
    const mm = text.match(KEY_CLIENT_REGEX);
    clientHint = mm ? mm[1].replace(/\b\w/g, (c) => c.toUpperCase()) : null;
  }
  const extraClients = Array.isArray(context.clientNames) ? context.clientNames : [];
  for (const n of extraClients) {
    if (n && text.includes(norm(n))) {
      clientHint = clientHint || n;
      break;
    }
  }

  let moduleHint = m.moduleHint || 'administración';
  if (/\b(permiso|mall|tienda|local|acceso|llave)\b/i.test(text)) moduleHint = 'planificación';
  if (/\b(ot|orden|visita|clima|hvac|equipo|refriger)\b/i.test(text)) moduleHint = 'clima';
  if (/\b(flota|traslado|vehículo|camión|ruta)\b/i.test(text)) moduleHint = 'flota';
  if (/\b(cotiz|propuesta|oportunidad|venta|comercial|pipeline)\b/i.test(text)) moduleHint = 'comercial';
  if (/\b(informe|documento|aprobación|observad|pdf|lyn)\b/i.test(text)) moduleHint = 'documentos';
  if (/\b(factura|facturación|pago|cobro|nc\b|nd\b)\b/i.test(text)) moduleHint = 'administración';

  let tipo = 'seguimiento';
  if (/\bpermiso\b/i.test(text)) tipo = 'permiso';
  else if (/\b(solicitud|pedido|requerimiento)\b/i.test(text)) tipo = 'solicitud';
  else if (/\b(aprob|aprobar)\b/i.test(text)) tipo = 'aprobación';
  else if (/\b(observ|corregir|devolución)\b/i.test(text)) tipo = 'observación';
  else if (/\b(factura|facturación|pago)\b/i.test(text)) tipo = 'facturación';
  else if (/\b(coordina|agendar|reunión)\b/i.test(text)) tipo = 'coordinación';

  let priorityHint = 'media';
  if (/\b(urgente|crítico|critico|inmediato|hoy)\b/i.test(text)) priorityHint = 'crítica';
  else if (/\b(importante|prioridad|24\s*h)\b/i.test(text)) priorityHint = 'alta';
  else if (/\b(rutina|fyi|informa)\b/i.test(text)) priorityHint = 'baja';

  const clienteClave = KEY_CLIENT_REGEX.test(text) || extraClients.some((n) => n && text.includes(norm(n)));

  let internalOwner = m.internalOwner || null;
  const followers = new Set(Array.isArray(m.internalFollowers) ? m.internalFollowers : []);
  if (!internalOwner) {
    if (tipo === 'permiso' || moduleHint === 'planificación') internalOwner = ACTORS.romina;
    else if (moduleHint === 'comercial' || tipo === 'coordinación') internalOwner = ACTORS.gery;
    else if (moduleHint === 'documentos' || tipo === 'observación') internalOwner = ACTORS.lyn;
    else if (moduleHint === 'clima' || moduleHint === 'flota') internalOwner = ACTORS.romina;
    else internalOwner = ACTORS.gery;
  }

  if (tipo === 'permiso' && clientHint && /puma/i.test(clientHint)) {
    followers.add(ACTORS.hernan);
    followers.add(ACTORS.lyn);
  }
  if (moduleHint === 'comercial' || tipo === 'coordinación') {
    followers.add(ACTORS.hernan);
    followers.add(ACTORS.lyn);
  }
  if (priorityHint === 'crítica' || (clienteClave && priorityHint === 'alta')) {
    followers.add(ACTORS.hernan);
    followers.add(ACTORS.lyn);
  }

  const requiresInternalAction =
    m.requiresInternalAction != null
      ? Boolean(m.requiresInternalAction)
      : !['cerrado'].includes(m.status) && tipo !== 'seguimiento';

  let reportarAHernan = Boolean(m.reportarAHernan);
  let reportarALyn = Boolean(m.reportarALyn);
  if (priorityHint === 'crítica' || (clienteClave && tipo === 'permiso')) reportarAHernan = reportarALyn = true;
  if (/\b(facturación|factura|reclamo|no\s+conforme)\b/i.test(text)) {
    reportarAHernan = true;
    reportarALyn = true;
  }
  if (tipo === 'observación' && /lyn/i.test(text)) {
    reportarALyn = true;
  }

  const canLinkOt = /\b(OT|O\.T\.|orden)[\s:-]*([A-Z0-9][A-Z0-9-]{4,})\b/i.test(text);
  const canLinkDoc = moduleHint === 'documentos' || tipo === 'observación' || tipo === 'aprobación';

  return {
    version: OUTLOOK_INTELLIGENCE_VERSION,
    clientHint,
    moduleHint,
    tipoCorreo: tipo,
    prioridad: priorityHint,
    internalOwnerSuggested: internalOwner,
    internalFollowersSuggested: [...followers],
    requiresInternalAction,
    reportarAHernan,
    reportarALyn,
    canLinkOt,
    canLinkDoc,
    tags: [
      clienteClave ? 'cliente_clave' : null,
      tipo === 'permiso' ? 'permiso' : null,
      priorityHint === 'crítica' ? 'critico' : null,
    ].filter(Boolean),
  };
}

/**
 * @param {object} emailRecord - Mensaje persistido con status, receivedAt, lastActivityAt, …
 * @param {object} [relatedData] - docs, ots, flow snapshot opcional
 */
export function detectInternalPending(emailRecord, relatedData = {}) {
  const e = emailRecord || {};
  const pendientes = [];
  const text = `${e.subject || ''} ${e.bodyText || ''}`.toLowerCase();
  const ageH = hoursBetween(e.lastActivityAt || e.receivedAt);
  const ageIn = hoursBetween(e.receivedAt);

  if (e.status === 'nuevo' && ageIn != null && ageIn > 8) {
    pendientes.push({
      code: 'MAIL_SIN_CLASIFICAR',
      texto: 'Correo sin pasar a clasificado / seguimiento en >8h',
      severidad: ageIn > 24 ? 'alta' : 'media',
    });
  }

  if (/\bpermiso\b/i.test(text) && e.internalOwner === ACTORS.romina && ageIn != null && ageIn > 24) {
    pendientes.push({
      code: 'PERMISO_ROMINA_PEND',
      texto: 'Permiso sin gestión registrada (ventana 24h)',
      severidad: 'alta',
    });
  }

  if (e.moduleHint === 'comercial' && e.internalOwner === ACTORS.gery && ageIn != null && ageIn > 48) {
    pendientes.push({
      code: 'COMERCIAL_GERY_STALL',
      texto: 'Hilo comercial sin continuidad (Gery)',
      severidad: 'media',
    });
  }

  const docs = relatedData.technicalDocuments || [];
  const aprobNoEnv = docs.filter((d) => d.estadoDocumento === 'aprobado' && !d.enviadoClienteEn).length;
  if (tipoObservacionDoc(text) && aprobNoEnv > 0) {
    pendientes.push({
      code: 'DOC_APROB_SIN_ENV_REL',
      texto: 'Contexto observación / documento con aprobados sin envío en ERP',
      severidad: 'media',
    });
  }

  if (e.fromEmail && !/@hnf|@servicios|interno/i.test(e.fromEmail) && e.status === 'seguimiento' && ageH != null && ageH > 72) {
    pendientes.push({
      code: 'CLIENTE_SIN_RESPUESTA_INTERNA',
      texto: 'Cliente en conversación pero sin actividad interna reciente',
      severidad: 'alta',
    });
  }

  return pendientes;
}

function tipoObservacionDoc(text) {
  return /\b(observ|informe|documento|lyn)\b/i.test(text);
}

/**
 * @param {object} feed - { messages: [] }
 * @param {object} [context]
 */
export function buildOutlookFollowUpSignals(feed, context = {}) {
  const messages = Array.isArray(feed?.messages) ? feed.messages : [];
  const signals = [];
  const permisosPuma = messages.filter(
    (m) => /\bpermiso\b/i.test(`${m.subject} ${m.bodyText}`) && /\bpuma\b/i.test(`${m.subject} ${m.bodyText} ${m.clientHint || ''}`)
  );
  const permisosVencidos = permisosPuma.filter((m) => {
    const h = hoursBetween(m.receivedAt);
    return h != null && h > 24 && m.status !== 'cerrado';
  });
  if (permisosVencidos.length) {
    signals.push(`Hay ${permisosVencidos.length} permiso(s) PUMA sin cierre registrado > 24 h.`);
  }

  const rominaCola = messages.filter(
    (m) => m.internalOwner === ACTORS.romina && m.status !== 'cerrado' && hoursBetween(m.receivedAt) != null && hoursBetween(m.receivedAt) > 24
  );
  if (rominaCola.length >= 2) {
    signals.push(`Romina tiene ${rominaCola.length} seguimientos con más de 24 h sin cerrar.`);
  }

  const geryStall = messages.filter(
    (m) => m.internalOwner === ACTORS.gery && m.moduleHint === 'comercial' && m.status === 'seguimiento' && hoursBetween(m.lastActivityAt || m.receivedAt) > 36
  );
  if (geryStall.length) {
    signals.push(`Gery tiene ${geryStall.length} solicitud(es) comercial sin continuidad reciente.`);
  }

  const clienteRespondio = messages.filter((m) => m.extractedData?.clienteRespondio && !m.extractedData?.accionInterna);
  if (clienteRespondio.length) {
    signals.push(`${clienteRespondio.length} hilo(s): cliente respondió sin acción interna registrada.`);
  }

  const sinClasificar = messages.filter((m) => m.status === 'nuevo' && (m.priorityHint === 'alta' || m.priorityHint === 'crítica'));
  if (sinClasificar.length) {
    signals.push(`${sinClasificar.length} correo(s) marcado(s) como importantes aún en estado «nuevo».`);
  }

  if (!signals.length) signals.push('Sin señales críticas de follow-up en el feed actual.');
  return { version: OUTLOOK_INTELLIGENCE_VERSION, signals };
}

/**
 * @param {object} outlookFeed
 * @param {object} [context] - technicalDocuments, planOts, etc.
 */
export function computeInternalDelayAlerts(outlookFeed, context = {}) {
  const messages = Array.isArray(outlookFeed?.messages) ? outlookFeed.messages : [];
  const alerts = [];
  const push = (a) => alerts.push(a);

  for (const m of messages) {
    if (m.status === 'cerrado') continue;
    const ageH = hoursBetween(m.receivedAt);
    const idleH = hoursBetween(m.lastActivityAt || m.receivedAt);
    const prio = m.priorityHint || 'media';
    const owner = m.internalOwner || '—';

    if (prio === 'crítica' && ageH != null && ageH > 4) {
      push({
        code: 'OUT_CRITICO_4H',
        severity: 'critical',
        title: 'Correo crítico sin gestión >4h',
        detail: `${m.subject || m.id} · ${m.clientHint || 'sin cliente'}`,
        owner,
        ageHours: Math.round(ageH),
        suggestedAction: 'Asignar acción interna y actualizar estado en Intake Hub.',
        nav: { view: 'jarvis-intake' },
        reportarAHernan: true,
        reportarALyn: true,
      });
    } else if (ageH != null && ageH > 24 && m.requiresInternalAction) {
      push({
        code: 'OUT_PEND_24H',
        severity: prio === 'alta' ? 'warning' : 'info',
        title: 'Pendiente interno >24h',
        detail: m.subject || m.id,
        owner,
        ageHours: Math.round(ageH),
        suggestedAction: 'Revisar hilo y registrar última actividad.',
        nav: { view: 'jarvis-intake' },
        reportarAHernan: Boolean(m.reportarAHernan),
        reportarALyn: Boolean(m.reportarALyn),
      });
    }

    if (idleH != null && idleH > 48 && m.fromEmail && !/@(hnf|servicios)/i.test(m.fromEmail)) {
      push({
        code: 'OUT_CLIENTE_ESPERA',
        severity: 'warning',
        title: 'Cliente sin respuesta interna prolongada',
        detail: m.subject || m.id,
        owner,
        ageHours: Math.round(idleH),
        suggestedAction: 'Coordinar respuesta o cierre explícito.',
        nav: { view: 'jarvis-intake' },
        reportarAHernan: true,
        reportarALyn: true,
      });
    }

    if (/\bpermiso\b/i.test(`${m.subject} ${m.bodyText}`) && ageH != null && ageH > 24) {
      push({
        code: 'OUT_PERMISO_PROG',
        severity: 'warning',
        title: 'Permiso detenido — riesgo de programación',
        detail: m.clientHint || m.subject,
        owner,
        ageHours: Math.round(ageH),
        suggestedAction: 'Desbloquear con tienda / mall o reprogramar visita.',
        nav: { view: 'planificacion' },
        reportarAHernan: true,
        reportarALyn: true,
      });
    }
  }

  const docs = context.technicalDocuments || [];
  let docObsN = 0;
  for (const d of docs) {
    if (d.estadoDocumento !== 'observado') continue;
    if (docObsN >= 3) break;
    docObsN += 1;
    push({
      code: 'OUT_DOC_OBS_REL',
      severity: 'info',
      title: 'Observación documental pendiente (contexto correo)',
      detail: d.id,
      owner: ACTORS.lyn,
      ageHours: null,
      suggestedAction: 'Cerrar observación en documentos técnicos.',
      nav: { view: 'technical-documents' },
      reportarAHernan: false,
      reportarALyn: true,
    });
  }

  alerts.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
  return { version: OUTLOOK_INTELLIGENCE_VERSION, alerts };
}

export function aggregateOutlookPendingByOwner(feed) {
  const messages = Array.isArray(feed?.messages) ? feed.messages : [];
  const by = { [ACTORS.romina]: [], [ACTORS.gery]: [], [ACTORS.lyn]: [], sin_dueño: [] };
  for (const m of messages) {
    if (m.status === 'cerrado') continue;
    const owner = m.internalOwner;
    if (owner === ACTORS.romina) by[ACTORS.romina].push(m);
    else if (owner === ACTORS.gery) by[ACTORS.gery].push(m);
    else if (owner === ACTORS.lyn) by[ACTORS.lyn].push(m);
    else by.sin_dueño.push(m);
  }
  return by;
}

/**
 * @param {object} importResult - resultado de ingestFolderDocuments (servidor)
 */
export function buildHistoricalImportSummary(importResult) {
  const files = Array.isArray(importResult?.files) ? importResult.files : [];
  const totalFiles = files.length;
  let procesados = 0;
  let conErrores = 0;
  let calendariosDetectados = 0;
  let correosClasificados = Number(importResult?.correosClasificadosFromFolder) || 0;
  const clientes = new Set();
  const meses = new Set();
  const observaciones = [];
  const sugerencias = [];

  for (const f of files) {
    if (f.status === 'error') conErrores += 1;
    else procesados += 1;
    if (f.detectedKind === 'calendar') calendariosDetectados += 1;
    if (f.detectedKind === 'email_paste') correosClasificados += 1;
    if (f.detectedCliente) clientes.add(f.detectedCliente);
    if (f.detectedMonth) meses.add(f.detectedMonth);
    if (f.note) observaciones.push(f.note);
  }

  if (importResult?.monthHint) meses.add(importResult.monthHint);
  if (conErrores) sugerencias.push('Revisar archivos con error: puede faltar texto extraído o formato no soportado.');
  if (!procesados) sugerencias.push('No se procesó ningún archivo nuevo (¿duplicados?).');

  return {
    version: OUTLOOK_INTELLIGENCE_VERSION,
    totalFiles,
    procesados,
    conErrores,
    documentosTecnicosCreados: importResult?.documentosTecnicosCreados ?? 0,
    calendariosDetectados,
    correosClasificados,
    clientesDetectados: clientes.size,
    mesesDetectados: [...meses].sort(),
    observaciones: observaciones.slice(0, 40),
    sugerencias,
  };
}

/**
 * Fusiona clasificación en un registro completo listo para persistir.
 */
export function applyClassificationToMessage(raw, classification) {
  const c = classification || classifyOutlookMessage(raw, {});
  const audit = Array.isArray(raw.auditTrail) ? [...raw.auditTrail] : [];
  audit.push({
    at: new Date().toISOString(),
    action: 'classified',
    moduleHint: c.moduleHint,
    prioridad: c.prioridad,
  });
  return {
    ...raw,
    clientHint: raw.clientHint || c.clientHint,
    moduleHint: c.moduleHint,
    priorityHint: c.prioridad,
    internalOwner: raw.internalOwner || c.internalOwnerSuggested,
    internalFollowers: [...new Set([...(raw.internalFollowers || []), ...c.internalFollowersSuggested])],
    requiresInternalAction: c.requiresInternalAction,
    reportarAHernan: c.reportarAHernan,
    reportarALyn: c.reportarALyn,
    tags: [...new Set([...(raw.tags || []), ...c.tags])],
    extractedData: {
      ...(raw.extractedData || {}),
      tipoCorreo: c.tipoCorreo,
      canLinkOt: c.canLinkOt,
      canLinkDoc: c.canLinkDoc,
    },
    status: raw.status === 'nuevo' ? 'clasificado' : raw.status,
    auditTrail: audit,
  };
}

/**
 * Resumen compacto para HQ: ingesta, nuevos, críticos, pendientes por dueño (solo lectura).
 */
export function buildOutlookIntakeHeadline(feed, followUp) {
  const messages = Array.isArray(feed?.messages) ? feed.messages : [];
  const pending = followUp?.pendingByOwner && typeof followUp.pendingByOwner === 'object' ? followUp.pendingByOwner : {};
  const delayAlerts = Array.isArray(followUp?.delayAlerts) ? followUp.delayAlerts : [];
  const nuevos = messages.filter((m) => m.status === 'nuevo').length;
  const critMsg = messages.filter(
    (m) => m.priorityHint === 'crítica' || m.priorityHint === 'critica' || m.severity === 'critical'
  ).length;
  const critAlerts = delayAlerts.filter((a) => a.severity === 'critical').length;
  return {
    lastIngestAt: feed?.lastIngestAt || null,
    nuevos,
    criticos: critMsg + critAlerts,
    pendientesRomina: Array.isArray(pending.Romina) ? pending.Romina.length : 0,
    pendientesGery: Array.isArray(pending.Gery) ? pending.Gery.length : 0,
    pendientesLyn: Array.isArray(pending.Lyn) ? pending.Lyn.length : 0,
    modo: feed?.outlookIntakeMode || 'recepcion_solo_lectura',
  };
}

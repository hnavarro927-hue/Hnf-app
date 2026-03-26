/**
 * Espejo backend de frontend/domain/outlook-intelligence.js (misma lógica, sin dependencias de UI).
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

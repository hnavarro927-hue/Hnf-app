/**
 * Prioridad operativa HNF — evitar “todo urgente”.
 */

export const HNF_PRIORITY_RULES_VERSION = '2026-03-27-v1';

const KEY_CLIENT = /\b(puma|cencosud|walmart|falabella|nike|cliente clave)\b/i;

/**
 * @param {object} ot
 * @returns {{ level: 'baja'|'normal'|'alta'|'urgente', reasons: string[] }}
 */
export function resolveOperationalPriority(ot) {
  const reasons = [];
  const blob = `${ot?.subtipoServicio || ''} ${ot?.observaciones || ''} ${ot?.cliente || ''}`.toLowerCase();

  if (/\bemergencia\b|urgencia|crític|critico|falla total|sin aire\b/i.test(blob)) {
    reasons.push('Subtipo o texto indica emergencia → urgente.');
    return { level: 'urgente', reasons };
  }

  if (KEY_CLIENT.test(String(ot?.cliente || '')) || KEY_CLIENT.test(blob)) {
    reasons.push('Cliente de alta relevancia operativa → alta (no urgente salvo emergencia explícita).');
    return { level: 'alta', reasons };
  }

  if (/mantención preventiva|preventiva|pm\b|rutina programada/i.test(blob)) {
    reasons.push('Mantención programada → normal salvo indicación contraria.');
    return { level: 'normal', reasons };
  }

  if (/traslado|revisión técnica|asistencia puntual/i.test(blob)) {
    reasons.push('Servicio flota estándar → normal por defecto.');
    return { level: 'normal', reasons };
  }

  if (/\bvisita técnica\b|inspección/i.test(blob)) {
    reasons.push('Visita técnica → normal/alta según cliente; por defecto normal.');
    return { level: 'normal', reasons };
  }

  reasons.push('Sin señales fuertes → prioridad normal operativa.');
  return { level: 'normal', reasons };
}

/**
 * Lógica por rol operativo HNF (contexto de sugerencias, no RBAC duro).
 */

export const HNF_ROLE_LOGIC_VERSION = '2026-03-27-v1';

export const HNF_ROLES = {
  HERNAN: 'hernan',
  ROMINA: 'romina',
  GERY: 'gery',
  JARVIS: 'jarvis',
};

export const ROLE_FOCUS = {
  [HNF_ROLES.HERNAN]: {
    label: 'Hernán',
    foco: 'Estratégico, supervisorio, overrides y riesgo económico.',
    defaultActions: ['Desbloquear decisión', 'Priorizar cliente clave', 'Alinear comercial–operación'],
  },
  [HNF_ROLES.ROMINA]: {
    label: 'Romina',
    foco: 'Clima, calendario de mantenciones, correos de permiso/aprobación, seguimiento OT HVAC.',
    defaultActions: ['Bandeja permisos', 'Calendario semanal', 'Asignación técnica Clima'],
  },
  [HNF_ROLES.GERY]: {
    label: 'Gery',
    foco: 'Flota, ingreso comercial, solicitudes, seguimiento de asignación y ruta.',
    defaultActions: ['Cola Flota', 'Ingreso / intake', 'Coordinación traslados'],
  },
  [HNF_ROLES.JARVIS]: {
    label: 'Jarvis',
    foco: 'Cerebro central: reglas, alertas, recomendaciones; automatización solo si OT en modo automático.',
    defaultActions: ['Sintetizar riesgos', 'Sugerir prioridad', 'Detectar pasos omitidos'],
  },
};

/**
 * @param {string} [operatorHint] nombre guardado en operador
 */
export function inferActiveRole(operatorHint) {
  const n = String(operatorHint || '').toLowerCase();
  if (/hern/i.test(n)) return HNF_ROLES.HERNAN;
  if (/romin/i.test(n)) return HNF_ROLES.ROMINA;
  if (/ger[yi]/i.test(n)) return HNF_ROLES.GERY;
  return HNF_ROLES.JARVIS;
}

export function rolePreamble(roleKey) {
  const r = ROLE_FOCUS[roleKey] || ROLE_FOCUS[HNF_ROLES.JARVIS];
  return `Contexto ${r.label}: ${r.foco}`;
}

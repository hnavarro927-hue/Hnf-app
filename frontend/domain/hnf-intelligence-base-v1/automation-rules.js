/**
 * Automatización controlada — solo cuando la OT está en modo automático; override manual siempre permitido.
 */

import { suggestAssignmentForOt } from './assignment-rules.js';
import { resolveOperationalPriority } from './priority-rules.js';

export const HNF_AUTOMATION_RULES_VERSION = '2026-03-27-v1';

/**
 * @param {object} ot
 * @returns {{ allowed: boolean, suggestions: { subtipo?: string, tecnico?: string, prioridad?: string }, note: string }}
 */
export function buildAutomationHintsForOt(ot) {
  const mode = String(ot?.operationMode || 'manual').toLowerCase();
  const allowed = mode === 'automatic';
  const asg = suggestAssignmentForOt(ot, { operationMode: mode });
  const pri = resolveOperationalPriority(ot);
  return {
    allowed,
    suggestions: {
      tecnico: asg.suggest || undefined,
      prioridad: pri.level,
    },
    note: allowed
      ? 'Modo automático: Jarvis puede sugerir aplicar asignación/prioridad; el operador mantiene override.'
      : 'Modo manual: solo sugerencias; ningún paso se ejecuta sin acción humana explícita.',
  };
}

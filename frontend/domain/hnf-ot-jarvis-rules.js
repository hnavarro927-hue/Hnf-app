/**
 * Jarvis operativo mínimo (sin IA externa): tipo, prioridad y responsable sugerido.
 */

/**
 * @param {{ area?: string|null, text?: string|null, cliente?: string|null }} ctx
 * @returns {{ tipoServicio: 'clima'|'flota', prioridadOperativa: 'alta'|'media'|'baja', responsable: string }}
 */
export function applyJarvisRulesToNewOt(ctx) {
  const t = String(ctx?.text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const area = String(ctx?.area ?? '')
    .trim()
    .toLowerCase();

  let tipoServicio = 'clima';
  if (area === 'flota') tipoServicio = 'flota';
  else if (area === 'clima') tipoServicio = 'clima';
  else if (/\b(flota|veh[ií]culo|camion|camión|patente\s*[a-z]{2}[- ]?[a-z]{2}[- ]?\d{2})\b/i.test(t)) {
    tipoServicio = 'flota';
  }

  let prioridadOperativa = 'media';
  if (/\b(urgente|urgencia|cr[ií]tico|ca[ií]da|sin\s+clima|fuga)\b/i.test(t)) prioridadOperativa = 'alta';
  else if (/\b(rutina|preventiv|mantenci[oó]n\s+program)\b/i.test(t)) prioridadOperativa = 'baja';

  const responsable = tipoServicio === 'flota' ? 'Gery' : 'Romina';

  return { tipoServicio, prioridadOperativa, responsable };
}

/**
 * Jarvis Intake — parseo semántico local de texto operativo (sin API, sin persistencia).
 * No crea OT ni ejecuta bucles; solo propone estructura para validación humana.
 */

/** @typedef {'whatsapp' | 'correo' | 'manual'} OrigenIntake */

/**
 * @typedef {{
 *   cliente: string | null,
 *   tipo: 'clima' | 'flota' | null,
 *   descripcion: string,
 *   prioridadSugerida: 'alta' | 'media' | 'baja',
 *   responsableSugerido: 'romina' | 'gery' | null,
 *   confianza: 'alta' | 'media' | 'baja',
 *   requiereValidacion: boolean,
 * }} ResultadoEntradaOperativa
 */

const RE_CLIMA =
  /\b(aire|clima|mantenci[oó]n|mantencion|hvac|split|refrigeraci[oó]n|refrigeracion|calefacci[oó]n|calefaccion)\b/i;
const RE_FLOTA =
  /\b(veh[ií]culo|vehiculo|traslado|flota|camion|camión|patente|conductor|conductora|ruta|flete|log[ií]stica|logistica)\b/i;
const RE_URGENTE =
  /\b(urgente|urgencia|detenido|detenida|emergencia|inmediat[oa]|ya mismo|para hoy|asap)\b/i;
const RE_BAJA_PRIORIDAD =
  /\b(sin apuro|cuando puedan|baja prioridad|no urgente|tranquilo|para la semana)\b/i;

function normTxt(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Solo extrae cliente si hay patrón explícito; no inventa nombres genéricos.
 * @param {string} texto
 * @returns {string | null}
 */
export function extraerClienteSugerido(texto) {
  const t = normTxt(texto);
  if (!t) return null;
  const lineas = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const linea of lineas) {
    const m =
      linea.match(/^\s*cliente\s*[:\-]\s*(.+)$/i) ||
      linea.match(/^\s*empresa\s*[:\-]\s*(.+)$/i) ||
      linea.match(/^\s*raz[oó]n\s*social\s*[:\-]\s*(.+)$/i);
    if (m && m[1]) {
      const v = normTxt(m[1]).slice(0, 200);
      return v.length >= 2 ? v : null;
    }
  }
  return null;
}

/**
 * @param {{ origen: OrigenIntake | string, texto: string }} input
 * @returns {ResultadoEntradaOperativa}
 */
export function parsearEntradaOperativa(input) {
  const origenRaw = String(input?.origen ?? 'manual').toLowerCase();
  const origen =
    origenRaw === 'whatsapp' || origenRaw === 'correo' || origenRaw === 'manual' ? origenRaw : 'manual';

  const texto = normTxt(input?.texto);
  const descripcion = texto.slice(0, 4000);

  const hitClima = RE_CLIMA.test(texto);
  const hitFlota = RE_FLOTA.test(texto);

  let tipo = null;
  if (hitClima && !hitFlota) tipo = 'clima';
  else if (hitFlota && !hitClima) tipo = 'flota';
  else if (hitClima && hitFlota) tipo = null;

  let responsableSugerido = null;
  if (tipo === 'clima') responsableSugerido = 'romina';
  if (tipo === 'flota') responsableSugerido = 'gery';

  let prioridadSugerida = 'media';
  if (RE_URGENTE.test(texto)) prioridadSugerida = 'alta';
  else if (RE_BAJA_PRIORIDAD.test(texto)) prioridadSugerida = 'baja';

  const cliente = extraerClienteSugerido(texto);

  let confianza = 'baja';
  if (cliente && tipo) confianza = 'alta';
  else if (tipo) confianza = 'media';
  else confianza = 'baja';

  const requiereValidacion = confianza === 'baja';

  return {
    cliente,
    tipo,
    descripcion,
    prioridadSugerida,
    responsableSugerido,
    confianza,
    requiereValidacion,
  };
}

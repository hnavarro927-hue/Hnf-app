/**
 * Resumen para el centro Jarvis: entradas, validación, confirmados, espera, ejecutivo.
 */

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * @param {object} data - viewData (hnfValidationQueue, hnfValidatedMemory, hnfCoreSolicitudes)
 */
export function buildJarvisCentroResumen(data) {
  const q = Array.isArray(data?.hnfValidationQueue) ? data.hnfValidationQueue : [];
  const mem = Array.isArray(data?.hnfValidatedMemory) ? data.hnfValidatedMemory : [];
  const sol = Array.isArray(data?.hnfCoreSolicitudes) ? data.hnfCoreSolicitudes : [];
  const t0 = startOfTodayMs();

  const entradasHoy = q.filter((x) => new Date(x.createdAt || 0).getTime() >= t0).length;
  const requiereValidacion = q.filter(
    (x) => x.estado === 'requiere_validacion' || x.estado === 'detectado' || x.estado === 'corregido'
  ).length;
  const confirmadosHoy = mem.filter((x) => new Date(x.createdAt || 0).getTime() >= t0).length;
  const enEspera = sol.filter((s) => s.estado === 'pendiente_aprobacion' || s.estado === 'observado').length;
  const ejecutivo = q.filter(
    (x) => x.sugerencias?.responsable === 'Hernán' || x.sugerencias?.area === 'ejecutivo'
  ).length;

  const lineaCompacta = `Hoy: ${entradasHoy} nuevo(s) · ${requiereValidacion} para revisar · ${confirmadosHoy} confirmado(s) · ${enEspera} en espera · ${ejecutivo} decisión ejecutiva`;

  return {
    entradasHoy,
    requiereValidacion,
    confirmadosHoy,
    enEspera,
    ejecutivo,
    lineaCompacta,
  };
}

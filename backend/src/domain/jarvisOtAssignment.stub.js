/**
 * Asignación automática (Jarvis) — reglas iniciales / stub.
 * Reemplazable por motor con disponibilidad real, zonas y carga.
 * @param {{ tipoServicio?: string, comuna?: string, direccion?: string }} ctx
 * @returns {string} Nombre de técnico sugerido
 */
export function suggestTechnicianAutomatic(ctx = {}) {
  const pool = ['Bernabé', 'Andrés', 'Yohantan'];
  const raw = `${ctx.tipoServicio || ''}|${ctx.comuna || ''}|${ctx.direccion || ''}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (h + raw.charCodeAt(i) * (i + 1)) % 997;
  return pool[h % pool.length];
}

/**
 * Identidad operativa opcional hasta que exista login.
 * El frontend puede enviar el header `X-HNF-Actor` (p. ej. nombre guardado en el navegador).
 */
export const getRequestActor = (request) => {
  const h = request?.headers?.['x-hnf-actor'] ?? request?.headers?.['X-HNF-Actor'];
  const s = typeof h === 'string' ? h.trim().slice(0, 80) : '';
  return s || 'sistema';
};

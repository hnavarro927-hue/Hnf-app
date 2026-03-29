/**
 * Actor para trazabilidad en dominios. Con sesión real, el servidor rellena `hnfActor`.
 * El header `X-HNF-Actor` solo aplica si HNF_LEGACY_ACTOR_HEADER está activo (auth.gateway).
 */
export const getRequestActor = (request) => {
  const fromSession = request?.hnfActor;
  if (fromSession && String(fromSession).trim()) {
    return String(fromSession).trim().slice(0, 80);
  }
  const h = request?.headers?.['x-hnf-actor'] ?? request?.headers?.['X-HNF-Actor'];
  const s = typeof h === 'string' ? h.trim().slice(0, 80) : '';
  return s || 'sistema';
};

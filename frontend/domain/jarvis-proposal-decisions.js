/**
 * Memoria de decisiones humanas sobre propuestas Jarvis (solo cliente).
 * Alimenta patrones futuros y ajuste de prioridad sugerida.
 */

const LS = 'hnf_jarvis_proposal_decisions_v1';
const MAX = 240;

function read() {
  try {
    const r = localStorage.getItem(LS);
    const a = r ? JSON.parse(r) : [];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function write(arr) {
  try {
    localStorage.setItem(LS, JSON.stringify(arr.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} entry
 * @param {string} entry.proposalId
 * @param {string} [entry.propuesta]
 * @param {string} [entry.accionSugerida]
 * @param {string} [entry.motivo]
 * @param {'ejecutar'|'modificar'|'descartar'} entry.decision
 * @param {number} [entry.msToDecide]
 * @param {string} [entry.outcome]
 * @param {string} [entry.clienteContext]
 */
export function appendJarvisProposalDecision(entry) {
  const cur = read();
  cur.unshift({
    at: new Date().toISOString(),
    proposalId: entry.proposalId || '—',
    propuesta: String(entry.propuesta || '').slice(0, 500),
    accionSugerida: String(entry.accionSugerida || '').slice(0, 300),
    motivo: String(entry.motivo || '').slice(0, 400),
    decision: entry.decision,
    msToDecide: Number(entry.msToDecide) || null,
    outcome: entry.outcome ? String(entry.outcome).slice(0, 200) : null,
    clienteContext: entry.clienteContext ? String(entry.clienteContext).slice(0, 80) : null,
  });
  write(cur);
}

export function getJarvisProposalDecisionsRecent(n = 40) {
  return read().slice(0, n);
}

/** Heurística simple: muchos descartes en mismo cliente → subir cautela en texto de motivo (consumo futuro). */
export function countRecentDiscardsForCliente(clienteKey) {
  const k = String(clienteKey || '').toLowerCase().trim();
  if (!k) return 0;
  return read().filter(
    (x) => x.decision === 'descartar' && String(x.clienteContext || '').toLowerCase().includes(k)
  ).length;
}

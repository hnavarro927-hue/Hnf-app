/**
 * Flujo continuo (Infinity): cadena ver → decidir → ejecutar → siguiente.
 * Prioriza según presión operativa y empuja el siguiente paso recomendado.
 */

import { commercialDraftPayload } from './jarvis-commercial-brain.js';

/**
 * @param {object} m - modelo `buildJarvisLiveCommandBrief`
 */
export function buildJarvisInfinityGuide(m) {
  const level = Number(m.level) || 0;
  const brain = m.commercialBrain;
  const tiles = m.pulseTiles || [];
  const ev = tiles.find((t) => t.key === 'evidencias')?.value ?? 0;
  const appr = tiles.find((t) => t.key === 'aprob')?.value ?? 0;
  const cierres = tiles.find((t) => t.key === 'cierres')?.value ?? 0;

  /** @type {Array<{ id: string; label: string; view: string; intel?: object; mandoId?: string }>} */
  const chain = [];

  const add = (step) => chain.push(step);

  if (appr >= 1) {
    add({ id: 'aprob', label: 'Aprobar pendientes', view: 'panel-operativo-vivo', mandoId: 'aprob' });
  }
  if (ev >= 1 || level >= 2) {
    add({ id: 'evid', label: 'Subir evidencia', view: 'clima', mandoId: 'evid' });
  }
  add({ id: 'dia', label: 'Ver ingresos del día', view: 'panel-operativo-vivo', mandoId: 'ing' });
  add({ id: 'cerrar', label: 'Cerrar OT', view: 'clima', mandoId: 'cerrar' });
  if (cierres >= 1) {
    add({ id: 'cobro', label: 'Cobrar · cierres listos', view: 'clima', mandoId: 'clima' });
  }
  const skipClienteChip =
    !brain?.cliente ||
    ['Cartera prioritaria', 'Cartera · brief', 'Pipeline declarado', 'Cartera · potencial declarado'].includes(
      brain.cliente
    );
  if (!skipClienteChip) {
    add({
      id: 'cli',
      label: 'Ver cliente',
      view: 'clima',
      intel: { climaFilter: { clienteContains: brain.cliente } },
      mandoId: 'ver_cli',
    });
  }
  if (brain) {
    add({
      id: 'prop',
      label: 'Generar propuesta',
      view: 'oportunidades',
      intel: { commercial: commercialDraftPayload(brain, '') },
      mandoId: 'gen_prop',
    });
  }
  add({ id: 'wa', label: 'WhatsApp', view: 'whatsapp', mandoId: 'wa' });
  add({ id: 'escala', label: 'Escalar riesgo', view: 'operacion-control', mandoId: 'escala' });

  let primaryIdx = 0;
  if (appr >= 1) primaryIdx = chain.findIndex((s) => s.id === 'aprob');
  else if (ev >= 1 || level >= 2) primaryIdx = chain.findIndex((s) => s.id === 'evid');
  else if (cierres >= 1) primaryIdx = chain.findIndex((s) => s.id === 'cobro');
  else if (brain) primaryIdx = chain.findIndex((s) => s.id === 'prop');
  if (primaryIdx < 0) primaryIdx = 0;

  const primary = chain[primaryIdx] || chain[0];
  const next = primaryIdx >= 0 && primaryIdx < chain.length - 1 ? chain[primaryIdx + 1] : null;

  return {
    chain,
    primary,
    primaryIdx,
    next,
    nextHint: next ? `Después: ${next.label}` : 'Sincronizá o revisá panel',
  };
}

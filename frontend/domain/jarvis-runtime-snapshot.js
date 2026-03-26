/**
 * Estado efímero compartido entre Pulse y núcleo Jarvis (sin dependencias circulares).
 */

const state = {
  pulse: null,
  errorRing: [],
  operadorPack: null,
  operadorAt: 0,
};

const MAX_ERRORS = 10;

export function jarvisRuntimeRecordPulseState(partial) {
  state.pulse = partial && typeof partial === 'object' ? { ...partial } : null;
}

export function jarvisRuntimeRecordError(message) {
  if (message == null || message === '') return;
  state.errorRing.push({ at: Date.now(), message: String(message) });
  while (state.errorRing.length > MAX_ERRORS) state.errorRing.shift();
}

export function jarvisRuntimeSetOperadorPack(pack) {
  state.operadorPack = pack && typeof pack === 'object' ? pack : null;
  state.operadorAt = Date.now();
}

export function jarvisRuntimeGetOperadorPack() {
  return state.operadorPack;
}

export function jarvisRuntimeGetOperadorMeta() {
  return { at: state.operadorAt, pack: state.operadorPack };
}

export function jarvisRuntimeGetSnapshot() {
  return {
    pulse: state.pulse ? { ...state.pulse } : null,
    errorRing: state.errorRing.map((e) => ({ ...e })),
    operadorAt: state.operadorAt,
  };
}

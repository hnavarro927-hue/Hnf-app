/**
 * Detección viewport táctil / tablet para Jarvis y shell.
 */

export function getViewportMode() {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth || 1200;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (w < 520) return 'phone';
  if (w < 1100 || (w < 1280 && coarse)) return 'tablet';
  return 'desktop';
}

export function isTabletMode() {
  const m = getViewportMode();
  return m === 'tablet' || m === 'phone';
}

export function getHNFJarvisUIApi() {
  return {
    getViewportMode,
    isTabletMode,
  };
}

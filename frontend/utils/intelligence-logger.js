/**
 * Registro interno en memoria para diagnóstico del asistente / motor IA.
 * Sin red. Opcional: localStorage hnf.debugIntel = "1" duplica en consola.
 */

const MAX = 200;
const buffer = [];

export const intelligenceLog = (level, code, message, meta = null) => {
  const entry = {
    ts: new Date().toISOString(),
    level: level || 'info',
    code: code || '—',
    message: message || '',
    meta,
  };
  buffer.push(entry);
  while (buffer.length > MAX) buffer.shift();

  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('hnf.debugIntel') === '1') {
      const fn = level === 'error' ? console.error : console.info;
      fn.call(console, '[HNF-IA]', code, message, meta ?? '');
    }
  } catch {
    /* ignore */
  }
};

export const getIntelligenceLog = () => [...buffer];

export const clearIntelligenceLog = () => {
  buffer.length = 0;
};

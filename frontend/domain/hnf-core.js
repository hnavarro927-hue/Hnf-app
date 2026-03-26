/**
 * Núcleo de protección HNF: ninguna ejecución síncrona o async debe tumbar la UI sin captura.
 */

export function safeExecute(name, fn, fallback) {
  try {
    return fn();
  } catch (err) {
    console.error(`[HNF safeExecute] ${name}`, err);
    if (typeof fallback === 'function') {
      try {
        return fallback(err);
      } catch (e2) {
        console.error(`[HNF safeExecute] ${name} fallback`, e2);
      }
    }
    return fallback;
  }
}

export async function safeAsync(name, promiseFn, fallback) {
  try {
    return await promiseFn();
  } catch (err) {
    console.error(`[HNF safeAsync] ${name}`, err);
    if (typeof fallback === 'function') {
      try {
        return await fallback(err);
      } catch (e2) {
        console.error(`[HNF safeAsync] ${name} fallback`, e2);
      }
    }
    return fallback;
  }
}

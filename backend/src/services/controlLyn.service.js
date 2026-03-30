import { controlLynRepository } from '../repositories/controlLyn.repository.js';

const PATCH_KEYS = [
  'montoEntregado',
  'solicitudTelefonica',
  'compra',
  'combustible',
  'refrigerante',
  'equipo',
  'uniforme',
  'epp',
  'inventarioCritico',
  'observaciones',
  'respaldo',
];

const clampStr = (v) => String(v ?? '').slice(0, 6000);

/**
 * @param {unknown} body
 * @param {string} actor
 */
export async function patchRegistroLyn(body, actor) {
  const cur = await controlLynRepository.get();
  const b = body && typeof body === 'object' ? body : {};
  const next = { ...cur };

  for (const k of PATCH_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
    if (k === 'montoEntregado') {
      const v = b[k];
      if (v === null || v === '' || v === undefined) {
        next.montoEntregado = null;
      } else {
        const n = Number(String(v).replace(',', '.'));
        next.montoEntregado = Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
      }
      continue;
    }
    next[k] = clampStr(b[k]);
  }

  next.actualizadoAt = new Date().toISOString();
  next.actualizadoPor = String(actor || 'sistema').slice(0, 120);

  return controlLynRepository.save(next);
}

export async function getRegistroLyn() {
  return controlLynRepository.get();
}

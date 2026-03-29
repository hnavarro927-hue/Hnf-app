import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_LEN = 16;
const KEY_LEN = 64;

/**
 * Hash interno HNF (scrypt). Es adecuado para credenciales locales;
 * la plataforma sigue siendo auth interna inicial hasta integrar IdP.
 */
export function hashPassword(plain) {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(String(plain), salt, KEY_LEN);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  try {
    const salt = Buffer.from(parts[1], 'base64');
    const expected = Buffer.from(parts[2], 'base64');
    const key = scryptSync(String(plain), salt, KEY_LEN);
    if (key.length !== expected.length) return false;
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

#!/usr/bin/env node
/**
 * Restablece la contraseña de un usuario en hnf_system_users.json (hash scrypt).
 * Uso (desde la carpeta backend):
 *   set HNF_NEW_PASSWORD=tu_clave_segura
 *   node scripts/hnf-set-password.mjs hernan
 *
 * En PowerShell:
 *   $env:HNF_NEW_PASSWORD="tu_clave_segura"; node scripts/hnf-set-password.mjs hernan
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/utils/password.util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../data/hnf_system_users.json');

const username = String(process.argv[2] || '').trim().toLowerCase();
const pwd = process.env.HNF_NEW_PASSWORD;

if (!username || !pwd || String(pwd).length < 6) {
  console.error(
    'Uso: HNF_NEW_PASSWORD="mínimo 6 caracteres" node scripts/hnf-set-password.mjs <usuario>'
  );
  process.exit(1);
}

const raw = await readFile(dataFile, 'utf8').catch(() => '[]');
let list;
try {
  list = JSON.parse(raw);
} catch {
  console.error('Archivo de usuarios inválido:', dataFile);
  process.exit(1);
}
if (!Array.isArray(list)) {
  console.error('Formato esperado: array JSON de usuarios.');
  process.exit(1);
}

const i = list.findIndex((x) => String(x.username || '').trim().toLowerCase() === username);
if (i < 0) {
  console.error(`Usuario no encontrado: ${username}`);
  process.exit(1);
}

list[i] = {
  ...list[i],
  passwordHash: hashPassword(pwd),
  actualizadoAt: new Date().toISOString(),
};

await writeFile(dataFile, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
console.log(`Contraseña actualizada para «${list[i].username}». Reiniciá el backend si ya estaba en ejecución (o esperá la recarga por mtime).`);

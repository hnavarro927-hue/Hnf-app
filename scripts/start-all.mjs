/**
 * Arranque paralelo local: frontend (Vite) + backend (Node).
 * Uso: npm run start:all (desde la raíz del repo) o start-hnf.cmd en Windows.
 * Un solo comando recomendado: npm run dev (concurrently + validación).
 * Orquestación avanzada (lock, reinicios, UI ADN): npm run dev:jarvis
 * Ctrl+C termina ambos procesos (mejor esfuerzo en Windows).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const feRoot = path.join(root, 'frontend');
const beRoot = path.join(root, 'backend');
if (!existsSync(path.join(feRoot, 'package.json')) || !existsSync(path.join(beRoot, 'package.json'))) {
  console.error('[HNF start:all] Ejecutá este script desde la raíz del repo (deben existir frontend/ y backend/).');
  process.exit(1);
}

console.log('');
console.log('========================================');
console.log('  HNF / Jarvis — arranque unificado');
console.log('========================================');
console.log(`  Raíz: ${root}`);
console.log('  · Frontend: Vite (típico http://127.0.0.1:5173 · LAN 0.0.0.0)');
console.log('  · Backend:  Node  (típico http://127.0.0.1:4000)');
console.log('');
console.log('  Dejá esta ventana abierta. Ctrl+C detiene ambos servicios.');
console.log('========================================');
console.log('');

const run = (label, cwd) => {
  const child = spawn('npm', ['run', 'dev'], {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });
  child.on('exit', (code, signal) => {
    console.log(`[HNF start:all] ${label} finalizó (código ${code}${signal ? `, señal ${signal}` : ''}).`);
  });
  return child;
};

const fe = run('frontend', feRoot);
const be = run('backend', beRoot);

const shutdown = () => {
  try {
    fe.kill();
  } catch {
    /* ignore */
  }
  try {
    be.kill();
  } catch {
    /* ignore */
  }
};

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

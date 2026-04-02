import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parseEnvLine = (line) => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return null;
  const i = t.indexOf('=');
  if (i === -1) return null;
  const k = t.slice(0, i).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) return null;
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return { k, v };
};

/**
 * Carga `.env` desde la raíz del repo y desde `backend/.env` sin dependencia extra.
 * No pisa variables ya definidas en el entorno del proceso (CI, shell, etc.).
 */
export function loadHnfEnvFiles() {
  const files = [
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const raw = readFileSync(file, 'utf8');
    for (const line of raw.split('\n')) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.k] === undefined) {
        process.env[parsed.k] = parsed.v;
      }
    }
  }
}

loadHnfEnvFiles();

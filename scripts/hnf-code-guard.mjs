#!/usr/bin/env node
/**
 * HNF Code Guard — validación previa a build (Vite/Node).
 * Detecta JSDoc peligroso (}>/generics), JSX sospechoso en /domain, mojibake frecuente.
 *
 * Uso:
 *   node scripts/hnf-code-guard.mjs [--fix] [--strict]
 * Env:
 *   HNF_CODE_GUARD_DEBUG=1  → log detallado
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEBUG = process.env.HNF_CODE_GUARD_DEBUG === '1';
const args = new Set(process.argv.slice(2));
const DO_FIX = args.has('--fix');
const STRICT = args.has('--strict');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'build']);

/** Doble decodificación típica: UTF-8 leído como Latin-1 (texto español) */
const MOJIBAKE_PAIRS = [
  ['\u00C3\u00A1', 'á'],
  ['\u00C3\u00A9', 'é'],
  ['\u00C3\u00AD', 'í'],
  ['\u00C3\u00B3', 'ó'],
  ['\u00C3\u00BA', 'ú'],
  ['\u00C3\u00B1', 'ñ'],
  ['\u00C3\u00BC', 'ü'],
  ['\u00C3\u00A7', 'ç'],
  ['\u00C2\u00BF', '¿'],
  ['\u00C2\u00A1', '¡'],
  ['\u00C2\u00B0', '°'],
  ['\u00C2\u00BA', 'º'],
  ['\u00E2\u20AC\u201D', '\u2014'],
];

/** Patrón que rompió import-analysis de Vite: `}>` cerrando genérico en @type */
const DANGEROUS_JSDOC = /\*\s*@type\s*\{[\s\S]*?\}>\s*\*\//g;

const JSX_LIKE = [
  /\breturn\s*\(\s*</,
  /=>\s*\(\s*</,
  /<\s*(div|span|Fragment|main|section|article|header|footer|aside|nav|ul|ol|li|p|h[1-6]|button|form|input|select|textarea|label|svg|path|g)\b[\s/>]/i,
  /<\/?[A-Z][A-Za-z0-9]*\s+[^>]*\/?>/,
];

function logDebug(msg) {
  if (DEBUG) console.error(`[HNF Code Guard][debug] ${msg}`);
}

function walkJsFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walkJsFiles(p, out);
    } else if (ent.isFile() && ent.name.endsWith('.js') && !ent.name.endsWith('.config.js')) {
      out.push(p);
    }
  }
  return out;
}

function isDomainPath(absPath) {
  const rel = relative(REPO_ROOT, absPath).split(sep).join('/');
  return rel.includes('/domain/') || rel.startsWith('domain/');
}

/** Cierra un ${ ... } respetando strings, comentarios y template literals anidados (evita falsos JSX en --strict). */
function skipTemplateInterpolationBody(src, i) {
  let depth = 1;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const q = c;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === q) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === '`') {
      i = consumeTemplateLiteralFromOpenBacktick(src, i);
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < src.length && src[i] !== '\n' && src[i] !== '\r') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++;
      if (i < src.length - 1) i += 2;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return i;
}

/** Desde el índice del ` de apertura, devuelve el índice inmediatamente después del ` de cierre. */
function consumeTemplateLiteralFromOpenBacktick(src, openIdx) {
  let i = openIdx + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '$' && src[i + 1] === '{') {
      i += 2;
      i = skipTemplateInterpolationBody(src, i);
      continue;
    }
    if (c === '`') return i + 1;
    i++;
  }
  return i;
}

function stripTemplateLiteralsFromSource(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] !== '`') {
      out += src[i];
      i++;
      continue;
    }
    i = consumeTemplateLiteralFromOpenBacktick(src, i);
    out += ' ';
  }
  return out;
}

function stripStringsAndComments(src) {
  let s = src;
  // Orden: primero literales (evita `/*` falso en 'image/*', URLs, etc.); comentarios al final.
  s = stripTemplateLiteralsFromSource(s);
  s = s.replace(/'(?:\\.|[^'\\])*'/g, ' ');
  s = s.replace(/"(?:\\.|[^"\\])*"/g, ' ');
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s.replace(/\/\/.*$/gm, ' ');
  return s;
}

function checkSyntax(absPath) {
  try {
    execSync(`node --check "${absPath}"`, { stdio: 'pipe', encoding: 'utf8' });
    return null;
  } catch (e) {
    return (e.stderr && String(e.stderr)) || e.message || 'syntax error';
  }
}

function applyMojibakePairs(content) {
  let s = content;
  let changed = false;
  for (const [bad, good] of MOJIBAKE_PAIRS) {
    if (s.includes(bad)) {
      s = s.split(bad).join(good);
      changed = true;
    }
  }
  return { next: s, changed };
}

function main() {
  const scanRoots = [join(REPO_ROOT, 'frontend'), join(REPO_ROOT, 'backend')];
  const files = [];
  for (const r of scanRoots) {
    if (statSync(r, { throwIfNoError: false })?.isDirectory()) walkJsFiles(r, files);
  }

  const errors = [];
  const fixLog = [];

  for (const abs of files) {
    const rel = relative(REPO_ROOT, abs);
    let content = readFileSync(abs, 'utf8');

    const { next: afterMoj, changed: mojChanged } = applyMojibakePairs(content);
    if (mojChanged) {
      if (DO_FIX) {
        content = afterMoj;
        writeFileSync(abs, content, 'utf8');
        fixLog.push({ file: rel, action: 'mojibake UTF-8 → caracteres correctos' });
        logDebug(`fix: ${rel}`);
      } else {
        errors.push({
          file: rel,
          kind: 'encoding',
          detail:
            'Texto con mojibake (ej. Ã©, â€”). Ejecutar: npm run validate:code:fix o node scripts/hnf-code-guard.mjs --fix',
        });
      }
    }

    const syn = checkSyntax(abs);
    if (syn) {
      errors.push({ file: rel, kind: 'syntax', detail: syn.trim().slice(0, 500) });
      continue;
    }

    DANGEROUS_JSDOC.lastIndex = 0;
    let m;
    while ((m = DANGEROUS_JSDOC.exec(content)) !== null) {
      errors.push({
        file: rel,
        kind: 'jsdoc-vite',
        detail:
          'JSDoc @type con cierre `}>`: puede romper el import-analysis de Vite. Usar comentario // o tipo plano sin `}>`.',
        snippet: m[0].replace(/\s+/g, ' ').slice(0, 100),
      });
    }

    const domain = isDomainPath(abs);
    const forJsxScan = stripStringsAndComments(content);
    if (domain) {
      for (const rx of JSX_LIKE) {
        if (rx.test(forJsxScan)) {
          errors.push({
            file: rel,
            kind: 'domain-jsx',
            detail:
              'frontend/domain no debe contener JSX. Mover UI a .jsx o usar createElement fuera de domain.',
            pattern: rx.source,
          });
          break;
        }
      }
    } else if (STRICT && abs.endsWith('.js')) {
      for (const rx of JSX_LIKE) {
        if (rx.test(forJsxScan)) {
          errors.push({
            file: rel,
            kind: 'jsx-in-js',
            detail: 'Posible JSX en .js (--strict). Renombrar a .jsx o extraer componente.',
            pattern: rx.source,
          });
          break;
        }
      }
    }
  }

  for (const f of fixLog) {
    console.log(`[HNF Code Guard] Aplicado: ${f.file} — ${f.action}`);
  }

  if (errors.length) {
    console.error('\n[HNF Code Guard] BLOQUEADO — corregir antes de build\n');
    for (const e of errors) {
      console.error(`  • ${e.file}`);
      console.error(`    [${e.kind}] ${e.detail}`);
      if (e.snippet) console.error(`    fragmento: ${e.snippet}`);
      if (e.pattern) console.error(`    patrón: ${e.pattern}`);
      console.error('');
    }
    process.exit(1);
  }

  logDebug(`${files.length} archivos .js OK`);
  console.log('[HNF Code Guard] OK — seguro para compilar');
  process.exit(0);
}

main();

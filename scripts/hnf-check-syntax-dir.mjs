#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || 'backend/src';
const dir = join(root, '..', target);

function walk(d, out = []) {
  for (const name of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (name.isFile() && name.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(dir);
let failed = false;
for (const f of files) {
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe' });
  } catch (e) {
    failed = true;
    console.error('[syntax]', f, e.stderr?.toString() || e.message);
  }
}
process.exit(failed ? 1 : 0);

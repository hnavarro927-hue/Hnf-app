import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/hnf_system_users.json');

let cache = null;
/** @type {number | null} */
let cacheMtimeMs = null;

async function load() {
  await mkdir(path.dirname(dataFile), { recursive: true });
  let mtimeMs = null;
  try {
    const st = await stat(dataFile);
    mtimeMs = st.mtimeMs;
    if (cache != null && cacheMtimeMs === mtimeMs) {
      return cache;
    }
  } catch {
    mtimeMs = null;
  }

  try {
    const raw = await readFile(dataFile, 'utf8');
    const j = JSON.parse(raw);
    cache = Array.isArray(j) ? j : [];
  } catch {
    cache = [];
  }
  try {
    const st2 = await stat(dataFile);
    cacheMtimeMs = st2.mtimeMs;
  } catch {
    cacheMtimeMs = mtimeMs ?? Date.now();
  }
  return cache;
}

async function save(items) {
  cache = items;
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  try {
    const st = await stat(dataFile);
    cacheMtimeMs = st.mtimeMs;
  } catch {
    cacheMtimeMs = Date.now();
  }
}

const nextId = (list) => {
  const nums = list
    .map((x) => {
      const m = /^USR-(\d+)$/i.exec(String(x.id || ''));
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `USR-${max + 1}`;
};

export const systemUserRepository = {
  dataFile,
  async findAll() {
    return load();
  },
  async findById(id) {
    const list = await load();
    return list.find((x) => x.id === id) || null;
  },
  async findByUsername(username) {
    const u = String(username || '')
      .trim()
      .toLowerCase();
    if (!u) return null;
    const list = await load();
    return list.find((x) => String(x.username || '').trim().toLowerCase() === u) || null;
  },
  async create(row) {
    const list = await load();
    const id = nextId(list);
    const now = new Date().toISOString();
    const base = {
      ...row,
      id,
      creadoAt: row.creadoAt || now,
      actualizadoAt: now,
    };
    list.push(base);
    await save(list);
    return base;
  },
  async update(id, patch) {
    const list = await load();
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const now = new Date().toISOString();
    const merged = {
      ...list[i],
      ...patch,
      id: list[i].id,
      actualizadoAt: now,
    };
    list[i] = merged;
    await save(list);
    return merged;
  },
};

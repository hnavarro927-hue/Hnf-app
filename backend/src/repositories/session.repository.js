import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/hnf_sessions.json');

let cache = null;

async function load() {
  if (cache) return cache;
  await mkdir(path.dirname(dataFile), { recursive: true });
  try {
    const raw = await readFile(dataFile, 'utf8');
    const j = JSON.parse(raw);
    cache = Array.isArray(j) ? j : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function save(items) {
  cache = items;
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

export const sessionRepository = {
  dataFile,
  async findByToken(token) {
    const t = String(token || '').trim();
    if (!t) return null;
    const list = await load();
    const now = Date.now();
    return (
      list.find((s) => s.token === t && (!s.expiresAt || new Date(s.expiresAt).getTime() > now)) ||
      null
    );
  },
  async create({ token, userId, expiresAt }) {
    const list = await load();
    const row = {
      token: String(token),
      userId: String(userId),
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null,
    };
    list.push(row);
    await save(list);
    return row;
  },
  async deleteByToken(token) {
    const t = String(token || '').trim();
    if (!t) return 0;
    const list = await load();
    const next = list.filter((s) => s.token !== t);
    const removed = list.length - next.length;
    await save(next);
    return removed;
  },
  async deleteAllForUser(userId) {
    const id = String(userId || '');
    const list = await load();
    const next = list.filter((s) => s.userId !== id);
    await save(next);
  },
};

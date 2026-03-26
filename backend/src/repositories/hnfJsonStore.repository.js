import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendHistorial } from '../utils/historialUtil.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createJsonStore(fileName) {
  const dataFile = path.resolve(__dirname, '../../data', fileName);
  let cache = null;

  const readAll = async () => {
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
  };

  const writeAll = async (items) => {
    cache = items;
    await mkdir(path.dirname(dataFile), { recursive: true });
    await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  };

  return { dataFile, readAll, writeAll };
}

/**
 * @param {ReturnType<typeof createJsonStore>} store
 * @param {(items: object[]) => string} nextIdFn
 */
export function makeCrudRepository(store, nextIdFn) {
  return {
    async findAll() {
      return store.readAll();
    },
    async findById(id) {
      const list = await store.readAll();
      return list.find((x) => x.id === id) || null;
    },
    async create(row, actor, historialAccion = 'alta', historialDetalle = '') {
      const list = await store.readAll();
      const id = nextIdFn(list);
      const now = new Date().toISOString();
      const base = {
        ...row,
        id,
        createdAt: now,
        updatedAt: now,
        historial: appendHistorial(
          { historial: [] },
          historialAccion,
          historialDetalle || `Registro ${id}`,
          actor
        ),
      };
      list.push(base);
      await store.writeAll(list);
      return base;
    },
    async update(id, patch, historialEntry, actor) {
      const list = await store.readAll();
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) return null;
      const cur = list[i];
      const merged = {
        ...cur,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      if (historialEntry) {
        merged.historial = appendHistorial(
          cur,
          historialEntry.accion,
          historialEntry.detalle,
          actor
        );
      }
      list[i] = merged;
      await store.writeAll(list);
      return merged;
    },
  };
}

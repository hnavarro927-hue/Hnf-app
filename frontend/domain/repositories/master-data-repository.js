/**
 * Repositorio Base maestra — un solo bundle versionado en localStorage.
 * Clave: `hnf.md.bundle.v1`. Migra lectura desde `hnf.local.clients.v1` si aplica.
 * Sustituible por fetch/API manteniendo la misma superficie de funciones.
 */

import { MASTER_IMPORT_SECTION_KEYS } from './master-data-bundle-validator.js';

const MD_KEY = 'hnf.md.bundle.v1';
const LEGACY_CLIENTS_KEY = 'hnf.local.clients.v1';

function emptyBundle() {
  return {
    version: 1,
    clients: [],
    clientContacts: [],
    branchesOrStores: [],
    contracts: [],
    maintenanceFrequencies: [],
    assetsOrEquipment: [],
    employees: [],
    roles: [],
    serviceCatalog: [],
    pricingCatalog: [],
  };
}

function normalizeBundle(raw) {
  const base = emptyBundle();
  if (!raw || typeof raw !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (k === 'version') {
      base.version = Number(raw.version) || 1;
      continue;
    }
    const v = raw[k];
    base[k] = Array.isArray(v) ? v : [];
  }
  return base;
}

function readBundle() {
  try {
    const raw = localStorage.getItem(MD_KEY);
    if (raw) {
      return normalizeBundle(JSON.parse(raw));
    }
    const b = emptyBundle();
    const leg = localStorage.getItem(LEGACY_CLIENTS_KEY);
    if (leg) {
      const arr = JSON.parse(leg);
      if (Array.isArray(arr) && arr.length) b.clients = arr;
    }
    localStorage.setItem(MD_KEY, JSON.stringify(b));
    return b;
  } catch {
    return emptyBundle();
  }
}

function writeBundle(b) {
  try {
    localStorage.setItem(MD_KEY, JSON.stringify(normalizeBundle(b)));
  } catch {
    /* ignore quota */
  }
}

function syncLegacyClientsMirror(clients) {
  try {
    localStorage.setItem(LEGACY_CLIENTS_KEY, JSON.stringify(Array.isArray(clients) ? clients : []));
  } catch {
    /* ignore */
  }
}

/** @returns {ReturnType<typeof emptyBundle>} */
export function getMasterBundle() {
  return readBundle();
}

export function saveMasterBundle(partial) {
  const cur = readBundle();
  const next = normalizeBundle({ ...cur, ...partial, version: 1 });
  writeBundle(next);
  syncLegacyClientsMirror(next.clients);
  return next;
}

/**
 * Aplica un patch validado: cada sección presente reemplaza por completo esa lista en el bundle.
 * @param {Record<string, object[]>} patch
 */
export function applyMasterImportPatch(patch) {
  if (!patch || typeof patch !== 'object') return getMasterBundle();
  const cur = readBundle();
  const next = normalizeBundle({ ...cur });
  for (const k of MASTER_IMPORT_SECTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, k) && Array.isArray(patch[k])) {
      next[k] = patch[k];
    }
  }
  writeBundle(next);
  syncLegacyClientsMirror(next.clients);
  return next;
}

/** Contexto para validar clientId contra clientes ya persistidos. */
export function getMasterImportValidationContext() {
  const b = readBundle();
  return {
    existingClientIds: new Set((b.clients || []).map((c) => String(c?.id ?? '').trim()).filter(Boolean)),
  };
}

/** Clientes mínimos (compat registro local + OT). */
export function getClients() {
  return [...(readBundle().clients || [])];
}

export function saveClients(list) {
  const b = readBundle();
  b.clients = Array.isArray(list) ? list : [];
  writeBundle(b);
  syncLegacyClientsMirror(b.clients);
}

/**
 * @param {{ nombre: string, id?: string }} data
 */
export function createClient(data) {
  const nombre = String(data?.nombre ?? '').trim();
  if (!nombre) throw new Error('Cliente: nombre obligatorio');
  const id = String(data?.id ?? '').trim() || `C-${Date.now()}`;
  const row = { id, nombre, creadoEn: new Date().toISOString() };
  const clients = getClients();
  if (clients.some((c) => String(c.id) === id)) throw new Error('Cliente: id ya existe');
  saveClients([...clients, row]);
  return row;
}

/**
 * @param {keyof ReturnType<typeof emptyBundle>} section
 */
export function getSection(section) {
  const b = readBundle();
  const k = String(section);
  const v = b[k];
  return Array.isArray(v) ? [...v] : [];
}

/**
 * @param {keyof ReturnType<typeof emptyBundle>} section
 * @param {object[]} rows
 */
export function setSection(section, rows) {
  const b = readBundle();
  const k = String(section);
  if (!(k in b) || k === 'version') return;
  b[k] = Array.isArray(rows) ? rows : [];
  writeBundle(b);
  if (k === 'clients') syncLegacyClientsMirror(b.clients);
}

/**
 * Registro local persistente: clientes + OT (localStorage).
 * Las OT locales se guardan en el mismo store que usa el Kanban (`hnf.ot.flow.v1` → localOts).
 */

import { applyJarvisRulesToNewOt } from './hnf-ot-jarvis-rules.js';
import { normalizeOT } from './hnf-ot-normalize.js';
import { loadFlowStore, saveFlowStore } from './hnf-ot-flow-storage.js';

const CLIENTS_KEY = 'hnf.local.clients.v1';

export function getClients() {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function saveClients(list) {
  const arr = Array.isArray(list) ? list : [];
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
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

export function getOTs() {
  const store = loadFlowStore();
  return Array.isArray(store.localOts) ? [...store.localOts] : [];
}

export function saveOTs(ots) {
  const store = loadFlowStore();
  store.localOts = Array.isArray(ots) ? ots.map((o) => normalizeOT(o) || o).filter(Boolean) : [];
  saveFlowStore(store);
}

/**
 * @param {{ clienteId: string, tipoServicio: 'clima'|'flota', descripcion?: string, prioridadOperativa?: string, responsable?: string }} data
 */
export function createOT(data) {
  const clienteId = String(data?.clienteId ?? '').trim();
  if (!clienteId) throw new Error('OT: cliente obligatorio (clienteId)');

  const clients = getClients();
  const client = clients.find((c) => String(c.id) === clienteId);
  if (!client) throw new Error('OT: cliente no existe; creá el cliente primero');

  const tipo = String(data?.tipoServicio ?? data?.tipo ?? '')
    .trim()
    .toLowerCase();
  if (tipo !== 'clima' && tipo !== 'flota') throw new Error('OT: tipo obligatorio (clima o flota)');

  const store = loadFlowStore();
  store.seq = (store.seq || 0) + 1;
  const id = `L-${Date.now()}-${store.seq}`;
  const now = new Date().toISOString();
  const desc = String(data?.descripcion ?? '').trim().slice(0, 2000) || '—';

  const jarvis = applyJarvisRulesToNewOt({
    text: desc,
    area: tipo,
    cliente: client.nombre,
  });

  const prioridad = String(data?.prioridadOperativa ?? jarvis.prioridadOperativa).toLowerCase();
  const priOk = ['alta', 'media', 'baja'].includes(prioridad) ? prioridad : jarvis.prioridadOperativa;
  const resp = String(data?.responsable ?? jarvis.responsable).trim() || jarvis.responsable;

  const ot = {
    id,
    clienteId: client.id,
    cliente: client.nombre,
    tipoServicio: tipo,
    descripcion: desc,
    estado: 'nueva',
    estadoOperativo: 'ingreso',
    estado_operativo: 'ingreso',
    prioridadOperativa: priOk,
    prioridadSugerida: priOk,
    tecnicoAsignado: resp,
    responsableActual: resp,
    responsable_actual: resp,
    fecha_creacion: now,
    fecha_actualizacion: now,
    hnfFlowLocal: true,
    historial: [
      {
        at: now,
        accion: 'alta_manual_registry',
        detalle: `Cliente ${client.nombre} · tipo ${tipo} · P ${priOk}`,
      },
    ],
  };

  const normalized = normalizeOT(ot);
  if (!normalized) throw new Error('OT: normalización falló');

  store.localOts = [...(store.localOts || []), normalized];
  saveFlowStore(store);
  return normalized;
}

/**
 * Cliente mínimo + OT clima en ingreso (solo prueba).
 */
export function createQuickTestOT() {
  let clients = getClients();
  let c = clients[0];
  if (!c) {
    c = createClient({ nombre: `Cliente prueba ${new Date().toISOString().slice(0, 10)}` });
    clients = getClients();
  }
  return createOT({
    clienteId: c.id,
    tipoServicio: 'clima',
    descripcion: 'OT rápida de prueba (local)',
  });
}

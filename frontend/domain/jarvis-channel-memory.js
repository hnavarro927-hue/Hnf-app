/**
 * Memoria de canales operativos — JARVIS_CHANNEL_MEMORY
 */

const LS_KEY = 'JARVIS_CHANNEL_MEMORY';

/** @typedef {{ id: string, channel_name: string, channel_kind: string, channel_function: string, channel_client: string, aliases?: string[], _seed?: boolean, origen_alias?: string, tipo_operativo?: string, default_responsable?: string }} JarvisChannelDef */

/** @type {JarvisChannelDef[]} */
const SEED = [
  {
    id: 'wa_reportes_clima',
    channel_name: 'WhatsApp Reportes Clima',
    channel_kind: 'grupo',
    channel_function: 'Control horario y presencia en tienda',
    channel_client: 'Operación Clima',
    origen_alias: 'Reporte Clima',
    tipo_operativo: 'operacion',
    default_responsable: 'Romina',
    aliases: ['reportes clima', 'whatsapp reportes clima', 'clima reportes'],
  },
  {
    id: 'wa_central_ops',
    channel_name: 'WhatsApp Central Operaciones',
    channel_kind: 'interno',
    channel_function: 'Revisión y aprobación interna de informes',
    channel_client: 'Operación HNF',
    origen_alias: 'Operaciones HNF',
    tipo_operativo: 'interno',
    default_responsable: 'Romina',
    aliases: ['central operaciones', 'central operación', 'ops interna'],
  },
  {
    id: 'wa_granleasing',
    channel_name: 'WhatsApp Granleasing',
    channel_kind: 'cliente',
    channel_function: 'Solicitudes operativas y coordinación con cliente',
    channel_client: 'Granleasing',
    origen_alias: 'Granleasing',
    tipo_operativo: 'cliente',
    default_responsable: 'Gery',
    aliases: ['granleasing', 'wa granleasing'],
  },
  {
    id: 'wa_west',
    channel_name: 'WhatsApp West Rent a Car',
    channel_kind: 'cliente',
    channel_function: 'Solicitudes y coordinación comercial/operativa',
    channel_client: 'West Rent a Car',
    origen_alias: 'West Rent a Car',
    tipo_operativo: 'cliente',
    default_responsable: 'Gery',
    aliases: ['west rent', 'west', 'rent a car west'],
  },
  {
    id: 'mail_granleasing',
    channel_name: 'Correos Granleasing',
    channel_kind: 'formal',
    channel_function: 'Solicitudes formales y respaldo documental',
    channel_client: 'Granleasing',
    origen_alias: 'Correo Granleasing',
    tipo_operativo: 'cliente',
    default_responsable: 'Gery',
    aliases: ['correos granleasing', 'mail granleasing', 'outlook granleasing'],
  },
  {
    id: 'doc_tecnico_hnf',
    channel_name: 'Documentos técnicos HNF',
    channel_kind: 'interno',
    channel_function: 'Aprobación documental y trazabilidad',
    channel_client: 'Operación HNF',
    origen_alias: 'Documental Lyn',
    tipo_operativo: 'interno',
    default_responsable: 'Lyn',
    aliases: ['documentos técnicos', 'lyn', 'aprobación documental'],
  },
  {
    id: 'otro_canal',
    channel_name: 'Otro canal',
    channel_kind: 'interno',
    channel_function: 'Ingesta general (sin canal operativo predefinido)',
    channel_client: '—',
    origen_alias: '',
    tipo_operativo: 'interno',
    default_responsable: 'Hernan',
    aliases: ['otro'],
  },
];

const readRaw = () => {
  try {
    const r = localStorage.getItem(LS_KEY);
    const a = r ? JSON.parse(r) : [];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

const writeRaw = (arr) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
};

function normalizeSeed() {
  const custom = readRaw().filter((c) => c && !c._seed);
  const byId = new Map();
  for (const s of SEED) {
    byId.set(s.id, { ...s, _seed: true });
  }
  for (const c of custom) {
    if (c?.id) byId.set(c.id, { ...c, _seed: false });
  }
  return [...byId.values()];
}

export function listChannels() {
  return normalizeSeed();
}

export function getChannelById(id) {
  const k = String(id || '').trim();
  return listChannels().find((c) => c.id === k) || null;
}

/**
 * @param {object} ch
 */
export function saveChannel(ch) {
  const id = String(ch?.id || '').trim();
  if (!id) return null;
  const prev = getChannelById(id) || {};
  const merged = { ...prev, ...ch, id };
  const arr = readRaw().filter((c) => c && c.id !== id && !c._seed);
  arr.push({ ...merged, _seed: false });
  writeRaw(arr);
  return getChannelById(id);
}

export function resolveChannelIdFromHint(hint) {
  const h = String(hint || '').trim().toLowerCase();
  if (!h) return null;
  for (const c of listChannels()) {
    if (c.id === h) return c.id;
    for (const a of c.aliases || []) {
      if (h.includes(String(a).toLowerCase())) return c.id;
    }
    if (h.includes(String(c.channel_name || '').toLowerCase().slice(0, 12))) return c.id;
  }
  return null;
}

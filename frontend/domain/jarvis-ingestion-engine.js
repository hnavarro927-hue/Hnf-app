/**
 * Motor de ingesta Jarvis: clasificar → extraer → normalizar → resumir (sin guardar).
 */

import {
  JARVIS_DOCUMENT_TYPE,
  JARVIS_DOCUMENT_TYPE_LABEL,
  JARVIS_KNOWLEDGE_ENGINE_VERSION,
  KNOWLEDGE_LAYER_ID,
} from './jarvis-knowledge-layers.js';

const PIPELINE_STEPS = ['classify', 'extract', 'normalize', 'summarize', 'await_confirmation', 'save'];

export { PIPELINE_STEPS, JARVIS_KNOWLEDGE_ENGINE_VERSION };

function normHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const OT_ALIASES = {
  id: ['ot', 'nro ot', 'numero ot', 'n orden', 'orden', 'id ot', 'folio'],
  cliente: ['cliente', 'empresa', 'razon social', 'customer'],
  direccion: ['direccion', 'dirección', 'address', 'ubicacion', 'ubicación'],
  comuna: ['comuna', 'ciudad', 'localidad'],
  contactoTerreno: ['contacto', 'contacto terreno', 'responsable'],
  telefonoContacto: ['telefono', 'teléfono', 'fono', 'celular', 'movil', 'móvil'],
  tipoServicio: ['tipo', 'tipo servicio', 'linea', 'línea', 'clima flota'],
  subtipoServicio: ['subtipo', 'sub tipo', 'servicio', 'trabajo'],
  tecnicoAsignado: ['tecnico', 'técnico', 'asignado', 'ejecutor'],
  origenPedido: ['origen', 'canal', 'fuente'],
  prioridad: ['prioridad', 'urgencia'],
  estado: ['estado', 'status', 'situacion'],
  fecha: ['fecha', 'fecha solicitud', 'fecha pedido', 'apertura'],
  hora: ['hora', 'hora solicitud'],
  cerradoEn: ['cierre', 'fecha cierre', 'cerrado', 'cerrado en'],
  pdfUrl: ['informe', 'pdf', 'reporte', 'url informe'],
};

const CLIENT_ALIASES = {
  nombre: ['nombre', 'empresa', 'cliente', 'razon social'],
  contactoPrincipal: ['contacto', 'persona'],
  telefono: ['telefono', 'teléfono', 'fono'],
  correo: ['correo', 'email', 'mail'],
  direccion: ['direccion', 'dirección'],
  comuna: ['comuna', 'ciudad'],
  region: ['region', 'región', 'zona'],
};

const DIR_ALIASES = {
  nombreCompleto: ['nombre', 'nombre completo', 'tecnico', 'técnico', 'conductor', 'chofer'],
  rol: ['rol', 'cargo', 'puesto'],
  area: ['area', 'área', 'zona', 'linea', 'línea'],
  telefono: ['telefono', 'teléfono', 'fono', 'celular'],
  correo: ['correo', 'email', 'mail'],
  licencia: ['licencia', 'licencia conducir', 'clase licencia'],
};

function mapRow(headersNorm, rowCells, aliasMap) {
  const out = {};
  for (const [field, aliases] of Object.entries(aliasMap)) {
    for (let i = 0; i < headersNorm.length; i++) {
      const hn = headersNorm[i];
      if (aliases.some((a) => hn === a || hn.includes(a) || a.includes(hn))) {
        const v = String(rowCells[i] ?? '').trim();
        if (v) out[field] = v;
        break;
      }
    }
  }
  return out;
}

export function parseDelimitedText(raw, delimiters = [',', ';', '\t']) {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const first = lines[0];
  let sep = ',';
  let best = 0;
  for (const d of delimiters) {
    const n = first.split(d).length;
    if (n > best) {
      best = n;
      sep = d;
    }
  }
  const split = (line) => {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        q = !q;
        continue;
      }
      if (!q && c === sep) {
        out.push(cur.trim());
        cur = '';
      } else cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = split(lines[li]).map((c) => c.replace(/^"|"$/g, '').trim());
    if (cells.every((c) => !c)) continue;
    rows.push(cells);
  }
  return { headers, rows, delimiter: sep };
}

export function normalizePhone(s) {
  let t = String(s || '').replace(/[^\d+]/g, '');
  if (t.startsWith('56') && t.length > 9) return `+${t}`;
  if (t.length >= 8 && !t.startsWith('+')) return t.startsWith('9') ? `+56${t}` : t;
  return String(s || '').trim();
}

export function normalizeEmail(s) {
  const t = String(s || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return String(s || '').trim();
  return t;
}

export function normalizeDateLoose(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    let dd = dmy[1].padStart(2, '0');
    let mm = dmy[2].padStart(2, '0');
    let yy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yy}-${mm}-${dd}`;
  }
  return t;
}

function scoreOtHeaders(headersNorm) {
  let score = 0;
  for (const h of headersNorm) {
    if (OT_ALIASES.id.some((a) => h.includes(a))) score += 3;
    if (OT_ALIASES.cliente.some((a) => h.includes(a) || h === a)) score += 2;
    if (OT_ALIASES.fecha.some((a) => h.includes(a))) score += 1;
  }
  return score;
}

function scoreClientHeaders(headersNorm) {
  let score = 0;
  for (const h of headersNorm) {
    if (CLIENT_ALIASES.nombre.some((a) => h.includes(a))) score += 2;
    if (CLIENT_ALIASES.correo.some((a) => h.includes(a))) score += 1;
  }
  return score;
}

function scoreDirectoryHeaders(headersNorm) {
  let score = 0;
  for (const h of headersNorm) {
    if (DIR_ALIASES.nombreCompleto.some((a) => h.includes(a))) score += 2;
    if (h.includes('conductor') || h.includes('tecnico') || h.includes('técnico')) score += 2;
  }
  return score;
}

/**
 * @param {string} fileName
 * @param {string[]} headers
 * @param {string} sampleText first 2k of text
 */
export function classifyIngestionInput(fileName = '', headers = [], sampleText = '') {
  const fn = String(fileName).toLowerCase();
  const blob = `${fn} ${sampleText.slice(0, 1500)}`.toLowerCase();

  if (/\.(xlsx|xls)$/i.test(fn)) {
    return {
      type: JARVIS_DOCUMENT_TYPE.DESCONOCIDO,
      confidence: 0.3,
      note: 'Excel detectado: exportá a CSV desde Excel para ingesta en esta versión, o usá una planilla CSV.',
    };
  }

  if (headers.length) {
    const hn = headers.map(normHeader);
    const sOt = scoreOtHeaders(hn);
    const sCl = scoreClientHeaders(hn);
    const sDir = scoreDirectoryHeaders(hn);
    if (sOt >= 4) {
      return { type: JARVIS_DOCUMENT_TYPE.OT_HISTORICA, confidence: 0.85, note: 'Columnas compatibles con OT.' };
    }
    if (fn.includes('cliente') || sCl >= 3) {
      return { type: JARVIS_DOCUMENT_TYPE.LISTADO_CLIENTES, confidence: 0.75, note: 'Listado tipo clientes.' };
    }
    if (fn.includes('conductor') || fn.includes('flota') || (sDir >= 3 && blob.includes('conductor'))) {
      return { type: JARVIS_DOCUMENT_TYPE.LISTADO_CONDUCTORES, confidence: 0.65, note: 'Listado posible conductores / equipo.' };
    }
    if (fn.includes('tecnico') || fn.includes('técnico') || sDir >= 3) {
      return { type: JARVIS_DOCUMENT_TYPE.LISTADO_TECNICOS, confidence: 0.65, note: 'Listado posible técnicos.' };
    }
    if (fn.includes('mantenc') || blob.includes('mantención') || blob.includes('mantencion')) {
      return { type: JARVIS_DOCUMENT_TYPE.PLANILLA_MANTENCIONES, confidence: 0.55, note: 'Planilla de mantenciones (revisar mapeo).' };
    }
  }

  if (/propuesta|cotizaci[oó]n|oferta comercial/i.test(blob)) {
    return { type: JARVIS_DOCUMENT_TYPE.PROPUESTA_COMERCIAL, confidence: 0.5, note: 'Texto sugiere propuesta u oferta.' };
  }
  if (/contrato|acuerdo marco/i.test(blob)) {
    return { type: JARVIS_DOCUMENT_TYPE.CONTRATO, confidence: 0.45, note: 'Posible contrato (validar en revisión).' };
  }
  if (/procedimiento|pol[ií]tica interna|instructivo/i.test(blob)) {
    return { type: JARVIS_DOCUMENT_TYPE.PROCEDIMIENTO_INTERNO, confidence: 0.45, note: 'Posible procedimiento interno.' };
  }
  if (/informe t[eé]cnico|hallazgos|recomendaciones t[eé]cnicas/i.test(blob)) {
    return { type: JARVIS_DOCUMENT_TYPE.INFORME_TECNICO, confidence: 0.45, note: 'Posible informe técnico.' };
  }

  return {
    type: JARVIS_DOCUMENT_TYPE.DESCONOCIDO,
    confidence: 0.25,
    note: 'Clasificación incierta: revisá el tipo y los campos antes de guardar.',
  };
}

export function extractProposalFieldsFromText(text) {
  const t = String(text || '');
  const out = {
    cliente: '',
    monto: '',
    fecha: '',
    tipoServicio: '',
    pistas: [],
  };
  const mMoney = t.match(/\$\s*([\d.,]+)/) || t.match(/(?:uf|clp|pesos)\s*[:\s]*([\d.,]+)/i);
  if (mMoney) out.monto = mMoney[1].replace(/\./g, '').replace(',', '.');
  const mDate = t.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  if (mDate) out.fecha = normalizeDateLoose(mDate[1]);
  if (/clima|hvac|refriger|aire acondicionado/i.test(t)) {
    out.tipoServicio = 'clima';
    out.pistas.push('Servicio tipo Clima / HVAC');
  }
  if (/flota|veh[ií]culo|traslado|camion|camión/i.test(t)) {
    out.tipoServicio = out.tipoServicio ? `${out.tipoServicio}+flota` : 'flota';
    out.pistas.push('Servicio tipo Flota');
  }
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  out.cliente = lines.find((l) => l.length > 3 && l.length < 80 && /^[A-ZÁÉÍÓÚÑ]/.test(l)) || '';
  if (/aprobad|pendiente|rechazad|ganada|perdida/i.test(t)) {
    out.pistas.push('Hay indicios de estado comercial en el texto.');
  }
  return out;
}

function existingOtIds(data) {
  const ots = data?.planOts ?? data?.ots?.data ?? [];
  const set = new Set();
  if (!Array.isArray(ots)) return set;
  for (const o of ots) {
    const id = String(o?.id ?? '').trim();
    if (id) set.add(id.toLowerCase());
  }
  return set;
}

function buildOtRecords(headers, rows, data) {
  const headersNorm = headers.map(normHeader);
  const records = [];
  const seenIds = new Map();
  const existing = existingOtIds(data);

  for (const cells of rows) {
    const raw = mapRow(headersNorm, cells, OT_ALIASES);
    const id = String(raw.id || '').trim();
    const cliente = String(raw.cliente || '').trim();
    const fecha = normalizeDateLoose(raw.fecha || '');
    const tipoRaw = String(raw.tipoServicio || '').toLowerCase();
    let tipoServicio = 'clima';
    if (tipoRaw.includes('flota')) tipoServicio = 'flota';
    else if (tipoRaw.includes('clima') || tipoRaw.includes('hvac')) tipoServicio = 'clima';

    const record = {
      id,
      cliente,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      hora: String(raw.hora || '09:00').trim() || '09:00',
      tipoServicio,
      subtipoServicio: String(raw.subtipoServicio || 'Histórico importado').trim() || 'Histórico importado',
      direccion: String(raw.direccion || '').trim(),
      comuna: String(raw.comuna || '').trim(),
      contactoTerreno: String(raw.contactoTerreno || '').trim(),
      telefonoContacto: normalizePhone(raw.telefonoContacto || ''),
      tecnicoAsignado: String(raw.tecnicoAsignado || 'Por asignar').trim() || 'Por asignar',
      origenPedido: String(raw.origenPedido || 'manual').trim() || 'manual',
      estado: String(raw.estado || 'pendiente').trim() || 'pendiente',
      cerradoEn: String(raw.cerradoEn || '').trim(),
      pdfUrl: String(raw.pdfUrl || '').trim(),
    };

    const missing = [];
    if (!cliente) missing.push('cliente');
    if (!record.direccion) missing.push('direccion');
    if (!record.comuna) missing.push('comuna');
    if (!record.contactoTerreno) missing.push('contactoTerreno');
    if (!record.telefonoContacto) missing.push('telefonoContacto');

    const dupInternal = id && seenIds.has(id.toLowerCase());
    if (id) seenIds.set(id.toLowerCase(), true);
    const dupSystem = id && existing.has(id.toLowerCase());

    records.push({
      record,
      missing,
      flags: {
        duplicateInFile: dupInternal,
        duplicateInSystem: dupSystem,
        needsReview: missing.length > 0 || dupInternal || dupSystem || !id,
      },
    });
  }
  return records;
}

function buildClientRecords(headers, rows) {
  const headersNorm = headers.map(normHeader);
  const out = [];
  const seen = new Map();
  for (const cells of rows) {
    const r = mapRow(headersNorm, cells, CLIENT_ALIASES);
    const nombre = String(r.nombre || '').trim();
    const missing = [];
    if (!nombre) missing.push('nombre');
    if (!r.telefono) missing.push('telefono');
    if (!r.correo) missing.push('correo');
    if (!r.direccion) missing.push('direccion');
    if (!r.comuna) missing.push('comuna');
    const key = nombre.toLowerCase();
    const dup = nombre && seen.has(key);
    if (nombre) seen.set(key, true);
    out.push({
      record: {
        nombre,
        contactoPrincipal: String(r.contactoPrincipal || '').trim(),
        telefono: normalizePhone(r.telefono || ''),
        correo: normalizeEmail(r.correo || ''),
        direccion: String(r.direccion || '').trim(),
        comuna: String(r.comuna || '').trim(),
        area: String(r.region || 'clima').toLowerCase().includes('flota') ? 'flota' : 'clima',
        observaciones: String(r.region || '').trim(),
      },
      missing,
      flags: { duplicateInFile: dup, needsReview: missing.length > 0 || dup },
    });
  }
  return out;
}

function buildDirectoryRecords(headers, rows, defaultRol) {
  const headersNorm = headers.map(normHeader);
  const out = [];
  const seen = new Map();
  for (const cells of rows) {
    const r = mapRow(headersNorm, cells, DIR_ALIASES);
    const nombreCompleto = String(r.nombreCompleto || '').trim();
    const missing = [];
    if (!nombreCompleto) missing.push('nombreCompleto');
    if (!r.telefono) missing.push('telefono');
    if (!r.correo) missing.push('correo');
    const key = nombreCompleto.toLowerCase();
    const dup = nombreCompleto && seen.has(key);
    if (nombreCompleto) seen.set(key, true);
    const rol = String(r.rol || defaultRol || 'Equipo operativo').trim();
    const licencia = String(r.licencia || '').trim();
    out.push({
      record: {
        nombreCompleto,
        rol,
        area: String(r.area || '').trim(),
        telefono: normalizePhone(r.telefono || ''),
        correo: normalizeEmail(r.correo || ''),
        permisos: licencia ? { licenciaConducir: licencia, jarvisIngesta: true } : { jarvisIngesta: true },
        activo: true,
      },
      missing,
      flags: { duplicateInFile: dup, needsReview: missing.length > 0 || dup },
    });
  }
  return out;
}

export function buildIngestionIntelligence(docType, stats, proposalExtract) {
  const lines = [];
  if (stats.missingOrigins > 0 && docType === JARVIS_DOCUMENT_TYPE.OT_HISTORICA) {
    lines.push('Estas OT históricas a veces vienen sin origen; conviene definir un origen por defecto (ej. manual / histórico) para trazabilidad.');
  }
  if (stats.duplicateCandidates > 0) {
    lines.push('Hay candidatos a duplicado: conviene consolidar antes de guardar en producción.');
  }
  if (docType === JARVIS_DOCUMENT_TYPE.PROPUESTA_COMERCIAL && proposalExtract?.cliente) {
    lines.push('Si hay propuestas repetidas del mismo cliente, conviene consolidar la oportunidad comercial en un solo registro.');
  }
  if (stats.missingEmailsConductors > 0) {
    lines.push('Faltan correos en conductores listados; conviene completarlos antes de activar automatizaciones.');
  }
  if (!lines.length) {
    lines.push('Revisá consistencia de columnas en futuras planillas para acelerar la validación.');
  }
  return lines;
}

/**
 * @param {{ fileName?: string, mimeType?: string, text: string, data?: object }} input
 */
export function runJarvisIngestionPipeline(input) {
  const text = String(input.text || '');
  const fileName = String(input.fileName || 'pegado.txt');
  const data = input.data && typeof input.data === 'object' ? input.data : {};

  const { headers, rows, delimiter } = parseDelimitedText(text);
  const classification = classifyIngestionInput(fileName, headers, text);

  let docType = classification.type;
  if (docType === JARVIS_DOCUMENT_TYPE.DESCONOCIDO && /,|;|\t/.test(text) && headers.length >= 2 && rows.length) {
    docType = JARVIS_DOCUMENT_TYPE.OT_HISTORICA;
  }

  let records = [];
  let proposalExtract = null;

  if (docType === JARVIS_DOCUMENT_TYPE.PROPUESTA_COMERCIAL || docType === JARVIS_DOCUMENT_TYPE.COTIZACION) {
    proposalExtract = extractProposalFieldsFromText(text);
    records = [
      {
        record: {
          titulo: `Propuesta · ${proposalExtract.cliente || fileName}`,
          tipo: 'propuesta_comercial',
          payload: proposalExtract,
        },
        missing: [!proposalExtract.cliente && 'cliente', !proposalExtract.monto && 'monto'].filter(Boolean),
        flags: { needsReview: true },
      },
    ];
  } else if (docType === JARVIS_DOCUMENT_TYPE.OT_HISTORICA && headers.length) {
    records = buildOtRecords(headers, rows, data);
  } else if (docType === JARVIS_DOCUMENT_TYPE.LISTADO_CLIENTES && headers.length) {
    records = buildClientRecords(headers, rows);
  } else if (
    docType === JARVIS_DOCUMENT_TYPE.LISTADO_CONDUCTORES ||
    docType === JARVIS_DOCUMENT_TYPE.LISTADO_TECNICOS
  ) {
    if (headers.length) {
      const defRol = docType === JARVIS_DOCUMENT_TYPE.LISTADO_CONDUCTORES ? 'Conductor' : 'Técnico';
      records = buildDirectoryRecords(headers, rows, defRol);
    }
  } else if (headers.length && rows.length) {
    records = buildOtRecords(headers, rows, data);
    docType = JARVIS_DOCUMENT_TYPE.OT_HISTORICA;
  } else {
    proposalExtract = extractProposalFieldsFromText(text);
    records = [
      {
        record: { titulo: fileName, tipo: 'texto_libre', payload: { texto: text.slice(0, 8000) } },
        missing: ['clasificacion_humana'],
        flags: { needsReview: true },
      },
    ];
    docType = JARVIS_DOCUMENT_TYPE.DESCONOCIDO;
  }

  const validComplete = records.filter(
    (r) => (!r.missing || r.missing.length === 0) && !r.flags.duplicateInFile
  ).length;
  const missingFieldsCount = records.filter((r) => r.missing?.length).length;
  const dupCandidates = records.filter((r) => r.flags.duplicateInFile || r.flags.duplicateInSystem).length;
  const missingOrigins =
    docType === JARVIS_DOCUMENT_TYPE.OT_HISTORICA
      ? records.filter((r) => !String(r.record?.origenPedido || '').trim() || r.record.origenPedido === 'manual')
          .length
      : 0;
  const missingEmailsConductors =
    docType === JARVIS_DOCUMENT_TYPE.LISTADO_CONDUCTORES
      ? records.filter((r) => !r.record?.correo).length
      : 0;

  const stats = {
    totalRows: records.length,
    validComplete,
    missingFieldsCount,
    duplicateCandidates: dupCandidates,
    missingOrigins,
    missingEmailsConductors,
    delimiter: delimiter || ',',
  };

  const intel = buildIngestionIntelligence(docType, stats, proposalExtract);

  const datosDetectados = [
    `Tipo detectado: ${JARVIS_DOCUMENT_TYPE_LABEL[docType] || docType} (${Math.round((classification.confidence || 0.5) * 100)}% confianza aprox.).`,
    `Filas analizadas: ${stats.totalRows}. Válidas completas (sin marcas de revisión): ${stats.validComplete}.`,
    stats.missingFieldsCount ? `Con campos faltantes: ${stats.missingFieldsCount}.` : null,
    stats.duplicateCandidates ? `Posibles duplicados: ${stats.duplicateCandidates}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const camposFaltantes =
    stats.missingFieldsCount > 0
      ? `${stats.missingFieldsCount} registro(s) requieren completar datos antes de un guardado directo al módulo OT.`
      : null;

  const posiblesDuplicados =
    dupCandidates > 0
      ? `${dupCandidates} fila(s) podrían ser duplicadas (mismo N° OT en archivo o ya existente en sistema).`
      : null;

  const accionSugerida =
    dupCandidates > 0
      ? 'Revisá duplicados con «Revisar duplicados» antes de guardar.'
      : stats.validComplete > 0
        ? 'Podés enviar a cola de validación HNF Core o, si todas las filas OT están completas, crear OT directas (solo tras confirmación explícita).'
        : 'Completá campos faltantes en la planilla o editá el resumen antes de guardar.';

  const mejoraSugerida = intel[0] || null;

  return {
    version: JARVIS_KNOWLEDGE_ENGINE_VERSION,
    pipeline: PIPELINE_STEPS,
    layers: [KNOWLEDGE_LAYER_ID.TABULAR, KNOWLEDGE_LAYER_ID.DOCUMENTS],
    classification: { ...classification, docType },
    docType,
    docTypeLabel: JARVIS_DOCUMENT_TYPE_LABEL[docType],
    headers,
    records,
    stats,
    proposalExtract,
    summary: {
      datosDetectados,
      camposFaltantes,
      posiblesDuplicados,
      accionSugerida,
      mejoraSugerida,
      intelLines: intel,
      confirmQuestion: '¿Deseás continuar y guardar según la opción que elijas abajo? (Nada se guarda hasta que confirmes.)',
    },
    exportReady: {
      format: 'hnf_jarvis_ingest_v1',
      generatedAt: new Date().toISOString(),
      docType,
      rows: records.map((r) => ({ ...r.record, _meta: { missing: r.missing, flags: r.flags } })),
    },
  };
}

import { HNF_TECH_DOC_PARSER_VERSION, INGEST_ALERT_CODES } from './technicalDocument.model.js';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const pickBlock = (text, labels) => {
  const lines = String(text || '').split(/\r?\n/);
  let cur = null;
  const out = {};

  const matchLabel = (line) => {
    const t = line.trim();
    const low = t.toLowerCase();
    for (const lbl of labels) {
      const l = lbl.toLowerCase();
      if (low.startsWith(`${l}:`) || low.startsWith(`${l} —`) || low.startsWith(`${l} -`)) {
        return { key: lbl, rest: t.slice(t.indexOf(':') + 1).trim() };
      }
      if (low === l || low === `${l}.`) return { key: lbl, rest: '' };
    }
    return null;
  };

  for (const line of lines) {
    const m = matchLabel(line);
    if (m) {
      cur = m.key;
      out[cur] = m.rest ? [m.rest] : [];
      continue;
    }
    if (cur) {
      if (!line.trim()) continue;
      out[cur].push(line.trim());
    }
  }
  const merged = {};
  for (const lbl of labels) {
    if (!out[lbl]) continue;
    merged[lbl] = out[lbl].join('\n').trim();
  }
  return merged;
};

function tryParseDateToIso(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    let day;
    let mo;
    if (a > 12) {
      day = a;
      mo = b;
    } else if (b > 12) {
      mo = a;
      day = b;
    } else {
      day = a;
      mo = b;
    }
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31 && y >= 2000 && y <= 2100) {
      const mm = String(mo).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }
  return '';
}

/**
 * Heurística servidor (sin OCR): mismo espíritu que el parser del frontend.
 */
export function parseTechnicalPDF(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return {
      ok: false,
      confidence: 0,
      fields: {},
      hints: ['Enviá texto del informe o metadata del PDF.'],
      version: HNF_TECH_DOC_PARSER_VERSION,
    };
  }

  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const j = JSON.parse(raw);
      return {
        ok: true,
        confidence: 0.85,
        fields: typeof j === 'object' && j ? j : {},
        hints: ['Entrada JSON reconocida.'],
        version: HNF_TECH_DOC_PARSER_VERSION,
      };
    } catch {
      /* seguir como texto */
    }
  }

  const fields = {};
  const hints = [];

  const otM = raw.match(/\b(OT|O\.T\.|ORDEN)[\s:.-]*([A-Z0-9][A-Z0-9-]{4,})\b/i);
  if (otM) {
    fields.otId = otM[2].toUpperCase();
    hints.push('Detectado posible ID de OT');
  }

  const docNum = raw.match(/\b(INFORME|INF|DOC|N[º°]|N°|#)\s*[:.]?\s*([A-Z0-9/-]{4,})\b/i);
  if (docNum) {
    fields.numeroDocumento = docNum[2].trim();
    hints.push('Detectado número de documento');
  }

  const cli = raw.match(/(?:cliente|mandante|razon social)\s*[:.]?\s*([^\n]+)/i);
  if (cli) fields.cliente = cli[1].trim();

  const tienda = raw.match(/(?:tienda|local|sucursal|ubicacion)\s*[:.]?\s*([^\n]+)/i);
  if (tienda) {
    fields.tiendaNombre = tienda[1].trim();
    fields.sucursal = tienda[1].trim();
  }

  const fecha = raw.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
  if (fecha) {
    const f = fecha[1];
    const iso = tryParseDateToIso(f);
    if (iso) fields.fechaServicio = iso;
    else hints.push('Fecha ambigua; normalizá a YYYY-MM-DD al revisar.');
  }

  const hi = raw.match(/(?:ingreso|llegada|inicio)\s*[:.]?\s*(\d{1,2}:\d{2})/i);
  const hs = raw.match(/(?:salida|termino|fin)\s*[:.]?\s*(\d{1,2}:\d{2})/i);
  if (hi) fields.horaIngreso = hi[1];
  if (hs) fields.horaSalida = hs[1];

  const tec = raw.match(/(?:tecnico|tecnicos)\s*[:.]?\s*([^\n]+)/i);
  if (tec) {
    fields.tecnicos = tec[1]
      .split(/[,;/]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  const tipo = raw.match(/\b(preventiv|correctiv|mantenci|reparaci[oó]n)\w*/i);
  if (tipo) {
    const t = tipo[0].toLowerCase();
    fields.tipoMantencion = t.includes('prevent')
      ? 'preventivo'
      : t.includes('correct')
        ? 'correctivo'
        : tipo[0];
  }

  const labels = [
    'Inspección inicial',
    'Inspeccion inicial',
    'Trabajos realizados',
    'Materiales y herramientas',
    'Materiales',
    'EPP',
    'Observaciones',
    'Observaciones técnicas',
    'Recomendaciones',
    'Recepción del trabajo',
    'Recepcion del trabajo',
    'Limitaciones',
    'Limitaciones del servicio',
    'Garantía',
    'Garantia',
    'Resumen ejecutivo',
  ];
  const blocks = pickBlock(raw, labels);
  const map = {
    'Inspección inicial': 'inspeccionInicial',
    'Inspeccion inicial': 'inspeccionInicial',
    'Trabajos realizados': 'trabajosRealizados',
    'Materiales y herramientas': 'materialesHerramientas',
    Materiales: 'materialesHerramientas',
    EPP: 'epp',
    Observaciones: 'observacionesTecnicas',
    'Observaciones técnicas': 'observacionesTecnicas',
    Recomendaciones: 'recomendaciones',
    'Recepción del trabajo': 'recepcionTrabajo',
    'Recepcion del trabajo': 'recepcionTrabajo',
    Limitaciones: 'limitacionesServicio',
    'Limitaciones del servicio': 'limitacionesServicio',
    Garantía: 'garantiaObservada',
    Garantia: 'garantiaObservada',
    'Resumen ejecutivo': 'resumenEjecutivo',
  };
  for (const [k, v] of Object.entries(blocks)) {
    const fk = map[k];
    if (fk && v) fields[fk] = v;
  }

  const hallazgos = [];
  const critRx =
    /\b(filtraci[oó]n|fuga|refrigerante|sin aislaci[oó]n|bajo rendimiento|garant[ií]a|no intervenci[oó]n|no se interviene)\w*\b/gi;
  let m;
  const seen = new Set();
  while ((m = critRx.exec(raw)) !== null) {
    const phrase = m[0].trim();
    const key = norm(phrase);
    if (seen.has(key)) continue;
    seen.add(key);
    hallazgos.push({
      texto: phrase,
      severidad: norm(phrase).includes('garant') ? 'garantia' : 'operativo',
    });
  }
  if (hallazgos.length) fields.hallazgosCriticos = hallazgos;

  const mediciones = [];
  const medRx = /(\d+(?:[.,]\d+)?)\s*(V|VAC|volt|voltios|A|amp|amper|°C|ºC|C\b|HP|PSI|bar)\b/gi;
  while ((m = medRx.exec(raw)) !== null) {
    mediciones.push({
      valor: m[1],
      unidad: m[2],
      contexto: raw.slice(Math.max(0, m.index - 20), m.index + 30).trim(),
    });
  }
  if (mediciones.length) fields.mediciones = mediciones.slice(0, 40);

  const foto = raw.match(/\b(foto|fotograf[ií]a|evidencia|anexo)\s*[:.]?\s*([^\n]+)/i);
  if (foto) {
    fields.evidencias = [{ tipo: 'texto', descripcion: foto[0] }];
  } else {
    fields.evidencias = [
      {
        tipo: 'placeholder',
        descripcion: 'Sin extracción OCR de imágenes; adjuntar o completar manualmente.',
      },
    ];
    hints.push('Evidencias: placeholder (sin OCR).');
  }

  let confidence = 0.35;
  if (fields.cliente) confidence += 0.12;
  if (fields.fechaServicio) confidence += 0.12;
  if (fields.trabajosRealizados) confidence += 0.1;
  if (fields.observacionesTecnicas) confidence += 0.08;
  if (fields.recomendaciones) confidence += 0.08;
  confidence = Math.min(0.92, confidence);

  return {
    ok: true,
    confidence: Math.round(confidence * 100) / 100,
    fields,
    hints,
    version: HNF_TECH_DOC_PARSER_VERSION,
  };
}

export function detectTechnicalRisks(data) {
  const d = data || {};
  const blob = norm(
    `${d.observacionesTecnicas || ''} ${d.recomendaciones || ''} ${d.trabajosRealizados || ''} ${d.limitacionesServicio || ''} ${d.inspeccionInicial || ''}`
  );
  const alerts = [];

  const fuga =
    (/\b(fuga|escape|perdida|pérdida|baja carga|sin carga)\b/.test(blob) &&
      /\b(refrigerante|gas refrigerante|r410|r22|r32|r134|presion baja)\b/.test(blob)) ||
    /\bfuga de refrigerante\b/.test(blob) ||
    /\bescape de gas\b/.test(blob);
  if (fuga) {
    alerts.push({
      code: INGEST_ALERT_CODES.FUGA_REF,
      nivel: 'critico',
      mensaje: 'Posible fuga o pérdida de refrigerante (riesgo crítico).',
    });
  }

  if (/\bfiltraci|filtra|gotera|humedad en ducto|infiltraci\b/.test(blob)) {
    alerts.push({
      code: INGEST_ALERT_CODES.FILTRACION,
      nivel: 'mantenimiento',
      mensaje: 'Filtración o humedad mencionada: alerta de mantenimiento.',
    });
  }

  if (
    /(sin aislamiento|sin aislacion|aislacion deficiente|aislamiento deficiente|sin aislar)/.test(blob)
  ) {
    alerts.push({
      code: INGEST_ALERT_CODES.AISLAMIENTO,
      nivel: 'eficiencia',
      mensaje: 'Aislamiento deficiente o ausente: alerta de eficiencia energética.',
    });
  }

  const trab = norm(d.trabajosRealizados || '');
  const rec = norm(d.recomendaciones || '');
  if (
    (trab.includes('no se interviene') ||
      trab.includes('sin intervencion') ||
      trab.includes('no interviene')) &&
    (rec.includes('reparar') || rec.includes('reemplazar') || rec.includes('sustituir') || rec.includes('cambiar'))
  ) {
    alerts.push({
      code: INGEST_ALERT_CODES.REDACCION_CONTRAD,
      nivel: 'redaccion',
      mensaje: 'Posible contradicción entre trabajos declarados y recomendaciones.',
    });
  }

  return alerts;
}

export function findOtIdByClienteFecha(cliente, fechaYmd, ots) {
  const fy = String(fechaYmd || '').slice(0, 10);
  if (!fy || !cliente) return '';
  const dn = norm(cliente);
  if (!dn) return '';
  const list = Array.isArray(ots) ? ots : [];
  for (const o of list) {
    if (String(o?.tipoServicio || 'clima').toLowerCase() === 'flota') continue;
    const of = String(o.fecha || '').slice(0, 10);
    if (of !== fy) continue;
    const cn = norm(o.cliente);
    if (!cn) continue;
    if (cn === dn || cn.includes(dn) || dn.includes(cn)) return String(o.id);
  }
  return '';
}

function mergePdfMetadata(fields, meta) {
  if (!meta || typeof meta !== 'object') return { ...fields };
  const out = { ...fields };
  const m = meta;
  if (m.cliente != null && String(m.cliente).trim()) out.cliente = String(m.cliente).trim();
  if (m.sucursal != null && String(m.sucursal).trim()) {
    out.sucursal = String(m.sucursal).trim();
    if (!out.tiendaNombre) out.tiendaNombre = out.sucursal;
  }
  if (m.tiendaNombre != null && String(m.tiendaNombre).trim()) out.tiendaNombre = String(m.tiendaNombre).trim();
  if (m.fechaServicio != null && String(m.fechaServicio).trim()) {
    out.fechaServicio = String(m.fechaServicio).slice(0, 10);
  }
  if (m.fecha != null && String(m.fecha).trim() && !out.fechaServicio) {
    out.fechaServicio = tryParseDateToIso(m.fecha) || String(m.fecha).slice(0, 10);
  }
  if (m.otId != null && String(m.otId).trim()) out.otId = String(m.otId).trim();
  if (m.tecnicos != null && Array.isArray(m.tecnicos) && m.tecnicos.length) out.tecnicos = m.tecnicos;
  const title = m.title || m.titulo || m.subject;
  if (title != null && String(title).trim() && !out.tituloDocumento) {
    out.tituloDocumento = String(title).trim().slice(0, 200);
  }
  if (m.tipoMantencion != null && String(m.tipoMantencion).trim()) {
    out.tipoMantencion = String(m.tipoMantencion).trim();
  }
  return out;
}

export function buildParsedDocumentFields(text, pdfMetadata) {
  const parsed = parseTechnicalPDF(text);
  const merged = mergePdfMetadata(parsed.fields, pdfMetadata);
  return { parsed, merged };
}

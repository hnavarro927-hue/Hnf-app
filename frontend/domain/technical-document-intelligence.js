/**
 * HNF Document Intelligence — parser heurístico, Jarvis (reglas), alertas y métricas.
 * Sin OCR: texto pegado / JSON parcial / metadata PDF futura.
 */

import { OPPORTUNITY_VALUE_BASES } from '../config/commercial-opportunity.defaults.js';

export const HNF_DOCUMENT_INTELLIGENCE_VERSION = '2026-03-22';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const pickBlock = (text, labels) => {
  const lines = String(text || '').split(/\r?\n/);
  let cur = null;
  const out = {};
  const lowerLbl = labels.map((l) => l.toLowerCase());

  const matchLabel = (line) => {
    const t = line.trim();
    const low = t.toLowerCase();
    for (const lbl of labels) {
      const l = lbl.toLowerCase();
      if (low.startsWith(l + ':') || low.startsWith(l + ' —') || low.startsWith(l + ' -')) {
        return { key: lbl, rest: t.slice(t.indexOf(':') + 1).trim() };
      }
      if (low === l || low === l + '.') return { key: lbl, rest: '' };
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

/**
 * @param {string} input - Texto libre del informe o JSON stringificado
 */
export function parseTechnicalReport(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    return {
      ok: false,
      confidence: 0,
      fields: {},
      hints: ['Pegá el texto del informe o un JSON parcial. OCR/PDF metadata se conectará aquí.'],
      version: HNF_DOCUMENT_INTELLIGENCE_VERSION,
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
        version: HNF_DOCUMENT_INTELLIGENCE_VERSION,
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(f)) fields.fechaServicio = f;
    else hints.push('Fecha ambigua; normalizá a YYYY-MM-DD al guardar.');
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
    fields.tipoMantencion = t.includes('prevent') ? 'preventivo' : t.includes('correct') ? 'correctivo' : tipo[0];
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
    'Garantía': 'garantiaObservada',
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
    hallazgos.push({ texto: phrase, severidad: norm(phrase).includes('garant') ? 'garantia' : 'operativo' });
  }
  if (hallazgos.length) fields.hallazgosCriticos = hallazgos;

  const mediciones = [];
  const medRx =
    /(\d+(?:[.,]\d+)?)\s*(V|VAC|volt|voltios|A|amp|amper|°C|ºC|C\b|HP|PSI|bar)\b/gi;
  while ((m = medRx.exec(raw)) !== null) {
    mediciones.push({ valor: m[1], unidad: m[2], contexto: raw.slice(Math.max(0, m.index - 20), m.index + 30).trim() });
  }
  if (mediciones.length) fields.mediciones = mediciones.slice(0, 40);

  const foto = raw.match(/\b(foto|fotograf[ií]a|evidencia|anexo)\s*[:.]?\s*([^\n]+)/i);
  if (foto) fields.evidencias = [{ tipo: 'texto', descripcion: foto[0] }];

  const conf = Math.min(0.95, 0.25 + hints.length * 0.08 + Object.keys(fields).length * 0.04);

  return {
    ok: Object.keys(fields).length > 0,
    confidence: conf,
    fields,
    hints,
    version: HNF_DOCUMENT_INTELLIGENCE_VERSION,
  };
}

/**
 * @param {object} parsed - Salida de parseTechnicalReport o body parcial
 */
export function normalizeTechnicalReport(parsed) {
  const f = parsed?.fields && typeof parsed.fields === 'object' ? { ...parsed.fields } : { ...parsed };
  const g = (k, d = '') => String(f[k] ?? d).trim();

  return {
    otId: g('otId'),
    cliente: g('cliente'),
    tiendaNombre: g('tiendaNombre'),
    sucursal: g('sucursal') || g('tiendaNombre'),
    fechaServicio: g('fechaServicio').slice(0, 10),
    horaIngreso: g('horaIngreso'),
    horaSalida: g('horaSalida'),
    tecnicos: Array.isArray(f.tecnicos) ? f.tecnicos.map((x) => String(x).trim()).filter(Boolean) : [],
    tipoMantencion: g('tipoMantencion'),
    numeroDocumento: g('numeroDocumento'),
    tituloDocumento: g('tituloDocumento') || (g('cliente') ? `Informe técnico Â· ${g('cliente')}` : ''),
    resumenEjecutivo: g('resumenEjecutivo'),
    inspeccionInicial: g('inspeccionInicial'),
    trabajosRealizados: g('trabajosRealizados'),
    materialesHerramientas: g('materialesHerramientas'),
    epp: g('epp'),
    observacionesTecnicas: g('observacionesTecnicas'),
    recomendaciones: g('recomendaciones'),
    recepcionTrabajo: g('recepcionTrabajo'),
    limitacionesServicio: g('limitacionesServicio'),
    garantiaObservada: g('garantiaObservada'),
    hallazgosCriticos: Array.isArray(f.hallazgosCriticos) ? f.hallazgosCriticos : [],
    mediciones: Array.isArray(f.mediciones) ? f.mediciones : [],
    evidencias: Array.isArray(f.evidencias) ? f.evidencias : [],
    activosRelacionados: Array.isArray(f.activosRelacionados) ? f.activosRelacionados : [],
    clienteInformePremium: f.clienteInformePremium && typeof f.clienteInformePremium === 'object' ? f.clienteInformePremium : null,
  };
}

/**
 * Jarvis — revisión por reglas (auditable, sin LLM).
 */
export function runJarvisDocumentReview(documento, ot = null) {
  const d = documento || {};
  const faltantes = [];
  const riesgosRedaccion = [];
  const riesgosTecnicos = [];
  const sugerencias = [];

  if (!String(d.resumenEjecutivo || '').trim()) faltantes.push('Resumen ejecutivo vacío o ausente.');
  if (!String(d.limitacionesServicio || '').trim() && !String(d.garantiaObservada || '').trim()) {
    sugerencias.push('Explicitar limitaciones del servicio o estado de garantía aunque no haya restricciones.');
  }

  const trab = norm(d.trabajosRealizados);
  const rec = norm(d.recomendaciones);
  const obs = norm(d.observacionesTecnicas);
  const gar = norm(d.garantiaObservada + ' ' + d.limitacionesServicio);

  if (trab && rec && rec.length > 20) {
    const contradict =
      (trab.includes('no se interviene') || trab.includes('sin intervencion')) &&
      (rec.includes('reparar') || rec.includes('cambiar') || rec.includes('sustituir'));
    if (contradict) {
      riesgosRedaccion.push('Las recomendaciones suenan a corrección fuerte pero el trabajo indica poca o nula intervención.');
    }
  }

  if ((obs.includes('critico') || obs.includes('urgente') || obs.includes('fuga')) && rec.length < 15) {
    riesgosTecnicos.push('Hay lenguaje de hallazgo relevante; las recomendaciones no reflejan continuidad clara.');
  }

  if ((trab.includes('garantia') || obs.includes('garantia')) && !gar.includes('garant')) {
    riesgosRedaccion.push('Se menciona garantía en el cuerpo pero no está aclarada en bloque dedicado (garantía / limitaciones).');
  }

  if (ot && String(ot.cliente || '').trim() && String(d.cliente || '').trim()) {
    const oc = norm(ot.cliente);
    const dc = norm(d.cliente);
    if (oc && dc && oc !== dc && !oc.includes(dc) && !dc.includes(oc)) {
      riesgosRedaccion.push('Cliente del documento no coincide claramente con la OT vinculada.');
    }
  }

  let consistenciaConOT = 'sin_ot';
  if (ot) {
    if (String(d.otId || '') && String(d.otId) !== String(ot.id)) consistenciaConOT = 'id_distinto';
    else if (String(d.fechaServicio || '').slice(0, 10) !== String(ot.fecha || '').slice(0, 10)) {
      consistenciaConOT = 'fecha_distinta';
      sugerencias.push('Verificar alineación de fecha de servicio con fecha de OT.');
    } else consistenciaConOT = 'alineado';
  }

  let consistenciaConActivo = 'sin_datos';
  const activos = Array.isArray(d.activosRelacionados) ? d.activosRelacionados.length : 0;
  if (activos > 0) consistenciaConActivo = 'referenciado';
  if (ot && Array.isArray(ot.equipos) && ot.equipos.length && activos === 0) {
    consistenciaConActivo = 'ot_tiene_equipos_sin_vinculo_doc';
    sugerencias.push('Vincular equipos de la OT al documento (activos relacionados).');
  }

  const nFal = faltantes.length;
  const nRr = riesgosRedaccion.length;
  const nRt = riesgosTecnicos.length;
  let estadoCalidad = 'aceptable';
  if (nFal + nRr + nRt === 0) estadoCalidad = 'bueno';
  if (nRr + nRt > 0) estadoCalidad = 'requiere_revision';
  if (nFal > 1 || nRr + nRt > 2) estadoCalidad = 'deficiente';

  let recomendacionFinal = 'Seguir flujo estándar de revisión.';
  if (estadoCalidad === 'bueno') recomendacionFinal = 'Apto para envío a revisión formal.';
  if (estadoCalidad === 'deficiente') recomendacionFinal = 'Corregir redacción y completar campos antes de aprobar.';

  return {
    version: HNF_DOCUMENT_INTELLIGENCE_VERSION,
    estadoCalidad,
    faltantes,
    riesgosRedaccion,
    riesgosTecnicos,
    sugerencias,
    consistenciaConOT,
    consistenciaConActivo,
    recomendacionFinal,
  };
}

const HORAS_STALE_REVISION = 72;
const HORAS_STALE_OBSERVADO = 120;

const parseTs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const t = new Date(String(raw)).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const horasDesde = (iso) => {
  const t = parseTs(iso);
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / 3600000;
};

/**
 * @param {object[]} docs
 * @param {object[]} ots
 */
/**
 * Validación previa a aprobación (espejo del backend para UX inmediata).
 */
export function validateBeforeApproval(documento, ctx = {}) {
  const d = documento || {};
  const errors = [];
  const comMit = String(ctx.comentarioMitigacion ?? ctx.comentario ?? '').trim();

  const ingest = Array.isArray(d.alertasIngesta) ? d.alertasIngesta : [];
  const hasCrit = ingest.some((a) => String(a.nivel || '').toLowerCase() === 'critico');
  if (hasCrit && comMit.length < 15) {
    errors.push(
      'Hay riesgo crítico en ingestión: agregá comentario de mitigación o criterio (≥ 15 caracteres).'
    );
  }

  if (String(d.recomendaciones || '').trim().length < 20) {
    errors.push('Recomendaciones vacías o demasiado breves para aprobar.');
  }

  const trab = norm(d.trabajosRealizados);
  const rec = norm(d.recomendaciones);
  if (trab && rec.length > 15) {
    const contradict =
      (trab.includes('no se interviene') || trab.includes('sin intervencion')) &&
      (rec.includes('reparar') || rec.includes('cambiar') || rec.includes('sustituir') || rec.includes('reemplazar'));
    if (contradict && comMit.length < 15) {
      errors.push('Inconsistencia trabajos vs recomendaciones: documentá criterio en el comentario de aprobación.');
    }
  }

  const obs = norm(d.observacionesTecnicas);
  if (
    (obs.includes('fuga') || obs.includes('critico') || obs.includes('urgente')) &&
    String(d.recomendaciones || '').trim().length < 40
  ) {
    errors.push('Observaciones con riesgo fuerte requieren recomendaciones más completas.');
  }

  const ot = ctx.ot;
  if (ot && String(d.cliente || '').trim() && String(ot.cliente || '').trim()) {
    const oc = norm(ot.cliente);
    const dc = norm(d.cliente);
    if (oc && dc && oc !== dc && !oc.includes(dc) && !dc.includes(oc)) {
      errors.push('Cliente del documento no coincide con la OT vinculada.');
    }
  }
  if (ot && String(d.fechaServicio || '').slice(0, 10) && String(ot.fecha || '').slice(0, 10)) {
    if (String(d.fechaServicio).slice(0, 10) !== String(ot.fecha).slice(0, 10)) {
      errors.push('Fecha de servicio distinta a la fecha de la OT vinculada.');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function computeTechnicalDocumentAlerts(docs, ots) {
  const list = Array.isArray(docs) ? docs : [];
  const otList = Array.isArray(ots) ? ots : [];
  const otsClima = otList.filter((o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota');
  const alerts = [];

  const byOt = new Map();
  for (const d of list) {
    const oid = String(d.otId || '').trim();
    if (!oid) continue;
    if (!byOt.has(oid)) byOt.set(oid, []);
    byOt.get(oid).push(d);
  }

  for (const o of otsClima) {
    if (o.estado !== 'terminado') continue;
    const hasDoc = (byOt.get(o.id) || []).some((d) =>
      ['en_revision', 'observado', 'aprobado', 'enviado'].includes(d.estadoDocumento)
    );
    if (!hasDoc) {
      alerts.push({
        code: 'DOC_OT_SIN_INFORME',
        severity: 'warning',
        mensaje: `OT ${o.id} terminada sin documento técnico en flujo (revisión/aprobación/envío).`,
        detalle: o.cliente || '—',
      });
    }
  }

  for (const d of list) {
    if (d.estadoDocumento === 'en_revision') {
      const ref = d.enviadoRevisionEn || d.updatedAt;
      if (horasDesde(ref) > HORAS_STALE_REVISION) {
        alerts.push({
          code: 'DOC_REVISION_LENTA',
          severity: 'info',
          mensaje: `Documento ${d.id} en revisión hace más de ${HORAS_STALE_REVISION} h.`,
          detalle: d.tituloDocumento || d.cliente,
        });
      }
    }
    if (d.estadoDocumento === 'observado') {
      alerts.push({
        code: 'DOC_OBSERVADO_PENDIENTE',
        severity: 'warning',
        mensaje: `Documento ${d.id} en estado observado (pendiente corrección / reenvío a revisión).`,
        detalle: d.cliente || '—',
      });
      const ref = d.observadoEn || d.updatedAt;
      if (horasDesde(ref) > HORAS_STALE_OBSERVADO) {
        alerts.push({
          code: 'DOC_OBSERVADO_SIN_VERSION',
          severity: 'warning',
          mensaje: `Documento ${d.id} observado sin nueva versión reciente.`,
          detalle: d.cliente || '—',
        });
      }
    }
    if (d.estadoDocumento === 'aprobado') {
      if (!d.enviadoClienteEn) {
        alerts.push({
          code: 'DOC_APROBADO_NO_ENVIADO',
          severity: 'info',
          mensaje: `Documento ${d.id} aprobado pero no marcado como enviado al cliente.`,
          detalle: d.cliente || '—',
        });
      }
    }

    const hall = Array.isArray(d.hallazgosCriticos) ? d.hallazgosCriticos : [];
    const crit = hall.filter((h) => {
      const t = norm(typeof h === 'string' ? h : h?.texto || '');
      return t.includes('crit') || t.includes('fuga') || t.includes('filtra');
    });
    if (crit.length && String(d.recomendaciones || '').length < 20) {
      alerts.push({
        code: 'DOC_HALLAZGO_SIN_ACCION',
        severity: 'warning',
        mensaje: `Hallazgo relevante en ${d.id} con recomendaciones débiles o vacías.`,
        detalle: d.otId || '—',
      });
    }

    const g = norm(d.garantiaObservada + d.observacionesTecnicas);
    const ar = d.activosRelacionados;
    if (g.includes('garantia') && !(Array.isArray(ar) && ar.length)) {
      alerts.push({
        code: 'DOC_GARANTIA_SIN_ACTIVO',
        severity: 'info',
        mensaje: `Mención de garantía en ${d.id} sin activos vinculados para historial.`,
        detalle: d.otId || '—',
      });
    }

    const ingest = Array.isArray(d.alertasIngesta) ? d.alertasIngesta : [];
    for (const a of ingest) {
      const n = String(a.nivel || '').toLowerCase();
      if (n === 'critico') {
        alerts.push({
          code: 'DOC_RIESGO_TECNICO_ALTO',
          severity: 'critical',
          mensaje: `Riesgo técnico alto (ingesta): ${a.mensaje || a.code || '—'} · ${d.id}.`,
          detalle: d.cliente || '—',
        });
      } else if (n === 'mantenimiento' || n === 'eficiencia') {
        alerts.push({
          code: 'DOC_ALERTA_INGESTA_OPERATIVA',
          severity: 'warning',
          mensaje: `Ingesta · ${a.mensaje || a.code || 'alerta'} (${d.id}).`,
          detalle: d.otId || '—',
        });
      } else if (n === 'redaccion') {
        alerts.push({
          code: 'DOC_ALERTA_INGESTA_REDACCION',
          severity: 'info',
          mensaje: `Ingesta · ${a.mensaje || a.code || 'redacción'} (${d.id}).`,
          detalle: d.cliente || '—',
        });
      }
    }

    const recTxt = String(d.recomendaciones || '').trim();
    const trabTxt = String(d.trabajosRealizados || '').trim();
    if (
      recTxt.length > 50 &&
      trabTxt.length < 30 &&
      !['aprobado', 'enviado'].includes(d.estadoDocumento)
    ) {
      alerts.push({
        code: 'DOC_RECOMENDACION_NO_ACCIONADA',
        severity: 'warning',
        mensaje: `Documento ${d.id}: recomendaciones extensas con poco detalle de trabajo ejecutado.`,
        detalle: d.cliente || '—',
      });
    }
  }

  return alerts;
}

/**
 * Métricas operativas del módulo documental (sobre datos cargados).
 */
export function computeTechnicalDocumentMetrics(docs) {
  const list = Array.isArray(docs) ? docs : [];
  const n = (est) => list.filter((d) => d.estadoDocumento === est).length;
  const aprobados = n('aprobado') + n('enviado');
  const conObs = list.filter((d) => (d.comentariosInternos || []).length > 0).length;

  const tiempos = [];
  for (const d of list) {
    const t0 = parseTs(d.enviadoRevisionEn || d.createdAt);
    const t1 = parseTs(d.aprobadoEn);
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
      tiempos.push((t1 - t0) / 3600000);
    }
  }
  const promedioHorasAprob =
    tiempos.length > 0 ? Math.round((tiempos.reduce((a, b) => a + b, 0) / tiempos.length) * 10) / 10 : null;

  const motivos = new Map();
  for (const d of list) {
    for (const c of d.comentariosInternos || []) {
      const m = String(c.motivo || c.tipo || '—').trim() || '—';
      motivos.set(m, (motivos.get(m) || 0) + 1);
    }
  }
  const principalesMotivos = [...motivos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([motivo, count]) => ({ motivo, count }));

  return {
    version: HNF_DOCUMENT_INTELLIGENCE_VERSION,
    total: list.length,
    borrador: n('borrador'),
    enRevision: n('en_revision'),
    observado: n('observado'),
    aprobado: n('aprobado'),
    enviado: n('enviado'),
    emitidos: list.length,
    conObservaciones: conObs,
    aprobadosSinObservacionPrevia: list.filter(
      (d) => d.estadoDocumento === 'aprobado' && !(d.comentariosInternos || []).length
    ).length,
    tiempoPromedioHorasAprobacion: promedioHorasAprob,
    principalesMotivosObservacion: principalesMotivos,
    tiempoAhorradoJarvisHorasEstimado: Math.min(list.length * 0.25, 40),
  };
}

/** Base para informe cliente premium (sin reemplazar PDF actual). */
export function buildClienteInformePremiumStructure(documento) {
  const d = documento || {};
  return {
    version: HNF_DOCUMENT_INTELLIGENCE_VERSION,
    resumenEjecutivo: d.resumenEjecutivo || '',
    alcanceServicio: {
      tipoMantencion: d.tipoMantencion || '',
      fechaServicio: d.fechaServicio || '',
      horario: [d.horaIngreso, d.horaSalida].filter(Boolean).join(' - '),
    },
    hallazgosDetectados: Array.isArray(d.hallazgosCriticos) ? d.hallazgosCriticos : [],
    accionesEjecutadas: d.trabajosRealizados || '',
    limitacionesYGarantia: {
      limitaciones: d.limitacionesServicio || '',
      garantia: d.garantiaObservada || '',
    },
    proximosPasos: d.recomendaciones || '',
    anexosFotograficos: Array.isArray(d.evidencias) ? d.evidencias : [],
    medicionesClave: Array.isArray(d.mediciones) ? d.mediciones : [],
  };
}

/**
 * Señales para historial de activo / riesgo / oportunidad (consumo futuro por Asset Intelligence).
 */
export function suggestAssetSignalsFromDocument(documento) {
  const d = documento || {};
  const blob = norm(
    `${d.observacionesTecnicas} ${d.recomendaciones} ${d.limitacionesServicio} ${d.garantiaObservada}`
  );
  const tags = [];
  if (blob.includes('filtra') || blob.includes('fuga') || blob.includes('refrigerante')) tags.push('fuga_riesgo');
  if (blob.includes('aisla')) tags.push('aislamiento');
  if (blob.includes('rendimiento') || blob.includes('baja presion')) tags.push('rendimiento');
  if (blob.includes('garantia') || blob.includes('no interviene')) tags.push('garantia');
  const oportunidades = [];
  if (tags.includes('rendimiento')) oportunidades.push('Seguimiento técnico / ajuste de carga');
  if (tags.includes('fuga_riesgo')) oportunidades.push('Intervención correctiva cotizada');
  return {
    version: HNF_DOCUMENT_INTELLIGENCE_VERSION,
    historialSugerido: (Array.isArray(d.hallazgosCriticos) ? d.hallazgosCriticos : []).slice(0, 12),
    riesgoTags: [...new Set(tags)],
    oportunidadesComerciales: oportunidades,
  };
}

/**
 * Detección de oportunidades comerciales desde un documento técnico.
 * Mantener coherente con backend `commercialOpportunity.generator.js`.
 */
export function detectCommercialOpportunities(documento) {
  const d = documento || {};
  const out = [];
  const obs = String(d.observacionesTecnicas || '');
  const rec = String(d.recomendaciones || '').trim();
  const recN = norm(rec);
  const tipoM = norm(d.tipoMantencion);
  const ingest = Array.isArray(d.alertasIngesta) ? d.alertasIngesta : [];
  const critIngest = ingest.filter((a) => String(a.nivel || '').toLowerCase() === 'critico');

  const obsCrit =
    critIngest.length > 0 ||
    /\b(fuga|escape|perdida de refrigerante|urgente|critico)\b/i.test(obs) ||
    (norm(obs).includes('fuga') && norm(obs).includes('refriger'));

  if (obsCrit) {
    const msg = critIngest.map((x) => x.mensaje).filter(Boolean)[0];
    out.push({
      regla: 'riesgo_critico',
      tipoServicio: 'urgencia',
      prioridad: 'alta',
      descripcion: msg || 'Riesgo operativo crítico detectado en el informe técnico.',
    });
  }

  if (rec.length > 35) {
    out.push({
      regla: 'recomendaciones',
      tipoServicio: 'mejora',
      prioridad: out.some((x) => x.prioridad === 'alta') ? 'media' : 'media',
      descripcion: `Oportunidad por recomendaciones: ${rec.slice(0, 240)}${rec.length > 240 ? '…' : ''}`,
    });
  }

  if (
    tipoM.includes('prevent') ||
    /\b(recurrente|mensual|contrato am|plan de mant)\b/.test(
      norm(`${d.resumenEjecutivo} ${obs} ${rec}`)
    )
  ) {
    out.push({
      regla: 'mantenimiento_recurrente',
      tipoServicio: 'mantenimiento',
      prioridad: 'baja',
      descripcion: 'Mantención recurrente / preventiva: potencial contrato o visitas programadas.',
    });
  }

  if (
    tipoM.includes('correct') ||
    recN.includes('repar') ||
    recN.includes('reemplaz') ||
    recN.includes('sustitu')
  ) {
    out.push({
      regla: 'reparacion',
      tipoServicio: 'reparacion',
      prioridad: out.some((x) => x.tipoServicio === 'urgencia') ? 'media' : 'media',
      descripcion: 'Línea correctiva / reparación o reemplazo sugerido en el informe.',
    });
  }

  const seen = new Set();
  return out.filter((row) => {
    const k = `${row.regla}:${row.tipoServicio}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function estimateOpportunityValue(opportunity) {
  const t = String(opportunity?.tipoServicio || '').toLowerCase();
  const base = OPPORTUNITY_VALUE_BASES[t] || OPPORTUNITY_VALUE_BASES.mejora;
  return {
    monto: Number(base.monto) || 0,
    etiqueta: base.etiqueta || '',
  };
}

/**
 * Vista previa local (no persiste). El servidor genera al aprobar el documento.
 */
export function generateOpportunitiesFromDocument(documento) {
  const d = documento || {};
  const cliente = String(d.cliente || '').trim() || '—';
  const tid = String(d.id || '').trim();
  return detectCommercialOpportunities(d).map((x) => {
    const { monto, etiqueta } = estimateOpportunityValue(x);
    return {
      technicalDocumentId: tid,
      cliente,
      tipoServicio: x.tipoServicio,
      descripcion: x.descripcion,
      prioridad: x.prioridad,
      estimacionMonto: monto,
      estimacionEtiqueta: etiqueta,
      estado: 'pendiente',
      origen: 'automatico',
      regla: x.regla,
    };
  });
}

export function computeCommercialOpportunitySummary(opportunities, monthStart, monthEnd) {
  const list = Array.isArray(opportunities) ? opportunities : [];
  const inMonth = list.filter((o) => {
    const f = String(o.fechaCreacion || '').slice(0, 10);
    return f >= monthStart && f <= monthEnd;
  });
  const potencialTotal = inMonth.reduce((s, o) => s + Number(o.estimacionMonto || 0), 0);
  const urgentes = inMonth.filter(
    (o) => String(o.prioridad) === 'alta' && String(o.estado) === 'pendiente'
  ).length;
  return {
    version: HNF_DOCUMENT_INTELLIGENCE_VERSION,
    countMes: inMonth.length,
    potencialTotalMes: Math.round(potencialTotal * 100) / 100,
    urgentesPendientesMes: urgentes,
  };
}

export function computeCommercialOpportunityAlerts(opportunities) {
  const list = Array.isArray(opportunities) ? opportunities : [];
  const alerts = [];
  const byCliente = new Map();

  for (const o of list) {
    const c = String(o.cliente || '—').trim() || '—';
    if (!byCliente.has(c)) byCliente.set(c, { altas: 0, potencialPend: 0 });
    const g = byCliente.get(c);
    if (String(o.prioridad) === 'alta') g.altas += 1;
    if (['pendiente', 'cotizado'].includes(String(o.estado))) {
      g.potencialPend += Number(o.estimacionMonto || 0);
    }
  }

  for (const [c, g] of byCliente) {
    if (c === '—') continue;
    if (g.altas >= 2) {
      alerts.push({
        code: 'OP_CLI_MULTIPLES_RIESGOS',
        severity: 'warning',
        mensaje: `Cliente ${c}: ${g.altas} oportunidades de prioridad alta.`,
        detalle: c,
      });
    }
    if (g.potencialPend >= 1500000) {
      alerts.push({
        code: 'OP_CLI_POTENCIAL_ALTO',
        severity: 'info',
        mensaje: `Cliente ${c}: alto potencial acumulado en oportunidades abiertas (~$${Math.round(g.potencialPend).toLocaleString('es-CL')}).`,
        detalle: c,
      });
    }
  }

  const HORAS = 72;
  const now = Date.now();
  const seenUrgent = new Set();
  for (const o of list) {
    if (String(o.prioridad) !== 'alta' || String(o.estado) !== 'pendiente') continue;
    const t = new Date(String(o.fechaCreacion || '')).getTime();
    if (!Number.isFinite(t)) continue;
    if ((now - t) / 3600000 <= HORAS) continue;
    if (seenUrgent.has(o.id)) continue;
    seenUrgent.add(o.id);
    alerts.push({
      code: 'OP_URGENTE_SIN_GESTION',
      severity: 'critical',
      mensaje: `Oportunidad urgente sin gestión: ${o.id} · ${o.cliente || '—'}.`,
      detalle: o.technicalDocumentId || '—',
    });
  }

  return alerts;
}

/**
 * Análisis de imagen para Jarvis — heurística local (sin API de visión).
 * Clasifica contexto por luminancia, proporción y textura aproximada para generar acción operable.
 */

export const JARVIS_IMAGE_INTEL_VERSION = '2026-03-23';

const roundMoney = (v) => Math.round(Number(v) || 0);

/**
 * Salida gerencial fija: REALIDAD / IMPACTO / ACCIÓN (conectado a dinero y riesgo).
 * @param {object} res - resultado parcial de analyzeJarvisImage (ok true o false)
 */
export function buildJarvisImageDecisionTriple(res) {
  const r = res || {};
  if (r.ok === false || r.error) {
    return {
      realidad: 'No hay lectura fiable de la imagen en este entorno.',
      impacto: 'Sin señal visual no traducís a dinero ni riesgo en sistema: la decisión queda al aire.',
      accion: String(r.error || 'Reintentá con otra captura o pegá contexto en Centro de Ingesta.'),
    };
  }
  const money = roundMoney(r.impactoEconomicoEstimado || 0);
  const realidad = [r.interpretacionTecnica, r.resumenOperativo].filter(Boolean).join(' · ').slice(0, 340);
  const impacto = [
    `Riesgo técnico ${r.riesgoTecnicoNivel || r.riesgoTecnico || '—'}.`,
    `Tensión económica estimada ~$${money.toLocaleString('es-CL')}.`,
    r.riesgoAsociado || '',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 400);
  return {
    realidad: realidad || 'Contexto visual capturado; validar con técnico antes de comprometer.',
    impacto: impacto.trim() || 'Impacto operativo/comercial por acotar con OT u oportunidad.',
    accion: r.accionRecomendada || r.accionSugerida || 'Clasificar en OT u oportunidad y asignar dueño con fecha.',
  };
}

/**
 * Tipo visible para lectura ejecutiva (no confundir con sistema interno).
 */
function ejecutivoTipoImagen(sistema, interpretacionTecnica) {
  const it = String(interpretacionTecnica || '').toLowerCase();
  if (it.includes('checklist') || it.includes('pantalla') || it.includes('informe')) return 'documento';
  if (it.includes('obra') || it.includes('faena') || it.includes('panorám')) return 'evidencia';
  if (it.includes('tablero') || it.includes('panel eléct') || it.includes('breaker')) return 'tablero';
  if (it.includes('unidad exterior') || it.includes('split') || it.includes('compresor')) return 'unidad';
  const map = {
    documento: 'documento',
    ot_evidencia: 'evidencia',
    equipo_problema: 'equipo',
    oportunidad_visual: 'equipo',
    instalacion: 'sala',
  };
  return map[sistema] || 'otro';
}

function ejecutivoOportunidadTipo(sistema, oportunidadComercial) {
  const o = String(oportunidadComercial || '').toLowerCase();
  if (o.includes('correctivo')) return 'correctivo';
  if (o.includes('preventiva') || o.includes('manten')) return 'mantención';
  if (o.includes('reemplazo')) return 'reemplazo';
  if (o.includes('upgrade') || o.includes('ampliación')) return 'upsell';
  if (o.includes('diagnóstico') && o.includes('visita')) return 'inspección';
  if (o.includes('facturación') || o.includes('hito')) return 'correctivo';
  if (o.includes('cierre documental') || o.includes('administrativ')) return 'sin oportunidad';
  if (sistema === 'oportunidad_visual') return 'upsell';
  if (sistema === 'documento') return 'sin oportunidad';
  return 'mantención';
}

function ejecutivoDestinoSugerido(sistema) {
  if (sistema === 'documento') return 'documento';
  if (sistema === 'oportunidad_visual') return 'comercial';
  if (sistema === 'ot_evidencia') return 'OT';
  if (sistema === 'equipo_problema') return 'OT';
  return 'OT';
}

function normalizeRiesgoEjecutivo(riesgoTecnico, sistema, generaRiesgo) {
  const r = String(riesgoTecnico || 'medio').toLowerCase();
  if (r === 'alto' && generaRiesgo && sistema === 'equipo_problema') return 'crítico';
  if (r === 'alto') return 'alto';
  if (r === 'bajo') return 'bajo';
  return 'medio';
}

/**
 * Cadena alienígena de interpretación — 5 pasos + metadatos para UI.
 * @param {object} imageIntel - salida de analyzeJarvisImage (finalize)
 */
export function buildJarvisInterpretationPipeline(imageIntel) {
  const img = imageIntel || {};
  if (img.ok === false || img.error) {
    return {
      version: JARVIS_IMAGE_INTEL_VERSION,
      pasos: [
        { n: 1, titulo: 'Identificación', cuerpo: 'Lectura parcial: no opero sobre píxeles fiables en este intento.', estado: 'alerta' },
        { n: 2, titulo: 'Riesgo', cuerpo: 'Sin imagen válida el riesgo es de ceguera: no hay decisión técnica anclada.', estado: 'alerta' },
        { n: 3, titulo: 'Oportunidad', cuerpo: 'Sin señal visual no traduzco a palanca comercial.', estado: 'neutral' },
        { n: 4, titulo: 'Acción', cuerpo: img.accionSugerida || 'Reintentá con otra captura o pegá contexto en ingesta.', estado: 'alerta' },
        { n: 5, titulo: 'Destino', cuerpo: 'Destino sugerido: histórico / reintento (no OT hasta validar).', estado: 'neutral' },
      ],
      destino: 'histórico',
      lecturaParcial: true,
      requiereContextoAdicional: String(img.error || 'Se requiere contexto adicional o nueva evidencia.'),
    };
  }

  const tipo = img.tipoImagenEjecutivo || ejecutivoTipoImagen(img.sistema, img.interpretacionTecnica);
  const oppT = img.oportunidadTipoEjecutivo || ejecutivoOportunidadTipo(img.sistema, img.oportunidadComercial);
  const dest = img.destinoSugerido || ejecutivoDestinoSugerido(img.sistema);
  const riesgoN = img.riesgoTecnicoNivel || normalizeRiesgoEjecutivo(img.riesgoTecnico, img.sistema, img.generaRiesgo);
  const lecturaParcial = Boolean(img.lecturaParcial);
  const ctx = img.requiereContextoAdicional || '';

  return {
    version: JARVIS_IMAGE_INTEL_VERSION,
    pasos: [
      {
        n: 1,
        titulo: 'Identificación',
        cuerpo: lecturaParcial
          ? `Lectura parcial · Tipo: ${tipo}. ${img.descripcionVisual || img.interpretacionTecnica || '—'}`
          : `Tipo: ${tipo}. ${img.descripcionVisual || img.interpretacionTecnica || '—'}`,
        estado: lecturaParcial ? 'warn' : 'ok',
      },
      {
        n: 2,
        titulo: 'Riesgo',
        cuerpo: `Riesgo técnico: ${riesgoN}. ${img.riesgoAsociado || ''}`.trim(),
        estado: riesgoN === 'crítico' || riesgoN === 'alto' ? 'warn' : 'ok',
      },
      {
        n: 3,
        titulo: 'Oportunidad',
        cuerpo: `Clasificación: ${oppT}. ${img.oportunidadComercial || '—'}`,
        estado: oppT === 'sin oportunidad' ? 'neutral' : 'ok',
      },
      {
        n: 4,
        titulo: 'Acción',
        cuerpo: img.accionSugerida || img.accionRecomendada || 'Asignar dueño y siguiente paso con fecha.',
        estado: 'ok',
      },
      {
        n: 5,
        titulo: 'Destino',
        cuerpo: `Destino sugerido: ${dest}.`,
        estado: 'ok',
      },
    ],
    destino: dest,
    lecturaParcial,
    requiereContextoAdicional: ctx,
  };
}

/**
 * Clasificación alineada a OT / equipo / problema / oportunidad + cadena tipo Iron Man.
 * @param {string} sistema
 */
function enrichIntelOperativo(sistema, interpretacionTecnica) {
  let riesgoTecnico = 'medio';
  let oportunidadComercial = 'Seguimiento técnico / administrativo';
  let urgencia = 'media';
  if (sistema === 'equipo_problema') {
    riesgoTecnico = 'alto';
    oportunidadComercial = 'Mantención preventiva vendible';
    urgencia = 'alta';
  } else if (sistema === 'documento') {
    riesgoTecnico = 'bajo';
    oportunidadComercial = 'Cierre documental y cobro asociado';
    urgencia = 'media';
  } else if (sistema === 'ot_evidencia') {
    riesgoTecnico = 'medio';
    oportunidadComercial = 'Facturación del hito completado';
    urgencia = 'media';
  } else if (sistema === 'oportunidad_visual') {
    riesgoTecnico = 'medio';
    oportunidadComercial = 'Upgrade o ampliación comercial';
    urgencia = 'alta';
  } else {
    riesgoTecnico = 'medio';
    oportunidadComercial = 'Diagnóstico en sitio';
    urgencia = 'media';
  }
  const hook = String(interpretacionTecnica || '').split('—')[0].trim().slice(0, 56);
  const resumenOperativo = `${hook || 'Señal visual'} → riesgo ${riesgoTecnico} → ${oportunidadComercial}`;
  const generaRiesgo = riesgoTecnico === 'alto' || sistema === 'ot_evidencia';
  const generaOportunidad = sistema === 'oportunidad_visual' || sistema === 'equipo_problema';
  const generaIngreso =
    sistema === 'oportunidad_visual' ||
    sistema === 'ot_evidencia' ||
    sistema === 'equipo_problema' ||
    sistema === 'instalacion';
  return {
    riesgoTecnico,
    oportunidadComercial,
    urgencia,
    resumenOperativo,
    generaIngreso,
    generaRiesgo,
    generaOportunidad,
  };
}

function clasificacionYCadena(sistema) {
  switch (sistema) {
    case 'equipo_problema':
      return {
        clasificacionNucleo: 'problema',
        elementosRelevantes: ['Equipo o instalación', 'Posible desgaste o carga térmica', 'Contexto de falla incipiente'],
        cadenaCausal:
          'Equipo con señales de desgaste o estrés → riesgo de falla → oportunidad de mantenimiento correctivo + preventivo.',
      };
    case 'documento':
      return {
        clasificacionNucleo: 'OT',
        elementosRelevantes: ['Captura o documento', 'Texto / checklist', 'Evidencia administrativa'],
        cadenaCausal: 'Documento técnico o comercial → riesgo de demora si no se amarra → acción: vincular a OT y cobrar.',
      };
    case 'ot_evidencia':
      return {
        clasificacionNucleo: 'OT',
        elementosRelevantes: ['Obra o sitio', 'Evidencia de avance', 'Instalación en campo'],
        cadenaCausal: 'Evidencia de faena en sitio → riesgo de trabajo no facturado → cerrar hito y activar cobro.',
      };
    case 'oportunidad_visual':
      return {
        clasificacionNucleo: 'oportunidad',
        elementosRelevantes: ['Zona de mejora', 'Upgrade posible', 'Potencial comercial visual'],
        cadenaCausal: 'Señal de mejora o ampliación → riesgo de dejar valor en mesa → abrir oportunidad con visita vendible.',
      };
    default:
      return {
        clasificacionNucleo: 'equipo',
        elementosRelevantes: ['Instalación clima/industrial', 'Contexto operativo HNF'],
        cadenaCausal: 'Instalación operativa → validar con técnico → convertir en OT u oportunidad explícita.',
      };
  }
}

function finalizeImageResult(partial) {
  const p = partial || {};
  const ok = p.ok !== false && !p.error;
  const desc = String(p.interpretacionTecnica || p.error || '').trim();
  const rt = p.riesgoTecnico || '—';
  const oc = p.oportunidadComercial || '—';
  const tipoImagenEjecutivo = ejecutivoTipoImagen(p.sistema, p.interpretacionTecnica);
  const oportunidadTipoEjecutivo = ejecutivoOportunidadTipo(p.sistema, oc);
  const destinoSugerido = ejecutivoDestinoSugerido(p.sistema);
  const riesgoTecnicoNivel = ok
    ? normalizeRiesgoEjecutivo(rt, p.sistema, p.generaRiesgo)
    : '—';
  const notaMeta = String(p.meta?.nota || '');
  const lecturaParcial =
    !ok ||
    /insuficiente|sin muestras|alta incertidumbre|no concluyo/i.test(notaMeta + desc) ||
    Boolean(p.meta?.nota?.includes('insuficiente'));
  const requiereContextoAdicional = lecturaParcial
    ? ok
      ? 'No concluyo falla conclusiva, pero detecto señal: sumá OT, cliente o segunda foto.'
      : 'Se requiere contexto adicional (texto, OT o nueva captura).'
    : '';

  const resumenEjecutivo = ok
    ? `${desc} Riesgo técnico ${riesgoTecnicoNivel}. Oportunidad probable: ${oportunidadTipoEjecutivo} — ${oc}.`.replace(/\s+/g, ' ').trim().slice(0, 360)
    : 'Lectura visual no operativa: reintentá con otra captura o acompañá con texto en ingesta.';

  const enriched = {
    ...p,
    descripcionVisual: desc || '—',
    riesgoTecnico: rt,
    riesgoTecnicoNivel,
    oportunidadComercial: oc,
    tipoImagenEjecutivo,
    oportunidadTipoEjecutivo,
    destinoSugerido,
    urgencia: p.urgencia || 'media',
    impactoProbable: roundMoney(p.impactoEconomicoEstimado || 0),
    resumenEjecutivo,
    accionSugerida: p.accionRecomendada || 'Clasificar en OT u oportunidad y asignar dueño con fecha.',
    lecturaParcial,
    requiereContextoAdicional,
    jarvisTriple: buildJarvisImageDecisionTriple({ ...p, riesgoTecnicoNivel }),
  };
  return {
    ...enriched,
    interpretacionPipeline: buildJarvisInterpretationPipeline(enriched),
  };
}

/**
 * @param {File} file
 * @returns {Promise<object|null>}
 */
export async function analyzeJarvisImage(file) {
  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
    return null;
  }

  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return finalizeImageResult({
      version: JARVIS_IMAGE_INTEL_VERSION,
      ok: false,
      error: 'No se pudo leer la imagen.',
    });
  }

  const iw = bmp.width;
  const ih = bmp.height;
  const maxSide = 256;
  const scale = Math.min(1, maxSide / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bmp.close?.();
    return finalizeImageResult({
      version: JARVIS_IMAGE_INTEL_VERSION,
      ok: false,
      error: 'Canvas no disponible.',
    });
  }

  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const aspect = iw / Math.max(1, ih);

  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return finalizeImageResult({
      version: JARVIS_IMAGE_INTEL_VERSION,
      ok: false,
      error: 'Origen de imagen no permite lectura de píxeles.',
    });
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  let sumSq = 0;
  const step = 4 * 8;
  for (let i = 0; i < data.length; i += step) {
    const a = data[i + 3];
    if (a < 12) continue;
    const rr = data[i];
    const gg = data[i + 1];
    const bb = data[i + 2];
    r += rr;
    g += gg;
    b += bb;
    const lum = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    sumSq += lum * lum;
    n += 1;
  }

  if (n === 0) {
    const cc = clasificacionYCadena('instalacion');
    const it =
      'Muestra insuficiente para estadística de píxeles — se asume contexto de instalación; validar con técnico.';
    const partial = {
      version: JARVIS_IMAGE_INTEL_VERSION,
      ok: true,
      sistema: 'instalacion',
      clasificacionJarvis: 'instalacion',
      ...cc,
      ...enrichIntelOperativo('instalacion', it),
      interpretacionTecnica: it,
      impactoEconomicoEstimado: roundMoney(185_000 * 0.35),
      accionRecomendada: 'Volver a capturar con mejor luz o acercar el elemento crítico (placa, equipo, medidor).',
      riesgoAsociado: 'Decisión con alta incertidumbre si no hay segunda evidencia.',
      meta: { nota: 'Imagen sin muestras útiles — fallback conservador.', file: file.name || 'imagen' },
    };
    return finalizeImageResult(partial);
  }
  const ar = r / n;
  const ag = g / n;
  const ab = b / n;
  const meanLum = (0.2126 * ar + 0.7152 * ag + 0.0722 * ab) / 255;
  const variance = Math.max(0, sumSq / n - (meanLum * 255) ** 2);

  /** @type {'ot_evidencia'|'equipo_problema'|'documento'|'instalacion'|'oportunidad_visual'} */
  let sistema = 'instalacion';
  if (meanLum > 0.72 && variance < 900) sistema = 'documento';
  else if (meanLum < 0.38 && variance > 1400) sistema = 'equipo_problema';
  else if (aspect > 1.45 && meanLum < 0.55) sistema = 'ot_evidencia';
  else if (variance > 2200 && meanLum > 0.35 && meanLum < 0.65) sistema = 'oportunidad_visual';

  const baseTicket = 185_000;
  let interpretacionTecnica = '';
  let impactoEconomicoEstimado = baseTicket * 0.35;
  let accionRecomendada = '';
  let riesgoAsociado = '';

  switch (sistema) {
    case 'equipo_problema':
      interpretacionTecnica =
        'Superficie oscura con alta variación — compatible con equipo con desgaste, suciedad térmica o falla incipiente.';
      impactoEconomicoEstimado = roundMoney(baseTicket * 0.55);
      accionRecomendada =
        'Agendar visita técnica, registrar hallazgos en OT y ofrecer mantenimiento correctivo + plan preventivo.';
      riesgoAsociado = 'Riesgo de parada no planificada y reclamo si no se documenta el estado.';
      break;
    case 'documento':
      interpretacionTecnica =
        'Imagen clara y uniforme — probable captura de pantalla, informe o checklist (contexto administrativo/técnico).';
      impactoEconomicoEstimado = roundMoney(baseTicket * 0.12);
      accionRecomendada = 'Vincular a OT o documento en ERP y pedir aprobación / envío al cliente si corresponde.';
      riesgoAsociado = 'Riesgo de demora comercial si el documento queda huérfano sin OT.';
      break;
    case 'ot_evidencia':
      interpretacionTecnica = 'Formato panorámico con tono de obra — posible evidencia de faena o instalación en sitio.';
      impactoEconomicoEstimado = roundMoney(baseTicket * 0.42);
      accionRecomendada = 'Adjuntar a OT abierta, cerrar hito técnico y disparar facturación si el trabajo está listo.';
      riesgoAsociado = 'Riesgo de trabajo ejecutado no cobrado si no se amarra a economía.';
      break;
    case 'oportunidad_visual':
      interpretacionTecnica =
        'Contraste heterogéneo — posible zona de mejora energética, ampliación o upgrade de equipo.';
      impactoEconomicoEstimado = roundMoney(baseTicket * 0.85);
      accionRecomendada = 'Abrir oportunidad comercial con valor estimado y visita de diagnóstico vendible.';
      riesgoAsociado = 'Riesgo de dejar valor en mesa si solo se archiva la foto sin acción comercial.';
      break;
    default:
      interpretacionTecnica =
        'Contexto de instalación clima/industrial genérico — requiere validación humana pero ya es señal operable.';
      impactoEconomicoEstimado = roundMoney(baseTicket * 0.4);
      accionRecomendada = 'Clasificar en OT o oportunidad y asignar técnico + responsable comercial.';
      riesgoAsociado = 'Riesgo medio: información visual sin trazabilidad en sistema.';
  }

  const extra = clasificacionYCadena(sistema);
  const operativo = enrichIntelOperativo(sistema, interpretacionTecnica);

  const partial = {
    version: JARVIS_IMAGE_INTEL_VERSION,
    ok: true,
    sistema,
    clasificacionJarvis: sistema,
    ...extra,
    ...operativo,
    interpretacionTecnica,
    impactoEconomicoEstimado,
    accionRecomendada,
    riesgoAsociado,
    meta: {
      meanLum: Math.round(meanLum * 1000) / 1000,
      varianceSample: Math.round(variance),
      aspect: Math.round(aspect * 100) / 100,
      file: file.name || 'imagen',
      nota: 'Análisis heurístico local — sin modelo de visión remoto. Validar con técnico.',
    },
  };
  return finalizeImageResult(partial);
}

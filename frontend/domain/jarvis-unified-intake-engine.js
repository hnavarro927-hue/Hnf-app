/**
 * Ingesta unificada — un solo contrato de significado para HQ y memoria.
 */

import { classifyIntakePayload, processIntakeFile } from './jarvis-active-intake-engine.js';

export const JARVIS_UNIFIED_INTAKE_VERSION = '2026-03-24';

/**
 * @param {object|string|File} input
 */
export function normalizeAnyInboundInput(input) {
  if (input instanceof File) return { type: 'file', file: input };
  if (input && typeof input === 'object' && input.file instanceof File) return { type: 'file', file: input.file, label: input.label };
  if (input && typeof input === 'object' && input.outlookMessage) return { type: 'outlook', message: input.outlookMessage };
  const text = typeof input === 'string' ? input : input?.text;
  if (text != null) return { type: 'texto', text: String(text) };
  return { type: 'desconocido', raw: input };
}

/**
 * @param {ReturnType<typeof normalizeAnyInboundInput>} normalized
 */
export function classifyInboundChannel(normalized) {
  const n = normalized || {};
  if (n.type === 'file') {
    const t = n.file?.type || '';
    if (t.startsWith('image/')) return 'imagen';
    return 'archivo';
  }
  if (n.type === 'outlook') return 'outlook';
  if (n.type === 'texto') {
    const c = classifyIntakePayload(n.text);
    if (c.canalSalida === 'correo' || c.canal === 'outlook') return 'outlook';
    if (c.canalSalida === 'whatsapp' || c.canal === 'whatsapp') return 'whatsapp';
    if (c.canalSalida === 'ot' || c.tipo === 'ot') return 'ot';
    return 'texto';
  }
  return 'texto';
}

function inferCliente(c) {
  const t = String(c.excerpt || c.vinculoSugerido || '').slice(0, 400);
  const m = t.match(/cliente[:\s]+([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 .,&'-]{2,40})/i);
  if (m) return m[1].trim();
  if (/puma|jumbo|lider|falabella|ripley|paris/i.test(t)) {
    const mm = t.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)\b/);
    if (mm) return mm[1];
  }
  return '—';
}

function canalPublico(kind, c) {
  if (kind === 'imagen') return 'imagen';
  const cs = c.canalSalida || c.canal || '';
  if (cs === 'correo' || c.canal === 'outlook') return 'outlook';
  if (cs === 'whatsapp') return 'whatsapp';
  if (cs === 'ot' || c.tipo === 'ot') return 'ot';
  if (c.canal === 'archivo_texto' && kind === 'texto') return 'archivo';
  return kind === 'binario' ? 'archivo' : 'texto';
}

/**
 * @param {object} processResult - salida processIntakeFile
 * @param {object} [unified]
 */
export function buildInboundMeaning(processResult, unified) {
  const pr = processResult || {};
  const c = pr.classification || {};
  const img = pr.imageIntel;
  const canal = canalPublico(pr.kind, c);
  const titulo =
    pr.kind === 'imagen'
      ? `Imagen · ${pr.name || 'archivo'}`
      : pr.name
        ? `Archivo · ${pr.name}`
        : c.source === 'texto_pegar'
          ? 'Texto pegado'
          : 'Entrada';

  const resumenEjecutivoImg = img?.resumenEjecutivo || img?.resumenOperativo || c.resumenImagen || '';
  const resumen =
    resumenEjecutivoImg ||
    [c.excerpt, c.narrativaRiesgo].filter(Boolean).join(' ').slice(0, 280) ||
    String(c.accionInmediata || '').slice(0, 200);

  const queEntro =
    pr.kind === 'imagen'
      ? `Llegó una imagen de terreno o evidencia (${pr.name || 'sin nombre'}).`
      : pr.kind === 'texto'
        ? `Llegó texto/archivo legible (${pr.name || 'contenido'}).`
        : `Llegó un archivo (${pr.name || 'binario'}) que requiere tratamiento.`;

  const significa =
    c.tipoSalida === 'oportunidad'
      ? 'Hay palanca comercial o de contrato en juego.'
      : c.tipoSalida === 'problema'
        ? 'Hay fricción técnica u operativa que puede frenar cobro o satisfacción.'
        : c.tipoSalida === 'riesgo'
          ? 'Hay exposición o incertidumbre que conviene acotar antes de responder.'
          : 'Es contexto que hay que anclar a cliente, OT u oportunidad para que sea ejecutable.';

  const queRiesgoGenera =
    c.generaRiesgo || c.narrativaRiesgo
      ? String(c.narrativaRiesgo || 'Riesgo de demora, retrabajo o pérdida de ritmo si queda sin dueño.').slice(0, 220)
      : 'Riesgo bajo si se asigna siguiente paso en menos de 24–48h.';

  const queOportunidadAbre =
    c.generaOportunidad || c.tipoSalida === 'oportunidad'
      ? String(c.narrativaOportunidad || 'Oportunidad de visita vendible, mantención o upgrade.').slice(0, 220)
      : 'Oportunidad indirecta: ordenar data y cerrar un hilo pendiente.';

  const queAccionRecomienda = String(c.accionInmediata || 'Asignar dueño y siguiente paso con fecha.').slice(0, 260);

  return {
    version: JARVIS_UNIFIED_INTAKE_VERSION,
    canal,
    titulo,
    origen: pr.name || c.source || 'ingesta_hq',
    cliente: inferCliente(c),
    responsable: c.responsable || 'Operación',
    urgencia: c.urgencia || 'media',
    riesgo: c.generaRiesgo ? 'elevado' : c.tipoSalida === 'riesgo' ? 'alto' : 'acotado',
    oportunidad: c.generaOportunidad || c.tipoSalida === 'oportunidad' ? 'si' : 'latente',
    impactoEconomico: Math.round(Number(c.impactoEconomicoEstimado || c.ingresoPotencial || 0) || 0),
    resumen,
    accionSugerida: queAccionRecomienda,
    vinculoSugerido: String(c.vinculoSugerido || '').slice(0, 240),
    mostrarEnHQ: true,
    queEntro,
    significa,
    queRiesgoGenera,
    queOportunidadAbre,
    queAccionRecomienda,
    _unifiedRef: Boolean(unified),
  };
}

export function buildInboundActionSuggestion(input, unified) {
  const meaning = typeof input?.canal === 'string' && input.accionSugerida ? input : buildInboundMeaning(input, unified);
  return {
    accion: meaning.accionSugerida,
    responsable: meaning.responsable,
    urgencia: meaning.urgencia,
    impactoEconomico: meaning.impactoEconomico,
  };
}

export function buildInboundVisualCard(input, unified) {
  const m = typeof input?.canal === 'string' && input.queEntro ? input : buildInboundMeaning(input, unified);
  return {
    headline: `[${m.canal}] ${m.cliente !== '—' ? m.cliente : 'Cliente no inferido'}`,
    lines: {
      entro: m.queEntro,
      significa: m.significa,
      riesgo: m.queRiesgoGenera,
      oportunidad: m.queOportunidadAbre,
      accion: m.queAccionRecomienda,
    },
    impacto: m.impactoEconomico,
    at: new Date().toISOString(),
  };
}

/**
 * Cadena de 5 pasos para texto/archivo (imagen usa interpretacionPipeline en image-intel).
 */
export function buildInboundInterpretationPipeline(processResult, unified) {
  const m = buildInboundMeaning(processResult, unified);
  const warnRiesgo = m.riesgo === 'elevado' || m.riesgo === 'alto';
  return {
    version: JARVIS_UNIFIED_INTAKE_VERSION,
    pasos: [
      { n: 1, titulo: 'Identificación', cuerpo: `${m.titulo}. ${m.queEntro}`, estado: 'ok' },
      { n: 2, titulo: 'Riesgo', cuerpo: m.queRiesgoGenera, estado: warnRiesgo ? 'warn' : 'ok' },
      { n: 3, titulo: 'Oportunidad', cuerpo: m.queOportunidadAbre, estado: 'ok' },
      { n: 4, titulo: 'Acción', cuerpo: m.queAccionRecomienda, estado: 'ok' },
      {
        n: 5,
        titulo: 'Destino',
        cuerpo: `Canal ${m.canal}: memoria local, HQ y cola sugerida · ${m.vinculoSugerido ? `Vínculo: ${m.vinculoSugerido.slice(0, 120)}` : 'Integración a feed operativo.'}`,
        estado: 'ok',
      },
    ],
  };
}

/**
 * @param {File} file
 * @param {object} [unified]
 */
export async function processUnifiedInboundFile(file, unified) {
  const pr = await processIntakeFile(file);
  const meaning = buildInboundMeaning(pr, unified);
  return { processResult: pr, meaning, card: buildInboundVisualCard(meaning, unified) };
}

/**
 * @param {string} rawText
 * @param {object} [unified]
 */
export function processUnifiedInboundText(rawText, unified) {
  const c = classifyIntakePayload(rawText);
  const pr = { kind: 'texto', name: 'pegado', classification: c };
  const meaning = buildInboundMeaning(pr, unified);
  return { processResult: pr, meaning, card: buildInboundVisualCard(meaning, unified) };
}

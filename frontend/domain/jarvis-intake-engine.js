/**
 * Motor Jarvis Operativo v1 — espejo de backend/src/domain/jarvis-intake-engine.js
 * (lógica local en navegador, sin IA externa).
 */

export const JARVIS_INTAKE_ENGINE_VERSION = '1.0.0';

const normTxt = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

export const normalizePhone = (s) => String(s || '').replace(/\D/g, '').slice(-9);

export const normalizeEmail = (s) => normTxt(s).replace(/\s/g, '');

/** @param {{ name?: string, mimeType?: string }} d */
export function classifyFileDescriptor(d) {
  const name = String(d?.name || '');
  const mime = String(d?.mimeType || '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  let categoria = 'otro';
  if (/pdf/.test(mime) || ext === '.pdf') categoria = 'pdf';
  else if (/spreadsheet|excel|csv/.test(mime) || ['.xlsx', '.xls', '.csv'].includes(ext)) categoria = 'hoja_calculo';
  else if (/word|document/.test(mime) || ['.doc', '.docx'].includes(ext)) categoria = 'documento_word';
  else if (/image/.test(mime) || /\.(png|jpe?g|webp|gif)$/i.test(name)) categoria = 'imagen';
  return {
    nombre: name,
    categoria,
    mimeType: mime || null,
    estado_revision: 'borrador_detectado',
    nota: 'Metadato en OT / evento; archivo no persistido en servidor hasta integración de almacenamiento.',
  };
}

export function areaFromTipoServicio(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'flota') return 'flota';
  if (t === 'comercial') return 'comercial';
  if (t === 'administrativo') return 'administrativo';
  return 'clima';
}

export function bandejaFromArea(area) {
  const a = String(area || '').toLowerCase();
  if (a === 'flota') return { bandeja: 'gery', responsable: 'Gery' };
  if (a === 'comercial') return { bandeja: 'comercial', responsable: 'Lyn' };
  if (a === 'administrativo') return { bandeja: 'administrativo', responsable: 'Romina' };
  return { bandeja: 'romina', responsable: 'Romina' };
}

export function mapOrigenToDetectado(origen) {
  const o = String(origen || '').toLowerCase();
  const map = {
    whatsapp: 'whatsapp',
    email: 'correo',
    correo: 'correo',
    llamada: 'telefono',
    cliente_directo: 'manual',
    interno: 'manual',
    manual: 'manual',
  };
  return map[o] || 'manual';
}

export function matchEntities(ctx, input) {
  const clienteNombre = String(input.cliente || '').trim();
  const tel = normalizePhone(input.telefono);
  const wa = normalizePhone(input.whatsappNumero || input.whatsapp);
  const em = normalizeEmail(input.emailCorreo || input.email);
  const contacto = String(input.contacto || '').trim();

  const advertencias = [];
  let clienteMatch = 'pendiente_validacion';
  let clienteScore = 0;
  let clienteId = null;

  const clientes = Array.isArray(ctx.clientes) ? ctx.clientes : [];
  for (const c of clientes) {
    const n = String(c.nombre || c.name || c.cliente || '').trim();
    if (!n) continue;
    if (normTxt(n) === normTxt(clienteNombre) && clienteNombre) {
      clienteMatch = 'existente';
      clienteScore = 100;
      clienteId = c.id || null;
      break;
    }
    if (clienteNombre && normTxt(clienteNombre).length > 3 && normTxt(n).includes(normTxt(clienteNombre))) {
      clienteMatch = 'posible_duplicado';
      clienteScore = Math.max(clienteScore, 72);
    }
  }

  if (clienteNombre && clienteMatch === 'pendiente_validacion') {
    clienteMatch = 'posible_nuevo';
    clienteScore = 40;
  }

  const ots = Array.isArray(ctx.otsMuestra) ? ctx.otsMuestra : [];
  for (const o of ots) {
    const otTel = normalizePhone(o.telefonoContacto);
    if (tel && otTel && otTel === tel) {
      advertencias.push('Teléfono coincide con una OT existente: revisá duplicado de solicitud.');
      clienteScore = Math.min(100, clienteScore + 25);
      break;
    }
  }
  if (wa && tel && wa === tel) {
    advertencias.push('WhatsApp y teléfono normalizados coinciden: verificá que sea intencional.');
  }

  let contactoMatch = contacto ? 'capturado' : 'pendiente_validacion';
  if (contacto && clientes.some((c) => normTxt(c.contacto) === normTxt(contacto))) {
    contactoMatch = 'existente';
  }

  const vehMatch =
    Array.isArray(ctx.vehicles) &&
    ctx.vehicles.some((v) => {
      const p = normTxt(v.patente || v.plate || '');
      const blob = normTxt(`${input.descripcion || ''} ${input.observaciones || ''}`);
      return p && blob.includes(p);
    });

  if (vehMatch) advertencias.push('Texto sugiere patente de flota: confirmá si el pedido es Flota.');

  const duplicado_probable = advertencias.some((a) => /duplicado|coincid/i.test(a)) || clienteMatch === 'posible_duplicado';

  return {
    cliente: { nombre: clienteNombre || null, match: clienteMatch, score: clienteScore, id: clienteId },
    contacto: { nombre: contacto || null, match: contactoMatch },
    telefono_normalizado: tel || null,
    whatsapp_normalizado: wa || null,
    email_normalizado: em || null,
    duplicado_probable,
    advertencias,
  };
}

export function runJarvisIntakeClassification(input, matchContext = {}) {
  const origen = String(input.origen || 'interno');
  const tipo = String(input.tipoServicio || input.tipo || 'clima');
  const descripcion = String(input.descripcion || input.observaciones || '');
  const area = areaFromTipoServicio(tipo);
  const { bandeja, responsable } = bandejaFromArea(area);
  const origen_detectado = mapOrigenToDetectado(origen);

  const match = matchEntities(matchContext, {
    cliente: input.cliente,
    contacto: input.contacto,
    telefono: input.telefono,
    emailCorreo: input.emailCorreo,
    whatsappNumero: input.whatsappNumero,
    descripcion,
    observaciones: input.observaciones,
  });

  let confianza = 55;
  if (match.cliente.match === 'existente') confianza += 25;
  if (match.cliente.match === 'posible_duplicado') confianza -= 15;
  if (normalizePhone(input.telefono)) confianza += 8;
  if (String(input.comuna || '').trim()) confianza += 5;
  if (String(input.direccion || '').trim()) confianza += 5;
  if (descripcion.length > 40) confianza += 7;
  confianza = Math.max(12, Math.min(98, Math.round(confianza)));

  const advertencias = [...match.advertencias];
  if (confianza < 45) advertencias.push('Confianza baja: validar datos con el cliente antes de cerrar.');
  if (!String(input.comuna || '').trim()) advertencias.push('Falta comuna: afecta ruteo y SLA regional.');

  const prioridad_sugerida =
    /emergencia|urgente|ca[ií]da|sin fr[ií]o|detenido/i.test(descripcion) ? 'alta' : 'media';

  const accion_sugerida = `Enviar a bandeja ${bandeja} (${responsable}). ${duplicado_hint(match)}`;

  const documentos = Array.isArray(input.filesMeta)
    ? input.filesMeta.map((f) => classifyFileDescriptor(f))
    : [];

  const trace = [
    {
      at: new Date().toISOString(),
      step: 'clasificacion_v1',
      detalle: `area=${area} bandeja=${bandeja} confianza=${confianza}`,
      actor: String(input.actorIngreso || 'operador'),
    },
  ];

  return {
    version: JARVIS_INTAKE_ENGINE_VERSION,
    origen_detectado,
    area_sugerida: area,
    confianza_jarvis: confianza,
    cliente_detectado: match.cliente,
    contacto_detectado: match.contacto,
    duplicado_probable: match.duplicado_probable,
    bandeja_destino: bandeja,
    notificacion_destino: responsable,
    prioridad_sugerida,
    advertencias,
    accion_sugerida,
    documentos_adjuntos: documentos,
    trace,
    rawExcerpt: descripcion.slice(0, 500),
  };
}

function duplicado_hint(m) {
  if (m.duplicado_probable) return 'Revisar posible duplicado antes de agenda.';
  return 'Sin señales fuertes de duplicado.';
}

export function flattenBriefForJarvisEvent(brief, extra = {}) {
  return {
    version: JARVIS_INTAKE_ENGINE_VERSION,
    rawExcerpt: brief.rawExcerpt || '',
    tipoClasificado: 'jarvis_intake_v1',
    prioridad: brief.prioridad_sugerida === 'alta' ? 'ALTO' : 'NORMAL',
    canalSalida: brief.origen_detectado || 'manual',
    accionInmediata: String(brief.accion_sugerida || '').slice(0, 2000),
    clienteDetectado: brief.cliente_detectado?.nombre || null,
    origen_detectado: brief.origen_detectado,
    area_sugerida: brief.area_sugerida,
    confianza_jarvis: brief.confianza_jarvis,
    contacto_detectado: brief.contacto_detectado?.nombre || null,
    duplicado_probable: brief.duplicado_probable,
    bandeja_destino: brief.bandeja_destino,
    estado_revision: extra.estado_revision || 'pendiente_validacion',
    observacion_revision: extra.observacion_revision || null,
    actor_revision: extra.actor_revision || null,
    jarvisTrace: brief.trace || [],
    advertencias: brief.advertencias || [],
    fuente: extra.fuente || 'ingreso_operativo',
    persistencia: 'servidor',
    ...extra,
  };
}

export function briefToOtTrace(brief, { otId, actor } = {}) {
  return {
    engineVersion: JARVIS_INTAKE_ENGINE_VERSION,
    at: new Date().toISOString(),
    otId: otId || null,
    actorIngreso: actor || null,
    origen_detectado: brief.origen_detectado,
    area_sugerida: brief.area_sugerida,
    confianza_jarvis: brief.confianza_jarvis,
    cliente_detectado: brief.cliente_detectado,
    contacto_detectado: brief.contacto_detectado,
    duplicado_probable: brief.duplicado_probable,
    bandeja_destino: brief.bandeja_destino,
    notificacion_destino: brief.notificacion_destino,
    prioridad_sugerida: brief.prioridad_sugerida,
    advertencias: brief.advertencias,
    accion_sugerida: brief.accion_sugerida,
    documentos: brief.documentos_adjuntos || [],
    trace: brief.trace || [],
  };
}

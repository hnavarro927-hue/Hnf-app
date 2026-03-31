function normTexto(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function detectarOrigen(input) {
  if (input.source === 'whatsapp') return 'whatsapp';
  if (input.source === 'email') return 'email';
  return 'manual';
}

/**
 * @param {string} texto
 * @param {string} [cliente]
 * @param {string} [area]
 * @returns {'alta'|'media'|'baja'}
 */
function sugerirPrioridad(texto, cliente, area) {
  const t = normTexto(texto);
  void cliente;
  void area;

  const altaMarcas = [
    'urgente',
    'fuga',
    'detenido',
    'falla total',
    'no enfria',
    'pana',
    'inmovilizado',
  ];
  for (const m of altaMarcas) {
    if (t.includes(normTexto(m))) return 'alta';
  }

  const mediaMarcas = ['revision', 'mantencion', 'visita', 'diagnostico'];
  for (const m of mediaMarcas) {
    if (t.includes(normTexto(m))) return 'media';
  }

  return 'baja';
}

/**
 * @param {string} texto
 * @returns {boolean}
 */
function detectarRiesgo(texto) {
  const t = normTexto(texto);
  const marcas = [
    'detenido',
    'fuga',
    'urgente',
    'cliente molesto',
    'atraso',
    'sin respuesta',
  ];
  return marcas.some((m) => t.includes(normTexto(m)));
}

function clasificarArea(texto) {
  const t = normTexto(texto);

  if (t.includes('aire') || t.includes('clima') || t.includes('mantencion')) {
    return 'clima';
  }

  if (t.includes('vehiculo') || t.includes('traslado') || t.includes('flota')) {
    return 'flota';
  }

  return 'clima';
}

function asignarResponsable(area) {
  const responsable = area === 'clima' ? 'Romina' : 'Gery';
  return responsable;
}

function crearOTDesdeInput(input = {}) {
  const origen = detectarOrigen(input);
  const area = clasificarArea(input.texto || '');
  const responsable = asignarResponsable(area);

  return {
    id: `OT-${Date.now()}`,
    origen,
    area,
    responsable,
    cliente: input.cliente || 'Sin cliente',
    descripcion: input.texto || '',
    estado: 'ingreso',
    fecha: new Date().toISOString(),
  };
}

module.exports = {
  clasificarArea,
  crearOTDesdeInput,
  detectarRiesgo,
  sugerirPrioridad,
};

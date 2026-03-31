function detectarOrigen(input) {
  if (input.source === 'whatsapp') return 'whatsapp';
  if (input.source === 'email') return 'email';
  return 'manual';
}

function clasificarArea(texto = '') {
  const t = texto.toLowerCase();

  // Flota primero: evita que palabras genéricas («mantención», «equipo») ganen sobre señales de flota.
  if (
    t.includes('traslado') ||
    t.includes('flota') ||
    t.includes('vehiculo') ||
    t.includes('vehículo') ||
    t.includes('camion') ||
    t.includes('camión') ||
    t.includes('rt')
  ) {
    return 'flota';
  }

  if (
    t.includes('aire') ||
    t.includes('clima') ||
    t.includes('mantencion') ||
    t.includes('mantención') ||
    t.includes('equipo')
  ) {
    return 'clima';
  }

  return 'indefinido';
}

function asignarResponsable(area) {
  if (area === 'clima') return 'Romina';
  if (area === 'flota') return 'Gery';
  return 'Pendiente';
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
  crearOTDesdeInput,
};

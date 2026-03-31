function detectarOrigen(input) {
  if (input.source === 'whatsapp') return 'whatsapp';
  if (input.source === 'email') return 'email';
  return 'manual';
}

function clasificarArea(texto = '') {
  const t = texto.toLowerCase();

  if (
    t.includes('aire') ||
    t.includes('clima') ||
    t.includes('mantencion') ||
    t.includes('equipo')
  ) {
    return 'clima';
  }

  if (
    t.includes('traslado') ||
    t.includes('flota') ||
    t.includes('vehiculo') ||
    t.includes('rt')
  ) {
    return 'flota';
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

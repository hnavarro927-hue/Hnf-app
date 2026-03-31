function detectarOrigen(input) {
  if (input.source === 'whatsapp') return 'whatsapp';
  if (input.source === 'email') return 'email';
  return 'manual';
}

function clasificarArea(texto) {
  const t = String(texto ?? '').toLowerCase();

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
};

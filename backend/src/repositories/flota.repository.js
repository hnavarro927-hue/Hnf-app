const vehiculos = [];
const gestionDiaria = [];
const ots = [];

const id = (prefix, list) => `${prefix}-${String(list.length + 1).padStart(3, '0')}`;

export const flotaRepository = {
  mode: 'memory-fallback',
  vehiculos,
  gestionDiaria,
  ots,
  createVehiculo: (data) => (vehiculos.push({ id: id('VEH', vehiculos), ...data }), vehiculos[vehiculos.length - 1]),
  createGestion: (data) => (gestionDiaria.push({ id: id('GDF', gestionDiaria), ...data }), gestionDiaria[gestionDiaria.length - 1]),
  updateGestion: (idGestion, data) => {
    const row = gestionDiaria.find((item) => item.id === idGestion);
    if (!row) return null;
    Object.assign(row, data);
    return row;
  },
  createOT: (data) => (ots.push({ id: id('OTF', ots), ...data }), ots[ots.length - 1]),
  updateOT: (idOt, data) => {
    const row = ots.find((item) => item.id === idOt);
    if (!row) return null;
    Object.assign(row, data);
    return row;
  },
};

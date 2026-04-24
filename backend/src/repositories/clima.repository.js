const clientes = [
  {
    id: 'CLI-100',
    razonSocial: 'PUMA ENERGY CHILE SPA',
    nombreComercial: 'PUMA Chile',
    rut: '76.123.456-7',
    contactoPrincipal: 'Alejandra Lira',
    correo: 'alejandra.lira@pumaenergy.com',
    telefono: '+56 9 5555 1111',
    tipoCliente: 'clima_contrato',
    activo: true,
  },
];

const tiendas = [
  {
    id: 'PUMA-001',
    clienteId: 'CLI-100',
    region: 'Metropolitana',
    storeType: 'EDS',
    nombreTienda: 'Puma Quilicura Norte',
    direccion: 'Panamericana Norte 1200',
    centroComercial: '',
    ciudad: 'Santiago',
    frecuenciaMantencion: 'bimensual',
    cantidadEquipos: 8,
    valorPreventivoClp: 320000,
    estadoOperativo: 'activa',
    incluidaEnContrato: true,
    observaciones: 'Cobertura nacional, no incluir recarga de gas en preventivo.',
    version: 1,
    vigenciaDesde: '2026-01-01',
  },
];

const equipos = [];
const calendario = [];
const informes = [];
const ots = [];
const emergencias = [];

const id = (prefix, list) => `${prefix}-${String(list.length + 1).padStart(3, '0')}`;

export const climaRepository = {
  mode: 'memory-fallback',
  clientes,
  tiendas,
  equipos,
  calendario,
  informes,
  ots,
  emergencias,
  createCliente: (data) => (clientes.push({ id: id('CLI', clientes), ...data }), clientes[clientes.length - 1]),
  createTienda: (data) => (tiendas.push({ id: id('PUMA', tiendas), ...data }), tiendas[tiendas.length - 1]),
  updateTienda: (idTienda, data) => {
    const row = tiendas.find((t) => t.id === idTienda);
    if (!row) return null;
    Object.assign(row, data);
    return row;
  },
  createEquipo: (data) => (equipos.push({ id: id('EQC', equipos), ...data }), equipos[equipos.length - 1]),
  createCalendario: (data) => (calendario.push({ id: id('CAL', calendario), ...data }), calendario[calendario.length - 1]),
  updateCalendario: (idCal, data) => {
    const row = calendario.find((c) => c.id === idCal);
    if (!row) return null;
    Object.assign(row, data);
    return row;
  },
  createInforme: (data) => (informes.push({ id: id('INF', informes), ...data }), informes[informes.length - 1]),
  updateInforme: (idInf, data) => {
    const row = informes.find((i) => i.id === idInf);
    if (!row) return null;
    Object.assign(row, data);
    return row;
  },
  createOT: (data) => (ots.push({ id: id('OTC', ots), ...data }), ots[ots.length - 1]),
  updateOT: (idOt, data) => {
    const row = ots.find((o) => o.id === idOt);
    if (!row) return null;
    Object.assign(row, data);
    return row;
  },
  createEmergencia: (data) => (emergencias.push({ id: id('EMC', emergencias), ...data }), emergencias[emergencias.length - 1]),
};

/**
 * Validación y normalización de importación JSON → bundle maestro (sin I/O).
 */

export const MASTER_IMPORT_SECTION_KEYS = [
  'clients',
  'clientContacts',
  'branchesOrStores',
  'contracts',
  'maintenanceFrequencies',
  'employees',
  'roles',
  'serviceCatalog',
  'pricingCatalog',
  'assetCatalog',
  'payrollCosts',
];

/** Claves legacy aceptadas en el JSON (no fallan "clave no reconocida"). */
export const MASTER_IMPORT_LEGACY_KEYS = ['assetsOrEquipment'];

const LABEL = {
  clients: 'clientes',
  clientContacts: 'contactos por cliente',
  branchesOrStores: 'tiendas / sucursales',
  contracts: 'contratos',
  maintenanceFrequencies: 'frecuencias de mantención',
  employees: 'empleados',
  roles: 'roles',
  serviceCatalog: 'catálogo de servicios',
  pricingCatalog: 'catálogo de precios',
  assetCatalog: 'catálogo de activos',
  payrollCosts: 'costos RRHH',
};

function str(v) {
  return String(v ?? '').trim();
}

function requireId(row, sectionKey, index, errors) {
  const id = str(row?.id);
  if (!id) errors.push(`${LABEL[sectionKey] || sectionKey} [${index + 1}]: falta "id".`);
  return id;
}

function req(row, key, sectionLabel, index, errors, msg) {
  const v = str(row?.[key]);
  if (!v) errors.push(`${sectionLabel} [${index + 1}]: ${msg || `falta "${key}".`}`);
  return v;
}

function validateClients(rows, errors) {
  const out = [];
  const seen = new Set();
  const UN = new Set(['clima', 'flota', 'mixto']);
  rows.forEach((row, i) => {
    const id = requireId(row, 'clients', i, errors);
    const nombre = str(row?.nombre || row?.nombre_cliente);
    if (!nombre) errors.push(`clientes [${i + 1}]: falta "nombre" o "nombre_cliente".`);
    const unidadNegocio = str(row?.unidadNegocio).toLowerCase();
    if (!unidadNegocio || !UN.has(unidadNegocio)) {
      errors.push(`clientes [${i + 1}]: "unidadNegocio" debe ser clima, flota o mixto.`);
    }
    const estado = str(row?.estado);
    if (!estado) errors.push(`clientes [${i + 1}]: falta "estado".`);
    if (id && seen.has(id)) errors.push(`clientes [${i + 1}]: id duplicado "${id}".`);
    if (id) seen.add(id);
    out.push({
      ...row,
      id,
      nombre: nombre || str(row?.nombre_cliente),
      rut: str(row?.rut),
      unidadNegocio,
      estado,
      notas: str(row?.notas),
    });
  });
  return out;
}

function validateClientContacts(rows, errors, existingClientIds) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const id = requireId(row, 'clientContacts', i, errors);
    const clientId = str(row?.clientId);
    if (!clientId) errors.push(`${LABEL.clientContacts} [${i + 1}]: falta "clientId".`);
    else if (!existingClientIds.has(clientId)) {
      errors.push(`${LABEL.clientContacts} [${i + 1}]: clientId "${clientId}" no resuelto.`);
    }
    req(row, 'nombre', LABEL.clientContacts, i, errors);
    req(row, 'cargo', LABEL.clientContacts, i, errors);
    req(row, 'email', LABEL.clientContacts, i, errors);
    req(row, 'telefono', LABEL.clientContacts, i, errors);
    req(row, 'canalPreferido', LABEL.clientContacts, i, errors);
    req(row, 'scope', LABEL.clientContacts, i, errors);
    if (id && seen.has(id)) errors.push(`${LABEL.clientContacts} [${i + 1}]: id duplicado.`);
    if (id) seen.add(id);
    out.push({
      ...row,
      id,
      clientId,
      nombre: str(row.nombre),
      cargo: str(row.cargo),
      email: str(row.email),
      telefono: str(row.telefono),
      canalPreferido: str(row.canalPreferido),
      scope: str(row.scope),
      sucursalRelacionadaId: str(row.sucursalRelacionadaId) || undefined,
      notas: str(row?.notas),
    });
  });
  return out;
}

const TIPO_SUC = new Set(['casa_matriz', 'store', 'outlet', 'base', 'taller', 'otro']);

function validateBranches(rows, errors, existingClientIds) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const id = requireId(row, 'branchesOrStores', i, errors);
    const clientId = str(row?.clientId);
    if (!clientId) errors.push(`${LABEL.branchesOrStores} [${i + 1}]: falta "clientId".`);
    else if (!existingClientIds.has(clientId)) {
      errors.push(`${LABEL.branchesOrStores} [${i + 1}]: clientId no resuelto.`);
    }
    req(row, 'nombre', LABEL.branchesOrStores, i, errors);
    const tipo = str(row?.tipo || row?.tipoTienda).toLowerCase().replace(/-/g, '_');
    if (!tipo || !TIPO_SUC.has(tipo)) {
      errors.push(
        `${LABEL.branchesOrStores} [${i + 1}]: "tipo" inválido (casa_matriz, store, outlet, base, taller, otro).`
      );
    }
    req(row, 'region', LABEL.branchesOrStores, i, errors);
    req(row, 'ciudad', LABEL.branchesOrStores, i, errors);
    req(row, 'direccion', LABEL.branchesOrStores, i, errors);
    req(row, 'zonaOperativa', LABEL.branchesOrStores, i, errors);
    req(row, 'estado', LABEL.branchesOrStores, i, errors);
    if (id && seen.has(id)) errors.push(`${LABEL.branchesOrStores} [${i + 1}]: id duplicado.`);
    if (id) seen.add(id);
    out.push({
      ...row,
      id,
      clientId,
      nombre: str(row.nombre),
      tipo,
      region: str(row.region),
      ciudad: str(row.ciudad),
      direccion: str(row.direccion),
      zonaOperativa: str(row.zonaOperativa),
      contactoPrincipalId: str(row?.contactoPrincipalId) || undefined,
      correoLocal: str(row?.correoLocal),
      dmNombre: str(row?.dmNombre),
      dmEmail: str(row?.dmEmail),
      assistantNombre: str(row?.assistantNombre),
      assistantEmail: str(row?.assistantEmail),
      estado: str(row.estado),
      notas: str(row?.notas),
    });
  });
  return out;
}

function validateContracts(rows, errors, existingClientIds, branchIds) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const id = requireId(row, 'contracts', i, errors);
    const clientId = str(row?.clientId);
    if (!clientId || !existingClientIds.has(clientId)) {
      errors.push(`${LABEL.contracts} [${i + 1}]: "clientId" obligatorio y debe existir.`);
    }
    const bid = str(row?.branchId);
    if (bid && !branchIds.has(bid)) {
      errors.push(`${LABEL.contracts} [${i + 1}]: branchId "${bid}" no existe en sucursales del archivo/base.`);
    }
    req(row, 'nombreContrato', LABEL.contracts, i, errors, 'falta "nombreContrato".');
    req(row, 'linea', LABEL.contracts, i, errors);
    req(row, 'modalidadFacturacion', LABEL.contracts, i, errors);
    req(row, 'moneda', LABEL.contracts, i, errors);
    if (str(row?.montoBase) === '' && row?.montoBase !== 0) {
      errors.push(`${LABEL.contracts} [${i + 1}]: falta "montoBase".`);
    }
    req(row, 'frecuenciaFacturacion', LABEL.contracts, i, errors);
    req(row, 'vigenciaInicio', LABEL.contracts, i, errors);
    req(row, 'vigenciaFin', LABEL.contracts, i, errors);
    req(row, 'observaciones', LABEL.contracts, i, errors, 'falta "observaciones" (podés usar "—").');
    if (id && seen.has(id)) errors.push(`${LABEL.contracts} [${i + 1}]: id duplicado.`);
    if (id) seen.add(id);
    out.push({ ...row, id, clientId, branchId: bid || undefined });
  });
  return out;
}

function validateMaintenanceFrequencies(rows, errors, existingClientIds, branchIds) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const id = requireId(row, 'maintenanceFrequencies', i, errors);
    const clientId = str(row?.clientId);
    const branchId = str(row?.branchId);
    if (!clientId || !existingClientIds.has(clientId)) {
      errors.push(`${LABEL.maintenanceFrequencies} [${i + 1}]: clientId inválido.`);
    }
    if (!branchId || !branchIds.has(branchId)) {
      errors.push(`${LABEL.maintenanceFrequencies} [${i + 1}]: branchId inválido o inexistente.`);
    }
    req(row, 'linea', LABEL.maintenanceFrequencies, i, errors);
    req(row, 'frecuencia', LABEL.maintenanceFrequencies, i, errors);
    req(row, 'detalle', LABEL.maintenanceFrequencies, i, errors, 'falta "detalle" (podés usar "—").');
    const activo = row?.activo;
    if (activo !== true && activo !== false && str(activo).toLowerCase() !== 'true' && str(activo).toLowerCase() !== 'false') {
      errors.push(`${LABEL.maintenanceFrequencies} [${i + 1}]: "activo" debe ser booleano.`);
    }
    const act = activo === true || str(activo).toLowerCase() === 'true';
    if (id && seen.has(id)) errors.push(`${LABEL.maintenanceFrequencies} [${i + 1}]: id duplicado.`);
    if (id) seen.add(id);
    out.push({
      ...row,
      id,
      clientId,
      branchId,
      linea: str(row.linea),
      frecuencia: str(row.frecuencia),
      detalle: str(row.detalle),
      mesReferencia: str(row?.mesReferencia) || undefined,
      activo: act,
    });
  });
  return out;
}

function validateEmployees(rows, errors) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const id = requireId(row, 'employees', i, errors);
    req(row, 'nombre', LABEL.employees, i, errors);
    req(row, 'rut', LABEL.employees, i, errors, 'falta "rut" (podés usar "—").');
    req(row, 'area', LABEL.employees, i, errors);
    req(row, 'especialidad', LABEL.employees, i, errors, 'falta "especialidad" (podés usar "—").');
    req(row, 'rolOperativo', LABEL.employees, i, errors);
    req(row, 'telefono', LABEL.employees, i, errors, 'falta "telefono" (podés usar "—").');
    req(row, 'email', LABEL.employees, i, errors);
    const activo = row?.activo;
    if (activo !== true && activo !== false && str(activo).toLowerCase() !== 'true' && str(activo).toLowerCase() !== 'false') {
      errors.push(`${LABEL.employees} [${i + 1}]: "activo" debe ser booleano.`);
    }
    const act = activo === true || str(activo).toLowerCase() === 'true';
    if (id && seen.has(id)) errors.push(`${LABEL.employees} [${i + 1}]: id duplicado.`);
    if (id) seen.add(id);
    out.push({
      ...row,
      id,
      nombre: str(row.nombre),
      rut: str(row.rut),
      area: str(row.area),
      especialidad: str(row.especialidad),
      rolOperativo: str(row.rolOperativo),
      telefono: str(row.telefono),
      email: str(row.email),
      tipoLicencia: str(row?.tipoLicencia) || undefined,
      activo: act,
      notas: str(row?.notas),
    });
  });
  return out;
}

function validateRoles(rows, errors) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const id = requireId(row, 'roles', i, errors);
    req(row, 'label', LABEL.roles, i, errors);
    req(row, 'scope', LABEL.roles, i, errors);
    const pb = row?.permisosBase;
    if (pb == null || (typeof pb !== 'string' && typeof pb !== 'object')) {
      errors.push(`${LABEL.roles} [${i + 1}]: "permisosBase" debe ser string u objeto.`);
    }
    if (id && seen.has(id)) errors.push(`${LABEL.roles} [${i + 1}]: id duplicado.`);
    if (id) seen.add(id);
    out.push({
      ...row,
      id,
      label: str(row.label),
      scope: str(row.scope),
      permisosBase: typeof pb === 'object' ? pb : str(pb),
    });
  });
  return out;
}

function validateServiceCatalog(rows, errors) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const id = requireId(row, 'serviceCatalog', i, errors);
    req(row, 'codigoInterno', LABEL.serviceCatalog, i, errors);
    const nombre = str(row?.nombre || row?.label);
    if (!nombre) errors.push(`${LABEL.serviceCatalog} [${i + 1}]: falta "nombre" o "label".`);
    const linea = str(row?.linea || row?.area);
    if (!linea) errors.push(`${LABEL.serviceCatalog} [${i + 1}]: falta "linea" (o "area").`);
    req(row, 'categoria', LABEL.serviceCatalog, i, errors, 'falta "categoria" (podés usar "—").');
    req(row, 'subtipo', LABEL.serviceCatalog, i, errors, 'falta "subtipo" (podés usar "—").');
    req(row, 'unidadCobro', LABEL.serviceCatalog, i, errors);
    const activo = row?.activo;
    if (activo !== true && activo !== false && str(activo).toLowerCase() !== 'true' && str(activo).toLowerCase() !== 'false') {
      errors.push(`${LABEL.serviceCatalog} [${i + 1}]: "activo" booleano.`);
    }
    const act = activo === true || str(activo).toLowerCase() === 'true';
    if (id && seen.has(id)) errors.push(`${LABEL.serviceCatalog} [${i + 1}]: id duplicado.`);
    if (id) seen.add(id);
    out.push({
      ...row,
      id,
      codigoInterno: str(row.codigoInterno),
      nombre,
      linea,
      categoria: str(row.categoria),
      subtipo: str(row.subtipo),
      unidadCobro: str(row.unidadCobro),
      activo: act,
    });
  });
  return out;
}

function validatePricingCatalog(rows, errors, serviceIds, existingClientIds) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const id = requireId(row, 'pricingCatalog', i, errors);
    const serviceId = str(row?.serviceId);
    if (!serviceId || !serviceIds.has(serviceId)) {
      errors.push(`${LABEL.pricingCatalog} [${i + 1}]: "serviceId" debe existir en serviceCatalog.`);
    }
    const optCid = str(row?.clientId);
    if (optCid && !existingClientIds.has(optCid)) {
      errors.push(`${LABEL.pricingCatalog} [${i + 1}]: clientId opcional no resuelto.`);
    }
    req(row, 'lista', LABEL.pricingCatalog, i, errors);
    req(row, 'moneda', LABEL.pricingCatalog, i, errors);
    const precio = row?.precioNeto ?? row?.valorReferencia;
    if (precio === undefined || precio === null || str(precio) === '') {
      errors.push(`${LABEL.pricingCatalog} [${i + 1}]: falta "precioNeto" (o "valorReferencia").`);
    }
    req(row, 'vigenciaDesde', LABEL.pricingCatalog, i, errors);
    req(row, 'vigenciaHasta', LABEL.pricingCatalog, i, errors);
    req(row, 'notas', LABEL.pricingCatalog, i, errors, 'falta "notas" (podés usar "—").');
    if (id && seen.has(id)) errors.push(`${LABEL.pricingCatalog} [${i + 1}]: id duplicado.`);
    if (id) seen.add(id);
    out.push({
      ...row,
      id,
      serviceId,
      clientId: optCid || undefined,
      lista: str(row.lista),
      moneda: str(row.moneda),
      precioNeto: precio,
      vigenciaDesde: str(row.vigenciaDesde),
      vigenciaHasta: str(row.vigenciaHasta),
      notas: str(row.notas),
    });
  });
  return out;
}

function validateAssetCatalog(rows, errors, branchIds) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const id = requireId(row, 'assetCatalog', i, errors);
    const branchId = str(row?.branchId);
    if (!branchId || !branchIds.has(branchId)) {
      errors.push(`${LABEL.assetCatalog} [${i + 1}]: "branchId" obligatorio y debe existir en sucursales.`);
    }
    const tipoActivo = str(row?.tipoActivo || row?.tipo);
    if (!tipoActivo) errors.push(`${LABEL.assetCatalog} [${i + 1}]: falta "tipoActivo" (o "tipo").`);
    req(row, 'subtipo', LABEL.assetCatalog, i, errors, 'falta "subtipo" (podés usar "—").');
    const cant = row?.cantidad;
    if (cant === undefined || cant === null || Number.isNaN(Number(cant))) {
      errors.push(`${LABEL.assetCatalog} [${i + 1}]: "cantidad" numérica.`);
    }
    req(row, 'observaciones', LABEL.assetCatalog, i, errors, 'falta "observaciones" (podés usar "—").');
    if (id && seen.has(id)) errors.push(`${LABEL.assetCatalog} [${i + 1}]: id duplicado.`);
    if (id) seen.add(id);
    out.push({
      ...row,
      id,
      branchId,
      tipoActivo,
      subtipo: str(row.subtipo),
      cantidad: Number(cant),
      observaciones: str(row.observaciones),
      costoReferencia: row?.costoReferencia,
    });
  });
  return out;
}

function validatePayrollCosts(rows, errors, employeeIds) {
  const out = [];
  const seen = new Set();
  const nums = [
    'sueldoBase',
    'gratificacion',
    'bonoAsistencia',
    'colacion',
    'bonoTelefono',
    'totalHaberes',
    'aportesPatronales',
    'costoEmpresa',
    'provisionAntiguedad',
    'provisionIndemnizacionMes',
    'provisionVacaciones',
    'costoEmpresaMes',
  ];
  rows.forEach((row, i) => {
    const id = requireId(row, 'payrollCosts', i, errors);
    const employeeId = str(row?.employeeId);
    if (!employeeId || !employeeIds.has(employeeId)) {
      errors.push(`${LABEL.payrollCosts} [${i + 1}]: "employeeId" debe existir en employees.`);
    }
    req(row, 'periodo', LABEL.payrollCosts, i, errors);
    for (const k of nums) {
      const v = row?.[k];
      if (v === undefined || v === null || Number.isNaN(Number(v))) {
        errors.push(`${LABEL.payrollCosts} [${i + 1}]: "${k}" debe ser numérico (usá 0).`);
      }
    }
    if (id && seen.has(id)) errors.push(`${LABEL.payrollCosts} [${i + 1}]: id duplicado.`);
    if (id) seen.add(id);
    const o = { ...row, id, employeeId, periodo: str(row.periodo) };
    for (const k of nums) o[k] = Number(row[k]);
    out.push(o);
  });
  return out;
}

/** Normaliza filas legacy assetsOrEquipment → assetCatalog. */
function legacyAssetsToCatalogRows(rawRows) {
  if (!Array.isArray(rawRows)) return [];
  return rawRows.map((row) => ({
    ...row,
    tipoActivo: row?.tipoActivo || row?.tipo,
    observaciones: row?.observaciones || row?.detalle || '',
    cantidad: row?.cantidad ?? 0,
    subtipo: row?.subtipo ?? '—',
  }));
}

/**
 * @param {unknown} raw — objeto parseado desde JSON
 * @param {{ existingClientIds?: Set<string> }} [ctx]
 * @returns {{ ok: boolean, errors: string[], patch: Record<string, object[]> | null }}
 */
export function validateMasterImportPayload(raw, ctx = {}) {
  const errors = [];
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['El contenido debe ser un objeto JSON (no un array ni texto suelto).'], patch: null };
  }

  const allowed = new Set([...MASTER_IMPORT_SECTION_KEYS, ...MASTER_IMPORT_LEGACY_KEYS, 'version']);
  const extra = Object.keys(raw).filter((k) => !allowed.has(k));
  if (extra.length) {
    errors.push(`Claves no reconocidas: ${extra.join(', ')}`);
  }

  const hasSection = (k) => Object.prototype.hasOwnProperty.call(raw, k);
  const hasAnySection =
    MASTER_IMPORT_SECTION_KEYS.some(hasSection) || hasSection('assetsOrEquipment');

  if (!hasAnySection) {
    errors.push(
      `Incluí al menos una sección: ${MASTER_IMPORT_SECTION_KEYS.map((k) => `"${k}"`).join(', ')}.`
    );
  }

  /** @type {Record<string, object[]>} */
  const patch = {};
  const existingClientIds = ctx.existingClientIds instanceof Set ? new Set(ctx.existingClientIds) : new Set();

  if (Array.isArray(raw.clients)) {
    patch.clients = validateClients(raw.clients, errors);
    for (const c of patch.clients) existingClientIds.add(String(c.id));
  } else if (hasSection('clients')) {
    errors.push('clients: debe ser un array.');
  }

  let branchIds = new Set();
  if (ctx.existingBranchIds instanceof Set) {
    for (const x of ctx.existingBranchIds) branchIds.add(String(x));
  }

  if (Array.isArray(raw.branchesOrStores)) {
    patch.branchesOrStores = validateBranches(raw.branchesOrStores, errors, existingClientIds);
    for (const b of patch.branchesOrStores) branchIds.add(String(b.id));
  } else if (hasSection('branchesOrStores')) {
    errors.push('branchesOrStores: debe ser un array.');
  }

  if (Array.isArray(raw.clientContacts)) {
    patch.clientContacts = validateClientContacts(raw.clientContacts, errors, existingClientIds);
  } else if (hasSection('clientContacts')) {
    errors.push('clientContacts: debe ser un array.');
  }

  if (Array.isArray(raw.contracts)) {
    patch.contracts = validateContracts(raw.contracts, errors, existingClientIds, branchIds);
  } else if (hasSection('contracts')) {
    errors.push('contracts: debe ser un array.');
  }

  if (Array.isArray(raw.maintenanceFrequencies)) {
    patch.maintenanceFrequencies = validateMaintenanceFrequencies(
      raw.maintenanceFrequencies,
      errors,
      existingClientIds,
      branchIds
    );
  } else if (hasSection('maintenanceFrequencies')) {
    errors.push('maintenanceFrequencies: debe ser un array.');
  }

  let employeeIds = new Set();
  if (ctx.existingEmployeeIds instanceof Set) {
    for (const x of ctx.existingEmployeeIds) employeeIds.add(String(x));
  }

  if (Array.isArray(raw.employees)) {
    patch.employees = validateEmployees(raw.employees, errors);
    for (const e of patch.employees) employeeIds.add(String(e.id));
  } else if (hasSection('employees')) {
    errors.push('employees: debe ser un array.');
  }

  if (Array.isArray(raw.roles)) {
    patch.roles = validateRoles(raw.roles, errors);
  } else if (hasSection('roles')) {
    errors.push('roles: debe ser un array.');
  }

  let serviceIds = new Set();
  if (ctx.existingServiceIds instanceof Set) {
    for (const x of ctx.existingServiceIds) serviceIds.add(String(x));
  }

  if (Array.isArray(raw.serviceCatalog)) {
    patch.serviceCatalog = validateServiceCatalog(raw.serviceCatalog, errors);
    for (const s of patch.serviceCatalog) serviceIds.add(String(s.id));
  } else if (hasSection('serviceCatalog')) {
    errors.push('serviceCatalog: debe ser un array.');
  }

  if (Array.isArray(raw.pricingCatalog)) {
    patch.pricingCatalog = validatePricingCatalog(raw.pricingCatalog, errors, serviceIds, existingClientIds);
  } else if (hasSection('pricingCatalog')) {
    errors.push('pricingCatalog: debe ser un array.');
  }

  const assetRows = [];
  if (Array.isArray(raw.assetCatalog)) {
    assetRows.push(...raw.assetCatalog);
  }
  if (Array.isArray(raw.assetsOrEquipment)) {
    assetRows.push(...legacyAssetsToCatalogRows(raw.assetsOrEquipment));
  }
  if (assetRows.length) {
    patch.assetCatalog = validateAssetCatalog(assetRows, errors, branchIds);
  } else if (hasSection('assetCatalog') || hasSection('assetsOrEquipment')) {
    errors.push('assetCatalog / assetsOrEquipment: debe ser un array.');
  }

  if (Array.isArray(raw.payrollCosts)) {
    patch.payrollCosts = validatePayrollCosts(raw.payrollCosts, errors, employeeIds);
  } else if (hasSection('payrollCosts')) {
    errors.push('payrollCosts: debe ser un array.');
  }

  const ok = errors.length === 0 && hasAnySection;
  return { ok, errors, patch: ok ? patch : null };
}

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
  'assetsOrEquipment',
];

const LABEL = {
  clients: 'clientes',
  clientContacts: 'contactos por cliente',
  branchesOrStores: 'tiendas / sucursales',
  contracts: 'contratos',
  maintenanceFrequencies: 'frecuencias de mantención',
  employees: 'empleados / técnicos',
  roles: 'roles',
  serviceCatalog: 'catálogo de servicios',
  pricingCatalog: 'catálogo de precios',
  assetsOrEquipment: 'activos / equipos',
};

function str(v) {
  return String(v ?? '').trim();
}

function requireId(row, sectionKey, index, errors) {
  const id = str(row?.id);
  if (!id) errors.push(`${LABEL[sectionKey] || sectionKey} [${index + 1}]: falta "id" (texto no vacío).`);
  return id;
}

function validateClients(rows, errors) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const id = requireId(row, 'clients', i, errors);
    const nombre = str(row?.nombre || row?.nombre_cliente);
    if (!nombre) errors.push(`clientes [${i + 1}]: falta "nombre" o "nombre_cliente".`);
    if (id && seen.has(id)) errors.push(`clientes [${i + 1}]: id duplicado "${id}".`);
    if (id) seen.add(id);
    out.push({
      ...row,
      id,
      nombre: nombre || str(row?.nombre) || str(row?.nombre_cliente),
    });
  });
  return out;
}

function validateSimpleRows(sectionKey, rows, errors, extraCheck) {
  const out = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    if (row == null || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`${LABEL[sectionKey]} [${i + 1}]: cada ítem debe ser un objeto.`);
      return;
    }
    const id = requireId(row, sectionKey, i, errors);
    if (id && seen.has(id)) errors.push(`${LABEL[sectionKey]} [${i + 1}]: id duplicado "${id}".`);
    if (id) seen.add(id);
    if (extraCheck) extraCheck(row, i, errors);
    out.push({ ...row, id });
  });
  return out;
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

  const allowed = new Set([...MASTER_IMPORT_SECTION_KEYS, 'version']);
  const extra = Object.keys(raw).filter((k) => !allowed.has(k));
  if (extra.length) {
    errors.push(`Claves no reconocidas (eliminálas o corregí el nombre): ${extra.join(', ')}`);
  }

  const hasAnySection = MASTER_IMPORT_SECTION_KEYS.some((k) => Object.prototype.hasOwnProperty.call(raw, k));
  if (!hasAnySection) {
    errors.push(
      `Incluí al menos una sección: ${MASTER_IMPORT_SECTION_KEYS.map((k) => `"${k}"`).join(', ')}.`
    );
  }

  /** @type {Record<string, object[]>} */
  const patch = {};
  const existingClientIds = ctx.existingClientIds instanceof Set ? ctx.existingClientIds : new Set();

  if (Array.isArray(raw.clients)) {
    patch.clients = validateClients(raw.clients, errors);
    for (const c of patch.clients) existingClientIds.add(String(c.id));
  } else if (Object.prototype.hasOwnProperty.call(raw, 'clients')) {
    errors.push('clients: debe ser un array.');
  }

  const fkClient = (row, i, section) => {
    const cid = str(row?.clientId);
    if (!cid) errors.push(`${LABEL[section]} [${i + 1}]: falta "clientId".`);
    else if (!existingClientIds.has(cid)) {
      errors.push(
        `${LABEL[section]} [${i + 1}]: clientId "${cid}" no existe en "clients" del archivo ni en la base actual.`
      );
    }
  };

  if (Array.isArray(raw.clientContacts)) {
    patch.clientContacts = validateSimpleRows('clientContacts', raw.clientContacts, errors, (row, i) =>
      fkClient(row, i, 'clientContacts')
    );
  } else if (Object.prototype.hasOwnProperty.call(raw, 'clientContacts')) {
    errors.push('clientContacts: debe ser un array.');
  }

  if (Array.isArray(raw.branchesOrStores)) {
    patch.branchesOrStores = validateSimpleRows('branchesOrStores', raw.branchesOrStores, errors, (row, i) =>
      fkClient(row, i, 'branchesOrStores')
    );
  } else if (Object.prototype.hasOwnProperty.call(raw, 'branchesOrStores')) {
    errors.push('branchesOrStores: debe ser un array.');
  }

  if (Array.isArray(raw.contracts)) {
    patch.contracts = validateSimpleRows('contracts', raw.contracts, errors, (row, i) => fkClient(row, i, 'contracts'));
  } else if (Object.prototype.hasOwnProperty.call(raw, 'contracts')) {
    errors.push('contracts: debe ser un array.');
  }

  if (Array.isArray(raw.maintenanceFrequencies)) {
    patch.maintenanceFrequencies = validateSimpleRows(
      'maintenanceFrequencies',
      raw.maintenanceFrequencies,
      errors,
      () => {}
    );
  } else if (Object.prototype.hasOwnProperty.call(raw, 'maintenanceFrequencies')) {
    errors.push('maintenanceFrequencies: debe ser un array.');
  }

  if (Array.isArray(raw.employees)) {
    patch.employees = validateSimpleRows('employees', raw.employees, errors, () => {});
  } else if (Object.prototype.hasOwnProperty.call(raw, 'employees')) {
    errors.push('employees: debe ser un array.');
  }

  if (Array.isArray(raw.roles)) {
    patch.roles = validateSimpleRows('roles', raw.roles, errors, (row, i) => {
      if (!str(row?.label)) errors.push(`roles [${i + 1}]: falta "label".`);
    });
  } else if (Object.prototype.hasOwnProperty.call(raw, 'roles')) {
    errors.push('roles: debe ser un array.');
  }

  if (Array.isArray(raw.serviceCatalog)) {
    patch.serviceCatalog = validateSimpleRows('serviceCatalog', raw.serviceCatalog, errors, (row, i) => {
      if (!str(row?.label)) errors.push(`catálogo de servicios [${i + 1}]: falta "label".`);
    });
  } else if (Object.prototype.hasOwnProperty.call(raw, 'serviceCatalog')) {
    errors.push('serviceCatalog: debe ser un array.');
  }

  if (Array.isArray(raw.pricingCatalog)) {
    patch.pricingCatalog = validateSimpleRows('pricingCatalog', raw.pricingCatalog, errors, () => {});
  } else if (Object.prototype.hasOwnProperty.call(raw, 'pricingCatalog')) {
    errors.push('pricingCatalog: debe ser un array.');
  }

  if (Array.isArray(raw.assetsOrEquipment)) {
    patch.assetsOrEquipment = validateSimpleRows('assetsOrEquipment', raw.assetsOrEquipment, errors, (row, i) => {
      const cid = str(row?.clientId);
      if (cid && !existingClientIds.has(cid)) {
        errors.push(
          `${LABEL.assetsOrEquipment} [${i + 1}]: clientId "${cid}" no existe en "clients" del archivo ni en la base actual.`
        );
      }
    });
  } else if (Object.prototype.hasOwnProperty.call(raw, 'assetsOrEquipment')) {
    errors.push('assetsOrEquipment: debe ser un array.');
  }

  const ok = errors.length === 0 && hasAnySection;
  return { ok, errors, patch: ok ? patch : null };
}

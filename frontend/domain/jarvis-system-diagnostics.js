/**
 * JarvisSystemDiagnostics — chequeos de salud del sistema con datos reales disponibles en el cliente.
 * No ejecuta POST /jarvis/intake aquí (evita efectos secundarios); ese camino se valida con verify:jarvis.
 */

/** @typedef {'ok' | 'warning' | 'error'} DiagnosticStatus */

/** @typedef {{ id: string, label: string, status: DiagnosticStatus, detail: string }} DiagnosticCheck */

const TERMINAL = new Set(['cerrada', 'finalizada', 'facturada', 'terminado', 'cerrado']);

function normInt(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function isOtAbierta(o) {
  const e = normInt(o?.estado);
  return e && !TERMINAL.has(e);
}

function responsableVacio(ot) {
  const t = String(ot?.tecnicoAsignado ?? '').trim();
  const r = String(ot?.responsableActual ?? '').trim();
  const bad = (x) => !x || normInt(x) === 'por asignar';
  return bad(t) && bad(r);
}

function prioridadOperativaPresente(ot) {
  return String(ot?.prioridadOperativa ?? '').trim().length > 0;
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 */
function resolveOtsListFromViewData(data) {
  const raw = data?.planOts ?? data?.ots?.data ?? [];
  return Array.isArray(raw) ? raw : [];
}

function envelopeTocado(data) {
  if (data?.ots != null) return true;
  if (Array.isArray(data?.planOts)) return true;
  return false;
}

/**
 * @param {{
 *   integrationStatus?: string,
 *   viewData?: Record<string, unknown> | null,
 *   lastDataRefreshAt?: string | null,
 * }} ctx
 * @returns {{ checks: DiagnosticCheck[], overall: DiagnosticStatus, summary: string, atIso: string }}
 */
export function runJarvisSystemDiagnostics(ctx = {}) {
  const atIso = new Date().toISOString();
  const integrationStatus = normInt(ctx.integrationStatus);
  const data = ctx.viewData ?? null;
  const list = resolveOtsListFromViewData(data);
  const touched = envelopeTocado(data);

  /** @type {DiagnosticCheck[]} */
  const checks = [];

  // 1) Backend / conectividad (vista shell)
  if (integrationStatus === 'conectado') {
    checks.push({
      id: 'backend',
      label: 'Estado backend (cliente)',
      status: 'ok',
      detail: 'Integración reportada como conectada.',
    });
  } else if (integrationStatus === 'cargando' || integrationStatus === 'pendiente') {
    checks.push({
      id: 'backend',
      label: 'Estado backend (cliente)',
      status: 'warning',
      detail: 'Carga o sincronización en curso; diagnóstico incompleto hasta conectar.',
    });
  } else if (integrationStatus === 'sin conexión' || integrationStatus === 'sin conexion') {
    checks.push({
      id: 'backend',
      label: 'Estado backend (cliente)',
      status: 'error',
      detail: 'Sin conexión con la API; no es posible validar /ots en vivo.',
    });
  } else {
    checks.push({
      id: 'backend',
      label: 'Estado backend (cliente)',
      status: 'warning',
      detail: integrationStatus ? `Estado desconocido: ${ctx.integrationStatus}` : 'sin dato',
    });
  }

  // 2) Lectura /ots (presencia de datos cargados en vista)
  if (!touched) {
    checks.push({
      id: 'ots_read',
      label: 'Lectura de OT en vista',
      status: integrationStatus === 'conectado' ? 'warning' : 'error',
      detail: 'diagnóstico incompleto: no hay sobre OT en datos de vista.',
    });
  } else if (!Array.isArray(list)) {
    checks.push({
      id: 'ots_read',
      label: 'Lectura de OT en vista',
      status: 'error',
      detail: 'Formato de lista OT inválido.',
    });
  } else if (integrationStatus === 'conectado' && list.length === 0) {
    checks.push({
      id: 'ots_read',
      label: 'Lectura de OT en vista',
      status: 'warning',
      detail: 'Conectado pero muestra vacía: verificar datos en servidor o filtros.',
    });
  } else {
    checks.push({
      id: 'ots_read',
      label: 'Lectura de OT en vista',
      status: 'ok',
      detail: `${list.length} OT en muestra.`,
    });
  }

  // 3) Creación /jarvis/intake — sin POST en cliente
  if (integrationStatus !== 'conectado') {
    checks.push({
      id: 'jarvis_intake',
      label: 'POST /jarvis/intake',
      status: 'error',
      detail: 'No verificable sin conexión; ejecutar smoke verify:jarvis en CI o servidor.',
    });
  } else {
    checks.push({
      id: 'jarvis_intake',
      label: 'POST /jarvis/intake',
      status: 'warning',
      detail:
        'Ruta activa en backend; esta vista no ejecuta POST. Validación operativa: npm run verify:jarvis.',
    });
  }

  const abiertas = list.filter(isOtAbierta);

  // 4) prioridadOperativa en OT abiertas
  if (!abiertas.length) {
    checks.push({
      id: 'prioridad_operativa',
      label: 'prioridadOperativa (OT abiertas)',
      status: list.length ? 'ok' : 'warning',
      detail: list.length ? 'Sin OT abiertas en muestra.' : 'sin dato',
    });
  } else {
    const sinP = abiertas.filter((o) => !prioridadOperativaPresente(o)).length;
    if (sinP === 0) {
      checks.push({
        id: 'prioridad_operativa',
        label: 'prioridadOperativa (OT abiertas)',
        status: 'ok',
        detail: `Todas las ${abiertas.length} OT abiertas tienen prioridad operativa.`,
      });
    } else if (sinP <= Math.ceil(abiertas.length * 0.25)) {
      checks.push({
        id: 'prioridad_operativa',
        label: 'prioridadOperativa (OT abiertas)',
        status: 'warning',
        detail: `${sinP} de ${abiertas.length} OT abiertas sin prioridadOperativa.`,
      });
    } else {
      checks.push({
        id: 'prioridad_operativa',
        label: 'prioridadOperativa (OT abiertas)',
        status: 'error',
        detail: `${sinP} de ${abiertas.length} OT abiertas sin prioridadOperativa.`,
      });
    }
  }

  // 5) riesgoDetectado explícito (boolean)
  if (!abiertas.length) {
    checks.push({
      id: 'riesgo_detectado',
      label: 'riesgoDetectado (OT abiertas)',
      status: list.length ? 'ok' : 'warning',
      detail: list.length ? 'Sin OT abiertas en muestra.' : 'sin dato',
    });
  } else {
    const sinBool = abiertas.filter((o) => typeof o?.riesgoDetectado !== 'boolean').length;
    if (sinBool === 0) {
      checks.push({
        id: 'riesgo_detectado',
        label: 'riesgoDetectado (OT abiertas)',
        status: 'ok',
        detail: 'Flag booleano presente en todas las OT abiertas.',
      });
    } else if (sinBool <= Math.ceil(abiertas.length * 0.25)) {
      checks.push({
        id: 'riesgo_detectado',
        label: 'riesgoDetectado (OT abiertas)',
        status: 'warning',
        detail: `${sinBool} OT abiertas sin riesgoDetectado booleano.`,
      });
    } else {
      checks.push({
        id: 'riesgo_detectado',
        label: 'riesgoDetectado (OT abiertas)',
        status: 'error',
        detail: `${sinBool} OT abiertas sin riesgoDetectado booleano.`,
      });
    }
  }

  // 6) Responsable asignado (OT abiertas)
  if (!abiertas.length) {
    checks.push({
      id: 'responsable',
      label: 'Responsable asignado (OT abiertas)',
      status: list.length ? 'ok' : 'warning',
      detail: list.length ? 'Sin OT abiertas en muestra.' : 'sin dato',
    });
  } else {
    const sinR = abiertas.filter(responsableVacio).length;
    if (sinR === 0) {
      checks.push({
        id: 'responsable',
        label: 'Responsable asignado (OT abiertas)',
        status: 'ok',
        detail: 'Todas las OT abiertas tienen responsable o técnico asignado.',
      });
    } else if (sinR <= Math.ceil(abiertas.length * 0.25)) {
      checks.push({
        id: 'responsable',
        label: 'Responsable asignado (OT abiertas)',
        status: 'warning',
        detail: `${sinR} de ${abiertas.length} OT abiertas sin responsable claro.`,
      });
    } else {
      checks.push({
        id: 'responsable',
        label: 'Responsable asignado (OT abiertas)',
        status: 'error',
        detail: `${sinR} de ${abiertas.length} OT abiertas sin responsable claro.`,
      });
    }
  }

  // 7) Salud panel gerencial
  if (integrationStatus !== 'conectado') {
    checks.push({
      id: 'panel_gerencial',
      label: 'Salud panel gerencial',
      status: 'error',
      detail: 'Sin conexión: panel sin datos confiables.',
    });
  } else if (!touched || list.length === 0) {
    checks.push({
      id: 'panel_gerencial',
      label: 'Salud panel gerencial',
      status: 'warning',
      detail: 'Conectado pero sin OT en panel: revisar API o datos.',
    });
  } else {
    checks.push({
      id: 'panel_gerencial',
      label: 'Salud panel gerencial',
      status: 'ok',
      detail: `Panel con datos (${list.length} OT).`,
    });
  }

  let overall = 'ok';
  for (const c of checks) {
    if (c.status === 'error') {
      overall = 'error';
      break;
    }
    if (c.status === 'warning') overall = 'warning';
  }

  const worst = checks.filter((c) => c.status === 'error');
  const warns = checks.filter((c) => c.status === 'warning');
  const summary =
    overall === 'error'
      ? `Crítico: ${worst.map((w) => w.label).join('; ')}`
      : overall === 'warning'
        ? `Atención: ${warns.length} advertencia(s).`
        : 'Operativo dentro de la muestra actual.';

  const refresh = ctx.lastDataRefreshAt ? String(ctx.lastDataRefreshAt).slice(0, 19) : 'sin dato';

  return {
    checks,
    overall,
    summary,
    atIso,
    lastDataRefreshAtLabel: refresh,
  };
}

export { resolveOtsListFromViewData };

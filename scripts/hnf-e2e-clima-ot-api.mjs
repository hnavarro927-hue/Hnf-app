/**
 * E2E API (sin navegador): health → crear OT (mismo contrato que wizard Clima) → listar y comprobar persistencia.
 *
 * Uso:
 *   HNF_E2E_API_BASE=http://127.0.0.1:4000 node scripts/hnf-e2e-clima-ot-api.mjs
 *
 * Con API en modo sesión (por defecto):
 *   HNF_E2E_API_BASE=... HNF_E2E_USER=hernan HNF_E2E_PASSWORD='tu-clave' node scripts/hnf-e2e-clima-ot-api.mjs
 *
 * Con HNF_AUTH_DISABLED=1 en el proceso del backend, el script puede crear sin login (POST sin Bearer).
 */
const base = String(process.env.HNF_E2E_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');
const user = process.env.HNF_E2E_USER || 'hernan';
const password = process.env.HNF_E2E_PASSWORD || 'hnf-cambiar-2026';

const minimalOtPayload = () => ({
  cliente: `E2E API ${new Date().toISOString().slice(0, 19)}`,
  direccion: 'Calle verificación 1',
  comuna: 'Santiago',
  contactoTerreno: 'Verificación',
  telefonoContacto: '+56987654321',
  tipoServicio: 'clima',
  subtipoServicio: 'Mantención preventiva',
  origenSolicitud: 'cliente_directo',
  origenPedido: 'llamada',
  prioridadOperativa: 'media',
  fecha: '2026-04-15',
  hora: '10:30',
  operationMode: 'manual',
  tecnicoAsignado: 'Por asignar',
  equipos: [],
});

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { _raw: text };
    }
  }
  return { res, body };
}

async function tryLogin() {
  const { res, body } = await fetchJson(`${base}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username: user, password }),
  });
  if (!res.ok) {
    return {
      token: null,
      err: body?.error?.message || `login HTTP ${res.status}`,
    };
  }
  const token = body?.data?.token;
  return { token: token ? String(token) : null, err: token ? null : 'login sin token en data' };
}

async function createOt(bearer) {
  const headers = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return fetchJson(`${base}/ots`, {
    method: 'POST',
    headers,
    body: JSON.stringify(minimalOtPayload()),
  });
}

async function listOts(bearer) {
  const headers = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return fetchJson(`${base}/ots`, { method: 'GET', headers });
}

async function main() {
  const h = await fetchJson(`${base}/health`, { method: 'GET' });
  if (!h.res.ok || !h.body?.data || String(h.body.data.status).toLowerCase() !== 'ok') {
    console.error('[hnf-e2e-clima-ot-api] /health falló en', base);
    console.error(h.body || h.res.status);
    process.exit(1);
  }
  console.log('[OK] GET /health');

  let bearer = null;
  let { res: c0, body: b0 } = await createOt(null);
  if (c0.status === 401) {
    const login = await tryLogin();
    if (!login.token) {
      console.error('[hnf-e2e-clima-ot-api] Sin sesión: POST /ots → 401 y login falló:', login.err);
      console.error('  Definí HNF_E2E_USER / HNF_E2E_PASSWORD o levantá el backend con HNF_AUTH_DISABLED=1 (solo local).');
      process.exit(1);
    }
    bearer = login.token;
    console.log('[OK] POST /auth/login');
    ({ res: c0, body: b0 } = await createOt(bearer));
  } else if (c0.ok) {
    console.log('[OK] POST /ots sin Bearer (API con HNF_AUTH_DISABLED)');
  }

  if (!c0.ok || !b0?.data?.id) {
    console.error('[hnf-e2e-clima-ot-api] POST /ots falló:', c0.status, b0);
    process.exit(1);
  }
  const id = String(b0.data.id);
  console.log('[OK] POST /ots →', id);

  const { res: g, body: bg } = await listOts(bearer);
  if (!g.ok || !Array.isArray(bg?.data)) {
    console.error('[hnf-e2e-clima-ot-api] GET /ots inesperado:', g.status, bg);
    process.exit(1);
  }
  const found = bg.data.some((o) => o && o.id === id);
  if (!found) {
    console.error('[hnf-e2e-clima-ot-api] La OT creada no aparece en GET /ots:', id);
    process.exit(1);
  }
  console.log('[OK] GET /ots incluye la OT nueva (persistencia verificada).');
  console.log('\nListo: mismo contrato que el wizard Clima; la UI debe cerrar modal y refrescar si hay sesión y /health OK.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

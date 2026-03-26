import { appConfig } from '../config/app.config.js';
import { fetchWithRetry } from '../domain/hnf-network.js';

const base = () => String(appConfig.apiBaseUrl || '').replace(/\/$/, '');

const url = (path) => `${base()}${path}`;

export async function fetchResponsibility() {
  const r = await fetchWithRetry(url('/api/responsibility'), { cache: 'no-store' }, { retries: 3, timeoutMs: 20000 });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(data?.error?.message || 'No se pudo leer el seguimiento de responsables.');
  return data.data;
}

export async function patchResponsibilityTask(id, estado) {
  const r = await fetchWithRetry(
    url(`/api/responsibility/tasks/${encodeURIComponent(id)}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    },
    { retries: 3, timeoutMs: 20000 }
  );
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(data?.error?.message || 'No se pudo actualizar la tarea.');
  return data.data;
}

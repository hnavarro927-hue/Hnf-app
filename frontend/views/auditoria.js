import { rbacHnfService } from '../services/rbac-hnf.service.js';

export const auditoriaView = (props) => {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-auditoria';
  wrap.style.cssText = 'margin:1rem;';

  const h = document.createElement('h2');
  h.textContent = 'Auditoría reciente';

  const sub = document.createElement('p');
  sub.className = 'muted small';
  sub.textContent = 'Eventos registrados en servidor (logins, cambios de usuarios, acciones críticas).';

  const feedback = props?.auditoriaFeedback;
  if (feedback?.message) {
    const fb = document.createElement('p');
    fb.className = feedback.type === 'error' ? 'hnf-banner-warn' : 'muted';
    fb.textContent = feedback.message;
    wrap.append(fb);
  }

  const list = document.createElement('ul');
  list.className = 'hnf-audit-list';
  list.style.cssText = 'list-style:none;padding:0;margin:1rem 0 0;max-height:70vh;overflow:auto;';

  const rows = props?.data?.auditRows || [];
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = 'Sin datos cargados aún.';
    list.append(li);
  } else {
    for (const r of rows) {
      const li = document.createElement('li');
      li.style.cssText =
        'padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:0.88rem;';
      const at = r.at || r.createdAt || '';
      const actor = r.actor || '—';
      const action = r.action || '—';
      li.textContent = `${at} · ${actor} · ${action}`;
      list.append(li);
    }
  }

  wrap.append(h, sub, list);
  return wrap;
};

export async function loadAuditoriaData() {
  const rows = await rbacHnfService.auditRecent(120);
  return { auditRows: Array.isArray(rows) ? rows : [] };
}

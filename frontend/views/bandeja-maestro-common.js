/**
 * Bandeja operativa de documentos Base Maestra por responsable (Romina / Gery / Lyn / admin).
 */

import { getStoredOperatorName } from '../config/operator.config.js';
import { maestroService } from '../services/maestro.service.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const DESTINOS = [
  { v: 'clima', l: 'Clima' },
  { v: 'flota', l: 'Flota' },
  { v: 'comercial', l: 'Comercial' },
  { v: 'administrativo', l: 'Administrativo' },
];

function maestroActorSlug() {
  const raw = getStoredOperatorName().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (raw.includes('romina')) return 'romina';
  if (raw.includes('gery')) return 'gery';
  if (raw.includes('lyn')) return 'lyn';
  if (raw.includes('hernan')) return 'hernan';
  return 'admin';
}

function probLabel(x) {
  if (x == null || x === '') return '—';
  if (typeof x === 'string') return x;
  return x.nombre || x.nombre_contacto || x.patente || x.id || '—';
}

function section(title) {
  const h = document.createElement('h3');
  h.className = 'hnf-bandeja-maestro__h';
  h.textContent = title;
  return h;
}

function renderDocRow(d, { offline, showFb, navigateToView, reloadApp, onChanged }) {
  const row = document.createElement('article');
  row.className = 'tarjeta hnf-bandeja-maestro__row';
  row.dataset.docId = d.id;
  const st = String(d.estado_revision || '');
  const tipo = d.tipo_archivo || d.categoria_detectada || '—';
  row.innerHTML = `<header class="hnf-bandeja-maestro__hdr"><strong>${esc(d.nombre_archivo)}</strong>
    <span class="muted small">${esc(st)} · ${esc(tipo)} · ${esc(d.destino_final || '—')} → bandeja ${esc(d.bandeja_destino || '—')}</span></header>
    <p class="small muted">Cliente: ${esc(probLabel(d.cliente_probable))} · Contacto: ${esc(probLabel(d.contacto_probable))} · Patente: ${esc(d.patente_probable || '—')} · Técnico: ${esc(probLabel(d.tecnico_probable))}</p>`;

  const corr = document.createElement('div');
  corr.className = 'hnf-bandeja-maestro__corr muted small';
  const sel = document.createElement('select');
  sel.className = 'hnf-cap-ingreso__input';
  sel.setAttribute('aria-label', 'Corregir destino');
  for (const o of DESTINOS) {
    const opt = document.createElement('option');
    opt.value = o.v;
    opt.textContent = o.l;
    sel.append(opt);
  }
  const df = String(d.destino_final || '').toLowerCase();
  sel.value = DESTINOS.some((x) => x.v === df) ? df : 'administrativo';
  const mot = document.createElement('input');
  mot.className = 'hnf-cap-ingreso__input';
  mot.placeholder = 'Motivo corrección destino';
  const bCorr = document.createElement('button');
  bCorr.type = 'button';
  bCorr.className = 'secondary-button';
  bCorr.textContent = 'Guardar corrección destino';
  bCorr.disabled = offline;
  bCorr.addEventListener('click', async () => {
    const motivo = mot.value.trim();
    if (!motivo) {
      showFb('Motivo obligatorio para corregir destino.', true);
      return;
    }
    bCorr.disabled = true;
    try {
      await maestroService.corregirDestinoDocumento(d.id, {
        nuevo_destino: sel.value,
        motivo,
        actor: maestroActorSlug(),
      });
      showFb('Destino actualizado.');
      mot.value = '';
      await onChanged?.();
    } catch (e) {
      showFb(e.message || 'Error', true);
    } finally {
      bCorr.disabled = offline;
    }
  });
  corr.append(document.createTextNode('Corregir destino: '), sel, mot, bCorr);

  const act = document.createElement('div');
  act.className = 'hnf-bandeja-maestro__act';

  const mk = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button';
    b.textContent = label;
    b.disabled = offline;
    b.addEventListener('click', fn);
    return b;
  };

  act.append(
    mk('Abrir Base maestra', () => navigateToView?.('base-maestra')),
    mk('Descargar', async () => {
      try {
        const blob = await maestroService.downloadDocumentoBlob(d.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = d.nombre_archivo || 'archivo';
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        showFb(e.message || 'Error', true);
      }
    }),
    mk('Aprobar', async () => {
      try {
        await maestroService.postAprobarDocumento(d.id, { auto_crear: false, modo: 'seguro' });
        showFb('Documento aprobado.');
        await reloadApp?.();
      } catch (e) {
        showFb(e.message || 'Error', true);
      }
    }),
    mk('Aprobar y crear', async () => {
      try {
        await maestroService.postAprobarDocumento(d.id, { auto_crear: true, modo: 'seguro' });
        showFb('Aprobación aplicada.');
        await reloadApp?.();
      } catch (e) {
        showFb(e.message || 'Error', true);
      }
    })
  );
  row.append(corr, act);
  return row;
}

export function createBandejaMaestroView({ slug, title, subtitle }) {
  return ({ integrationStatus, reloadApp, navigateToView } = {}) => {
    const root = document.createElement('section');
    root.className = 'hnf-bandeja-maestro hnf-op-view';
    const offline = integrationStatus === 'sin conexión';

    const fb = document.createElement('p');
    fb.className = 'hnf-base-maestra__fb';
    fb.hidden = true;
    const showFb = (msg, err = false) => {
      fb.hidden = false;
      fb.className = `hnf-base-maestra__fb ${err ? 'form-feedback form-feedback--error' : 'form-feedback form-feedback--success'}`;
      fb.textContent = msg;
    };

    const head = document.createElement('header');
    head.className = 'module-header';
    head.innerHTML = `<h2>${esc(title)}</h2><p class="muted small">${esc(subtitle || '')}</p>`;

    const host = document.createElement('div');
    host.className = 'hnf-bandeja-maestro__host';

    const load = async () => {
      if (offline) {
        host.replaceChildren();
        const p = document.createElement('p');
        p.className = 'form-feedback form-feedback--error';
        p.textContent = 'Sin conexión al servidor.';
        host.append(p);
        return;
      }
      host.replaceChildren();
      const loading = document.createElement('p');
      loading.className = 'muted';
      loading.textContent = 'Cargando bandeja…';
      host.append(loading);
      try {
        const r = await maestroService.getBandeja(slug, { limit: 200 });
        const docs = Array.isArray(r?.documentos) ? r.documentos : [];
        host.replaceChildren();

        const pend = docs.filter((x) => String(x.estado_revision).toLowerCase() !== 'aprobado');
        const hoy = new Date().toISOString().slice(0, 10);
        const aprHoy = docs.filter(
          (x) => String(x.estado_revision).toLowerCase() === 'aprobado' && String(x.updatedAt || '').startsWith(hoy)
        );
        const rev = docs.filter((x) => x.revision_manual_sugerida);

        const onChanged = () => load();

        host.append(section(`Pendientes (${pend.length})`));
        if (!pend.length) {
          const p = document.createElement('p');
          p.className = 'muted small';
          p.textContent = 'Nada pendiente en esta bandeja.';
          host.append(p);
        } else {
          for (const d of pend.slice(0, 80)) {
            host.append(renderDocRow(d, { offline, showFb, navigateToView, reloadApp, onChanged }));
          }
        }

        host.append(section(`Aprobados hoy (${aprHoy.length})`));
        for (const d of aprHoy.slice(0, 40)) {
          host.append(renderDocRow(d, { offline, showFb, navigateToView, reloadApp, onChanged }));
        }

        host.append(section(`Revisión manual sugerida (${rev.length})`));
        for (const d of rev.slice(0, 40)) {
          host.append(renderDocRow(d, { offline, showFb, navigateToView, reloadApp, onChanged }));
        }
      } catch (e) {
        host.replaceChildren();
        const p = document.createElement('p');
        p.className = 'form-feedback form-feedback--error';
        p.textContent = e.message || 'Error al cargar bandeja';
        host.append(p);
      }
    };

    const ref = document.createElement('button');
    ref.type = 'button';
    ref.className = 'secondary-button';
    ref.textContent = 'Actualizar';
    ref.disabled = offline;
    ref.addEventListener('click', () => load());

    root.append(head, ref, fb, host);
    load();
    return root;
  };
}

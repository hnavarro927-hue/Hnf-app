import {
  canAccessCargaMasiva,
  canAccessClientesManual,
  canAccessDirectorioInterno,
  filterValidationQueueForRole,
} from '../domain/hnf-operator-role.js';
import { ETIQUETA_ESTADO_VALIDACION } from '../domain/hnf-ui-copy.js';
import { hnfOperativoIntegradoService } from '../services/hnf-operativo-integrado.service.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const unwrap = (res) => res?.data ?? res;

/** @param {object} data @param {string} role @param {Function} showFb @param {Function} refresh */
export function renderValidacionTab(data, role, showFb, refresh) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-core-panel';
  const intro = document.createElement('p');
  intro.className = 'muted small hnf-core-panel__intro';
  intro.textContent =
    'Jarvis propone datos; vos corregís y confirmás. Solo lo confirmado pasa a la memoria validada.';
  const raw = Array.isArray(data?.hnfValidationQueue) ? data.hnfValidationQueue : [];
  const items = filterValidationQueueForRole(raw, role);
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'muted tarjeta';
    p.style.padding = '1rem';
    p.textContent = 'No hay elementos en tu bandeja de validación.';
    wrap.append(intro, p);
    return wrap;
  }
  const list = document.createElement('div');
  list.className = 'hnf-core-val-list';
  for (const it of items) {
    const card = document.createElement('article');
    card.className = 'hnf-core-val-card tarjeta';
    const st = it.estado || 'detectado';
    const lab = ETIQUETA_ESTADO_VALIDACION[st] || st;
    card.innerHTML = `<header class="hnf-core-val-card__h"><strong>${esc(it.id)}</strong> <span class="hnf-core-val-card__st">${esc(lab)}</span></header>
      <p class="hnf-core-val-card__t">${esc(it.titulo)}</p>
      <p class="muted small">Fuente: ${esc(it.fuente)} · Sugerido: ${esc(it.sugerencias?.responsable || '—')} (${esc(it.sugerencias?.etiqueta || '')})</p>`;
    const ta = document.createElement('textarea');
    ta.className = 'hnf-core-val-card__json';
    ta.rows = 4;
    ta.value = JSON.stringify(it.payloadEditado || it.payloadPropuesto || {}, null, 2);
    ta.setAttribute('aria-label', 'Datos a validar');
    const row = document.createElement('div');
    row.className = 'hnf-core-val-card__act';
    const bSave = document.createElement('button');
    bSave.type = 'button';
    bSave.className = 'secondary-button';
    bSave.textContent = 'Guardar corrección';
    bSave.addEventListener('click', async () => {
      try {
        const parsed = JSON.parse(ta.value || '{}');
        await hnfOperativoIntegradoService.patchValidationQueue(it.id, { payloadEditado: parsed });
        showFb('Corrección guardada.');
        await refresh();
      } catch (e) {
        showFb(e.message || 'Error JSON o red', true);
      }
    });
    const bConf = document.createElement('button');
    bConf.type = 'button';
    bConf.className = 'primary-button';
    bConf.textContent = 'Confirmar y memorizar';
    bConf.disabled = st === 'confirmado' || st === 'archivado';
    bConf.addEventListener('click', async () => {
      try {
        await hnfOperativoIntegradoService.confirmValidation(it.id);
        showFb('Confirmado: quedó en memoria validada.');
        await refresh();
      } catch (e) {
        showFb(e.message || 'Error', true);
      }
    });
    const bArch = document.createElement('button');
    bArch.type = 'button';
    bArch.className = 'secondary-button';
    bArch.textContent = 'Archivar';
    bArch.disabled = st === 'confirmado';
    bArch.addEventListener('click', async () => {
      try {
        await hnfOperativoIntegradoService.patchValidationQueue(it.id, { estado: 'archivado' });
        showFb('Archivado.');
        await refresh();
      } catch (e) {
        showFb(e.message || 'Error', true);
      }
    });
    row.append(bSave, bConf, bArch);
    card.append(ta, row);
    list.append(card);
  }
  wrap.append(intro, list);
  return wrap;
}

export function renderMemoriaTab(data) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-core-panel';
  const mem = Array.isArray(data?.hnfValidatedMemory) ? data.hnfValidatedMemory : [];
  const p = document.createElement('p');
  p.className = 'muted small';
  p.textContent = 'Datos que ya fueron confirmados por una persona (base para que Jarvis aprenda).';
  const ul = document.createElement('ul');
  ul.className = 'hnf-core-mem-list';
  const show = [...mem].reverse().slice(0, 40);
  if (!show.length) {
    ul.innerHTML = '<li class="muted">Aún no hay registros confirmados.</li>';
  } else {
    for (const m of show) {
      const li = document.createElement('li');
      li.className = 'hnf-core-mem-li';
      li.innerHTML = `<strong>${esc(m.id)}</strong> · ${esc(m.tipoMemoria || '—')} · ${esc(m.titulo || '')}<br><span class="muted small">${esc(JSON.stringify(m.datosValidados || {}).slice(0, 120))}…</span>`;
      ul.append(li);
    }
  }
  wrap.append(p, ul);
  return wrap;
}

export function renderClientesTab(data, showFb, refresh) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-core-panel';
  const clients = Array.isArray(data?.hnfExtendedClients) ? data.hnfExtendedClients : [];
  const form = document.createElement('div');
  form.className = 'hnf-core-new tarjeta';
  form.innerHTML = `
    <h3 class="hnf-core-new__h">Cliente (ingreso manual)</h3>
    <label class="hnf-core-new__lab">Nombre<input class="hnf-core-new__in" name="nombre" required /></label>
    <label class="hnf-core-new__lab">Razón social<input class="hnf-core-new__in" name="razonSocial" /></label>
    <label class="hnf-core-new__lab">RUT<input class="hnf-core-new__in" name="rut" /></label>
    <label class="hnf-core-new__lab">Dirección<input class="hnf-core-new__in" name="direccion" /></label>
    <label class="hnf-core-new__lab">Comuna<input class="hnf-core-new__in" name="comuna" /></label>
    <label class="hnf-core-new__lab">Ciudad<input class="hnf-core-new__in" name="ciudad" /></label>
    <label class="hnf-core-new__lab">Región<input class="hnf-core-new__in" name="region" /></label>
    <label class="hnf-core-new__lab">Giro<input class="hnf-core-new__in" name="giro" /></label>
    <label class="hnf-core-new__lab">Contacto<input class="hnf-core-new__in" name="contactoPrincipal" /></label>
    <label class="hnf-core-new__lab">Correo<input class="hnf-core-new__in" name="correo" type="email" /></label>
    <label class="hnf-core-new__lab">Teléfono<input class="hnf-core-new__in" name="telefono" /></label>
    <label class="hnf-core-new__lab">WhatsApp principal<input class="hnf-core-new__in" name="whatsapp_principal" /></label>
    <label class="hnf-core-new__lab">Estado
      <select class="hnf-core-new__in" name="estado"><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select>
    </label>
    <label class="hnf-core-new__lab">Área
      <select class="hnf-core-new__in" name="area"><option value="clima">Clima</option><option value="flota">Flota</option><option value="comercial">Comercial</option><option value="control">Control</option></select>
    </label>
    <label class="hnf-core-new__lab">Frecuencia servicio<input class="hnf-core-new__in" name="frecuenciaServicio" placeholder="ej. mensual" /></label>
    <label class="hnf-core-new__lab">Responsable interno<input class="hnf-core-new__in" name="responsableInterno" /></label>
    <label class="hnf-core-new__lab">Observaciones<textarea class="hnf-core-new__ta" name="observaciones" rows="2"></textarea></label>
    <label class="hnf-core-new__lab">Etiquetas (coma)<input class="hnf-core-new__in" name="etiquetas" placeholder="vip, retail" /></label>`;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'primary-button';
  b.textContent = 'Guardar cliente';
  b.addEventListener('click', async () => {
    const q = (n) => form.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
    const tags = q('etiquetas')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!q('nombre')) {
      showFb('Nombre obligatorio.', true);
      return;
    }
    try {
      await hnfOperativoIntegradoService.postExtendedClient({
        nombre: q('nombre'),
        razonSocial: q('razonSocial'),
        rut: q('rut'),
        direccion: q('direccion'),
        comuna: q('comuna'),
        ciudad: q('ciudad'),
        region: q('region'),
        giro: q('giro'),
        contactoPrincipal: q('contactoPrincipal'),
        correo: q('correo'),
        telefono: q('telefono'),
        whatsapp_principal: q('whatsapp_principal'),
        estado: form.querySelector('[name="estado"]')?.value || 'activo',
        area: form.querySelector('[name="area"]')?.value || 'clima',
        frecuenciaServicio: q('frecuenciaServicio'),
        responsableInterno: q('responsableInterno'),
        observaciones: q('observaciones'),
        etiquetas: tags,
      });
      showFb('Cliente guardado.');
      await refresh();
    } catch (e) {
      showFb(e.message || 'Error', true);
    }
  });
  form.append(b);
  const tbl = document.createElement('div');
  tbl.className = 'tarjeta hnf-core-cli-table';
  tbl.innerHTML = '<h3 class="hnf-core-new__h">Registrados</h3>';
  if (!clients.length) {
    tbl.append(document.createTextNode(''));
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Sin clientes en el directorio extendido.';
    tbl.append(empty);
  } else {
    const t = document.createElement('table');
    t.className = 'hnf-core-list__table';
    t.innerHTML = `<thead><tr><th>ID</th><th>Nombre</th><th>Área</th><th>Correo</th><th></th></tr></thead>`;
    const tb = document.createElement('tbody');
    for (const c of clients) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(c.id)}</td><td>${esc(c.nombre)}</td><td>${esc(c.area)}</td><td>${esc(c.correo)}</td><td></td>`;
      const td = tr.cells[4];
      const ed = document.createElement('button');
      ed.type = 'button';
      ed.className = 'secondary-button';
      ed.textContent = 'Editar área';
      ed.addEventListener('click', async () => {
        const nv = window.prompt('Área (clima / flota / comercial / control)', c.area || 'clima');
        if (!nv) return;
        try {
          await hnfOperativoIntegradoService.patchExtendedClient(c.id, { area: nv.trim() });
          showFb('Actualizado.');
          await refresh();
        } catch (e) {
          showFb(e.message || 'Error', true);
        }
      });
      td.append(ed);
      tb.append(tr);
    }
    t.append(tb);
    tbl.append(t);
  }
  wrap.append(form, tbl);
  return wrap;
}

export function renderDirectorioTab(data, showFb, refresh) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-core-panel';
  const dir = Array.isArray(data?.hnfInternalDirectory) ? data.hnfInternalDirectory : [];
  const form = document.createElement('div');
  form.className = 'hnf-core-new tarjeta';
  form.innerHTML = `
    <h3 class="hnf-core-new__h">Persona interna</h3>
    <label class="hnf-core-new__lab">Nombre completo<input class="hnf-core-new__in" name="nombreCompleto" required /></label>
    <label class="hnf-core-new__lab">RUT<input class="hnf-core-new__in" name="rut" /></label>
    <label class="hnf-core-new__lab">Rol<input class="hnf-core-new__in" name="rol" placeholder="ej. Administración" /></label>
    <label class="hnf-core-new__lab">Área<input class="hnf-core-new__in" name="area" placeholder="clima / flota / control" /></label>
    <label class="hnf-core-new__lab">Correo<input class="hnf-core-new__in" name="correo" type="email" /></label>
    <label class="hnf-core-new__lab">Teléfono<input class="hnf-core-new__in" name="telefono" /></label>
    <label class="hnf-core-new__lab">WhatsApp<input class="hnf-core-new__in" name="whatsapp" /></label>
    <label class="hnf-core-new__lab">Supervisor<input class="hnf-core-new__in" name="supervisor" placeholder="Nombre del supervisor" /></label>
    <label class="hnf-core-new__lab">Alias (coma, para reconocer en textos)<input class="hnf-core-new__in" name="aliases" placeholder="romi, r. pérez" /></label>`;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'primary-button';
  b.textContent = 'Agregar';
  b.addEventListener('click', async () => {
    const q = (n) => form.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
    const aliases = q('aliases')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (!q('nombreCompleto')) {
      showFb('Nombre obligatorio.', true);
      return;
    }
    try {
      await hnfOperativoIntegradoService.postInternalDirectory({
        nombreCompleto: q('nombreCompleto'),
        rut: q('rut'),
        rol: q('rol'),
        area: q('area'),
        correo: q('correo'),
        telefono: q('telefono'),
        whatsapp: q('whatsapp'),
        supervisor: q('supervisor'),
        aliases,
        activo: true,
      });
      showFb('Persona agregada.');
      await refresh();
    } catch (e) {
      showFb(e.message || 'Error', true);
    }
  });
  form.append(b);
  const tbl = document.createElement('div');
  tbl.className = 'tarjeta';
  const t = document.createElement('table');
  t.className = 'hnf-core-list__table';
  t.innerHTML = `<thead><tr><th>Nombre</th><th>Área</th><th>Activo</th><th></th></tr></thead>`;
  const tb = document.createElement('tbody');
  for (const d of dir) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(d.nombreCompleto)}</td><td>${esc(d.area)}</td><td>${d.activo ? 'Sí' : 'No'}</td><td></td>`;
    const td = tr.cells[3];
    const tgl = document.createElement('button');
    tgl.type = 'button';
    tgl.className = 'secondary-button';
    tgl.textContent = d.activo ? 'Desactivar' : 'Activar';
    tgl.addEventListener('click', async () => {
      try {
        await hnfOperativoIntegradoService.patchInternalDirectory(d.id, { activo: !d.activo });
        await refresh();
      } catch (e) {
        showFb(e.message || 'Error', true);
      }
    });
    td.append(tgl);
    tb.append(tr);
  }
  t.append(tb);
  tbl.append(t);
  wrap.append(form, tbl);
  return wrap;
}

export function renderCargaMasivaTab(showFb, refresh) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-core-panel';
  const p = document.createElement('p');
  p.className = 'muted small';
  p.textContent =
    'Pegá un arreglo JSON de filas. Jarvis crea ítems en «requiere validación»; revisá duplicados en Core antes de confirmar.';
  const ta = document.createElement('textarea');
  ta.className = 'hnf-core-bulk-json';
  ta.rows = 10;
  ta.placeholder = '[{"nombre":"Cliente A","correo":"a@b.c","area":"clima"}, {...}]';
  const sel = document.createElement('select');
  sel.className = 'hnf-core-new__in';
  sel.style.maxWidth = '220px';
  ['cliente', 'gasto', 'ot', 'evento', 'generico'].forEach((t) => sel.append(new Option(t, t)));
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'primary-button';
  b.textContent = 'Enviar a bandeja de validación';
  b.addEventListener('click', async () => {
    try {
      const rows = JSON.parse(ta.value || '[]');
      if (!Array.isArray(rows) || !rows.length) {
        showFb('Necesitás un arreglo JSON con al menos una fila.', true);
        return;
      }
      const res = unwrap(await hnfOperativoIntegradoService.postCargaMasiva({ tipo: sel.value, rows }));
      showFb(`Listo: ${res?.total ?? rows.length} fila(s) en validación.`);
      await refresh();
    } catch (e) {
      showFb(e.message || 'JSON inválido o error de red', true);
    }
  });
  wrap.append(p, sel, ta, b);
  return wrap;
}

export const JARVIS_TAB_DEF = [
  { id: 'solicitudes', label: 'Solicitudes', visible: () => true },
  { id: 'validacion', label: 'Validación', visible: () => true },
  { id: 'memoria', label: 'Memoria', visible: () => true },
  { id: 'clientes', label: 'Clientes', visible: (r) => canAccessClientesManual(r) },
  { id: 'directorio', label: 'Equipo interno', visible: (r) => canAccessDirectorioInterno(r) },
  { id: 'carga', label: 'Carga histórica', visible: (r) => canAccessCargaMasiva(r) },
  { id: 'finanzas', label: 'Finanzas', visible: () => true },
  { id: 'equipo', label: 'Carga por técnico', visible: () => true },
];

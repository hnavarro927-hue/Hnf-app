/**
 * Base maestra operativa: clientes (existentes), contactos, técnicos, conductores, vehículos, archivos y carga masiva.
 */

import { appConfig } from '../config/app.config.js';
import {
  canAccessClientesManual,
  canAccessDirectorioInterno,
  canAccessMaestroCargaArchivos,
  resolveOperatorRole,
} from '../domain/hnf-operator-role.js';
import { maestroService } from '../services/maestro.service.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const ESTADO_DOC = {
  borrador: 'Borrador',
  clasificado_jarvis: 'Clasificado por Jarvis',
  pendiente_revision: 'Pendiente revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  archivado: 'Archivado',
};

function jarvisBox(text) {
  const s = document.createElement('section');
  s.className = 'hnf-maestro-jarvis tarjeta';
  s.setAttribute('aria-label', 'Jarvis');
  s.innerHTML = `<h3 class="hnf-maestro-jarvis__t">Jarvis detectó:</h3><p class="muted small hnf-maestro-jarvis__p"></p>`;
  s.querySelector('.hnf-maestro-jarvis__p').textContent = text;
  return s;
}

function etiquetaEstadoVinculo(estado) {
  const m = {
    vinculado_automatico: 'Coincidencia encontrada',
    coincidencia_encontrada: 'Coincidencia encontrada',
    posible_duplicado: 'Posible duplicado',
    crear_sugerido: 'Crear nuevo',
    sin_datos: 'No encontrado',
    vinculado_manual: 'Vincular existente',
  };
  return m[estado] || estado || '—';
}

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

const ACCEPT_MASIVA =
  'application/pdf,.pdf,.xlsx,.xls,.csv,image/jpeg,image/png,image/webp,.doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const baseMaestraHubView = ({
  data,
  reloadApp,
  navigateToView,
  integrationStatus,
} = {}) => {
  const root = document.createElement('div');
  root.className = 'hnf-base-maestra';

  const role = resolveOperatorRole();
  const offline = integrationStatus === 'sin conexión';

  const tabs = [
    { id: 'clientes', label: 'Clientes' },
    { id: 'contactos', label: 'Contactos' },
    { id: 'personal', label: 'Personal interno' },
    { id: 'tecnicos', label: 'Técnicos' },
    { id: 'conductores', label: 'Conductores' },
    { id: 'vehiculos', label: 'Vehículos' },
    { id: 'archivos', label: 'Archivos / revisión' },
    ...(canAccessMaestroCargaArchivos(role) ? [{ id: 'carga', label: 'Carga masiva' }] : []),
  ];

  let active = 'clientes';
  const host = document.createElement('div');
  host.className = 'hnf-base-maestra__host';

  const fb = document.createElement('p');
  fb.className = 'hnf-base-maestra__fb';
  fb.hidden = true;

  const showFb = (msg, err = false) => {
    fb.hidden = false;
    fb.className = `hnf-base-maestra__fb ${err ? 'form-feedback form-feedback--error' : 'form-feedback form-feedback--success'}`;
    fb.textContent = msg;
  };

  const refresh = async () => {
    if (typeof reloadApp === 'function') await reloadApp();
  };

  const renderClientes = () => {
    const w = document.createElement('div');
    w.className = 'hnf-base-maestra__panel';
    w.append(
      jarvisBox(
        'Los clientes se validan antes de quedar como referencia para OT y archivos. Si falta información importante para guardar, completá los campos obligatorios.'
      )
    );
    const list = Array.isArray(data?.hnfExtendedClients) ? data.hnfExtendedClients : [];
    const canEdit = canAccessClientesManual(role);
    if (!canEdit) {
      const p = document.createElement('p');
      p.className = 'muted small';
      p.textContent =
        'Solo Lyn y Hernán editan la ficha completa desde aquí; vos ves el listado. Podés pedir el alta en Command Center · Clientes.';
      w.append(p);
    }
    const t = document.createElement('table');
    t.className = 'hnf-core-list__table';
    t.innerHTML = `<thead><tr><th>ID</th><th>Nombre</th><th>RUT</th><th>Comuna</th><th>Correo</th><th>Estado</th></tr></thead>`;
    const tb = document.createElement('tbody');
    for (const c of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(c.id)}</td><td>${esc(c.nombre || c.nombre_cliente)}</td><td>${esc(c.rut)}</td><td>${esc(c.comuna)}</td><td>${esc(c.correo || c.correo_principal)}</td><td>${esc(c.estado || 'activo')}</td>`;
      tb.append(tr);
    }
    if (!list.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" class="muted">Sin clientes en base. Usá Command Center → Clientes o cargá datos.</td>`;
      tb.append(tr);
    }
    t.append(tb);
    w.append(t);
    if (canEdit) {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'secondary-button';
      link.textContent = 'Ir a ingreso de clientes (Command Center)';
      link.addEventListener('click', () => navigateToView?.('hnf-core'));
      w.append(link);
    }
    return w;
  };

  const renderContactos = () => {
    const w = document.createElement('div');
    w.className = 'hnf-base-maestra__panel';
    w.append(jarvisBox('Los contactos se enlazan a un cliente (ID). Jarvis usa esta lista para sugerir coincidencias en archivos.'));
    const list = Array.isArray(data?.maestroContactos) ? data.maestroContactos : [];
    const form = document.createElement('div');
    form.className = 'hnf-core-new tarjeta';
    form.innerHTML = `
      <h3 class="hnf-core-new__h">Nuevo contacto</h3>
      <label class="hnf-core-new__lab">Nombre contacto *<input class="hnf-core-new__in" name="nombre_contacto" required /></label>
      <label class="hnf-core-new__lab">Cargo<input class="hnf-core-new__in" name="cargo" /></label>
      <label class="hnf-core-new__lab">Cliente ID (XCL-…)<input class="hnf-core-new__in" name="cliente_id" placeholder="XCL-0001" /></label>
      <label class="hnf-core-new__lab">Correo<input class="hnf-core-new__in" name="correo" type="email" /></label>
      <label class="hnf-core-new__lab">Teléfono<input class="hnf-core-new__in" name="telefono" /></label>
      <label class="hnf-core-new__lab">WhatsApp<input class="hnf-core-new__in" name="whatsapp" /></label>
      <label class="hnf-core-new__lab">Canal preferido
        <select class="hnf-core-new__in" name="canal_preferido"><option value="correo">Correo</option><option value="telefono">Teléfono</option><option value="whatsapp">WhatsApp</option></select>
      </label>
      <label class="hnf-core-new__lab">Observaciones<textarea class="hnf-core-new__ta" name="observaciones" rows="2"></textarea></label>`;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'primary-button';
    b.textContent = 'Guardar contacto';
    b.disabled = offline;
    b.addEventListener('click', async () => {
      const q = (n) => form.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
      if (!q('nombre_contacto')) {
        showFb('Falta información importante para guardar: nombre del contacto.', true);
        return;
      }
      try {
        await maestroService.postContacto({
          nombre_contacto: q('nombre_contacto'),
          cargo: q('cargo'),
          cliente_id: q('cliente_id'),
          correo: q('correo'),
          telefono: q('telefono'),
          whatsapp: q('whatsapp'),
          canal_preferido: form.querySelector('[name="canal_preferido"]').value,
          observaciones: q('observaciones'),
          activo: true,
        });
        showFb('Subida de información exitosa.');
        await refresh();
      } catch (e) {
        showFb(e.message || 'Error', true);
      }
    });
    form.append(b);
    w.append(form);
    const tbl = document.createElement('table');
    tbl.className = 'hnf-core-list__table';
    tbl.innerHTML = `<thead><tr><th>ID</th><th>Nombre</th><th>Cliente</th><th>Correo</th><th>Activo</th></tr></thead>`;
    const tb = document.createElement('tbody');
    for (const c of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(c.id)}</td><td>${esc(c.nombre_contacto)}</td><td>${esc(c.cliente_id)}</td><td>${esc(c.correo)}</td><td>${c.activo ? 'Sí' : 'No'}</td>`;
      tb.append(tr);
    }
    tbl.append(tb);
    w.append(tbl);
    return w;
  };

  const renderPersonal = () => {
    const w = document.createElement('div');
    w.className = 'hnf-base-maestra__panel';
    w.append(
      jarvisBox(
        canAccessDirectorioInterno(role)
          ? 'El personal interno alimenta la ficha de técnicos y conductores (persona_id).'
          : 'Solo gerencia edita el directorio completo; ves el listado.'
      )
    );
    const dir = Array.isArray(data?.hnfInternalDirectory) ? data.hnfInternalDirectory : [];
    if (canAccessDirectorioInterno(role)) {
      const hint = document.createElement('p');
      hint.className = 'muted small';
      hint.textContent = 'Para altas masivas usá Command Center → Equipo interno, o completá aquí vía enlace.';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary-button';
      b.textContent = 'Abrir Command Center · directorio';
      b.addEventListener('click', () => navigateToView?.('hnf-core'));
      w.append(hint, b);
    }
    const t = document.createElement('table');
    t.className = 'hnf-core-list__table';
    t.innerHTML = `<thead><tr><th>Nombre</th><th>RUT</th><th>Rol</th><th>Área</th><th>Supervisor</th><th>Activo</th></tr></thead>`;
    const tb = document.createElement('tbody');
    for (const d of dir) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(d.nombreCompleto)}</td><td>${esc(d.rut)}</td><td>${esc(d.rol)}</td><td>${esc(d.area)}</td><td>${esc(d.supervisor)}</td><td>${d.activo ? 'Sí' : 'No'}</td>`;
      tb.append(tr);
    }
    t.append(tb);
    w.append(t);
    return w;
  };

  const mkSimpleForm = (title, fields, onSubmit) => {
    const form = document.createElement('div');
    form.className = 'hnf-core-new tarjeta';
    const h = document.createElement('h3');
    h.className = 'hnf-core-new__h';
    h.textContent = title;
    form.append(h);
    for (const f of fields) {
      const lab = document.createElement('label');
      lab.className = 'hnf-core-new__lab';
      lab.textContent = f.label;
      const inp = document.createElement('input');
      inp.className = 'hnf-core-new__in';
      inp.name = f.name;
      if (f.type) inp.type = f.type;
      lab.append(inp);
      form.append(lab);
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'primary-button';
    b.textContent = 'Guardar';
    b.disabled = offline;
    b.addEventListener('click', () => onSubmit(form, b));
    form.append(b);
    return form;
  };

  const renderTecnicos = () => {
    const w = document.createElement('div');
    w.className = 'hnf-base-maestra__panel';
    w.append(jarvisBox('persona_id debe existir en personal interno. Especialidad y zona ayudan a asignar OT.'));
    const list = Array.isArray(data?.maestroTecnicos) ? data.maestroTecnicos : [];
    w.append(
      mkSimpleForm(
        'Alta técnico',
        [
          { name: 'persona_id', label: 'ID persona (directorio) *' },
          { name: 'especialidad', label: 'Especialidad' },
          { name: 'zona', label: 'Zona' },
          { name: 'disponibilidad', label: 'Disponibilidad' },
        ],
        async (form) => {
          const q = (n) => form.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
          if (!q('persona_id')) {
            showFb('Falta información importante para guardar: persona_id.', true);
            return;
          }
          try {
            await maestroService.postTecnico({
              persona_id: q('persona_id'),
              especialidad: q('especialidad'),
              zona: q('zona'),
              disponibilidad: q('disponibilidad') || 'disponible',
              habilidades: [],
              certificaciones: [],
              documentos_asociados: [],
            });
            showFb('Subida de información exitosa.');
            await refresh();
          } catch (e) {
            showFb(e.message || 'Error', true);
          }
        }
      )
    );
    const tbl = document.createElement('table');
    tbl.className = 'hnf-core-list__table';
    tbl.innerHTML = `<thead><tr><th>ID</th><th>Persona</th><th>Especialidad</th><th>Zona</th></tr></thead>`;
    const tb = document.createElement('tbody');
    for (const x of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(x.id)}</td><td>${esc(x.persona_id)}</td><td>${esc(x.especialidad)}</td><td>${esc(x.zona)}</td>`;
      tb.append(tr);
    }
    tbl.append(tb);
    w.append(tbl);
    return w;
  };

  const renderConductores = () => {
    const w = document.createElement('div');
    w.className = 'hnf-base-maestra__panel';
    w.append(jarvisBox('Conductores enlazan a persona del directorio. Revisá vencimiento de licencia.'));
    const list = Array.isArray(data?.maestroConductores) ? data.maestroConductores : [];
    w.append(
      mkSimpleForm(
        'Alta conductor',
        [
          { name: 'persona_id', label: 'ID persona *' },
          { name: 'tipo_licencia', label: 'Tipo licencia' },
          { name: 'vencimiento_licencia', label: 'Vencimiento', type: 'date' },
          { name: 'disponibilidad', label: 'Disponibilidad' },
        ],
        async (form) => {
          const q = (n) => form.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
          if (!q('persona_id')) {
            showFb('Falta información importante para guardar: persona_id.', true);
            return;
          }
          try {
            await maestroService.postConductor({
              persona_id: q('persona_id'),
              tipo_licencia: q('tipo_licencia'),
              vencimiento_licencia: q('vencimiento_licencia'),
              disponibilidad: q('disponibilidad') || 'disponible',
              observaciones: '',
            });
            showFb('Subida de información exitosa.');
            await refresh();
          } catch (e) {
            showFb(e.message || 'Error', true);
          }
        }
      )
    );
    const tbl = document.createElement('table');
    tbl.className = 'hnf-core-list__table';
    tbl.innerHTML = `<thead><tr><th>ID</th><th>Persona</th><th>Licencia</th><th>Vence</th></tr></thead>`;
    const tb = document.createElement('tbody');
    for (const x of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(x.id)}</td><td>${esc(x.persona_id)}</td><td>${esc(x.tipo_licencia)}</td><td>${esc(x.vencimiento_licencia)}</td>`;
      tb.append(tr);
    }
    tbl.append(tb);
    w.append(tbl);
    return w;
  };

  const renderVehiculos = () => {
    const w = document.createElement('div');
    w.className = 'hnf-base-maestra__panel';
    w.append(jarvisBox('Patente en mayúsculas. Cliente opcional (ID XCL).'));
    const list = Array.isArray(data?.maestroVehiculos) ? data.maestroVehiculos : [];
    w.append(
      mkSimpleForm(
        'Alta vehículo',
        [
          { name: 'patente', label: 'Patente *' },
          { name: 'marca', label: 'Marca' },
          { name: 'modelo', label: 'Modelo' },
          { name: 'ano', label: 'Año' },
          { name: 'tipo', label: 'Tipo' },
          { name: 'cliente_id', label: 'Cliente ID' },
          { name: 'responsable_actual', label: 'Responsable actual' },
          { name: 'kilometraje', label: 'Kilometraje' },
        ],
        async (form) => {
          const q = (n) => form.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
          if (!q('patente')) {
            showFb('Falta información importante para guardar: patente.', true);
            return;
          }
          try {
            await maestroService.postVehiculo({
              patente: q('patente'),
              marca: q('marca'),
              modelo: q('modelo'),
              ano: q('ano'),
              tipo: q('tipo'),
              cliente_id: q('cliente_id'),
              responsable_actual: q('responsable_actual'),
              kilometraje: q('kilometraje'),
              estado: 'activo',
              observaciones: '',
              documentos_asociados: [],
            });
            showFb('Subida de información exitosa.');
            await refresh();
          } catch (e) {
            showFb(e.message || 'Error', true);
          }
        }
      )
    );
    const tbl = document.createElement('table');
    tbl.className = 'hnf-core-list__table';
    tbl.innerHTML = `<thead><tr><th>ID</th><th>Patente</th><th>Marca</th><th>Cliente</th><th>Estado</th></tr></thead>`;
    const tb = document.createElement('tbody');
    for (const x of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(x.id)}</td><td>${esc(x.patente)}</td><td>${esc(x.marca)}</td><td>${esc(x.cliente_id)}</td><td>${esc(x.estado)}</td>`;
      tb.append(tr);
    }
    tbl.append(tb);
    w.append(tbl);
    return w;
  };

  const renderArchivos = () => {
    const w = document.createElement('div');
    w.className = 'hnf-base-maestra__panel';
    w.append(
      jarvisBox(
        'Revisar antes de aprobar: Jarvis detectó señales y propone vínculos a cliente, contacto, vehículo y técnico. Podés vincular existente con IDs o crear entidad con datos editables. No se crean duplicados sin tu acción.'
      )
    );
    const list = Array.isArray(data?.maestroDocumentos) ? data.maestroDocumentos : [];
    for (const d of list.slice(0, 40)) {
      const card = document.createElement('article');
      card.className = 'tarjeta hnf-maestro-doc-card';
      const st = ESTADO_DOC[d.estado_revision] || d.estado_revision;
      card.innerHTML = `<header><strong>${esc(d.nombre_archivo)}</strong> <span class="muted small">${esc(st)} · confianza ${esc(d.confianza_jarvis)}%</span></header>
        <p class="small">${esc(d.resumen_jarvis || '—')}</p>
        <p class="muted small">Módulo sugerido: ${esc(d.modulo_destino_sugerido || '—')} · categoría ${esc(d.categoria_detectada || '—')}</p>`;
      const vinc = d.jarvis_vinculacion && typeof d.jarvis_vinculacion === 'object' ? d.jarvis_vinculacion : {};
      const relWrap = document.createElement('div');
      relWrap.className = 'hnf-maestro-doc-rel';
      const mkDetBlock = (titulo, bloque) => {
        if (!bloque || typeof bloque !== 'object') return;
        const box = document.createElement('div');
        box.className = 'hnf-maestro-rel-block';
        const h = document.createElement('h4');
        h.className = 'small hnf-maestro-rel-block__t';
        h.textContent = titulo;
        const lab = document.createElement('p');
        lab.className = 'muted small';
        lab.textContent = `${etiquetaEstadoVinculo(bloque.estado)} · ${bloque.mensaje_ui || ''}`;
        box.append(h, lab);
        if (Array.isArray(bloque.candidatos) && bloque.candidatos.length) {
          const ul = document.createElement('ul');
          ul.className = 'muted small';
          for (const c of bloque.candidatos.slice(0, 5)) {
            const li = document.createElement('li');
            li.textContent = `${c.id || c.patente || ''} — ${esc(c.nombre || c.patente || JSON.stringify(c))}`;
            ul.append(li);
          }
          box.append(ul);
        }
        relWrap.append(box);
      };
      mkDetBlock('Cliente detectado', vinc.cliente);
      mkDetBlock('Contacto detectado', vinc.contacto);
      mkDetBlock('Vehículo detectado', vinc.vehiculo);
      mkDetBlock('Técnico detectado', vinc.tecnico);
      card.append(relWrap);

      const fkRow = document.createElement('div');
      fkRow.className = 'hnf-maestro-doc-fk muted small';
      fkRow.textContent =
        'Vincular existente: completá los IDs y usá «Guardar corrección» (también guarda tipo/observación).';
      const inpCliente = document.createElement('input');
      inpCliente.className = 'hnf-cap-ingreso__input';
      inpCliente.placeholder = 'cliente_id (XCL-…)';
      inpCliente.value = d.cliente_id || '';
      const inpContacto = document.createElement('input');
      inpContacto.className = 'hnf-cap-ingreso__input';
      inpContacto.placeholder = 'contacto_id (MCO-…)';
      inpContacto.value = d.contacto_id || '';
      const inpVeh = document.createElement('input');
      inpVeh.className = 'hnf-cap-ingreso__input';
      inpVeh.placeholder = 'vehiculo_id';
      inpVeh.value = d.vehiculo_id || '';
      const inpTec = document.createElement('input');
      inpTec.className = 'hnf-cap-ingreso__input';
      inpTec.placeholder = 'tecnico_id';
      inpTec.value = d.tecnico_id || '';
      card.append(fkRow, inpCliente, inpContacto, inpVeh, inpTec);

      const crearWrap = document.createElement('div');
      crearWrap.className = 'hnf-maestro-crear tarjeta';
      crearWrap.innerHTML = `<p class="small"><strong>Crear nuevo</strong> (editar antes de enviar; respeta RUT/correo/tel/patente únicos)</p>`;
      const inNombreCli = document.createElement('input');
      inNombreCli.className = 'hnf-cap-ingreso__input';
      inNombreCli.placeholder = 'Cliente — nombre';
      inNombreCli.value =
        vinc.cliente?.nombre_sugerido || d.datos_detectados?.nombre_cliente_inferido || '';
      const inRutCli = document.createElement('input');
      inRutCli.className = 'hnf-cap-ingreso__input';
      inRutCli.placeholder = 'Cliente — RUT';
      inRutCli.value = vinc.cliente?.rut_sugerido || d.datos_detectados?.ruts?.[0] || '';
      const inCorreoCli = document.createElement('input');
      inCorreoCli.className = 'hnf-cap-ingreso__input';
      inCorreoCli.placeholder = 'Cliente — correo';
      inCorreoCli.value = d.datos_detectados?.emails?.[0] || '';
      const inNomCont = document.createElement('input');
      inNomCont.className = 'hnf-cap-ingreso__input';
      inNomCont.placeholder = 'Contacto — nombre';
      inNomCont.value =
        vinc.contacto?.nombre_sugerido || d.datos_detectados?.nombre_contacto_inferido || '';
      const inCorreoCont = document.createElement('input');
      inCorreoCont.className = 'hnf-cap-ingreso__input';
      inCorreoCont.placeholder = 'Contacto — correo';
      inCorreoCont.value = vinc.contacto?.correo_sugerido || d.datos_detectados?.emails?.[0] || '';
      const inTelCont = document.createElement('input');
      inTelCont.className = 'hnf-cap-ingreso__input';
      inTelCont.placeholder = 'Contacto — teléfono';
      inTelCont.value =
        vinc.contacto?.telefono_sugerido || d.datos_detectados?.telefonos?.[0] || '';
      const inClienteCont = document.createElement('input');
      inClienteCont.className = 'hnf-cap-ingreso__input';
      inClienteCont.placeholder = 'Contacto — cliente_id';
      inClienteCont.value = d.cliente_id || '';
      const inPat = document.createElement('input');
      inPat.className = 'hnf-cap-ingreso__input';
      inPat.placeholder = 'Vehículo — patente';
      inPat.value = vinc.vehiculo?.patente_sugerida || d.datos_detectados?.patentes?.[0] || '';
      const inMarca = document.createElement('input');
      inMarca.className = 'hnf-cap-ingreso__input';
      inMarca.placeholder = 'Vehículo — marca';
      const inClienteVeh = document.createElement('input');
      inClienteVeh.className = 'hnf-cap-ingreso__input';
      inClienteVeh.placeholder = 'Vehículo — cliente_id';
      inClienteVeh.value = d.cliente_id || '';
      crearWrap.append(
        inNombreCli,
        inRutCli,
        inCorreoCli,
        document.createElement('hr'),
        inNomCont,
        inCorreoCont,
        inTelCont,
        inClienteCont,
        document.createElement('hr'),
        inPat,
        inMarca,
        inClienteVeh
      );
      const rowCrear = document.createElement('div');
      rowCrear.className = 'hnf-maestro-doc-card__act';
      const mkBtnCrear = (label, tipo) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary-button';
        b.textContent = label;
        b.disabled = offline;
        b.addEventListener('click', async () => {
          let datos = {};
          if (tipo === 'cliente') {
            datos = {
              nombre: inNombreCli.value.trim(),
              rut: inRutCli.value.trim(),
              correo: inCorreoCli.value.trim(),
            };
            if (!datos.nombre) {
              showFb('Nombre de cliente obligatorio.', true);
              return;
            }
          } else if (tipo === 'contacto') {
            datos = {
              nombre_contacto: inNomCont.value.trim(),
              correo: inCorreoCont.value.trim(),
              telefono: inTelCont.value.trim(),
              cliente_id: inClienteCont.value.trim(),
              canal_preferido: 'correo',
              activo: true,
            };
            if (!datos.nombre_contacto) {
              showFb('Nombre de contacto obligatorio.', true);
              return;
            }
          } else if (tipo === 'vehiculo') {
            datos = {
              patente: inPat.value.trim(),
              marca: inMarca.value.trim(),
              cliente_id: inClienteVeh.value.trim(),
              estado: 'activo',
              documentos_asociados: [],
            };
            if (!datos.patente) {
              showFb('Patente obligatoria.', true);
              return;
            }
          }
          try {
            await maestroService.postCrearEntidadDesdeDocumento(d.id, { tipo, datos });
            showFb('Entidad creada y documento vinculado.');
            await refresh();
          } catch (e) {
            showFb(e.message || 'Error', true);
          }
        });
        return b;
      };
      rowCrear.append(
        mkBtnCrear('Crear entidad · cliente', 'cliente'),
        mkBtnCrear('Crear entidad · contacto', 'contacto'),
        mkBtnCrear('Crear entidad · vehículo', 'vehiculo')
      );
      crearWrap.append(rowCrear);
      card.append(crearWrap);

      const hist = Array.isArray(d.historial_revision) ? d.historial_revision : [];
      if (hist.length) {
        const hh = document.createElement('div');
        hh.className = 'muted small';
        hh.innerHTML = '<strong>Historial revisión</strong>';
        const ul = document.createElement('ul');
        for (const h of hist.slice(-5)) {
          const li = document.createElement('li');
          li.textContent = `${esc(h.at)} · ${esc(h.tipo)} · ${esc(h.usuario)} — ${esc(h.detalle)}`;
          ul.append(li);
        }
        hh.append(ul);
        card.append(hh);
      }

      const row = document.createElement('div');
      row.className = 'hnf-maestro-doc-card__act';
      const inpTipo = document.createElement('input');
      inpTipo.className = 'hnf-cap-ingreso__input';
      inpTipo.placeholder = 'entidad_relacionada_tipo (ej. cliente)';
      inpTipo.value = d.entidad_relacionada_tipo || '';
      const inpId = document.createElement('input');
      inpId.className = 'hnf-cap-ingreso__input';
      inpId.placeholder = 'entidad_relacionada_id';
      inpId.value = d.entidad_relacionada_id || '';
      const inpObs = document.createElement('input');
      inpObs.className = 'hnf-cap-ingreso__input';
      inpObs.placeholder = 'Observación revisión';
      inpObs.value = d.observacion_revision || '';

      const mkBtn = (label, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary-button';
        b.textContent = label;
        b.disabled = offline;
        b.addEventListener('click', fn);
        return b;
      };

      row.append(
        mkBtn('Guardar corrección', async () => {
          try {
            await maestroService.patchDocumento(d.id, {
              entidad_relacionada_tipo: inpTipo.value.trim() || null,
              entidad_relacionada_id: inpId.value.trim() || null,
              observacion_revision: inpObs.value.trim(),
              cliente_id: inpCliente.value.trim() || null,
              contacto_id: inpContacto.value.trim() || null,
              vehiculo_id: inpVeh.value.trim() || null,
              tecnico_id: inpTec.value.trim() || null,
            });
            showFb('Corrección guardada.');
            await refresh();
          } catch (e) {
            showFb(e.message || 'Error', true);
          }
        }),
        mkBtn('Reclasificar con Jarvis', async () => {
          try {
            await maestroService.reclasificarDocumento(d.id);
            showFb('Jarvis reclasificó el archivo.');
            await refresh();
          } catch (e) {
            showFb(e.message || 'Error', true);
          }
        }),
        mkBtn('Aprobado', async () => {
          try {
            await maestroService.patchDocumento(d.id, { estado_revision: 'aprobado' });
            showFb('Marcado como aprobado.');
            await refresh();
          } catch (e) {
            showFb(e.message || 'Error', true);
          }
        }),
        mkBtn('Rechazado', async () => {
          try {
            await maestroService.patchDocumento(d.id, {
              estado_revision: 'rechazado',
              observacion_revision: inpObs.value.trim() || 'Rechazado',
            });
            showFb('Marcado como rechazado.');
            await refresh();
          } catch (e) {
            showFb(e.message || 'Error', true);
          }
        }),
        mkBtn('Archivado', async () => {
          try {
            await maestroService.patchDocumento(d.id, { estado_revision: 'archivado' });
            showFb('Archivado.');
            await refresh();
          } catch (e) {
            showFb(e.message || 'Error', true);
          }
        }),
        mkBtn('Descargar', async () => {
          try {
            const blob = await maestroService.downloadDocumentoBlob(d.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = d.nombre_archivo || 'archivo';
            a.click();
            URL.revokeObjectURL(url);
          } catch (e) {
            showFb(e.message || 'No se pudo descargar', true);
          }
        })
      );
      card.append(inpTipo, inpId, inpObs, row);
      w.append(card);
    }
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No hay archivos en revisión. Usá Carga masiva.';
      w.append(p);
    }
    return w;
  };

  const renderCarga = () => {
    const w = document.createElement('div');
    w.className = 'hnf-base-maestra__panel';
    w.append(
      jarvisBox(
        `Arrastrá archivos o elegí varios. Formatos: PDF, Excel, CSV, imágenes, Word. Máximo ~12 MB por archivo. Se guarda en ${appConfig.apiBaseUrl} (servidor HNF).`
      )
    );
    let files = [];
    const zone = document.createElement('div');
    zone.className = 'hnf-maestro-dropzone tarjeta';
    zone.textContent = 'Arrastrá y soltá aquí o usá el botón';
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = ACCEPT_MASIVA;
    input.style.display = 'none';
    const btnPick = document.createElement('button');
    btnPick.type = 'button';
    btnPick.className = 'secondary-button';
    btnPick.textContent = 'Elegir archivos';
    btnPick.addEventListener('click', () => input.click());
    const listEl = document.createElement('ul');
    listEl.className = 'hnf-maestro-file-list';

    const syncList = () => {
      listEl.replaceChildren();
      files.forEach((f, i) => {
        const li = document.createElement('li');
        li.className = 'hnf-maestro-file-li';
        li.textContent = `${f.name} (${Math.round(f.size / 1024)} KB) `;
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'secondary-button';
        rm.textContent = 'Quitar';
        rm.addEventListener('click', () => {
          files = files.filter((_, j) => j !== i);
          syncList();
        });
        li.append(rm);
        listEl.append(li);
      });
    };

    const addFiles = (fl) => {
      const arr = Array.from(fl || []);
      for (const f of arr) {
        if (f.size > 12 * 1024 * 1024) continue;
        files.push(f);
      }
      syncList();
    };

    input.addEventListener('change', () => {
      addFiles(input.files);
      input.value = '';
    });
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('hnf-maestro-dropzone--over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('hnf-maestro-dropzone--over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('hnf-maestro-dropzone--over');
      addFiles(e.dataTransfer?.files);
    });

    const btnSend = document.createElement('button');
    btnSend.type = 'button';
    btnSend.className = 'primary-button';
    btnSend.textContent = 'Procesar con Jarvis y dejar pendiente de revisión';
    btnSend.disabled = offline;
    btnSend.addEventListener('click', async () => {
      if (!files.length) {
        showFb('Falta información importante para guardar: elegí al menos un archivo.', true);
        return;
      }
      btnSend.disabled = true;
      try {
        const payloadFiles = [];
        for (const f of files) {
          const dataBase64 = await readFileBase64(f);
          payloadFiles.push({ name: f.name, mimeType: f.type || 'application/octet-stream', dataBase64 });
        }
        const res = await maestroService.ingestDocumentos({ files: payloadFiles });
        const n = res?.total ?? res?.documentos?.length ?? payloadFiles.length;
        showFb(`Subida de información exitosa. ${n} archivo(s) en revisión.`);
        files = [];
        syncList();
        await refresh();
      } catch (e) {
        showFb(e.message || 'Error al subir', true);
      } finally {
        btnSend.disabled = offline;
      }
    });

    w.append(zone, btnPick, input, listEl, btnSend);
    return w;
  };

  const renderActive = () => {
    host.replaceChildren();
    if (offline) {
      const p = document.createElement('p');
      p.className = 'form-feedback form-feedback--error';
      p.textContent = 'Sin conexión al servidor: la base maestra requiere red.';
      host.append(p);
      return;
    }
    const map = {
      clientes: renderClientes,
      contactos: renderContactos,
      personal: renderPersonal,
      tecnicos: renderTecnicos,
      conductores: renderConductores,
      vehiculos: renderVehiculos,
      archivos: renderArchivos,
      carga: renderCarga,
    };
    host.append(map[active]?.() || document.createElement('div'));
  };

  const head = document.createElement('header');
  head.className = 'hnf-base-maestra__head';
  head.innerHTML = `<h1 class="hnf-base-maestra__title">Base maestra operativa</h1>
    <p class="muted small">Clientes, personas, flota y archivos con revisión antes de aprobar.</p>`;

  const nav = document.createElement('nav');
  nav.className = 'hnf-base-maestra__tabs';
  for (const t of tabs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hnf-base-maestra__tab';
    b.textContent = t.label;
    b.dataset.tab = t.id;
    if (t.id === active) b.classList.add('hnf-base-maestra__tab--active');
    b.addEventListener('click', () => {
      active = t.id;
      nav.querySelectorAll('.hnf-base-maestra__tab').forEach((x) => {
        x.classList.toggle('hnf-base-maestra__tab--active', x.dataset.tab === active);
      });
      renderActive();
    });
    nav.append(b);
  }

  root.append(head, nav, fb, host);
  renderActive();
  return root;
};

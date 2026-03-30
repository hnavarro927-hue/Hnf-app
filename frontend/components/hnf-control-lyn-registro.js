import { controlLynRegistroService } from '../services/control-lyn-registro.service.js';

const fields = [
  { key: 'montoEntregado', label: 'Monto entregado', type: 'money', hint: 'Pesos chilenos (solo número).' },
  { key: 'solicitudTelefonica', label: 'Solicitud telefónica', type: 'area', hint: 'Lo que pidieron por teléfono.' },
  { key: 'compra', label: 'Compra', type: 'area', hint: 'Compras o pedidos del día.' },
  { key: 'combustible', label: 'Combustible', type: 'area' },
  { key: 'refrigerante', label: 'Refrigerante', type: 'area' },
  { key: 'equipo', label: 'Equipo', type: 'area', hint: 'Equipos o repuestos relevantes.' },
  { key: 'uniforme', label: 'Uniforme', type: 'area' },
  { key: 'epp', label: 'EPP', type: 'area', hint: 'Elementos de protección personal.' },
  { key: 'inventarioCritico', label: 'Inventario crítico', type: 'area', hint: 'Faltantes o stock mínimo.' },
  { key: 'observaciones', label: 'Observaciones', type: 'area' },
  { key: 'respaldo', label: 'Respaldo', type: 'area', hint: 'Dónde quedó respaldado (carpeta, correo, enlace).' },
];

function renderForm(wrap, doc, reloadApp) {
  wrap.replaceChildren();
  const box = document.createElement('div');
  box.className = 'hnf-control-lyn-registro__inner';

  const h = document.createElement('h2');
  h.className = 'hnf-control-lyn-registro__title';
  h.textContent = 'Registro de control (Lyn)';

  const intro = document.createElement('p');
  intro.className = 'hnf-control-lyn-registro__intro muted';
  intro.textContent =
    'Anotá aquí lo que necesitás revisar del día: montos, pedidos, insumos e inventario. Se guarda en el servidor para que el equipo vea lo mismo.';

  const grid = document.createElement('div');
  grid.className = 'hnf-control-lyn-registro__grid';

  const inputs = {};

  for (const f of fields) {
    const cell = document.createElement('div');
    cell.className =
      f.type === 'area' ? 'hnf-control-lyn-registro__field hnf-control-lyn-registro__field--full' : 'hnf-control-lyn-registro__field';

    const lab = document.createElement('label');
    lab.htmlFor = `hnf-lyn-${f.key}`;
    lab.textContent = f.label;

    let input;
    if (f.type === 'money') {
      input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.id = `hnf-lyn-${f.key}`;
      input.className = 'hnf-control-lyn-registro__input';
      const v = doc[f.key];
      input.value = v != null && v !== '' ? String(v) : '';
    } else {
      input = document.createElement('textarea');
      input.id = `hnf-lyn-${f.key}`;
      input.className = 'hnf-control-lyn-registro__textarea';
      input.rows = f.key === 'observaciones' || f.key === 'respaldo' ? 4 : 3;
      input.value = String(doc[f.key] ?? '');
    }

    inputs[f.key] = input;
    cell.append(lab);
    if (f.hint) {
      const hi = document.createElement('span');
      hi.className = 'hnf-control-lyn-registro__hint muted small';
      hi.textContent = f.hint;
      cell.append(hi);
    }
    cell.append(input);
    grid.append(cell);
  }

  const actions = document.createElement('div');
  actions.className = 'hnf-control-lyn-registro__actions';

  const status = document.createElement('p');
  status.className = 'hnf-control-lyn-registro__meta muted small';
  const setMeta = (d) => {
    if (d?.actualizadoAt) {
      const who = d.actualizadoPor ? ` · ${d.actualizadoPor}` : '';
      status.textContent = `Último guardado: ${new Date(d.actualizadoAt).toLocaleString('es-CL')}${who}`;
    } else {
      status.textContent = 'Aún no hay guardados.';
    }
  };
  setMeta(doc);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'primary-button';
  btn.textContent = 'Guardar registro';

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.textContent = 'Guardando…';
    try {
      const body = {};
      for (const f of fields) {
        const el = inputs[f.key];
        if (f.type === 'money') {
          const t = el.value.trim();
          if (t === '') body[f.key] = null;
          else {
            const norm = t.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
            body[f.key] = norm;
          }
        } else {
          body[f.key] = el.value;
        }
      }
      const saved = await controlLynRegistroService.patch(body);
      setMeta(saved);
      status.textContent = `Guardado ${new Date().toLocaleTimeString('es-CL')}.`;
      void reloadApp?.();
    } catch (e) {
      status.textContent = e?.message ? String(e.message) : 'No se pudo guardar.';
    } finally {
      btn.disabled = false;
    }
  });

  actions.append(btn, status);
  box.append(h, intro, grid, actions);
  wrap.append(box);
}

/**
 * Panel de registro operativo para Lyn (y Hernán) en Control gerencial.
 * Si el usuario no tiene permiso API, el bloque no se muestra.
 */
export function createHnfControlLynRegistroPanel({ reloadApp } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-control-lyn-registro';
  wrap.setAttribute('aria-busy', 'true');
  const load = document.createElement('p');
  load.className = 'muted hnf-control-lyn-registro__loading';
  load.textContent = 'Cargando registro de control…';
  wrap.append(load);

  void (async () => {
    try {
      const doc = await controlLynRegistroService.get();
      wrap.removeAttribute('aria-busy');
      renderForm(wrap, doc, reloadApp);
    } catch (e) {
      if (e?.status === 403) {
        wrap.remove();
        return;
      }
      load.textContent = e?.message ? String(e.message) : 'No se pudo cargar el registro.';
      wrap.removeAttribute('aria-busy');
    }
  })();

  return wrap;
}

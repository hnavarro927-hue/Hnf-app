import { usersService } from '../services/users.service.js';

const ROLES = ['admin', 'hernan', 'lyn', 'romina', 'gery', 'tecnico', 'conductor'];

export const usuariosView = (props) => {
  const users = props?.data?.users || [];
  const feedback = props?.usuariosFeedback;
  const onAction = props?.onUsuariosAction;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin:1rem;';

  const h = document.createElement('h2');
  h.textContent = 'Usuarios del sistema';

  const sub = document.createElement('p');
  sub.className = 'muted small';
  sub.textContent =
    'Alta, rol y estado. Las contraseñas no se muestran; usá restablecer para dejar una temporal.';

  if (feedback?.message) {
    const fb = document.createElement('p');
    fb.style.cssText = feedback.type === 'error' ? 'color:#f87171;' : 'color:#86efac;padding:0.35rem 0;';
    fb.textContent = feedback.message;
    wrap.append(fb);
  }

  const form = document.createElement('div');
  form.className = 'tarjeta';
  form.style.cssText = 'padding:1rem;margin:1rem 0;display:grid;gap:0.5rem;max-width:32rem;';

  const ft = document.createElement('strong');
  ft.className = 'small';
  ft.textContent = 'Nuevo usuario';
  form.append(ft);

  const nombre = document.createElement('input');
  nombre.placeholder = 'Nombre';
  nombre.className = 'hnf-input';
  const email = document.createElement('input');
  email.type = 'email';
  email.placeholder = 'Email';
  email.className = 'hnf-input';
  const username = document.createElement('input');
  username.placeholder = 'Usuario (login)';
  username.className = 'hnf-input';
  const rol = document.createElement('select');
  rol.className = 'hnf-input';
  for (const r of ROLES) {
    const o = document.createElement('option');
    o.value = r;
    o.textContent = r;
    rol.append(o);
  }
  const activo = document.createElement('label');
  activo.className = 'small';
  const activoCb = document.createElement('input');
  activoCb.type = 'checkbox';
  activoCb.checked = true;
  activo.append(activoCb, document.createTextNode(' Activo'));
  const pass = document.createElement('input');
  pass.type = 'password';
  pass.placeholder = 'Contraseña temporal';
  pass.className = 'hnf-input';
  const crea = document.createElement('button');
  crea.type = 'button';
  crea.className = 'primary-button';
  crea.textContent = 'Crear usuario';
  crea.addEventListener('click', async () => {
    await onAction?.('create', {
      nombre: nombre.value.trim(),
      email: email.value.trim(),
      username: username.value.trim().toLowerCase(),
      rol: rol.value,
      activo: activoCb.checked,
      password: pass.value,
    });
  });
  form.append(nombre, email, username, rol, activo, pass, crea);

  const table = document.createElement('table');
  table.className = 'hnf-table-compact';
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:0.88rem;';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const label of ['Usuario', 'Nombre', 'Rol', 'Activo', 'Acciones']) {
    const th = document.createElement('th');
    th.align = 'left';
    th.textContent = label;
    hr.append(th);
  }
  thead.append(hr);
  const tbody = document.createElement('tbody');

  for (const u of users) {
    const tr = document.createElement('tr');

    const tdU = document.createElement('td');
    tdU.textContent = u.username || '';
    const tdN = document.createElement('td');
    tdN.textContent = u.nombre || '';

    const tdR = document.createElement('td');
    const rolSel = document.createElement('select');
    rolSel.className = 'hnf-input';
    for (const r of ROLES) {
      const o = document.createElement('option');
      o.value = r;
      o.textContent = r;
      if (r === u.rol) o.selected = true;
      rolSel.append(o);
    }
    rolSel.addEventListener('change', async () => {
      await onAction?.('patchRol', { id: u.id, rol: rolSel.value });
    });
    tdR.append(rolSel);

    const tdA = document.createElement('td');
    tdA.textContent = u.activo === false ? 'No' : 'Sí';

    const tdX = document.createElement('td');
    const btnOff = document.createElement('button');
    btnOff.type = 'button';
    btnOff.className = 'secondary-button';
    btnOff.textContent = u.activo === false ? 'Activar' : 'Desactivar';
    btnOff.addEventListener('click', async () => {
      await onAction?.('estado', { id: u.id, activo: u.activo === false });
    });
    const btnPw = document.createElement('button');
    btnPw.type = 'button';
    btnPw.className = 'secondary-button';
    btnPw.textContent = 'Restablecer contraseña';
    btnPw.addEventListener('click', async () => {
      const p = window.prompt('Nueva contraseña temporal (mín. 6 caracteres):');
      if (!p) return;
      await onAction?.('resetPw', { id: u.id, password: p });
    });
    tdX.append(btnOff, document.createTextNode(' '), btnPw);

    tr.append(tdU, tdN, tdR, tdA, tdX);
    tbody.append(tr);
  }

  table.append(thead, tbody);
  wrap.append(h, sub, form, table);
  return wrap;
};

export async function loadUsuariosData() {
  const users = await usersService.list();
  return { users: Array.isArray(users) ? users : [] };
}

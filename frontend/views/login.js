/**
 * Login interno HNF (sin IdP externo).
 */
export const loginView = (root, { onSuccess, bannerMessage = '' } = {}) => {
  root.innerHTML = '';
  root.className = 'hnf-login-root';

  const wrap = document.createElement('div');
  wrap.className = 'hnf-login-card tarjeta';
  wrap.style.cssText = 'max-width:22rem;margin:3rem auto;padding:1.5rem;';

  const h = document.createElement('h1');
  h.style.fontSize = '1.15rem';
  h.textContent = 'HNF — Iniciar sesión';

  const note = document.createElement('p');
  note.className = 'muted small';
  note.textContent =
    'Acceso operativo interno. Usuario y contraseña los asigna un administrador del sistema.';

  if (bannerMessage) {
    const b = document.createElement('p');
    b.className = 'hnf-banner-warn';
    b.style.cssText = 'padding:0.5rem 0.65rem;border-radius:6px;background:#3d2a1a;color:#ffd7a8;';
    b.textContent = bannerMessage;
    wrap.append(b);
  }

  const err = document.createElement('p');
  err.className = 'hnf-login-error';
  err.style.cssText = 'color:#f87171;min-height:1.25rem;font-size:0.9rem;';

  const form = document.createElement('form');
  form.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem;margin-top:0.75rem;';

  const uLabel = document.createElement('label');
  uLabel.className = 'small';
  uLabel.textContent = 'Usuario';
  const user = document.createElement('input');
  user.type = 'text';
  user.name = 'username';
  user.autocomplete = 'username';
  user.className = 'hnf-input';
  user.required = true;

  const pLabel = document.createElement('label');
  pLabel.className = 'small';
  pLabel.textContent = 'Contraseña';
  const pass = document.createElement('input');
  pass.type = 'password';
  pass.name = 'password';
  pass.autocomplete = 'current-password';
  pass.className = 'hnf-input';
  pass.required = true;

  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'primary-button';
  btn.textContent = 'Entrar';

  form.append(uLabel, user, pLabel, pass, btn);
  wrap.append(h, note, err, form);
  root.append(wrap);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    btn.disabled = true;
    try {
      await onSuccess?.({
        username: user.value.trim(),
        password: pass.value,
      });
    } catch (ex) {
      err.textContent = ex?.message || 'No se pudo iniciar sesión.';
    } finally {
      btn.disabled = false;
    }
  });
};

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Login interno HNF (sin IdP externo).
 * @param {{ onSuccess?: Function, bannerMessage?: string, loginDebug?: { apiUrl: string, environment: string } | null }}=} opts
 */
export const loginView = (root, { onSuccess, bannerMessage = '', loginDebug = null } = {}) => {
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

  const bannerEl = bannerMessage
    ? (() => {
        const b = document.createElement('p');
        b.className = 'hnf-banner-warn';
        b.style.cssText =
          'padding:0.5rem 0.65rem;border-radius:6px;background:#3d2a1a;color:#ffd7a8;';
        b.textContent = bannerMessage;
        return b;
      })()
    : null;

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

  wrap.append(h, note);
  if (bannerEl) wrap.append(bannerEl);
  if (loginDebug) {
    const dbg = document.createElement('div');
    dbg.className = 'hnf-login-env-debug muted small';
    dbg.style.cssText =
      'margin-top:0.75rem;padding:0.5rem 0.65rem;border-radius:6px;border:1px solid rgba(255,255,255,0.12);font-family:ui-monospace,monospace;font-size:0.75rem;line-height:1.45;';
    dbg.innerHTML = `<div><strong>API:</strong> ${escapeHtml(loginDebug.apiUrl)}</div><div><strong>ENTORNO:</strong> ${escapeHtml(loginDebug.environment)}</div>`;
    wrap.append(dbg);
  }
  wrap.append(err, form);
  root.append(wrap);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    err.style.color = '#f87171';
    btn.disabled = true;
    try {
      await onSuccess?.({
        username: user.value.trim(),
        password: pass.value,
      });
    } catch (ex) {
      const warn = ex?.authUiSeverity === 'warn';
      err.style.color = warn ? '#fbbf24' : '#f87171';
      err.textContent = ex?.message || 'No se pudo iniciar sesión.';
    } finally {
      btn.disabled = false;
    }
  });
};

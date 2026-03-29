export const sinAccesoView = (props) => {
  const moduleId = props?.deniedModuleId || '';
  const wrap = document.createElement('div');
  wrap.className = 'tarjeta';
  wrap.style.cssText = 'margin:1.5rem;padding:1.25rem;max-width:36rem;';

  const h = document.createElement('h2');
  h.style.fontSize = '1.1rem';
  h.textContent = 'Sin acceso a este módulo';

  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = moduleId
    ? `No tenés permisos para abrir «${moduleId}». Si necesitás acceso, consultá con Hernán o administración.`
    : 'No tenés permisos para esta sección. Si necesitás acceso, consultá con Hernán o administración.';

  wrap.append(h, p);
  return wrap;
};

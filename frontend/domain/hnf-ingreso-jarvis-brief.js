/**
 * Textos claros para el panel de ingreso (sin llamadas a servidor).
 * Coincidencias de cliente contra nombres ya vistos en datos cargados.
 */

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * @param {object} opts
 * @param {object} opts.formLike — campos del formulario (cliente, telefono, emailCorreo, origen, tipo, whatsappNumero, comuna)
 * @param {string[]} opts.clientesConocidos
 */
export function buildIngresoJarvisBrief({ formLike = {}, clientesConocidos = [] } = {}) {
  const cliente = String(formLike.cliente || '').trim();
  const telefono = String(formLike.telefono || '').trim();
  const email = String(formLike.emailCorreo || '').trim();
  const origen = String(formLike.origen || '');
  const tipo = String(formLike.tipo || '');
  const wa = String(formLike.whatsappNumero || '').trim();
  const comuna = String(formLike.comuna || '').trim();

  const resumen = [];
  if (cliente) resumen.push(`Cliente: ${cliente}`);
  if (tipo) {
    const t =
      tipo === 'flota'
        ? 'Flota (Gery)'
        : tipo === 'comercial'
          ? 'Comercial (Lyn / Hernán)'
          : tipo === 'administrativo'
            ? 'Administrativo (Romina)'
            : 'Clima (Romina)';
    resumen.push(`Área detectada: ${t}`);
  }
  if (origen) resumen.push(`Origen: ${origen}`);

  const importante = [];
  const conocidos = clientesConocidos.map((c) => norm(c)).filter(Boolean);
  if (cliente && conocidos.includes(norm(cliente))) {
    importante.push('Cliente detectado: el nombre coincide con un cliente ya cargado. Revisá que no sea un duplicado.');
  }
  if (origen === 'whatsapp' && !wa) {
    importante.push('Falta número de WhatsApp para este origen.');
  }
  if (!telefono && origen !== 'whatsapp') {
    importante.push('Falta número de teléfono: es obligatorio para crear la OT.');
  }
  if (!email) {
    importante.push('Información importante: no hay correo de contacto cargado (opcional pero recomendado).');
  }
  if (!comuna) {
    importante.push('Información importante: falta comuna o ciudad.');
  }

  const recomendaciones = [];
  if (tipo === 'clima') {
    recomendaciones.push('Recomendación: al guardar, la OT queda en bandeja Clima para Romina.');
  }
  if (tipo === 'flota') {
    recomendaciones.push('Recomendación: al guardar, la OT queda en bandeja Flota para Gery.');
  }
  if (tipo === 'comercial') {
    recomendaciones.push('Recomendación: revisá el módulo Comercial (Lyn / Hernán) para seguimiento.');
  }
  if (tipo === 'administrativo') {
    recomendaciones.push('Recomendación: trámite interno — priorizar validación con Romina.');
  }
  if (!telefono && origen === 'whatsapp' && wa) {
    recomendaciones.push('Recomendación: completá también el teléfono general si el cliente tiene línea fija.');
  }

  const faltantes = [];
  if (!cliente) faltantes.push('Nombre del cliente / empresa');
  if (!telefono && origen !== 'whatsapp') faltantes.push('Teléfono');
  if (origen === 'whatsapp' && (!wa || !String(formLike.whatsappNombre || '').trim())) {
    faltantes.push('WhatsApp: número y nombre');
  }

  return {
    resumen: resumen.length ? resumen.join(' · ') : 'Completá origen y cliente para ver un resumen.',
    importante: importante.join(' '),
    recomendaciones: recomendaciones.join(' '),
    faltantes: faltantes.length ? `Datos faltantes: ${faltantes.join(', ')}.` : 'Sin faltantes críticos visibles.',
  };
}

/**
 * Inteligencia relacional sobre detección Jarvis (sin IA externa).
 * Vinculación automática conservadora + propuestas de creación.
 */

export const JARVIS_REL_ENGINE_VERSION = '1.0.0';

export function normalizeRutChile(r) {
  return String(r || '')
    .replace(/\./g, '')
    .replace(/\s/g, '')
    .replace(/-/g, '')
    .toUpperCase()
    .replace(/[^0-9K]/g, '');
}

export function normalizePhoneChile(s) {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length >= 9) return d.slice(-9);
  return d;
}

export function normalizePatenteChile(p) {
  return String(p || '')
    .replace(/[\s-]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

const normTxt = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

function tokenJaccard(a, b) {
  const ta = new Set(normTxt(a).split(/\s+/).filter((x) => x.length > 2));
  const tb = new Set(normTxt(b).split(/\s+/).filter((x) => x.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

function findSimilarClients(nombre, clientes, minJ = 0.55) {
  if (!String(nombre || '').trim()) return [];
  const out = [];
  for (const c of clientes) {
    const n = c.nombre || c.nombre_cliente || c.name || '';
    const j = tokenJaccard(nombre, n);
    if (j >= minJ) out.push({ id: c.id, nombre: n, score: j });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * @param {object} classifyResult — salida de classifyDocumentBuffer + opcional texto_match_sample
 * @param {object} ctx — clientes[], contactos[], vehiculos[], tecnicos[], personalById Map o lista personal
 */
export function resolveRelationalLinks(classifyResult, ctx) {
  const datos = classifyResult.datos_detectados || {};
  const blob = `${classifyResult.texto_match_sample || ''} ${classifyResult.resumen_breve || ''}`.slice(
    0,
    50000
  );
  const blobN = normTxt(blob);

  const clientes = Array.isArray(ctx.clientes) ? ctx.clientes : [];
  const contactos = Array.isArray(ctx.contactos) ? ctx.contactos : [];
  const vehiculos = Array.isArray(ctx.vehiculos) ? ctx.vehiculos : [];
  const tecnicos = Array.isArray(ctx.tecnicos) ? ctx.tecnicos : [];
  const personal = Array.isArray(ctx.personal) ? ctx.personal : [];
  const personalById = new Map(personal.map((p) => [p.id, p]));

  const rutPrimero = datos.ruts?.[0] ? normalizeRutChile(datos.ruts[0]) : '';
  const emailPrimero = datos.emails?.[0] ? String(datos.emails[0]).toLowerCase().trim() : '';
  const telPrimero = datos.telefonos?.[0] ? normalizePhoneChile(datos.telefonos[0]) : '';
  const patPrimero = datos.patentes?.[0] ? normalizePatenteChile(datos.patentes[0]) : '';

  /* —— Cliente —— */
  let cliente = { estado: 'sin_datos', mensaje_ui: 'Sin RUT ni nombre claro para cliente.' };
  if (rutPrimero) {
    const porRut = clientes.filter((c) => normalizeRutChile(c.rut) === rutPrimero && rutPrimero.length > 7);
    if (porRut.length === 1) {
      cliente = {
        estado: 'vinculado_automatico',
        mensaje_ui: 'Coincidencia encontrada: RUT único en clientes.',
        cliente_id: porRut[0].id,
        nombre: porRut[0].nombre || porRut[0].nombre_cliente,
        rut: porRut[0].rut,
        criterio: 'rut_exacto',
      };
    } else if (porRut.length > 1) {
      cliente = {
        estado: 'posible_duplicado',
        mensaje_ui: 'Posible duplicado: más de un cliente con el mismo RUT en datos (revisar manualmente).',
        candidatos: porRut.map((c) => ({ id: c.id, nombre: c.nombre || c.nombre_cliente, rut: c.rut })),
      };
    } else {
      const similares = findSimilarClients(
        datos.nombre_cliente_inferido || classifyResult.cliente_probable?.nombre || '',
        clientes,
        0.5
      );
      cliente = {
        estado: 'crear_sugerido',
        mensaje_ui: 'Crear nuevo: RUT detectado sin cliente en base.',
        rut_sugerido: datos.ruts[0],
        nombre_sugerido: datos.nombre_cliente_inferido || classifyResult.cliente_probable?.nombre || '',
        candidatos_similares: similares,
      };
    }
  } else if (classifyResult.cliente_probable?.id) {
    cliente = {
      estado: 'coincidencia_encontrada',
      mensaje_ui: 'Coincidencia encontrada: nombre en texto (revisar antes de vincular).',
      cliente_id: classifyResult.cliente_probable.id,
      nombre: classifyResult.cliente_probable.nombre,
      criterio: 'nombre_en_texto',
    };
  } else if (datos.nombre_cliente_inferido || classifyResult.cliente_probable?.nombre) {
    const nom = datos.nombre_cliente_inferido || classifyResult.cliente_probable?.nombre;
    const sim = findSimilarClients(nom, clientes, 0.55);
    if (sim.length === 1 && sim[0].score >= 0.72) {
      cliente = {
        estado: 'coincidencia_encontrada',
        mensaje_ui: 'Coincidencia encontrada: nombre muy similar a un cliente.',
        cliente_id: sim[0].id,
        nombre: sim[0].nombre,
        criterio: 'nombre_similar',
        score: sim[0].score,
      };
    } else if (sim.length > 0) {
      cliente = {
        estado: 'posible_duplicado',
        mensaje_ui: 'Posible duplicado: varios clientes con nombre parecido.',
        candidatos: sim.map((s) => ({ id: s.id, nombre: s.nombre, score: s.score })),
        nombre_sugerido: nom,
      };
    } else {
      cliente = {
        estado: 'crear_sugerido',
        mensaje_ui: 'Crear nuevo: nombre detectado sin match fuerte.',
        nombre_sugerido: nom,
      };
    }
  }

  /* —— Contacto —— */
  let contacto = { estado: 'sin_datos', mensaje_ui: 'Sin correo ni teléfono para contacto.' };
  if (emailPrimero) {
    const porMail = contactos.filter((c) => String(c.correo || '').toLowerCase().trim() === emailPrimero);
    if (porMail.length === 1) {
      contacto = {
        estado: 'vinculado_automatico',
        mensaje_ui: 'Coincidencia encontrada: correo único.',
        contacto_id: porMail[0].id,
        nombre: porMail[0].nombre_contacto,
        criterio: 'correo',
      };
    } else if (porMail.length > 1) {
      contacto = {
        estado: 'posible_duplicado',
        mensaje_ui: 'Posible duplicado: mismo correo en varios contactos.',
        candidatos: porMail.map((c) => ({ id: c.id, nombre: c.nombre_contacto })),
      };
    } else if (blobN.includes(normTxt(emailPrimero))) {
      contacto = {
        estado: 'crear_sugerido',
        mensaje_ui: 'Crear nuevo: correo detectado, no está en contactos.',
        correo_sugerido: emailPrimero,
        nombre_sugerido: datos.nombre_contacto_inferido || '',
      };
    }
  }
  if (contacto.estado === 'sin_datos' && telPrimero) {
    const porTel = contactos.filter((c) => {
      const t = normalizePhoneChile(c.telefono);
      const w = normalizePhoneChile(c.whatsapp);
      return (t && t === telPrimero) || (w && w === telPrimero);
    });
    if (porTel.length === 1) {
      contacto = {
        estado: 'vinculado_automatico',
        mensaje_ui: 'Coincidencia encontrada: teléfono único.',
        contacto_id: porTel[0].id,
        nombre: porTel[0].nombre_contacto,
        criterio: 'telefono',
      };
    } else if (porTel.length > 1) {
      contacto = {
        estado: 'posible_duplicado',
        mensaje_ui: 'Posible duplicado: mismo teléfono en varios contactos.',
        candidatos: porTel.map((c) => ({ id: c.id, nombre: c.nombre_contacto })),
      };
    } else if (telPrimero.length >= 8) {
      contacto = {
        estado: 'crear_sugerido',
        mensaje_ui: 'Crear nuevo: teléfono detectado sin contacto.',
        telefono_sugerido: datos.telefonos[0],
        nombre_sugerido: datos.nombre_contacto_inferido || '',
      };
    }
  }
  if (contacto.estado === 'sin_datos' && classifyResult.contacto_probable?.id) {
    contacto = {
      estado: 'coincidencia_encontrada',
      mensaje_ui: 'Coincidencia encontrada: nombre de contacto en texto.',
      contacto_id: classifyResult.contacto_probable.id,
      nombre: classifyResult.contacto_probable.nombre,
      criterio: 'nombre_en_texto',
    };
  }

  /* —— Vehículo —— */
  let vehiculo = { estado: 'sin_datos', mensaje_ui: 'Sin patente detectada.' };
  if (patPrimero) {
    const porP = vehiculos.filter((v) => normalizePatenteChile(v.patente) === patPrimero);
    if (porP.length === 1) {
      vehiculo = {
        estado: 'vinculado_automatico',
        mensaje_ui: 'Coincidencia encontrada: patente única.',
        vehiculo_id: porP[0].id,
        patente: porP[0].patente,
        criterio: 'patente',
      };
    } else if (porP.length > 1) {
      vehiculo = {
        estado: 'posible_duplicado',
        mensaje_ui: 'Posible duplicado: misma patente en varios registros.',
        candidatos: porP.map((v) => ({ id: v.id, patente: v.patente })),
      };
    } else {
      vehiculo = {
        estado: 'crear_sugerido',
        mensaje_ui: 'Crear nuevo: patente no está en vehículos maestro.',
        patente_sugerida: datos.patentes[0],
      };
    }
  }

  /* —— Técnico (ficha maestro MTE + persona) —— */
  let tecnico = { estado: 'sin_datos', mensaje_ui: 'Sin técnico inferido.' };
  const tecMatches = [];
  for (const t of tecnicos) {
    const per = personalById.get(t.persona_id);
    const nom = per?.nombreCompleto || '';
    const nn = normTxt(nom);
    if (nn.length > 5 && blobN.includes(nn)) {
      tecMatches.push({ id: t.id, persona_id: t.persona_id, nombre: nom });
    }
  }
  if (classifyResult.tecnico_probable?.id) {
    const ex = tecnicos.find((x) => x.id === classifyResult.tecnico_probable.id);
    if (ex) {
      tecnico = {
        estado: 'coincidencia_encontrada',
        mensaje_ui: 'Coincidencia encontrada: persona/técnico en texto.',
        tecnico_id: ex.id,
        nombre: classifyResult.tecnico_probable.nombre,
        criterio: 'nombre_en_texto',
      };
    }
  } else if (tecMatches.length === 1) {
    tecnico = {
      estado: 'vinculado_automatico',
      mensaje_ui: 'Coincidencia encontrada: un técnico coincide con el texto.',
      tecnico_id: tecMatches[0].id,
      nombre: tecMatches[0].nombre,
      criterio: 'persona_en_texto',
    };
  } else if (tecMatches.length > 1) {
    tecnico = {
      estado: 'posible_duplicado',
      mensaje_ui: 'Varios técnicos podrían coincidir.',
      candidatos: tecMatches,
    };
  }

  const autoClienteId = cliente.estado === 'vinculado_automatico' ? cliente.cliente_id : null;
  const autoContactoId = contacto.estado === 'vinculado_automatico' ? contacto.contacto_id : null;
  const autoVehiculoId = vehiculo.estado === 'vinculado_automatico' ? vehiculo.vehiculo_id : null;
  const autoTecnicoId = tecnico.estado === 'vinculado_automatico' ? tecnico.tecnico_id : null;

  return {
    version: JARVIS_REL_ENGINE_VERSION,
    cliente,
    contacto,
    vehiculo,
    tecnico,
    autoClienteId,
    autoContactoId,
    autoVehiculoId,
    autoTecnicoId,
  };
}

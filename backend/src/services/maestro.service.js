import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyDocumentBuffer } from '../domain/jarvis-document-intake.engine.js';
import {
  normalizePatenteChile,
  normalizePhoneChile,
  normalizeRutChile,
  resolveRelationalLinks,
} from '../domain/jarvis-relational-intake.engine.js';
import { hnfExtendedClientRepository } from '../repositories/hnfExtendedClient.repository.js';
import { hnfInternalDirectoryRepository } from '../repositories/hnfInternalDirectory.repository.js';
import { maestroConductorRepository } from '../repositories/maestroConductor.repository.js';
import { maestroContactoRepository } from '../repositories/maestroContacto.repository.js';
import { maestroDocumentoRepository } from '../repositories/maestroDocumento.repository.js';
import { otRepository } from '../repositories/ot.repository.js';
import { maestroTecnicoRepository } from '../repositories/maestroTecnico.repository.js';
import { maestroVehiculoRepository } from '../repositories/maestroVehiculo.repository.js';
import {
  computeDestinoFieldsForDocument,
  documentoTieneRevisionManualSugerida,
  labelBandejaHumano,
  labelDestinoHumano,
  MAESTRO_DESTINOS,
  normalizeDestinoModulo,
  resolveBandejaFinal,
} from '../domain/maestro-document-destino.engine.js';
import { hnfOperativoIntegradoService } from './hnfOperativoIntegrado.service.js';
import { isOtCerrada } from '../utils/otEstado.js';
import {
  aplicarModuloPorTipoSolicitud,
  inferTipoSolicitudFromText,
  RESPUESTA_AUTOMATICA_INTAKE_FASE1,
} from '../domain/jarvis-intake-externo.engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '../../data');
const UPLOAD_REL = path.join('uploads', 'maestro');

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 15;

const safeName = (n) =>
  String(n || 'archivo')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 160) || 'archivo';

/** Contexto Jarvis: clasificación en texto + resolución relacional (cliente/contacto/vehículo/técnico). */
async function buildMaestroJarvisContext() {
  const [clientesRaw, contactosRaw, personal, vehiculos, tecnicos] = await Promise.all([
    hnfExtendedClientRepository.findAll(),
    maestroContactoRepository.findAll(),
    hnfInternalDirectoryRepository.findAll(),
    maestroVehiculoRepository.findAll(),
    maestroTecnicoRepository.findAll(),
  ]);
  const clientes = clientesRaw.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    nombre_cliente: c.nombre || c.nombre_cliente,
    rut: c.rut,
    correo: c.correo || c.correo_principal,
    telefono: c.telefono || c.telefono_principal,
  }));
  const contactos = contactosRaw.map((c) => ({
    id: c.id,
    nombre_contacto: c.nombre_contacto,
    correo: c.correo,
    telefono: c.telefono,
    whatsapp: c.whatsapp,
    cliente_id: c.cliente_id,
  }));
  return {
    clientes,
    contactos,
    personal: personal.map((p) => ({ id: p.id, nombreCompleto: p.nombreCompleto, nombre: p.nombreCompleto })),
    vehiculos,
    tecnicos,
  };
}

function aplicarDestinoJarvisNuevo(moduloSugerido) {
  const { destino_final, bandeja_destino, area_detectada } = resolveBandejaFinal(moduloSugerido);
  return {
    destino_detectado: destino_final,
    area_detectada,
    destino_final,
    bandeja_destino,
    clasificacion_fuente: 'jarvis',
  };
}

function tiempoHastaGestionSegundos(doc) {
  const a = doc?.intake_fecha_ingreso;
  const b = doc?.intake_fecha_primera_gestion;
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 1000) : null;
}

function appendHistorialRevision(cur, tipo, detalle, usuario) {
  const h = Array.isArray(cur?.historial_revision) ? [...cur.historial_revision] : [];
  h.push({
    at: new Date().toISOString(),
    tipo,
    detalle: String(detalle || '').slice(0, 2000),
    usuario: usuario || null,
  });
  return h.length > 250 ? h.slice(-250) : h;
}

/** Clasificación mínima desde fila persistida (sin releer archivo salvo opción explícita). */
function buildSyntheticClassifyFromStoredDoc(doc) {
  const datos =
    doc.datos_detectados && typeof doc.datos_detectados === 'object' ? { ...doc.datos_detectados } : {};
  const arr = (k) => {
    if (!Array.isArray(datos[k])) datos[k] = datos[k] != null && datos[k] !== '' ? [datos[k]] : [];
  };
  arr('ruts');
  arr('emails');
  arr('telefonos');
  arr('patentes');
  arr('ots');
  if (!datos.patentes?.length && doc.patente_probable) datos.patentes = [doc.patente_probable];
  if (!datos.ots?.length && doc.ot_probable) datos.ots = [doc.ot_probable];
  const fn = String(doc.nombre_archivo || '');
  const texto = `${fn}\n${doc.texto_match_sample || ''}\n${doc.resumen_jarvis || ''}`.slice(0, 50000);
  return {
    datos_detectados: datos,
    texto_match_sample: texto,
    resumen_breve: doc.resumen_jarvis || '',
    cliente_probable: doc.cliente_probable || null,
    contacto_probable: doc.contacto_probable || null,
    tecnico_probable: doc.tecnico_probable || null,
  };
}

/** Documentos candidatos a reparación (sin jarvis, sin versión o señales sin reflejar en bloques). */
function documentoNecesitaReparacionVinculos(doc) {
  const v = doc.jarvis_vinculacion;
  if (!v || typeof v !== 'object' || !v.version) return true;
  const datos = doc.datos_detectados || {};
  const hasRut = (datos.ruts && datos.ruts.length > 0) || false;
  const hasNom =
    String(datos.nombre_cliente_inferido || '').trim().length > 2 || !!doc.cliente_probable?.nombre;
  const hasMail = (datos.emails && datos.emails.length > 0) || false;
  const hasTel = (datos.telefonos && datos.telefonos.length > 0) || false;
  const hasPat =
    (datos.patentes && datos.patentes.length > 0) || !!String(doc.patente_probable || '').trim();
  if ((hasRut || hasNom) && (!v.cliente || v.cliente.estado === 'sin_datos')) return true;
  if ((hasMail || hasTel) && (!v.contacto || v.contacto.estado === 'sin_datos')) return true;
  if (hasPat && (!v.vehiculo || v.vehiculo.estado === 'sin_datos')) return true;
  return false;
}

/**
 * Aplica vínculos automáticos solo en FK vacíos; si ya hay FK no lo pisa.
 * Si Jarvis discrepa con un FK existente, marca revisión manual sugerida.
 */
function mergeRepairVinculosConservador(cur, vinc) {
  const before = {
    cliente_id: cur.cliente_id || null,
    contacto_id: cur.contacto_id || null,
    vehiculo_id: cur.vehiculo_id || null,
    tecnico_id: cur.tecnico_id || null,
    jarvis_vinculacion_version: cur.jarvis_vinculacion?.version || null,
  };

  const curC = String(cur.cliente_id || '').trim();
  const curCo = String(cur.contacto_id || '').trim();
  const curV = String(cur.vehiculo_id || '').trim();
  const curT = String(cur.tecnico_id || '').trim();

  let clienteBlock = vinc.cliente;
  if (curC) {
    const sug = vinc.autoClienteId;
    if (sug && sug !== curC) {
      clienteBlock = {
        estado: 'revision_manual_sugerida',
        mensaje_ui: 'Vinculado manualmente; Jarvis sugiere otra coincidencia — revisar.',
        vinculo_conservado_id: curC,
        sugerencia_jarvis: { ...vinc.cliente },
      };
    } else {
      clienteBlock = {
        ...vinc.cliente,
        estado: 'vinculado_manual',
        cliente_id: curC,
        mensaje_ui: 'Vinculado (conservado; reparación histórica no modifica este ID).',
      };
    }
  }

  let contactoBlock = vinc.contacto;
  if (curCo) {
    const sug = vinc.autoContactoId;
    if (sug && sug !== curCo) {
      contactoBlock = {
        estado: 'revision_manual_sugerida',
        mensaje_ui: 'Vinculado manualmente; Jarvis sugiere otro contacto — revisar.',
        vinculo_conservado_id: curCo,
        sugerencia_jarvis: { ...vinc.contacto },
      };
    } else {
      contactoBlock = {
        ...vinc.contacto,
        estado: 'vinculado_manual',
        contacto_id: curCo,
        mensaje_ui: 'Vinculado (conservado; reparación histórica no modifica este ID).',
      };
    }
  }

  let vehBlock = vinc.vehiculo;
  if (curV) {
    const sug = vinc.autoVehiculoId;
    if (sug && sug !== curV) {
      vehBlock = {
        estado: 'revision_manual_sugerida',
        mensaje_ui: 'Vinculado manualmente; Jarvis sugiere otro vehículo — revisar.',
        vinculo_conservado_id: curV,
        sugerencia_jarvis: { ...vinc.vehiculo },
      };
    } else {
      vehBlock = {
        ...vinc.vehiculo,
        estado: 'vinculado_manual',
        vehiculo_id: curV,
        mensaje_ui: 'Vinculado (conservado; reparación histórica no modifica este ID).',
      };
    }
  }

  let tecBlock = vinc.tecnico;
  if (curT) {
    const sug = vinc.autoTecnicoId;
    if (sug && sug !== curT) {
      tecBlock = {
        estado: 'revision_manual_sugerida',
        mensaje_ui: 'Vinculado manualmente; Jarvis sugiere otro técnico — revisar.',
        vinculo_conservado_id: curT,
        sugerencia_jarvis: { ...vinc.tecnico },
      };
    } else {
      tecBlock = {
        ...vinc.tecnico,
        estado: 'vinculado_manual',
        tecnico_id: curT,
        mensaje_ui: 'Vinculado (conservado; reparación histórica no modifica este ID).',
      };
    }
  }

  const nextFk = {
    cliente_id: curC || vinc.autoClienteId || null,
    contacto_id: curCo || vinc.autoContactoId || null,
    vehiculo_id: curV || vinc.autoVehiculoId || null,
    tecnico_id: curT || vinc.autoTecnicoId || null,
  };

  const jarvis_vinculacion = {
    ...vinc,
    cliente: clienteBlock,
    contacto: contactoBlock,
    vehiculo: vehBlock,
    tecnico: tecBlock,
  };

  const after = {
    cliente_id: nextFk.cliente_id,
    contacto_id: nextFk.contacto_id,
    vehiculo_id: nextFk.vehiculo_id,
    tecnico_id: nextFk.tecnico_id,
    jarvis_vinculacion_version: jarvis_vinculacion.version,
  };

  return { before, nextFk, jarvis_vinculacion, after };
}

const normTxtSimple = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

/**
 * Aprobación: valida/vincula FK existentes, busca por RUT/correo/tel/patente, y opcionalmente crea entidades (anti-duplicados).
 * No pisa FK ya válidas ni crea en tipo con revisión manual sugerida (modo seguro).
 */
async function procesarAprobacionDocumento(documentoId, body, actor) {
  const autoCrear = body?.auto_crear !== false;
  const modo = String(body?.modo || 'seguro').toLowerCase() === 'agresivo' ? 'agresivo' : 'seguro';
  const forzar = Boolean(body?.forzar_reprocesar);

  let doc = await maestroDocumentoRepository.findById(documentoId);
  if (!doc) return { error: 'No encontrado' };
  if (String(doc.estado_revision || '').toLowerCase() === 'aprobado' && !forzar) {
    return { errors: ['Documento ya aprobado. Usá forzar_reprocesar para repetir.'] };
  }

  const vincPrev = doc.jarvis_vinculacion && typeof doc.jarvis_vinculacion === 'object' ? doc.jarvis_vinculacion : {};
  const datos = doc.datos_detectados && typeof doc.datos_detectados === 'object' ? doc.datos_detectados : {};
  const ctx = await buildMaestroJarvisContext();
  const hints = resolveRelationalLinks(buildSyntheticClassifyFromStoredDoc(doc), ctx);

  const clientesAll = [...(await hnfExtendedClientRepository.findAll())];
  const contactosAll = [...(await maestroContactoRepository.findAll())];
  const vehiculosAll = [...(await maestroVehiculoRepository.findAll())];
  const tecnicosAll = [...(await maestroTecnicoRepository.findAll())];
  const personalAll = await hnfInternalDirectoryRepository.findAll();

  const entidades_creadas = [];
  const entidades_vinculadas = [];
  const resumen = {
    cliente: { accion: 'omitido', id: null, detalle: '' },
    contacto: { accion: 'omitido', id: null, detalle: '' },
    vehiculo: { accion: 'omitido', id: null, detalle: '' },
    tecnico: { accion: 'omitido', id: null, detalle: '' },
  };

  const skipCreate = (bloque) => modo === 'seguro' && bloque?.estado === 'revision_manual_sugerida';

  let cliente_id = String(doc.cliente_id || '').trim();
  let contacto_id = String(doc.contacto_id || '').trim();
  let vehiculo_id = String(doc.vehiculo_id || '').trim();
  let tecnico_id = String(doc.tecnico_id || '').trim();
  const patenteDocRaw =
    datos.patentes?.[0] || doc.patente_probable || vincPrev.vehiculo?.patente_sugerida || '';

  /* —— Cliente —— */
  if (cliente_id) {
    const ex = clientesAll.find((c) => c.id === cliente_id);
    if (ex) {
      entidades_vinculadas.push({ tipo: 'cliente', id: cliente_id, razon: 'fk_existente_validada' });
      resumen.cliente = { accion: 'vinculado', id: cliente_id, detalle: 'FK ya asignada y válida' };
    } else {
      resumen.cliente = { accion: 'omitido', id: cliente_id, detalle: 'FK conservada (ID no hallado en base; no se sobrescribe)' };
    }
  } else {
    const rutRaw = datos.ruts?.[0] || vincPrev.cliente?.rut_sugerido || '';
    const rutKey = rutRaw ? normalizeRutChile(rutRaw) : '';
    const byRut =
      rutKey.length > 7 ? clientesAll.find((c) => normalizeRutChile(c.rut) === rutKey) : null;
    if (byRut) {
      cliente_id = byRut.id;
      entidades_vinculadas.push({ tipo: 'cliente', id: byRut.id, razon: 'por_rut' });
      resumen.cliente = { accion: 'vinculado', id: byRut.id, detalle: 'Coincidencia por RUT' };
    } else if (autoCrear && !skipCreate(vincPrev.cliente) && rutKey.length > 7) {
      const nombre = String(
        datos.nombre_cliente_inferido || doc.cliente_probable?.nombre || vincPrev.cliente?.nombre_sugerido || ''
      ).trim();
      const sugCrear = vincPrev.cliente?.estado === 'crear_sugerido' || hints.cliente?.estado === 'crear_sugerido';
      if (nombre.length > 2 && (sugCrear || modo === 'agresivo')) {
        const r = await hnfOperativoIntegradoService.createExtendedClient(
          {
            nombre,
            rut: rutRaw || '',
            correo: datos.emails?.[0] || '',
            telefono: datos.telefonos?.[0] || '',
          },
          actor
        );
        if (r.errors) {
          resumen.cliente = { accion: 'omitido', id: null, detalle: r.errors.join('; ') };
        } else {
          cliente_id = r.id;
          clientesAll.push(r);
          entidades_creadas.push({ tipo: 'cliente', id: r.id });
          resumen.cliente = { accion: 'creado', id: r.id, detalle: 'Alta cliente extendido' };
        }
      } else {
        resumen.cliente = {
          accion: 'omitido',
          id: null,
          detalle: 'Falta nombre o sugerencia crear_sugerido (modo seguro exige ambos con RUT)',
        };
      }
    } else {
      if (!autoCrear) {
        resumen.cliente = { accion: 'omitido', id: null, detalle: 'auto_crear false' };
      } else if (skipCreate(vincPrev.cliente)) {
        resumen.cliente = {
          accion: 'omitido',
          id: null,
          detalle: 'revisión manual sugerida (seguro): no se crea cliente',
        };
      } else if (rutKey.length <= 7) {
        resumen.cliente = {
          accion: 'omitido',
          id: null,
          detalle: 'Sin RUT válido en documento: no se crea cliente (anti-duplicados)',
        };
      } else {
        resumen.cliente = { accion: 'omitido', id: null, detalle: 'Sin acción de creación' };
      }
    }
  }

  /* —— Contacto (después de cliente) —— */
  if (contacto_id) {
    const ex = contactosAll.find((c) => c.id === contacto_id);
    if (ex) {
      entidades_vinculadas.push({ tipo: 'contacto', id: contacto_id, razon: 'fk_existente_validada' });
      resumen.contacto = { accion: 'vinculado', id: contacto_id, detalle: 'FK ya asignada y válida' };
    } else {
      resumen.contacto = { accion: 'omitido', id: contacto_id, detalle: 'FK conservada (ID no hallado)' };
    }
  } else {
    const email = String(datos.emails?.[0] || vincPrev.contacto?.correo_sugerido || '')
      .toLowerCase()
      .trim();
    const telRaw = datos.telefonos?.[0] || vincPrev.contacto?.telefono_sugerido || '';
    const tel = normalizePhoneChile(telRaw);
    let by = email ? contactosAll.find((c) => String(c.correo || '').toLowerCase().trim() === email) : null;
    if (!by && tel.length >= 8) {
      by = contactosAll.find(
        (c) =>
          normalizePhoneChile(c.telefono) === tel || normalizePhoneChile(c.whatsapp) === tel
      );
    }
    if (by) {
      contacto_id = by.id;
      entidades_vinculadas.push({ tipo: 'contacto', id: by.id, razon: email ? 'por_correo' : 'por_telefono' });
      resumen.contacto = { accion: 'vinculado', id: by.id, detalle: 'Coincidencia correo/tel' };
    } else if (autoCrear && !skipCreate(vincPrev.contacto)) {
      const nombre = String(
        datos.nombre_contacto_inferido || vincPrev.contacto?.nombre_sugerido || ''
      ).trim();
      const sug = vincPrev.contacto?.estado === 'crear_sugerido' || hints.contacto?.estado === 'crear_sugerido';
      const canal = email ? 'correo' : 'telefono';
      if ((email || tel.length >= 8) && nombre.length > 2 && (sug || modo === 'agresivo')) {
        const r = await createContactoWithChecks(
          {
            nombre_contacto: nombre,
            correo: email,
            telefono: telRaw || '',
            cliente_id: cliente_id || '',
            canal_preferido: canal,
            activo: true,
          },
          actor
        );
        if (r.errors) {
          resumen.contacto = { accion: 'omitido', id: null, detalle: r.errors.join('; ') };
        } else {
          contacto_id = r.id;
          contactosAll.push(r);
          entidades_creadas.push({ tipo: 'contacto', id: r.id });
          resumen.contacto = { accion: 'creado', id: r.id, detalle: 'Alta contacto maestro' };
        }
      } else {
        resumen.contacto = { accion: 'omitido', id: null, detalle: 'Falta correo/tel o nombre o sugerencia crear' };
      }
    } else {
      resumen.contacto = {
        accion: 'omitido',
        id: null,
        detalle: !autoCrear ? 'auto_crear false' : 'revisión manual sugerida (seguro)',
      };
    }
  }

  /* —— Vehículo —— */
  if (vehiculo_id) {
    const ex = vehiculosAll.find((v) => v.id === vehiculo_id);
    if (ex) {
      entidades_vinculadas.push({ tipo: 'vehiculo', id: vehiculo_id, razon: 'fk_existente_validada' });
      resumen.vehiculo = { accion: 'vinculado', id: vehiculo_id, detalle: 'FK ya asignada y válida' };
    } else {
      resumen.vehiculo = { accion: 'omitido', id: vehiculo_id, detalle: 'FK conservada (ID no hallado)' };
    }
  } else {
    const patKey = patenteDocRaw ? normalizePatenteChile(patenteDocRaw) : '';
    const byP = patKey.length > 3 ? vehiculosAll.find((v) => normalizePatenteChile(v.patente) === patKey) : null;
    if (byP) {
      vehiculo_id = byP.id;
      entidades_vinculadas.push({ tipo: 'vehiculo', id: byP.id, razon: 'por_patente' });
      resumen.vehiculo = { accion: 'vinculado', id: byP.id, detalle: 'Coincidencia patente' };
    } else if (autoCrear && !skipCreate(vincPrev.vehiculo) && patKey.length > 3) {
      const sug = vincPrev.vehiculo?.estado === 'crear_sugerido' || hints.vehiculo?.estado === 'crear_sugerido';
      if (sug || modo === 'agresivo') {
        const r = await createVehiculoWithChecks(
          {
            patente: patenteDocRaw,
            marca: '',
            cliente_id: cliente_id || '',
            estado: 'activo',
            documentos_asociados: [],
          },
          actor
        );
        if (r.errors) {
          resumen.vehiculo = { accion: 'omitido', id: null, detalle: r.errors.join('; ') };
        } else {
          vehiculo_id = r.id;
          vehiculosAll.push(r);
          entidades_creadas.push({ tipo: 'vehiculo', id: r.id });
          resumen.vehiculo = { accion: 'creado', id: r.id, detalle: 'Alta vehículo maestro' };
        }
      } else {
        resumen.vehiculo = { accion: 'omitido', id: null, detalle: 'Modo seguro: solo crea vehículo con crear_sugerido' };
      }
    } else {
      resumen.vehiculo = {
        accion: 'omitido',
        id: null,
        detalle: patKey.length <= 3 ? 'Sin patente detectada' : 'sin acción',
      };
    }
  }

  /* —— Técnico —— */
  if (tecnico_id) {
    const ex = tecnicosAll.find((t) => t.id === tecnico_id);
    if (ex) {
      entidades_vinculadas.push({ tipo: 'tecnico', id: tecnico_id, razon: 'fk_existente_validada' });
      resumen.tecnico = { accion: 'vinculado', id: tecnico_id, detalle: 'FK ya asignada y válida' };
    } else {
      resumen.tecnico = { accion: 'omitido', id: tecnico_id, detalle: 'FK conservada (ID no hallado)' };
    }
  } else {
    const autoT = hints.autoTecnicoId;
    if (autoT) {
      tecnico_id = autoT;
      entidades_vinculadas.push({ tipo: 'tecnico', id: autoT, razon: 'jarvis_resolver' });
      resumen.tecnico = { accion: 'vinculado', id: autoT, detalle: 'Coincidencia motor Jarvis' };
    } else if (modo === 'agresivo' && !skipCreate(vincPrev.tecnico) && doc.tecnico_probable?.nombre) {
      const needle = normTxtSimple(doc.tecnico_probable.nombre);
      const matches = personalAll.filter((p) => {
        const nn = normTxtSimple(p.nombreCompleto);
        return nn.length > 4 && (nn.includes(needle) || needle.includes(nn));
      });
      if (matches.length === 1) {
        const persona_id = matches[0].id;
        const exTec = tecnicosAll.find((t) => String(t.persona_id) === String(persona_id));
        if (exTec) {
          tecnico_id = exTec.id;
          entidades_vinculadas.push({ tipo: 'tecnico', id: exTec.id, razon: 'persona_unica_existente' });
          resumen.tecnico = { accion: 'vinculado', id: exTec.id, detalle: 'Técnico existente por persona' };
        } else {
          const row = await maestroTecnicoRepository.create(
            {
              persona_id,
              especialidad: '',
              zona: '',
              disponibilidad: 'disponible',
              habilidades: [],
              certificaciones: [],
              documentos_asociados: [],
            },
            actor
          );
          tecnico_id = row.id;
          tecnicosAll.push(row);
          entidades_creadas.push({ tipo: 'tecnico', id: row.id });
          resumen.tecnico = { accion: 'creado', id: row.id, detalle: 'Alta técnico maestro (persona directorio)' };
        }
      } else {
        resumen.tecnico = {
          accion: 'omitido',
          id: null,
          detalle: matches.length === 0 ? 'Sin persona única en directorio' : 'Ambigüedad en directorio',
        };
      }
    } else {
      resumen.tecnico = {
        accion: 'omitido',
        id: null,
        detalle: modo === 'seguro' ? 'Seguro: no se crea técnico automático' : 'Sin datos de técnico',
      };
    }
  }

  const jarvis_vinculacion = {
    ...vincPrev,
    version: hints.version || vincPrev.version,
    autoClienteId: hints.autoClienteId,
    autoContactoId: hints.autoContactoId,
    autoVehiculoId: hints.autoVehiculoId,
    autoTecnicoId: hints.autoTecnicoId,
    cliente: cliente_id
      ? {
          estado: resumen.cliente.accion === 'creado' ? 'vinculado_automatico' : 'vinculado_manual',
          mensaje_ui:
            resumen.cliente.accion === 'creado'
              ? 'Creado y vinculado en aprobación'
              : 'Vinculado en aprobación',
          cliente_id,
          criterio: 'aprobacion_documento_jarvis',
        }
      : hints.cliente || vincPrev.cliente || { estado: 'sin_datos', mensaje_ui: 'Sin cliente en aprobación.' },
    contacto: contacto_id
      ? {
          estado: resumen.contacto.accion === 'creado' ? 'vinculado_automatico' : 'vinculado_manual',
          mensaje_ui:
            resumen.contacto.accion === 'creado'
              ? 'Creado y vinculado en aprobación'
              : 'Vinculado en aprobación',
          contacto_id,
          criterio: 'aprobacion_documento_jarvis',
        }
      : hints.contacto || vincPrev.contacto || { estado: 'sin_datos', mensaje_ui: 'Sin contacto en aprobación.' },
    vehiculo: vehiculo_id
      ? {
          estado: resumen.vehiculo.accion === 'creado' ? 'vinculado_automatico' : 'vinculado_manual',
          mensaje_ui:
            resumen.vehiculo.accion === 'creado'
              ? 'Creado y vinculado en aprobación'
              : 'Vinculado en aprobación',
          vehiculo_id,
          patente: patenteDocRaw || hints.vehiculo?.patente,
          criterio: 'aprobacion_documento_jarvis',
        }
      : hints.vehiculo || vincPrev.vehiculo || { estado: 'sin_datos', mensaje_ui: 'Sin vehículo en aprobación.' },
    tecnico: tecnico_id
      ? {
          estado: resumen.tecnico.accion === 'creado' ? 'vinculado_automatico' : 'vinculado_manual',
          mensaje_ui:
            resumen.tecnico.accion === 'creado'
              ? 'Creado y vinculado en aprobación'
              : 'Vinculado en aprobación',
          tecnico_id,
          criterio: 'aprobacion_documento_jarvis',
        }
      : hints.tecnico || vincPrev.tecnico || { estado: 'sin_datos', mensaje_ui: 'Sin técnico en aprobación.' },
  };

  const detalleHist = JSON.stringify({
    origen: 'usuario',
    actor,
    modo,
    auto_crear: autoCrear,
    entidades_creadas,
    entidades_vinculadas,
    resumen,
  }).slice(0, 1950);

  const historial_revision = appendHistorialRevision(doc, 'aprobacion_documento_jarvis', detalleHist, actor);

  const updated = await maestroDocumentoRepository.update(
    documentoId,
    {
      estado_revision: 'aprobado',
      actor_revision: actor,
      cliente_id: cliente_id || null,
      contacto_id: contacto_id || null,
      vehiculo_id: vehiculo_id || null,
      tecnico_id: tecnico_id || null,
      jarvis_vinculacion,
      relational_engine_version: hints.version || doc.relational_engine_version,
      historial_revision,
      ultima_aprobacion_jarvis: {
        at: new Date().toISOString(),
        actor,
        modo,
        auto_crear: autoCrear,
        resumen,
        entidades_creadas,
        entidades_vinculadas,
      },
    },
    actor
  );

  return {
    ok: true,
    documento: updated,
    resumen,
    entidades_creadas,
    entidades_vinculadas,
    modo,
    auto_crear: autoCrear,
  };
}

async function createContactoWithChecks(body, actor) {
  const n = normContacto(body);
  if (!n.nombre_contacto) return { errors: ['nombre_contacto obligatorio'] };
  const all = await maestroContactoRepository.findAll();
  if (n.correo) {
    const em = n.correo.toLowerCase();
    if (all.some((c) => String(c.correo || '').toLowerCase() === em))
      return { errors: ['Ese correo ya está registrado en otro contacto'] };
  }
  const nt = n.telefono ? normalizePhoneChile(n.telefono) : '';
  const nw = n.whatsapp ? normalizePhoneChile(n.whatsapp) : '';
  const clash = all.some((c) => {
    if (nt.length >= 8 && (normalizePhoneChile(c.telefono) === nt || normalizePhoneChile(c.whatsapp) === nt))
      return true;
    if (nw.length >= 8 && (normalizePhoneChile(c.telefono) === nw || normalizePhoneChile(c.whatsapp) === nw))
      return true;
    return false;
  });
  if (clash) return { errors: ['Teléfono o WhatsApp ya registrado en otro contacto'] };
  return maestroContactoRepository.create(n, actor);
}

async function createVehiculoWithChecks(body, actor) {
  const n = normVehiculo(body);
  if (!n.patente) return { errors: ['patente obligatoria'] };
  const key = normalizePatenteChile(n.patente);
  const all = await maestroVehiculoRepository.findAll();
  if (all.some((v) => normalizePatenteChile(v.patente) === key))
    return { errors: ['Esa patente ya existe en el maestro de vehículos'] };
  return maestroVehiculoRepository.create(n, actor);
}

function normContacto(body, prev = {}) {
  return {
    nombre_contacto: String(body.nombre_contacto ?? prev.nombre_contacto ?? '').trim(),
    cargo: String(body.cargo ?? prev.cargo ?? '').trim(),
    cliente_id: String(body.cliente_id ?? prev.cliente_id ?? '').trim(),
    correo: String(body.correo ?? prev.correo ?? '').trim(),
    telefono: String(body.telefono ?? prev.telefono ?? '').trim(),
    whatsapp: String(body.whatsapp ?? prev.whatsapp ?? '').trim(),
    canal_preferido: String(body.canal_preferido ?? prev.canal_preferido ?? 'correo').toLowerCase(),
    observaciones: String(body.observaciones ?? prev.observaciones ?? '').trim(),
    activo: body.activo !== undefined ? Boolean(body.activo) : prev.activo !== false,
  };
}

function normTecnico(body, prev = {}) {
  return {
    persona_id: String(body.persona_id ?? prev.persona_id ?? '').trim(),
    especialidad: String(body.especialidad ?? prev.especialidad ?? '').trim(),
    zona: String(body.zona ?? prev.zona ?? '').trim(),
    disponibilidad: String(body.disponibilidad ?? prev.disponibilidad ?? 'disponible').trim(),
    habilidades: Array.isArray(body.habilidades)
      ? body.habilidades.map((x) => String(x).trim()).filter(Boolean)
      : prev.habilidades || [],
    certificaciones: Array.isArray(body.certificaciones)
      ? body.certificaciones.map((x) => String(x).trim()).filter(Boolean)
      : prev.certificaciones || [],
    documentos_asociados: Array.isArray(body.documentos_asociados)
      ? body.documentos_asociados
      : prev.documentos_asociados || [],
  };
}

function normConductor(body, prev = {}) {
  return {
    persona_id: String(body.persona_id ?? prev.persona_id ?? '').trim(),
    tipo_licencia: String(body.tipo_licencia ?? prev.tipo_licencia ?? '').trim(),
    vencimiento_licencia: String(body.vencimiento_licencia ?? prev.vencimiento_licencia ?? '').trim(),
    disponibilidad: String(body.disponibilidad ?? prev.disponibilidad ?? 'disponible').trim(),
    observaciones: String(body.observaciones ?? prev.observaciones ?? '').trim(),
  };
}

function normVehiculo(body, prev = {}) {
  return {
    patente: String(body.patente ?? prev.patente ?? '')
      .trim()
      .toUpperCase(),
    marca: String(body.marca ?? prev.marca ?? '').trim(),
    modelo: String(body.modelo ?? prev.modelo ?? '').trim(),
    ano: String(body.ano ?? prev.ano ?? '').trim(),
    tipo: String(body.tipo ?? prev.tipo ?? '').trim(),
    cliente_id: String(body.cliente_id ?? prev.cliente_id ?? '').trim(),
    responsable_actual: String(body.responsable_actual ?? prev.responsable_actual ?? '').trim(),
    kilometraje: String(body.kilometraje ?? prev.kilometraje ?? '').trim(),
    estado: String(body.estado ?? prev.estado ?? 'activo').trim(),
    observaciones: String(body.observaciones ?? prev.observaciones ?? '').trim(),
    documentos_asociados: Array.isArray(body.documentos_asociados)
      ? body.documentos_asociados
      : prev.documentos_asociados || [],
  };
}

const ESTADOS_DOC = [
  'borrador',
  'clasificado_jarvis',
  'pendiente_revision',
  'aprobado',
  'rechazado',
  'archivado',
];

export const maestroService = {
  /* —— Contactos —— */
  async listContactos() {
    const all = await maestroContactoRepository.findAll();
    return [...all].sort((a, b) => String(a.nombre_contacto).localeCompare(b.nombre_contacto));
  },
  async createContacto(body, actor) {
    return createContactoWithChecks(body, actor);
  },
  async patchContacto(id, body, actor) {
    const cur = await maestroContactoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    return maestroContactoRepository.update(id, normContacto(body, cur), actor);
  },

  /* —— Técnicos —— */
  async listTecnicos() {
    return maestroTecnicoRepository.findAll();
  },
  async createTecnico(body, actor) {
    const n = normTecnico(body);
    if (!n.persona_id) return { errors: ['persona_id obligatorio (persona del directorio interno)'] };
    return maestroTecnicoRepository.create(n, actor);
  },
  async patchTecnico(id, body, actor) {
    const cur = await maestroTecnicoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    return maestroTecnicoRepository.update(id, normTecnico(body, cur), actor);
  },

  /* —— Conductores —— */
  async listConductores() {
    return maestroConductorRepository.findAll();
  },
  async createConductor(body, actor) {
    const n = normConductor(body);
    if (!n.persona_id) return { errors: ['persona_id obligatorio'] };
    return maestroConductorRepository.create(n, actor);
  },
  async patchConductor(id, body, actor) {
    const cur = await maestroConductorRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    return maestroConductorRepository.update(id, normConductor(body, cur), actor);
  },

  /* —— Vehículos maestro —— */
  async listVehiculos() {
    return maestroVehiculoRepository.findAll();
  },
  async createVehiculo(body, actor) {
    return createVehiculoWithChecks(body, actor);
  },
  async patchVehiculo(id, body, actor) {
    const cur = await maestroVehiculoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    return maestroVehiculoRepository.update(id, normVehiculo(body, cur), actor);
  },

  /* —— Documentos —— */
  async listDocumentos() {
    const all = await maestroDocumentoRepository.findAll();
    return [...all].sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  },

  async listDocumentosVista() {
    const all = await this.listDocumentos();
    return all.map((d) => {
      const c = computeDestinoFieldsForDocument(d);
      const { ruta_interna, texto_match_sample, ...rest } = d;
      return {
        ...rest,
        ...c,
        revision_manual_sugerida: documentoTieneRevisionManualSugerida(d),
        tiene_archivo: Boolean(ruta_interna),
        tiempo_hasta_gestion_segundos: tiempoHastaGestionSegundos(d),
      };
    });
  },

  async getDocumento(id) {
    return maestroDocumentoRepository.findById(id);
  },
  async getDocumentoAbsolutePath(doc) {
    if (!doc?.ruta_interna) return null;
    const abs = path.join(DATA_ROOT, doc.ruta_interna);
    return abs;
  },

  /**
   * Ingesta: base64 por archivo. Guarda en disco + fila pendiente de revisión (no escribe base maestra sola).
   */
  async ingestArchivosBase64(body, actor) {
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) return { errors: ['files[] vacío'] };
    if (files.length > MAX_FILES) return { errors: [`Máximo ${MAX_FILES} archivos por envío`] };

    const ctx = await buildMaestroJarvisContext();
    const creados = [];
    const uploadAbs = path.join(DATA_ROOT, UPLOAD_REL);
    await mkdir(uploadAbs, { recursive: true });

    for (const f of files) {
      const name = safeName(f.name || f.nombre_archivo);
      const mime = String(f.mimeType || f.tipo_archivo || 'application/octet-stream').slice(0, 120);
      const b64 = String(f.dataBase64 || f.base64 || '').replace(/^data:[^;]+;base64,/, '');
      if (!b64) {
        creados.push({ error: `Sin datos base64: ${name}` });
        continue;
      }
      let buffer;
      try {
        buffer = Buffer.from(b64, 'base64');
      } catch {
        creados.push({ error: `Base64 inválido: ${name}` });
        continue;
      }
      if (buffer.length > MAX_BYTES) {
        creados.push({ error: `Archivo demasiado grande: ${name}` });
        continue;
      }

      const hash = createHash('sha256').update(buffer).digest('hex');
      const fileRel = path.join(UPLOAD_REL, `${hash.slice(0, 16)}_${name}`).replace(/\\/g, '/');
      const abs = path.join(DATA_ROOT, fileRel);
      await writeFile(abs, buffer);

      const jarvis = classifyDocumentBuffer({ filename: name, mimeType: mime, buffer }, ctx);
      const vinc = resolveRelationalLinks(jarvis, ctx);
      const historial_revision = appendHistorialRevision(
        {},
        'deteccion_jarvis',
        `Clasificación documento ${jarvis.version} · vínculos ${vinc.version}`,
        actor
      );

      const row = {
        nombre_archivo: name,
        tipo_archivo: mime,
        categoria_detectada: jarvis.categoria_detectada,
        entidad_relacionada_tipo: body.entidad_relacionada_tipo || null,
        entidad_relacionada_id: body.entidad_relacionada_id || null,
        clasificado_por_jarvis: true,
        confianza_jarvis: jarvis.confianza_clasificacion,
        estado_revision: 'pendiente_revision',
        etiquetas: Array.isArray(body.etiquetas) ? body.etiquetas : [],
        fecha_subida: new Date().toISOString(),
        subido_por: actor,
        url_storage: null,
        ruta_interna: fileRel,
        hash_archivo: hash,
        resumen_jarvis: jarvis.resumen_breve,
        datos_detectados: jarvis.datos_detectados,
        modulo_destino_sugerido: jarvis.modulo_destino_sugerido,
        cliente_probable: jarvis.cliente_probable,
        contacto_probable: jarvis.contacto_probable,
        tecnico_probable: jarvis.tecnico_probable,
        patente_probable: jarvis.patente_probable,
        ot_probable: jarvis.ot_probable,
        jarvis_advertencias: jarvis.advertencias,
        observacion_revision: '',
        actor_revision: null,
        engine_version: jarvis.version,
        relational_engine_version: vinc.version,
        jarvis_vinculacion: vinc,
        cliente_id: vinc.autoClienteId,
        contacto_id: vinc.autoContactoId,
        vehiculo_id: vinc.autoVehiculoId,
        tecnico_id: vinc.autoTecnicoId,
        historial_revision,
        texto_match_sample: String(jarvis.texto_match_sample || '').slice(0, 8000),
        estado_operativo: 'pendiente',
        responsable_asignado: null,
        ot_id_vinculada: null,
        ...aplicarDestinoJarvisNuevo(jarvis.modulo_destino_sugerido),
      };

      const created = await maestroDocumentoRepository.create(row, actor);
      created.url_descarga = `/maestro/documentos/${encodeURIComponent(created.id)}/descarga`;
      creados.push(created);
    }

    return { documentos: creados, total: creados.filter((x) => x.id).length };
  },

  /**
   * Ingesta WhatsApp / correo → documento(s) en Base Maestra, clasificación Jarvis y bandeja (clima/flota/…).
   * Fase 1: respuesta automática solo como texto sugerido en JSON (sin envío por API externa).
   */
  async ingestExternoCanal(body, actor) {
    const canal = String(body?.canal || '').toLowerCase().trim();
    if (!['whatsapp', 'correo'].includes(canal)) return { errors: ['canal debe ser whatsapp|correo'] };
    const origen = String(body?.origen || '').trim().slice(0, 320);
    const mensaje = String(body?.mensaje || '').trim();
    if (!origen) return { errors: ['origen obligatorio (teléfono, correo o identificador remitente)'] };
    if (!mensaje) return { errors: ['mensaje obligatorio'] };
    const adjuntos = Array.isArray(body.adjuntos) ? body.adjuntos : [];
    if (adjuntos.length > MAX_FILES) return { errors: [`Máximo ${MAX_FILES} adjuntos`] };

    const tipoSol = inferTipoSolicitudFromText(`${mensaje}\n${origen}`);
    const intakeBatchId = `IBATCH-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const prefixText = `[INGRESO_EXTERNO canal=${canal} origen=${origen} tipo_solicitud=${tipoSol}]\n${mensaje}\n\n`;
    const prefixBuf = Buffer.from(prefixText, 'utf8');

    const ctx = await buildMaestroJarvisContext();
    const uploadAbs = path.join(DATA_ROOT, UPLOAD_REL);
    await mkdir(uploadAbs, { recursive: true });

    const items = [];
    const adjuntosErrores = [];
    if (adjuntos.length === 0) {
      items.push({
        name: `intake-${canal}-${Date.now()}.txt`,
        mime: 'text/plain',
        buffer: Buffer.alloc(0),
      });
    } else {
      adjuntos.forEach((a, idx) => {
        const b64 = String(a.dataBase64 || a.base64 || '').replace(/^data:[^;]+;base64,/, '');
        const mime = String(a.mimeType || a.tipo_archivo || 'application/octet-stream').slice(0, 120);
        const name = safeName(a.nombre_archivo || a.name || `adjunto-${idx + 1}`);
        if (!b64) {
          adjuntosErrores.push(`Sin base64: ${name}`);
          return;
        }
        let buf;
        try {
          buf = Buffer.from(b64, 'base64');
        } catch {
          adjuntosErrores.push(`Base64 inválido: ${name}`);
          return;
        }
        if (buf.length > MAX_BYTES) {
          adjuntosErrores.push(`Archivo demasiado grande: ${name}`);
          return;
        }
        items.push({ name, mime, buffer: buf });
      });
    }

    if (adjuntos.length > 0 && items.length === 0) {
      return {
        errors: ['Ningún adjunto válido.'],
        adjuntos_errores: adjuntosErrores,
      };
    }

    const total = items.length;
    const creados = [];
    for (let idx = 0; idx < items.length; idx += 1) {
      const it = items[idx];
      const combined = Buffer.concat([prefixBuf, it.buffer]);
      const hash = createHash('sha256').update(combined).digest('hex');
      const fileRel = path.join(UPLOAD_REL, `${hash.slice(0, 16)}_${it.name}`).replace(/\\/g, '/');
      const abs = path.join(DATA_ROOT, fileRel);
      await writeFile(abs, combined);

      let jarvis = classifyDocumentBuffer({ filename: it.name, mimeType: it.mime, buffer: combined }, ctx);
      jarvis = aplicarModuloPorTipoSolicitud(jarvis, tipoSol);
      const vinc = resolveRelationalLinks(jarvis, ctx);
      const historial_revision = appendHistorialRevision(
        {},
        'intake_externo',
        JSON.stringify({ canal, origen, tipo_solicitud: tipoSol, batch: intakeBatchId, indice: idx, total }).slice(
          0,
          1950
        ),
        actor
      );

      const row = {
        nombre_archivo: it.name,
        tipo_archivo: it.mime,
        categoria_detectada: jarvis.categoria_detectada,
        entidad_relacionada_tipo: null,
        entidad_relacionada_id: null,
        clasificado_por_jarvis: true,
        confianza_jarvis: jarvis.confianza_clasificacion,
        estado_revision: 'pendiente_revision',
        etiquetas: ['intake_externo', canal],
        fecha_subida: now,
        subido_por: actor,
        url_storage: null,
        ruta_interna: fileRel,
        hash_archivo: hash,
        resumen_jarvis: jarvis.resumen_breve,
        datos_detectados: jarvis.datos_detectados,
        modulo_destino_sugerido: jarvis.modulo_destino_sugerido,
        cliente_probable: jarvis.cliente_probable,
        contacto_probable: jarvis.contacto_probable,
        tecnico_probable: jarvis.tecnico_probable,
        patente_probable: jarvis.patente_probable,
        ot_probable: jarvis.ot_probable,
        jarvis_advertencias: jarvis.advertencias,
        observacion_revision: '',
        actor_revision: null,
        engine_version: jarvis.version,
        relational_engine_version: vinc.version,
        jarvis_vinculacion: vinc,
        cliente_id: vinc.autoClienteId,
        contacto_id: vinc.autoContactoId,
        vehiculo_id: vinc.autoVehiculoId,
        tecnico_id: vinc.autoTecnicoId,
        historial_revision,
        texto_match_sample: String(jarvis.texto_match_sample || '').slice(0, 8000),
        estado_operativo: 'pendiente',
        responsable_asignado: null,
        ot_id_vinculada: null,
        intake_canal: canal,
        intake_origen: origen,
        mensaje_original: mensaje.slice(0, 8000),
        intake_fecha_ingreso: now,
        intake_fecha_primera_gestion: null,
        tipo_solicitud_inferida: tipoSol,
        intake_batch_id: intakeBatchId,
        intake_adjunto_total: total,
        intake_indice_adjunto: idx,
        ...aplicarDestinoJarvisNuevo(jarvis.modulo_destino_sugerido),
      };

      const created = await maestroDocumentoRepository.create(row, actor);
      created.url_descarga = `/maestro/documentos/${encodeURIComponent(created.id)}/descarga`;
      creados.push(created);
    }

    return {
      documentos: creados,
      total: creados.length,
      intake_batch_id: intakeBatchId,
      tipo_solicitud_inferida: tipoSol,
      respuesta_automatica_sugerida: RESPUESTA_AUTOMATICA_INTAKE_FASE1,
      adjuntos_errores: adjuntosErrores.length ? adjuntosErrores : undefined,
    };
  },

  async aprobarDocumentoMaestro(id, body, actor) {
    return procesarAprobacionDocumento(id, body || {}, actor);
  },

  async patchDocumento(id, body, actor) {
    const cur = await maestroDocumentoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    const patch = {};
    if (body.categoria_detectada !== undefined) patch.categoria_detectada = String(body.categoria_detectada).slice(0, 80);
    if (body.entidad_relacionada_tipo !== undefined)
      patch.entidad_relacionada_tipo = String(body.entidad_relacionada_tipo).slice(0, 64);
    if (body.entidad_relacionada_id !== undefined)
      patch.entidad_relacionada_id = String(body.entidad_relacionada_id).slice(0, 64);
    if (body.etiquetas !== undefined) patch.etiquetas = Array.isArray(body.etiquetas) ? body.etiquetas : [];
    if (body.observacion_revision !== undefined) patch.observacion_revision = String(body.observacion_revision).slice(0, 2000);
    if (body.estado_revision !== undefined) {
      const e = String(body.estado_revision).toLowerCase();
      if (!ESTADOS_DOC.includes(e)) return { errors: ['estado_revision inválido'] };
      patch.estado_revision = e;
      patch.actor_revision = actor;
    }
    if (body.resumen_jarvis_manual !== undefined) patch.resumen_jarvis = String(body.resumen_jarvis_manual).slice(0, 2000);

    const fkKeys = ['cliente_id', 'contacto_id', 'vehiculo_id', 'tecnico_id'];
    let fkChanged = false;
    for (const k of fkKeys) {
      if (body[k] !== undefined) {
        const v = String(body[k] ?? '').trim();
        patch[k] = v || null;
        if (String(cur[k] ?? '') !== (v || '')) fkChanged = true;
      }
    }
    if (fkChanged) {
      patch.historial_revision = appendHistorialRevision(
        cur,
        'correccion_manual',
        'Vínculos actualizados en revisión (cliente / contacto / vehículo / técnico).',
        actor
      );
    }

    return maestroDocumentoRepository.update(id, patch, actor);
  },

  /**
   * Crear cliente extendido, contacto maestro o vehículo maestro desde la revisión de un documento; enlaza IDs al documento.
   */
  async crearEntidadDesdeDocumento(docId, body, actor) {
    const cur = await maestroDocumentoRepository.findById(docId);
    if (!cur) return { error: 'No encontrado' };
    const tipo = String(body?.tipo || '').toLowerCase();
    const datos = body?.datos && typeof body.datos === 'object' ? body.datos : {};
    const vincBase = cur.jarvis_vinculacion && typeof cur.jarvis_vinculacion === 'object' ? { ...cur.jarvis_vinculacion } : {};

    if (tipo === 'cliente') {
      const r = await hnfOperativoIntegradoService.createExtendedClient(datos, actor);
      if (r.errors) return r;
      const entidad = r;
      vincBase.cliente = {
        ...(vincBase.cliente || {}),
        estado: 'vinculado_manual',
        mensaje_ui: 'Vincular existente: cliente recién creado desde revisión.',
        cliente_id: entidad.id,
      };
      const historial_revision = appendHistorialRevision(
        cur,
        'creacion_asistida',
        `Cliente ${entidad.id} creado desde documento ${docId}`,
        actor
      );
      await maestroDocumentoRepository.update(
        docId,
        { cliente_id: entidad.id, jarvis_vinculacion: vincBase, historial_revision },
        actor
      );
      return { ok: true, entidad, documento: await maestroDocumentoRepository.findById(docId) };
    }

    if (tipo === 'contacto') {
      const payload = { ...datos };
      if (!String(payload.cliente_id || '').trim() && cur.cliente_id) payload.cliente_id = cur.cliente_id;
      const r = await createContactoWithChecks(payload, actor);
      if (r.errors) return r;
      const entidad = r;
      vincBase.contacto = {
        ...(vincBase.contacto || {}),
        estado: 'vinculado_manual',
        mensaje_ui: 'Vincular existente: contacto creado desde revisión.',
        contacto_id: entidad.id,
      };
      const historial_revision = appendHistorialRevision(
        cur,
        'creacion_asistida',
        `Contacto ${entidad.id} creado desde documento ${docId}`,
        actor
      );
      await maestroDocumentoRepository.update(
        docId,
        { contacto_id: entidad.id, jarvis_vinculacion: vincBase, historial_revision },
        actor
      );
      return { ok: true, entidad, documento: await maestroDocumentoRepository.findById(docId) };
    }

    if (tipo === 'vehiculo') {
      const payload = { ...datos };
      if (!String(payload.cliente_id || '').trim() && cur.cliente_id) payload.cliente_id = cur.cliente_id;
      const r = await createVehiculoWithChecks(payload, actor);
      if (r.errors) return r;
      const entidad = r;
      vincBase.vehiculo = {
        ...(vincBase.vehiculo || {}),
        estado: 'vinculado_manual',
        mensaje_ui: 'Vincular existente: vehículo creado desde revisión.',
        vehiculo_id: entidad.id,
      };
      const historial_revision = appendHistorialRevision(
        cur,
        'creacion_asistida',
        `Vehículo ${entidad.id} creado desde documento ${docId}`,
        actor
      );
      await maestroDocumentoRepository.update(
        docId,
        { vehiculo_id: entidad.id, jarvis_vinculacion: vincBase, historial_revision },
        actor
      );
      return { ok: true, entidad, documento: await maestroDocumentoRepository.findById(docId) };
    }

    return { errors: ['tipo debe ser cliente, contacto o vehiculo'] };
  },

  /**
   * Reparación histórica masiva: reconstruye jarvis_vinculacion desde datos guardados (y opcionalmente relee archivo).
   * No sobrescribe FK ya existentes; completa vacíos y marca revisión manual si Jarvis discrepa.
   */
  async repararVinculosHistoricos(body, actor) {
    const alcance = String(body?.alcance || 'incompletos').toLowerCase();
    const origen =
      String(body?.origen || 'accion_usuario').toLowerCase() === 'job_manual' ? 'job_manual' : 'accion_usuario';
    const limite = Math.min(Math.max(Number(body?.limite) || 200, 1), 500);
    const offset = Math.max(Number(body?.offset) || 0, 0);
    const enriquecer = Boolean(body?.enriquecer_desde_archivo);

    const all = await maestroDocumentoRepository.findAll();
    let ids = [];

    if (alcance === 'id') {
      const id = String(body?.documento_id || body?.id || '').trim();
      if (!id) return { errors: ['documento_id (o id) obligatorio para alcance id'] };
      ids = [id];
    } else if (alcance === 'lote') {
      const raw = Array.isArray(body?.documento_ids) ? body.documento_ids : [];
      ids = raw.map((x) => String(x).trim()).filter(Boolean);
      if (!ids.length) return { errors: ['documento_ids[] obligatorio para alcance lote'] };
    } else if (alcance === 'todos') {
      ids = [...all]
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .slice(offset, offset + limite)
        .map((d) => d.id);
    } else if (alcance === 'incompletos') {
      ids = [...all]
        .filter((d) => documentoNecesitaReparacionVinculos(d))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .slice(offset, offset + limite)
        .map((d) => d.id);
    } else {
      return { errors: ['alcance inválido: usar todos, incompletos, id o lote'] };
    }

    const ctx = await buildMaestroJarvisContext();
    const resultados = [];

    for (const docId of ids) {
      const cur = all.find((x) => x.id === docId);
      if (!cur) {
        resultados.push({ id: docId, ok: false, error: 'no_encontrado' });
        continue;
      }

      let docForSynth = cur;
      if (enriquecer && cur.ruta_interna) {
        try {
          const abs = path.join(DATA_ROOT, cur.ruta_interna);
          const buffer = await readFile(abs);
          const jarvis = classifyDocumentBuffer(
            { filename: cur.nombre_archivo, mimeType: cur.tipo_archivo, buffer },
            ctx
          );
          docForSynth = {
            ...cur,
            datos_detectados: jarvis.datos_detectados,
            texto_match_sample: jarvis.texto_match_sample,
            resumen_jarvis: jarvis.resumen_breve,
            cliente_probable: jarvis.cliente_probable,
            contacto_probable: jarvis.contacto_probable,
            tecnico_probable: jarvis.tecnico_probable,
            patente_probable: jarvis.patente_probable,
            ot_probable: jarvis.ot_probable,
          };
        } catch {
          /* mantener fila tal cual */
        }
      }

      const synthetic = buildSyntheticClassifyFromStoredDoc(docForSynth);
      const vinc = resolveRelationalLinks(synthetic, ctx);
      const { before, nextFk, jarvis_vinculacion, after } = mergeRepairVinculosConservador(cur, vinc);

      const detalleHist = JSON.stringify({ origen, antes: before, despues: after }).slice(0, 1950);
      const historial_revision = appendHistorialRevision(cur, 'reparacion_historica_jarvis', detalleHist, actor);

      const dj = aplicarDestinoJarvisNuevo(cur.modulo_destino_sugerido);
      const destinoPatch = {};
      if (!cur.bandeja_destino || !cur.destino_final) {
        destinoPatch.destino_final = dj.destino_final;
        destinoPatch.bandeja_destino = dj.bandeja_destino;
        destinoPatch.area_detectada = dj.area_detectada;
        destinoPatch.clasificacion_fuente = cur.clasificacion_fuente || 'jarvis';
        if (!cur.destino_detectado) destinoPatch.destino_detectado = dj.destino_detectado;
      }

      await maestroDocumentoRepository.update(
        docId,
        {
          ...nextFk,
          jarvis_vinculacion,
          relational_engine_version: vinc.version,
          historial_revision,
          ...destinoPatch,
        },
        actor
      );
      resultados.push({ id: docId, ok: true, antes: before, despues: after });
    }

    return {
      alcance,
      origen,
      limite,
      offset,
      procesados: resultados.length,
      resultados,
    };
  },

  async reclasificarDocumento(id, actor) {
    const cur = await maestroDocumentoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    if (!cur.ruta_interna) return { error: 'Sin archivo en servidor' };
    const abs = path.join(DATA_ROOT, cur.ruta_interna);
    let buffer;
    try {
      buffer = await readFile(abs);
    } catch {
      return { error: 'Archivo no encontrado en disco' };
    }
    const ctx = await buildMaestroJarvisContext();
    const jarvis = classifyDocumentBuffer(
      { filename: cur.nombre_archivo, mimeType: cur.tipo_archivo, buffer },
      ctx
    );
    const vinc = resolveRelationalLinks(jarvis, ctx);
    const historial_revision = appendHistorialRevision(
      cur,
      'deteccion_jarvis',
      `Reclasificación ${jarvis.version} · vínculos ${vinc.version}`,
      actor
    );
    const next = {
      categoria_detectada: jarvis.categoria_detectada,
      confianza_jarvis: jarvis.confianza_clasificacion,
      resumen_jarvis: jarvis.resumen_breve,
      datos_detectados: jarvis.datos_detectados,
      modulo_destino_sugerido: jarvis.modulo_destino_sugerido,
      cliente_probable: jarvis.cliente_probable,
      contacto_probable: jarvis.contacto_probable,
      tecnico_probable: jarvis.tecnico_probable,
      patente_probable: jarvis.patente_probable,
      ot_probable: jarvis.ot_probable,
      jarvis_advertencias: jarvis.advertencias,
      estado_revision: 'pendiente_revision',
      clasificado_por_jarvis: true,
      engine_version: jarvis.version,
      relational_engine_version: vinc.version,
      jarvis_vinculacion: vinc,
      historial_revision,
      texto_match_sample: String(jarvis.texto_match_sample || '').slice(0, 8000),
    };
    if (vinc.autoClienteId) next.cliente_id = vinc.autoClienteId;
    if (vinc.autoContactoId) next.contacto_id = vinc.autoContactoId;
    if (vinc.autoVehiculoId) next.vehiculo_id = vinc.autoVehiculoId;
    if (vinc.autoTecnicoId) next.tecnico_id = vinc.autoTecnicoId;
    next.area_detectada = normalizeDestinoModulo(jarvis.modulo_destino_sugerido);
    next.destino_detectado =
      cur.destino_detectado != null && String(cur.destino_detectado).trim()
        ? normalizeDestinoModulo(cur.destino_detectado)
        : normalizeDestinoModulo(jarvis.modulo_destino_sugerido);
    if (String(cur.clasificacion_fuente || 'jarvis') !== 'manual') {
      const r = resolveBandejaFinal(jarvis.modulo_destino_sugerido);
      next.destino_final = r.destino_final;
      next.bandeja_destino = r.bandeja_destino;
      next.clasificacion_fuente = 'jarvis';
    } else {
      const df = normalizeDestinoModulo(cur.destino_final || cur.modulo_destino_sugerido);
      const rMan = resolveBandejaFinal(df);
      next.destino_final = rMan.destino_final;
      next.bandeja_destino = rMan.bandeja_destino;
      next.clasificacion_fuente = 'manual';
    }
    return maestroDocumentoRepository.update(id, next, actor);
  },

  async corregirDestinoDocumento(id, body, actorHeader) {
    const cur = await maestroDocumentoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    const nuevo = normalizeDestinoModulo(body?.nuevo_destino);
    if (!MAESTRO_DESTINOS.includes(nuevo)) return { errors: ['nuevo_destino debe ser clima|flota|comercial|administrativo'] };
    const motivo = String(body?.motivo || '').trim().slice(0, 500);
    if (!motivo) return { errors: ['motivo obligatorio (breve)'] };
    const actorEff = String(body?.actor || actorHeader || '').trim().slice(0, 80) || actorHeader || 'sistema';

    const destino_anterior = normalizeDestinoModulo(cur.destino_final || cur.modulo_destino_sugerido);
    const destino_detectado =
      cur.destino_detectado != null && String(cur.destino_detectado).trim()
        ? normalizeDestinoModulo(cur.destino_detectado)
        : normalizeDestinoModulo(cur.modulo_destino_sugerido);
    const r = resolveBandejaFinal(nuevo);
    const now = new Date().toISOString();
    const detalle = JSON.stringify({
      destino_anterior,
      destino_nuevo: nuevo,
      motivo,
      actor: actorEff,
      timestamp: now,
    }).slice(0, 1950);
    const historial_revision = appendHistorialRevision(cur, 'correccion_destino_jarvis', detalle, actorEff);

    const updated = await maestroDocumentoRepository.update(
      id,
      {
        destino_detectado,
        area_detectada: normalizeDestinoModulo(cur.modulo_destino_sugerido),
        destino_final: r.destino_final,
        bandeja_destino: r.bandeja_destino,
        clasificacion_fuente: 'manual',
        destino_corregido_manual: nuevo,
        motivo_correccion: motivo,
        corrected_at: now,
        corrected_by: actorEff,
        historial_revision,
      },
      actorEff
    );
    return { ok: true, documento: updated, bandeja_destino: r.bandeja_destino, destino_final: r.destino_final };
  },

  async listBandejaResponsable(slug, query = {}) {
    const key = String(slug || '').toLowerCase();
    if (!['romina', 'gery', 'lyn', 'admin'].includes(key)) return { errors: ['bandeja inválida'] };
    const all = await maestroDocumentoRepository.findAll();
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 300);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const estadoF = query.estado ? String(query.estado).toLowerCase() : '';
    const destinoF = query.destino ? String(query.destino).toLowerCase() : '';
    const pendiente = query.pendiente;
    const today = new Date().toISOString().slice(0, 10);

    let rows = all.map((d) => {
      const c = computeDestinoFieldsForDocument(d);
      const revision_manual_sugerida = documentoTieneRevisionManualSugerida(d);
      const { ruta_interna, texto_match_sample, ...rest } = d;
      return {
        id: rest.id,
        nombre_archivo: rest.nombre_archivo,
        tipo_archivo: rest.tipo_archivo,
        categoria_detectada: rest.categoria_detectada,
        cliente_probable: rest.cliente_probable,
        contacto_probable: rest.contacto_probable,
        patente_probable: rest.patente_probable,
        tecnico_probable: rest.tecnico_probable,
        destino_detectado: c.destino_detectado,
        destino_final: c.destino_final,
        bandeja_destino: c.bandeja_destino,
        area_detectada: c.area_detectada,
        clasificacion_fuente: c.clasificacion_fuente,
        modulo_destino_sugerido: rest.modulo_destino_sugerido,
        estado_revision: rest.estado_revision,
        ultima_aprobacion_jarvis: rest.ultima_aprobacion_jarvis,
        revision_manual_sugerida,
        destino_corregido_manual: rest.destino_corregido_manual,
        motivo_correccion: rest.motivo_correccion,
        corrected_at: rest.corrected_at,
        corrected_by: rest.corrected_by,
        createdAt: rest.createdAt,
        updatedAt: rest.updatedAt,
        tiene_archivo: Boolean(ruta_interna),
        aprobado_hoy:
          String(rest.estado_revision || '').toLowerCase() === 'aprobado' &&
          String(rest.updatedAt || '').slice(0, 10) === today,
        estado_operativo: String(rest.estado_operativo || 'pendiente').toLowerCase(),
        responsable_asignado: rest.responsable_asignado || null,
        ot_id_vinculada: rest.ot_id_vinculada || null,
        intake_canal: rest.intake_canal || null,
        intake_origen: rest.intake_origen || null,
        mensaje_original: rest.mensaje_original
          ? String(rest.mensaje_original).slice(0, 1200)
          : null,
        tipo_solicitud_inferida: rest.tipo_solicitud_inferida || null,
        intake_fecha_ingreso: rest.intake_fecha_ingreso || null,
        intake_fecha_primera_gestion: rest.intake_fecha_primera_gestion || null,
        tiempo_hasta_gestion_segundos: tiempoHastaGestionSegundos(rest),
        intake_batch_id: rest.intake_batch_id || null,
      };
    });

    if (key !== 'admin') {
      rows = rows.filter((d) => String(d.bandeja_destino).toLowerCase() === key);
    }
    if (estadoF) rows = rows.filter((d) => String(d.estado_revision || '').toLowerCase() === estadoF);
    if (destinoF) rows = rows.filter((d) => String(d.destino_final) === destinoF);
    if (pendiente === 'true' || pendiente === true) {
      rows = rows.filter((d) => String(d.estado_revision || '').toLowerCase() !== 'aprobado');
    }
    if (pendiente === 'false' || pendiente === false) {
      rows = rows.filter((d) => String(d.estado_revision || '').toLowerCase() === 'aprobado');
    }

    rows.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    const total = rows.length;
    const slice = rows.slice(offset, offset + limit);
    return { total, limit, offset, documentos: slice };
  },

  async getResumenIntakeMaestroDocumentos() {
    const all = await maestroDocumentoRepository.findAll();
    const ots = await otRepository.findAll();
    const otById = new Map(ots.map((o) => [o.id, o]));
    const today = new Date().toISOString().slice(0, 10);
    const pend = { romina: 0, gery: 0, lyn: 0 };
    let revision_manual_sugerida = 0;
    const idsCorregidosHoy = new Set();
    const ejemplos = [];
    let operativo_pendientes_reales = 0;
    let operativo_en_proceso = 0;
    const idsCerradosHoy = new Set();

    for (const d of all) {
      const c = computeDestinoFieldsForDocument(d);
      if (documentoTieneRevisionManualSugerida(d)) revision_manual_sugerida += 1;
      const hist = Array.isArray(d.historial_revision) ? d.historial_revision : [];
      if (hist.some((h) => h.tipo === 'correccion_destino_jarvis' && String(h.at || '').slice(0, 10) === today)) {
        idsCorregidosHoy.add(d.id);
      }
      if (String(d.estado_revision || '').toLowerCase() !== 'aprobado') {
        const b = String(c.bandeja_destino || '').toLowerCase();
        if (b === 'romina') pend.romina += 1;
        else if (b === 'gery') pend.gery += 1;
        else if (b === 'lyn') pend.lyn += 1;
      }

      const er = String(d.estado_revision || '').toLowerCase();
      if (er !== 'archivado') {
        const eo = String(d.estado_operativo || 'pendiente').toLowerCase();
        if (eo === 'pendiente') operativo_pendientes_reales += 1;
        else if (eo === 'en_proceso') operativo_en_proceso += 1;
      }
      const eo2 = String(d.estado_operativo || '').toLowerCase();
      if (eo2 === 'cerrado' && String(d.updatedAt || '').slice(0, 10) === today) {
        idsCerradosHoy.add(d.id);
      }
      const oid = d.ot_id_vinculada;
      if (oid) {
        const ot = otById.get(oid);
        if (ot && isOtCerrada(ot.estado) && String(ot.cerradoEn || '').slice(0, 10) === today) {
          idsCerradosHoy.add(d.id);
        }
      }
    }

    for (const d of all) {
      const hist = [...(Array.isArray(d.historial_revision) ? d.historial_revision : [])].reverse();
      const ev = hist.find((h) => h.tipo === 'correccion_destino_jarvis');
      if (ev && ejemplos.length < 5) {
        try {
          const p = JSON.parse(ev.detalle || '{}');
          const det = normalizeDestinoModulo(d.modulo_destino_sugerido);
          const b = resolveBandejaFinal(p.destino_nuevo).bandeja_destino;
          ejemplos.push({
            documento_id: d.id,
            archivo: d.nombre_archivo,
            texto: `Jarvis detectó ${labelDestinoHumano(det)}, corregido manualmente a ${labelDestinoHumano(p.destino_nuevo)} y enviado a bandeja ${labelBandejaHumano(b)}.`,
          });
        } catch {
          ejemplos.push({ documento_id: d.id, archivo: d.nombre_archivo, texto: ev.detalle || '' });
        }
      }
    }

    return {
      pendientes_romina: pend.romina,
      pendientes_gery: pend.gery,
      pendientes_lyn: pend.lyn,
      documentos_destino_corregido_hoy: idsCorregidosHoy.size,
      revision_manual_sugerida,
      ejemplos_correccion: ejemplos,
      operativo_pendientes_reales: operativo_pendientes_reales,
      operativo_en_proceso: operativo_en_proceso,
      operativo_cerrados_hoy: idsCerradosHoy.size,
    };
  },
};

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bandejaFromTipoServicio, notificacionAsignadaFromBandeja } from '../domain/hnf-ot-bandeja.js';
import {
  debeEntrarColaLynAlCerrar,
  normalizeAprobacionLynEstado,
} from '../domain/ot-lyn-aprobacion.engine.js';
import { calcularEstimadosMensuales } from '../domain/ot-facturacion.engine.js';
import { appendHistorial } from '../utils/historialUtil.js';
import { isOtCerrada, normalizeOtEstadoStored } from '../utils/otEstado.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
const dataFile = path.join(dataDir, 'ots.json');

let cache = null;

const parseMaxOtNumber = (items) =>
  items.reduce((max, item) => {
    const match = typeof item.id === 'string' ? item.id.match(/^OT-(\d+)$/i) : null;
    const n = match ? Number.parseInt(match[1], 10) : 0;
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);

const nextId = (items) => {
  const n = parseMaxOtNumber(items) + 1;
  return `OT-${String(n).padStart(3, '0')}`;
};

const round2 = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100) / 100;
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

const computeOtEconomics = (item) => {
  const cm = round2(item.costoMateriales);
  const mo = round2(item.costoManoObra);
  const tr = round2(item.costoTraslado);
  const ot = round2(item.costoOtros);
  const costoTotal = round2(cm + mo + tr + ot);
  const montoCobrado = round2(item.montoCobrado);
  const utilidad = round2(montoCobrado - costoTotal);
  return { ...item, costoMateriales: cm, costoManoObra: mo, costoTraslado: tr, costoOtros: ot, costoTotal, montoCobrado, utilidad };
};

const normalizeOperationMode = (v) => (v === 'automatic' ? 'automatic' : 'manual');

const deriveResponsable = (item) => {
  const t = String(item?.tecnicoAsignado || '').trim();
  if (item?.responsableActual != null && String(item.responsableActual).trim()) {
    return String(item.responsableActual).trim();
  }
  if (t && t !== 'Por asignar') return t;
  return null;
};

const mapLegacyOrigenSolicitud = (origenPedido) => {
  const x = String(origenPedido || '').toLowerCase().trim();
  if (x === 'whatsapp') return 'whatsapp';
  if (x === 'correo' || x === 'email') return 'email';
  if (x === 'llamada') return 'llamada';
  if (x === 'manual' || x === 'jarvis' || x === '') return 'interno';
  return 'interno';
};

const ensureDefaults = (item) => {
  const now = new Date().toISOString();
  const creado = item.creadoEn || item.createdAt || null;
  const tipo = String(item.tipoServicio || '').toLowerCase();
  const origenSol =
    String(item.origenSolicitud ?? '').trim() || mapLegacyOrigenSolicitud(item.origenPedido);
  const base = {
    ...item,
    estado: normalizeOtEstadoStored(item.estado),
    operationMode: normalizeOperationMode(item.operationMode),
    origenPedido: String(item.origenPedido ?? '').trim(),
    origenSolicitud: origenSol,
    whatsappContactoNumero: String(item.whatsappContactoNumero ?? '').trim(),
    whatsappContactoNombre: String(item.whatsappContactoNombre ?? '').trim(),
    entradaExterna: Boolean(item.entradaExterna),
    bandejaAsignada:
      String(item.bandejaAsignada || '').trim() || bandejaFromTipoServicio(item.tipoServicio),
    notificacionAsignadaA:
      String(item.notificacionAsignadaA || '').trim() ||
      notificacionAsignadaFromBandeja(
        String(item.bandejaAsignada || '').trim() || bandejaFromTipoServicio(item.tipoServicio)
      ),
    prioridadOperativa: ['alta', 'media', 'baja'].includes(String(item.prioridadOperativa || '').toLowerCase())
      ? String(item.prioridadOperativa).toLowerCase()
      : 'media',
    pendienteRespuestaCliente: Boolean(item.pendienteRespuestaCliente),
    asignadoPor: item.asignadoPor != null && String(item.asignadoPor).trim() ? String(item.asignadoPor).trim() : null,
    responsableActual: deriveResponsable(item),
    pdfName: item.pdfName ?? null,
    pdfUrl: item.pdfUrl ?? null,
    creadoEn: item.creadoEn ?? null,
    cerradoEn: item.cerradoEn ?? null,
    createdAt: item.createdAt || creado || null,
    updatedAt: item.updatedAt || creado || now,
    creadoPor: item.creadoPor ?? null,
    actualizadoPor: item.actualizadoPor ?? null,
    historial: Array.isArray(item.historial) ? item.historial : [],
    equipos: Array.isArray(item.equipos) ? item.equipos : [],
    fotografiasAntes: Array.isArray(item.fotografiasAntes) ? item.fotografiasAntes : [],
    fotografiasDurante: Array.isArray(item.fotografiasDurante) ? item.fotografiasDurante : [],
    fotografiasDespues: Array.isArray(item.fotografiasDespues) ? item.fotografiasDespues : [],
    jarvisIntakeTrace:
      item.jarvisIntakeTrace && typeof item.jarvisIntakeTrace === 'object' ? item.jarvisIntakeTrace : null,
    estadoOperativo: (() => {
      const e = String(item.estadoOperativo || '').toLowerCase().trim();
      if (['pendiente', 'en_proceso', 'gestionado', 'cerrado'].includes(e)) return e;
      return null;
    })(),
    maestroDocumentoOrigenId:
      item.maestroDocumentoOrigenId != null && String(item.maestroDocumentoOrigenId).trim()
        ? String(item.maestroDocumentoOrigenId).trim()
        : null,
    costoMateriales: item.costoMateriales ?? 0,
    costoManoObra: item.costoManoObra ?? 0,
    costoTraslado: item.costoTraslado ?? 0,
    costoOtros: item.costoOtros ?? 0,
    montoCobrado: item.montoCobrado ?? 0,
    montoEstimado: round2(item.montoEstimado ?? 0),
    margenEstimado: (() => {
      if (item.margenEstimado == null || item.margenEstimado === '') return null;
      const n = Number.parseFloat(String(item.margenEstimado).replace(',', '.'));
      return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
    })(),
    tipoFacturacion: ['inmediata', 'mensual'].includes(String(item.tipoFacturacion || '').toLowerCase())
      ? String(item.tipoFacturacion).toLowerCase()
      : 'inmediata',
    periodoFacturacion:
      item.periodoFacturacion != null && String(item.periodoFacturacion).trim()
        ? String(item.periodoFacturacion).trim().slice(0, 7)
        : null,
    tiendaId: item.tiendaId != null && String(item.tiendaId).trim() ? String(item.tiendaId).trim() : null,
    tiendaNombre:
      item.tiendaNombre != null && String(item.tiendaNombre).trim()
        ? String(item.tiendaNombre).slice(0, 200)
        : null,
    valorReferencialTienda: round2(item.valorReferencialTienda ?? 0),
    incluidaEnCierreMensual: Boolean(item.incluidaEnCierreMensual),
    cierreMensualId:
      item.cierreMensualId != null && String(item.cierreMensualId).trim()
        ? String(item.cierreMensualId).trim()
        : null,
    utilidadEstimada:
      item.utilidadEstimada != null && item.utilidadEstimada !== ''
        ? (() => {
            const n = Number.parseFloat(String(item.utilidadEstimada).replace(',', '.'));
            return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
          })()
        : null,
    margenEstimadoRatio:
      item.margenEstimadoRatio != null && item.margenEstimadoRatio !== ''
        ? (() => {
            const n = Number.parseFloat(String(item.margenEstimadoRatio).replace(',', '.'));
            return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
          })()
        : null,
    aprobacionLynEstado: (() => {
      const explicit = normalizeAprobacionLynEstado(item.aprobacionLynEstado);
      if (explicit) return explicit;
      const tipo = String(item.tipoServicio || '').toLowerCase();
      const est = normalizeOtEstadoStored(item.estado);
      if ((tipo === 'clima' || tipo === 'flota') && isOtCerrada(est)) {
        return 'pendiente_revision_lyn';
      }
      return null;
    })(),
    listoEnviarCliente: (() => {
      const ap = normalizeAprobacionLynEstado(item.aprobacionLynEstado);
      if (ap === 'aprobado_lyn') return true;
      return Boolean(item.listoEnviarCliente);
    })(),
    lynAprobacionHistorial: Array.isArray(item.lynAprobacionHistorial) ? item.lynAprobacionHistorial : [],
    enviadoCliente: Boolean(item.enviadoCliente),
    fechaEnvio: item.fechaEnvio != null && String(item.fechaEnvio).trim() ? String(item.fechaEnvio).trim() : null,
    enviadoPor: item.enviadoPor != null && String(item.enviadoPor).trim() ? String(item.enviadoPor).trim().slice(0, 120) : null,
  };
  const eco = computeOtEconomics(base);
  const est = calcularEstimadosMensuales(eco);
  return {
    ...eco,
    utilidadEstimada: est.utilidadEstimada,
    margenEstimadoRatio: est.margenEstimadoRatio,
  };
};

const touch = (item, accion, detalle, actor = 'sistema') => ({
  ...item,
  updatedAt: new Date().toISOString(),
  actualizadoPor: actor,
  historial: appendHistorial(item, accion, detalle, actor),
});

const loadStore = async () => {
  if (cache) return cache;

  try {
    const raw = await readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.map(ensureDefaults) : [];
  } catch {
    cache = [];
  }

  return cache;
};

const saveStore = async (items) => {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  cache = items;
};

export const otRepository = {
  mode: 'json-file',

  async findAll() {
    return loadStore();
  },

  async findById(id) {
    const items = await loadStore();
    return items.find((item) => item.id === id) || null;
  },

  async create(data, actor = 'sistema') {
    const items = await loadStore();
    const now = new Date().toISOString();
    const requestedId = data.id != null ? String(data.id).trim() : '';
    const id = requestedId || nextId(items);
    if (items.some((x) => x.id === id)) {
      return { error: 'DUPLICATE_ID', id };
    }

    const { id: _dropId, ...rest } = data;
    const mode = normalizeOperationMode(rest.operationMode);
    let jarvisIntakeTrace =
      rest.jarvisIntakeTrace && typeof rest.jarvisIntakeTrace === 'object' ? { ...rest.jarvisIntakeTrace } : null;
    if (jarvisIntakeTrace) {
      jarvisIntakeTrace.otId = id;
    }
    const jNote =
      jarvisIntakeTrace?.confianza_jarvis != null
        ? ` · Jarvis v1: ${jarvisIntakeTrace.confianza_jarvis}% → bandeja ${jarvisIntakeTrace.bandeja_destino || '—'}`
        : '';
    const item = ensureDefaults({
      id,
      ...rest,
      jarvisIntakeTrace,
      operationMode: mode,
      estado: rest.estado != null ? rest.estado : undefined,
      creadoEn: rest.creadoEn || now,
      createdAt: rest.createdAt || rest.creadoEn || now,
      updatedAt: now,
      creadoPor: actor,
      actualizadoPor: actor,
      historial: appendHistorial(
        {},
        'alta',
        `OT creada · ${normalizeOtEstadoStored(rest.estado)} · modo ${mode}${jNote}`,
        actor
      ),
    });
    const next = [...items, item];
    await saveStore(next);
    return item;
  },

  async patchOperational(id, patch, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    let updated = { ...ensureDefaults(items[index]) };
    const p = patch || {};

    if ('operationMode' in p) {
      const m = normalizeOperationMode(p.operationMode);
      if (m !== updated.operationMode) {
        updated.operationMode = m;
        updated = touch(updated, 'operacion', `Modo operación → ${m}`, actor);
      }
    }

    if ('tecnicoAsignado' in p) {
      const t = String(p.tecnicoAsignado ?? '').trim() || 'Por asignar';
      updated.tecnicoAsignado = t;
      updated.asignadoPor = actor;
      if ('responsableActual' in p && p.responsableActual != null) {
        const r = String(p.responsableActual).trim();
        updated.responsableActual = r || null;
      } else {
        updated.responsableActual = t === 'Por asignar' ? null : t;
      }
      updated = touch(updated, 'asignacion', `Técnico asignado → ${t}`, actor);
    } else if ('responsableActual' in p) {
      const r = String(p.responsableActual ?? '').trim();
      updated.responsableActual = r || null;
      updated = touch(updated, 'responsable', `Responsable actual → ${r || '—'}`, actor);
    }

    if ('origenPedido' in p) {
      updated.origenPedido = String(p.origenPedido ?? '').trim();
      updated = touch(updated, 'origen', 'Origen del pedido actualizado', actor);
    }

    if ('pendienteRespuestaCliente' in p) {
      updated.pendienteRespuestaCliente = Boolean(p.pendienteRespuestaCliente);
      updated = touch(updated, 'whatsapp', 'Pendiente respuesta cliente actualizado', actor);
    }

    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async updateStatus(id, estado, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const prev = ensureDefaults(items[index]);
    const estadoN = normalizeOtEstadoStored(estado);
    let updated = { ...prev, estado: estadoN };
    if (isOtCerrada(estadoN)) {
      updated.cerradoEn = new Date().toISOString();
    } else if (isOtCerrada(prev.estado) && !isOtCerrada(estadoN)) {
      updated.cerradoEn = null;
    }
    if (debeEntrarColaLynAlCerrar(updated, estadoN)) {
      updated.aprobacionLynEstado = 'pendiente_revision_lyn';
      updated.listoEnviarCliente = false;
    }
    updated = touch(updated, 'estado', `${prev.estado} → ${estadoN}`, actor);
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async patchClienteEnvioSimulado(
    id,
    { enviadoCliente, fechaEnvio, enviadoPor },
    actor = 'sistema'
  ) {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    let updated = {
      ...ensureDefaults(items[index]),
      enviadoCliente: Boolean(enviadoCliente),
      fechaEnvio: fechaEnvio != null ? String(fechaEnvio) : null,
      enviadoPor: enviadoPor != null ? String(enviadoPor).slice(0, 120) : null,
    };
    updated = touch(
      updated,
      'envio_cliente',
      `Informe marcado como enviado al cliente (simulado) · ${updated.fechaEnvio || ''}`,
      actor
    );
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async applyLynAprobacion(id, { nuevoEstado, listoEnviarCliente, entradaHistorial }, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    let updated = { ...ensureDefaults(items[index]) };
    const prevEstadoLyn = updated.aprobacionLynEstado ?? null;
    if (nuevoEstado != null && String(nuevoEstado).length) {
      const n = normalizeAprobacionLynEstado(nuevoEstado);
      updated.aprobacionLynEstado = n || String(nuevoEstado).trim();
    }
    if (listoEnviarCliente !== undefined) {
      updated.listoEnviarCliente = Boolean(listoEnviarCliente);
    }
    const hist = Array.isArray(updated.lynAprobacionHistorial) ? [...updated.lynAprobacionHistorial] : [];
    if (entradaHistorial && typeof entradaHistorial === 'object') {
      hist.push({
        at: entradaHistorial.at || new Date().toISOString(),
        actor: String(entradaHistorial.actor || actor).slice(0, 120),
        accion: String(entradaHistorial.accion || '').slice(0, 80),
        comentario: String(entradaHistorial.comentario ?? '').slice(0, 2000),
        estadoAnterior: entradaHistorial.estadoAnterior ?? prevEstadoLyn,
        estadoNuevo: entradaHistorial.estadoNuevo ?? updated.aprobacionLynEstado,
      });
    }
    while (hist.length > 80) hist.shift();
    updated.lynAprobacionHistorial = hist;

    const detalle = `Lyn · ${entradaHistorial?.accion || 'acción'} · ${prevEstadoLyn ?? '—'} → ${updated.aprobacionLynEstado ?? '—'}`;
    updated = touch(updated, 'lyn_aprobacion', detalle, actor);
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async updateVisitFields(id, fields, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const cur = ensureDefaults(items[index]);
    const updated = { ...cur };
    if ('resumenTrabajo' in fields) {
      updated.resumenTrabajo = String(fields.resumenTrabajo ?? '').trim();
    }
    if ('recomendaciones' in fields) {
      updated.recomendaciones = String(fields.recomendaciones ?? '').trim();
    }
    if ('observaciones' in fields) {
      updated.observaciones = String(fields.observaciones ?? '').trim();
    }
    let out = touch(updated, 'visita', 'Textos de visita actualizados', actor);
    out = ensureDefaults(out);
    const next = [...items];
    next[index] = out;
    await saveStore(next);
    return out;
  },

  async updateEconomics(id, fields, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const cur = ensureDefaults(items[index]);
    const updated = { ...cur };
    for (const k of ['costoMateriales', 'costoManoObra', 'costoTraslado', 'costoOtros', 'montoCobrado']) {
      if (k in fields) updated[k] = round2(fields[k]);
    }
    let out = touch(updated, 'economia', 'Costos / ingreso actualizados', actor);
    out = ensureDefaults(out);
    const next = [...items];
    next[index] = out;
    await saveStore(next);
    return out;
  },

  async appendEvidences(id, patch, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const current = ensureDefaults(items[index]);
    const mergeBlock = (existing, incoming) => {
      const merged = [...(existing || [])];
      const names = new Set(merged.map((e) => e.name));
      for (const ev of incoming) {
        if (!names.has(ev.name)) {
          merged.push(ev);
          names.add(ev.name);
        }
      }
      return merged;
    };

    let updated = {
      ...current,
      fotografiasAntes: patch.fotografiasAntes
        ? mergeBlock(current.fotografiasAntes, patch.fotografiasAntes)
        : current.fotografiasAntes,
      fotografiasDurante: patch.fotografiasDurante
        ? mergeBlock(current.fotografiasDurante, patch.fotografiasDurante)
        : current.fotografiasDurante,
      fotografiasDespues: patch.fotografiasDespues
        ? mergeBlock(current.fotografiasDespues, patch.fotografiasDespues)
        : current.fotografiasDespues,
    };
    updated = touch(updated, 'evidencias', 'Fotos agregadas', actor);
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async updateReport(id, { pdfName, pdfUrl }, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    let updated = { ...ensureDefaults(items[index]), pdfName, pdfUrl };
    updated = touch(updated, 'informe', 'PDF asociado a la OT', actor);
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async updateEquipos(id, equipos, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    let updated = { ...ensureDefaults(items[index]), equipos };
    updated = touch(updated, 'equipos', 'Equipos / checklist / evidencias actualizados', actor);
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async deleteById(id) {
    const items = await loadStore();
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return null;
    await saveStore(next);
    return true;
  },

  async patchEstadoOperativoYDocumentoOrigen(id, fields, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    let updated = { ...ensureDefaults(items[index]) };
    const allowed = ['pendiente', 'en_proceso', 'gestionado', 'cerrado'];
    if (fields && fields.estadoOperativo != null) {
      const e = String(fields.estadoOperativo).toLowerCase().trim();
      if (allowed.includes(e)) {
        updated.estadoOperativo = e;
      }
    }
    if (fields && fields.maestroDocumentoOrigenId != null) {
      const m = String(fields.maestroDocumentoOrigenId || '').trim();
      updated.maestroDocumentoOrigenId = m || null;
    }
    updated = touch(
      updated,
      'bandeja_maestro',
      `Estado operativo / vínculo documento: ${JSON.stringify(fields || {}).slice(0, 200)}`,
      actor
    );
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async patchCore(id, patch, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    let updated = { ...ensureDefaults(items[index]) };
    const p = patch || {};
    const str = (k) => (p[k] != null ? String(p[k]).trim() : undefined);

    if ('cliente' in p) updated.cliente = str('cliente') || null;
    if ('direccion' in p) updated.direccion = str('direccion') || '';
    if ('comuna' in p) updated.comuna = str('comuna') || '';
    if ('contactoTerreno' in p) updated.contactoTerreno = str('contactoTerreno') || '';
    if ('telefonoContacto' in p) updated.telefonoContacto = str('telefonoContacto') || '';
    if ('tipoServicio' in p && p.tipoServicio) {
      const t = String(p.tipoServicio).toLowerCase();
      const allowed = ['clima', 'flota', 'comercial', 'administrativo'];
      updated.tipoServicio = allowed.includes(t) ? t : 'clima';
      updated.bandejaAsignada = bandejaFromTipoServicio(updated.tipoServicio);
      updated.notificacionAsignadaA = notificacionAsignadaFromBandeja(updated.bandejaAsignada);
    }
    if ('subtipoServicio' in p) updated.subtipoServicio = str('subtipoServicio') || '';
    if ('observaciones' in p) updated.observaciones = str('observaciones') || '';
    if ('origenSolicitud' in p && p.origenSolicitud) updated.origenSolicitud = String(p.origenSolicitud).trim();
    if ('origenPedido' in p) updated.origenPedido = str('origenPedido') || '';
    if ('prioridadOperativa' in p && p.prioridadOperativa) {
      const pr = String(p.prioridadOperativa).toLowerCase();
      if (['alta', 'media', 'baja'].includes(pr)) updated.prioridadOperativa = pr;
    }
    if ('whatsappContactoNumero' in p) updated.whatsappContactoNumero = str('whatsappContactoNumero') || '';
    if ('whatsappContactoNombre' in p) updated.whatsappContactoNombre = str('whatsappContactoNombre') || '';
    if ('entradaExterna' in p) updated.entradaExterna = Boolean(p.entradaExterna);
    if ('pendienteRespuestaCliente' in p) updated.pendienteRespuestaCliente = Boolean(p.pendienteRespuestaCliente);

    if ('tipoFacturacion' in p && p.tipoFacturacion != null) {
      const tf = String(p.tipoFacturacion).toLowerCase();
      if (['inmediata', 'mensual'].includes(tf)) updated.tipoFacturacion = tf;
    }
    if ('periodoFacturacion' in p) {
      updated.periodoFacturacion =
        p.periodoFacturacion != null && String(p.periodoFacturacion).trim()
          ? String(p.periodoFacturacion).trim().slice(0, 7)
          : null;
    }
    if ('tiendaId' in p) {
      updated.tiendaId =
        p.tiendaId != null && String(p.tiendaId).trim() ? String(p.tiendaId).trim() : null;
    }
    if ('tiendaNombre' in p) {
      updated.tiendaNombre =
        p.tiendaNombre != null ? String(p.tiendaNombre).slice(0, 200) : '';
    }
    if ('valorReferencialTienda' in p && p.valorReferencialTienda != null) {
      updated.valorReferencialTienda = round2(p.valorReferencialTienda);
    }
    if ('incluidaEnCierreMensual' in p) {
      updated.incluidaEnCierreMensual = Boolean(p.incluidaEnCierreMensual);
    }
    if ('cierreMensualId' in p) {
      updated.cierreMensualId =
        p.cierreMensualId != null && String(p.cierreMensualId).trim()
          ? String(p.cierreMensualId).trim()
          : null;
    }

    updated = touch(updated, 'edicion', 'Datos principales de la OT actualizados', actor);
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },
};

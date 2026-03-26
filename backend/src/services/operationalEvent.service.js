import {
  assertValidEstadoTransition,
  buildInternalReportFromEvent,
  classifyOperationalEvent,
  ESTADO_FLUJO_OPERATIVO,
  normalizeUrgencia,
  ORIGEN_EVENTO,
  TIPO_EVENTO_OPERATIVO,
} from '../domain/hnf-operational-event.js';
import { operationalEventRepository } from '../repositories/operationalEvent.repository.js';
import { otRepository } from '../repositories/ot.repository.js';
import { solicitudFlotaRepository } from '../repositories/solicitudFlota.repository.js';

const nowIso = () => new Date().toISOString();
const utcDay = (iso) => String(iso || '').slice(0, 10);

function auditEntry(actor, from_estado, to_estado, action, nota) {
  return {
    at: nowIso(),
    actor: String(actor || 'sistema').slice(0, 120),
    from_estado: from_estado || null,
    to_estado: to_estado || null,
    action: String(action || 'cambio').slice(0, 80),
    nota: nota != null ? String(nota).slice(0, 500) : null,
  };
}

function baseEventFromClassification({
  origen,
  mensaje_original,
  resumen_interpretado,
  actor,
  extras = {},
}) {
  const cls = classifyOperationalEvent({
    text: mensaje_original,
    origen,
    hints: extras.hints || {},
  });
  const tipoFinal = extras.tipo_evento || cls.tipo_evento;
  const urgencia = normalizeUrgencia(extras.urgencia || cls.urgencia);
  const aprobacion_requerida =
    Boolean(extras.aprobacion_requerida) ||
    tipoFinal === TIPO_EVENTO_OPERATIVO.AUTORIZACION_REQUERIDA ||
    tipoFinal === TIPO_EVENTO_OPERATIVO.INFORME_REVISION;

  const estadoInicial =
    tipoFinal === TIPO_EVENTO_OPERATIVO.PENDIENTE_INTERPRETAR
      ? ESTADO_FLUJO_OPERATIVO.RECIBIDO
      : ESTADO_FLUJO_OPERATIVO.REGISTRADO;
  const estado0 = extras.estado != null ? extras.estado : estadoInicial;

  const ts = extras.fecha_hora || nowIso();
  const ev = {
    origen,
    cliente: extras.cliente ?? null,
    contacto: extras.contacto ?? null,
    telefono: extras.telefono ?? null,
    canal: extras.canal ?? origen,
    fecha_hora: ts,
    tipo_evento: tipoFinal,
    subtipo: extras.subtipo || cls.subtipo,
    mensaje_original: String(mensaje_original || '').slice(0, 8000),
    resumen_interpretado: String(resumen_interpretado || cls.subtipo || '').slice(0, 4000),
    sucursal: extras.sucursal ?? null,
    tienda: extras.tienda ?? null,
    ubicacion: extras.ubicacion ?? null,
    tecnico: extras.tecnico ?? null,
    conductor: extras.conductor ?? null,
    responsable: extras.responsable ?? extras.tecnico ?? null,
    urgencia,
    estado: estado0,
    etapa: extras.etapa ?? 'captura',
    aprobacion_requerida,
    aprobado_por: extras.aprobado_por ?? null,
    observaciones: extras.observaciones != null ? String(extras.observaciones).slice(0, 4000) : null,
    evidencia_relacionada: Array.isArray(extras.evidencia_relacionada) ? extras.evidencia_relacionada : [],
    relacion_ot: extras.relacion_ot ?? null,
    relacion_traslado: extras.relacion_traslado ?? null,
    creado_por: String(actor || 'sistema').slice(0, 120),
    actualizado_por: String(actor || 'sistema').slice(0, 120),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    audit: [auditEntry(actor, null, estado0, 'creado', extras.nota_creacion || null)],
    whatsapp_message_id: extras.whatsapp_message_id ?? null,
    raw_ingest_id: extras.raw_ingest_id ?? null,
    hora_entrada_tienda: extras.hora_entrada_tienda ?? null,
    hora_salida_tienda: extras.hora_salida_tienda ?? null,
    etapa_revision: extras.etapa_revision ?? null,
  };
  return ev;
}

export const operationalEventService = {
  async list() {
    return operationalEventRepository.list();
  },

  async getById(id) {
    return operationalEventRepository.findById(id);
  },

  async createManual(body, actor) {
    const origen = body.origen || ORIGEN_EVENTO.MANUAL;
    const mensaje = body.mensaje_original ?? body.texto ?? '';
    const doc = baseEventFromClassification({
      origen,
      mensaje_original: mensaje,
      resumen_interpretado: body.resumen_interpretado ?? body.resumen ?? '',
      actor,
      extras: {
        cliente: body.cliente,
        contacto: body.contacto,
        telefono: body.telefono,
        canal: body.canal || 'manual',
        sucursal: body.sucursal,
        tienda: body.tienda,
        ubicacion: body.ubicacion,
        tecnico: body.tecnico,
        conductor: body.conductor,
        responsable: body.responsable,
        relacion_ot: body.relacion_ot,
        relacion_traslado: body.relacion_traslado,
        evidencia_relacionada: body.evidencia_relacionada,
        estado: body.estado,
        tipo_evento: body.tipo_evento,
        subtipo: body.subtipo,
        urgencia: body.urgencia,
        etapa: body.etapa,
        hints: body.hints,
        aprobacion_requerida: body.aprobacion_requerida,
        aprobado_por: body.aprobado_por,
        observaciones: body.observaciones,
        raw_ingest_id: body.raw_ingest_id,
        whatsapp_message_id: body.whatsapp_message_id,
        hora_entrada_tienda: body.hora_entrada_tienda,
        hora_salida_tienda: body.hora_salida_tienda,
        etapa_revision: body.etapa_revision,
        fecha_hora: body.fecha_hora,
        nota_creacion: body.nota_creacion,
      },
    });
    return operationalEventRepository.insertNew(doc);
  },

  /**
   * Idempotente por whatsapp_message_id.
   */
  async syncFromWhatsappRecord(record, parsed, actor = 'whatsapp-ingest') {
    if (!record?.id) return null;
    const existing = await operationalEventRepository.findByWhatsappMessageId(record.id);
    const text =
      String(record.descripcion || parsed?.descripcion || record.observaciones || '').slice(0, 8000) ||
      '[sin texto — ver adjuntos/evidencias]';
    const origen =
      record.chatKind === 'cliente' || record.origenChat === 'cliente'
        ? ORIGEN_EVENTO.WHATSAPP_CLIENTE
        : ORIGEN_EVENTO.WHATSAPP_INTERNO;

    const extras = {
      cliente: record.cliente && record.cliente !== 'desconocido' ? record.cliente : null,
      telefono: record.tecnicoId && record.tecnicoId !== 'tecnico_no_identificado' ? null : null,
      canal: 'whatsapp',
      tecnico: record.tecnico || null,
      responsable: record.tecnico || null,
      ubicacion: record.ubicacion || parsed?.ubicacion || null,
      relacion_ot: record.otIdRelacionado || null,
      whatsapp_message_id: record.id,
      evidencia_relacionada: (record.evidencias || []).map((e) => ({
        tipo: e.tipo || 'archivo',
        url: e.url,
        name: e.name,
      })),
      hints: { forceTipo: null },
    };

    const doc = baseEventFromClassification({
      origen,
      mensaje_original: text,
      resumen_interpretado: `WhatsApp · ${record.resultadoIngesta || 'procesado'} · tipo ${parsed?.tipo || record.tipo || '—'}`,
      actor,
      extras: {
        ...extras,
        estado: ESTADO_FLUJO_OPERATIVO.REGISTRADO,
        etapa: 'vinculacion_ot',
      },
    });

    if (existing) {
      const merged = {
        ...existing,
        ...doc,
        id: existing.id,
        createdAt: existing.createdAt,
        creado_por: existing.creado_por,
        audit: [
          ...(existing.audit || []),
          auditEntry(actor, existing.estado, doc.estado, 'sync_whatsapp', record.id),
        ],
        updatedAt: nowIso(),
        actualizado_por: actor,
      };
      return operationalEventRepository.upsert(merged);
    }

    return operationalEventRepository.insertNew(doc);
  },

  async transitionEstado(id, { estado, actor, nota }) {
    const ev = await operationalEventRepository.findById(id);
    if (!ev) return { error: 'not_found' };
    const check = assertValidEstadoTransition(ev.estado, estado);
    if (!check.ok) return { error: check.error };
    const next = {
      ...ev,
      estado,
      updatedAt: nowIso(),
      actualizado_por: String(actor || 'sistema').slice(0, 120),
      audit: [...(ev.audit || []), auditEntry(actor, ev.estado, estado, 'transicion', nota)],
    };
    if (estado === ESTADO_FLUJO_OPERATIVO.APROBADO && !next.aprobado_por) {
      next.aprobado_por = String(actor || '').slice(0, 120) || 'sistema';
    }
    return operationalEventRepository.upsert(next);
  },

  informeInterno(id) {
    return operationalEventRepository.findById(id).then((ev) => {
      if (!ev) return null;
      return buildInternalReportFromEvent(ev);
    });
  },

  /** Panel diario consolidado (UTC día). Fuente de verdad servidor. */
  async buildDailyPanelSnapshot() {
    const day = utcDay(nowIso());
    const [events, ots, sol] = await Promise.all([
      operationalEventRepository.list(),
      otRepository.findAll(),
      solicitudFlotaRepository.findAll({}),
    ]);

    const eventsToday = events.filter((e) => utcDay(e.fecha_hora || e.createdAt) === day);
    const planOts = Array.isArray(ots) ? ots : [];
    const flotaList = Array.isArray(sol) ? sol : [];

    const otsActivas = planOts.filter((o) => {
      const st = String(o.estado || '').toLowerCase();
      return st && !['terminado', 'cerrado', 'cancelado'].includes(st);
    });

    const trasladoCerrado = new Set(['completada', 'cerrada']);
    const trasladosActivos = flotaList.filter((s) => !trasladoCerrado.has(String(s.estado || '').toLowerCase()));

    const autorizacionesPendientes = events.filter(
      (e) =>
        e.estado === ESTADO_FLUJO_OPERATIVO.ESPERANDO_APROBACION ||
        (e.aprobacion_requerida && e.estado !== ESTADO_FLUJO_OPERATIVO.APROBADO && e.estado !== ESTADO_FLUJO_OPERATIVO.CERRADO)
    );

    const evidenciasPendientes = events.filter((e) => e.tipo_evento === TIPO_EVENTO_OPERATIVO.EVIDENCIA_PENDIENTE);

    const cierresListos = planOts.filter((o) => {
      const st = String(o.estado || '').toLowerCase();
      return st === 'terminado';
    });

    const cuellosDeBotella = [];
    const pendInterp = eventsToday.filter((e) => e.tipo_evento === TIPO_EVENTO_OPERATIVO.PENDIENTE_INTERPRETAR);
    if (pendInterp.length) {
      cuellosDeBotella.push({
        code: 'interpretacion',
        texto: `${pendInterp.length} evento(s) pendiente(s) de interpretación hoy`,
        severidad: 'alta',
      });
    }
    if (autorizacionesPendientes.length >= 3) {
      cuellosDeBotella.push({
        code: 'aprobaciones',
        texto: `${autorizacionesPendientes.length} autorizaciones / aprobaciones en cola`,
        severidad: 'media',
      });
    }

    const responsablesCriticosMap = {};
    for (const e of events) {
      if (e.estado === ESTADO_FLUJO_OPERATIVO.CERRADO) continue;
      if (!['alta', 'critica'].includes(String(e.urgencia || '').toLowerCase())) continue;
      const r = e.responsable || e.tecnico || 'sin_asignar';
      responsablesCriticosMap[r] = (responsablesCriticosMap[r] || 0) + 1;
    }
    const responsables_criticos = Object.entries(responsablesCriticosMap)
      .map(([responsable, count]) => ({ responsable, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    return {
      meta: {
        panelDayUtc: day,
        generatedAt: nowIso(),
        schemaVersion: '2026-03-24',
      },
      entradas_del_dia: eventsToday,
      ots_activas: otsActivas,
      traslados_activos: trasladosActivos,
      autorizaciones_pendientes: autorizacionesPendientes,
      evidencias_pendientes: evidenciasPendientes,
      cierres_listos: cierresListos,
      cuellos_de_botella: cuellosDeBotella,
      responsables_criticos,
      conteos: {
        eventos_hoy: eventsToday.length,
        ots_activas: otsActivas.length,
        traslados_activos: trasladosActivos.length,
      },
    };
  },
};

import { mapWhatsAppCloudToInternal } from '../adapters/whatsappCloudInbound.adapter.js';
import {
  ORIGEN_EVENTO,
  TIPO_EVENTO_OPERATIVO,
  ESTADO_FLUJO_OPERATIVO,
} from '../domain/hnf-operational-event.js';
import { normalizeWhatsAppInput } from '../domain/whatsapp-ingestion.js';
import { operationalRawInboxRepository } from '../repositories/operationalRawInbox.repository.js';
import { operationalEventService } from './operationalEvent.service.js';

const nowIso = () => new Date().toISOString();

/**
 * Guarda payload bruto y genera evento operativo (o deja explícito pendiente de interpretar).
 */
export async function ingestExternalPayload(
  { channel, payload, sourceHint, actor },
  options = {}
) {
  const ch = String(channel || 'unknown').toLowerCase();
  const raw = await operationalRawInboxRepository.append({
    channel: ch,
    sourceHint: sourceHint || null,
    body_raw:
      typeof payload === 'string' ? payload.slice(0, 120_000) : JSON.stringify(payload).slice(0, 120_000),
    processing_status: 'queued',
  });

  try {
    if (ch === 'whatsapp_cloud' || ch === 'whatsapp_webhook') {
      const internal = mapWhatsAppCloudToInternal(payload);
      const norm = normalizeWhatsAppInput(internal);
      const text = norm.texto || internal.body || '';
      const event = await operationalEventService.createManual(
        {
          origen: ORIGEN_EVENTO.WHATSAPP_CLIENTE,
          mensaje_original: text || JSON.stringify(payload).slice(0, 4000),
          resumen_interpretado: `Webhook WhatsApp · ${internal._source || 'cloud'}`,
          canal: 'whatsapp',
          telefono: internal.from || null,
          contacto: internal.from || null,
          raw_ingest_id: raw.id,
          whatsapp_message_id: String(internal.id || internal.messageId || ''),
          hints: {},
        },
        actor
      );
      await operationalRawInboxRepository.updateItem(raw.id, {
        processing_status: 'processed',
        operational_event_id: event.id,
        processedAt: nowIso(),
      });
      return { raw, event };
    }

    if (ch === 'whatsapp_interno' || ch === 'whatsapp_cliente') {
      const norm = normalizeWhatsAppInput(payload?.message ?? payload);
      const text = norm.texto || '';
      const event = await operationalEventService.createManual(
        {
          origen: ch === 'whatsapp_cliente' ? ORIGEN_EVENTO.WHATSAPP_CLIENTE : ORIGEN_EVENTO.WHATSAPP_INTERNO,
          mensaje_original: text || '[sin texto]',
          resumen_interpretado: sourceHint || 'Ingesta manual estructurada',
          canal: 'whatsapp',
          raw_ingest_id: raw.id,
          cliente: payload?.cliente,
          relacion_ot: payload?.relacion_ot,
        },
        actor
      );
      await operationalRawInboxRepository.updateItem(raw.id, {
        processing_status: 'processed',
        operational_event_id: event.id,
        processedAt: nowIso(),
      });
      return { raw, event };
    }

    if (ch === 'correo' || ch === 'correo_resumido') {
      const p = payload && typeof payload === 'object' ? payload : {};
      const text = String(p.summary || p.cuerpo || p.body || p.text || '').slice(0, 8000);
      const event = await operationalEventService.createManual(
        {
          origen: ORIGEN_EVENTO.CORREO,
          mensaje_original: text || '[correo sin cuerpo]',
          resumen_interpretado: String(p.asunto || p.subject || 'Correo ingresado').slice(0, 500),
          canal: 'email',
          cliente: p.cliente || null,
          contacto: p.de || p.from || null,
          raw_ingest_id: raw.id,
        },
        actor
      );
      await operationalRawInboxRepository.updateItem(raw.id, {
        processing_status: 'processed',
        operational_event_id: event.id,
        processedAt: nowIso(),
      });
      return { raw, event };
    }

    if (options.allowMalformedToPending) {
      const event = await operationalEventService.createManual(
        {
          origen: ORIGEN_EVENTO.SISTEMA,
          mensaje_original: raw.body_raw.slice(0, 8000),
          resumen_interpretado: 'Pendiente de interpretar (canal no clasificado)',
          canal: ch,
          tipo_evento: TIPO_EVENTO_OPERATIVO.PENDIENTE_INTERPRETAR,
          estado: ESTADO_FLUJO_OPERATIVO.RECIBIDO,
          raw_ingest_id: raw.id,
        },
        actor
      );
      await operationalRawInboxRepository.updateItem(raw.id, {
        processing_status: 'processed',
        operational_event_id: event.id,
        processedAt: nowIso(),
      });
      return { raw, event };
    }

    await operationalRawInboxRepository.updateItem(raw.id, {
      processing_status: 'error',
      error_message: 'channel_not_supported',
      processedAt: nowIso(),
    });
    return { raw, event: null, error: 'channel_not_supported' };
  } catch (e) {
    await operationalRawInboxRepository.updateItem(raw.id, {
      processing_status: 'error',
      error_message: String(e?.message || e).slice(0, 500),
      processedAt: nowIso(),
    });

    const fallback = await operationalEventService.createManual(
      {
        origen: ORIGEN_EVENTO.SISTEMA,
        mensaje_original: raw.body_raw.slice(0, 8000),
        resumen_interpretado: 'Error en pipeline de ingesta — revisar raw inbox',
        canal: ch,
        tipo_evento: TIPO_EVENTO_OPERATIVO.PENDIENTE_INTERPRETAR,
        estado: ESTADO_FLUJO_OPERATIVO.RECIBIDO,
        raw_ingest_id: raw.id,
        observaciones: String(e?.message || e).slice(0, 500),
      },
      actor
    );
    return { raw, event: fallback, ingestError: String(e?.message || e) };
  }
}

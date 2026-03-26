import { ingestExternalPayload } from '../services/operationalIngest.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

/**
 * Ingesta genérica: { channel, payload, sourceHint? }
 * Canales: whatsapp_cloud, whatsapp_cliente, whatsapp_interno, correo, correo_resumido, ...
 */
export const postOperationalIngest = async (req, res) => {
  try {
    const actor = getRequestActor(req);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const channel = String(body.channel || '').trim();
    if (!channel) {
      return sendError(res, 400, 'channel es obligatorio.', { resource: 'operational_ingest' });
    }
    const out = await ingestExternalPayload(
      {
        channel,
        payload: body.payload !== undefined ? body.payload : body,
        sourceHint: body.sourceHint,
        actor,
      },
      { allowMalformedToPending: body.allowMalformedToPending !== false }
    );
    if (out.error && !out.event) {
      return sendError(res, 400, out.error, { resource: 'operational_ingest', rawId: out.raw?.id });
    }
    sendSuccess(
      res,
      201,
      { raw: out.raw, event: out.event, ingestError: out.ingestError || null },
      { resource: 'operational_ingest' }
    );
  } catch (e) {
    sendError(res, 500, e?.message || 'Error en ingesta operativa');
  }
};

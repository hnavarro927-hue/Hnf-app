import { technicalDocumentRepository } from '../../repositories/technicalDocument.repository.js';
import { otRepository } from '../../repositories/ot.repository.js';
import { createTechnicalDocument } from '../../services/technicalDocument.service.js';
import {
  buildParsedDocumentFields,
  detectTechnicalRisks,
  findOtIdByClienteFecha,
} from './technicalDocument.parser.js';

const nowIso = () => new Date().toISOString();

export async function ingestTechnicalDocument(body, actor) {
  const texto = String(body?.texto ?? body?.text ?? '').trim();
  const pdfMetadata =
    body?.pdfMetadata != null && typeof body.pdfMetadata === 'object' ? body.pdfMetadata : null;

  const metaKeys = ['cliente', 'fechaServicio', 'fecha', 'otId', 'title', 'titulo', 'subject', 'sucursal'];
  const hasMeta =
    pdfMetadata &&
    metaKeys.some((k) => pdfMetadata[k] != null && String(pdfMetadata[k]).trim());

  if (!texto && !hasMeta) {
    return {
      error:
        'Enviá `texto` (o `text`) y/o `pdfMetadata` con al menos cliente, fecha u otId.',
    };
  }

  const { parsed, merged } = buildParsedDocumentFields(texto, pdfMetadata);
  const alertas = detectTechnicalRisks(merged);

  const ots = await otRepository.findAll();
  let otId = String(body?.otId ?? merged.otId ?? '').trim();
  if (!otId && merged.cliente && merged.fechaServicio) {
    otId = findOtIdByClienteFecha(merged.cliente, merged.fechaServicio, ots);
  }

  const titulo =
    String(merged.tituloDocumento || '').trim() ||
    (merged.cliente ? `Informe técnico · ${merged.cliente}` : 'Informe técnico · ingestión');

  const analisisJarvis = {
    fuente: 'ingesta_servidor',
    at: nowIso(),
    parseVersion: parsed.version,
    confianzaParseo: parsed.confidence,
    alertasGeneradas: alertas.length,
    codigosAlerta: alertas.map((a) => a.code),
    vinculoOt: otId || null,
  };

  const ingestaResumen = {
    at: nowIso(),
    confidence: parsed.confidence,
    hints: Array.isArray(parsed.hints) ? parsed.hints : [],
    ok: parsed.ok,
  };

  const t0 = nowIso();
  const createBody = {
    ...merged,
    otId,
    tituloDocumento: titulo,
    estadoDocumento: 'en_revision',
    fuente: pdfMetadata && !texto ? 'pdf_metadata' : 'pdf_texto',
    alertasIngesta: alertas,
    ingestaResumen,
    analisisJarvis,
    enviadoRevisionPor: actor,
    enviadoRevisionEn: t0,
  };

  const { entry } = await createTechnicalDocument(createBody, actor);

  await technicalDocumentRepository.appendIngestaEvent(
    entry.id,
    {
      tipo: 'ingesta',
      texto: `Ingesta PDF/texto · confianza ${parsed.confidence} · ${alertas.length} alerta(s)`,
      fuente: 'sistema',
    },
    actor
  );

  const fresh = await technicalDocumentRepository.findById(entry.id);

  return {
    payload: {
      documento: fresh,
      alertas,
      estado: 'en_revision',
      parseMeta: {
        confidence: parsed.confidence,
        hints: parsed.hints,
        version: parsed.version,
        ok: parsed.ok,
      },
    },
  };
}

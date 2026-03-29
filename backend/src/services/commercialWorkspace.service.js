import { commercialPropuestaRepository } from '../repositories/commercialPropuesta.repository.js';

const TIPOS = ['propuesta', 'borrador_correo_jarvis', 'seguimiento_nota'];
const ESTADOS = ['borrador', 'lista_revision', 'aprobada_envio', 'enviada_manual', 'descartada'];

function normTipo(t) {
  const s = String(t || 'propuesta').toLowerCase();
  return TIPOS.includes(s) ? s : 'propuesta';
}

export const commercialWorkspaceService = {
  async listPropuestas() {
    const list = await commercialPropuestaRepository.findAll();
    return [...list].sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    );
  },

  async listBorradoresCorreo() {
    const list = await commercialPropuestaRepository.findAll();
    return list
      .filter((x) => String(x.tipo) === 'borrador_correo_jarvis')
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  },

  async create(body, actor) {
    const titulo = String(body?.titulo || '').trim().slice(0, 200);
    if (!titulo) return { errors: ['titulo obligatorio'] };
    const tipo = normTipo(body?.tipo);
    const row = await commercialPropuestaRepository.create(
      {
        tipo,
        titulo,
        leadId: body?.leadId ? String(body.leadId).trim() : null,
        opportunityId: body?.opportunityId ? String(body.opportunityId).trim() : null,
        estado: ESTADOS.includes(String(body?.estado || '').toLowerCase())
          ? String(body.estado).toLowerCase()
          : 'borrador',
        montoEstimado:
          body?.montoEstimado != null
            ? Math.round(Number.parseFloat(String(body.montoEstimado).replace(',', '.')) * 100) / 100
            : null,
        moneda: String(body?.moneda || 'CLP').slice(0, 8),
        cuerpoTexto: String(body?.cuerpoTexto || body?.cuerpo_correo || '').slice(0, 24000),
        asuntoSugerido: String(body?.asuntoSugerido || '').slice(0, 400),
        adjuntosSugeridos: Array.isArray(body?.adjuntosSugeridos)
          ? body.adjuntosSugeridos.map((x) => String(x).slice(0, 400)).filter(Boolean).slice(0, 24)
          : [],
        jarvisPreparado: Boolean(body?.jarvisPreparado),
        requiereAprobacionEnvio: true,
        enviadoAt: null,
        seguimiento: Array.isArray(body?.seguimiento) ? body.seguimiento : [],
      },
      actor
    );
    return { entry: row };
  },

  async patch(id, body, actor) {
    const cur = await commercialPropuestaRepository.findById(String(id || '').trim());
    if (!cur) return { error: 'No encontrado' };
    const patch = {};
    if (body.titulo != null) patch.titulo = String(body.titulo).slice(0, 200);
    if (body.estado != null && ESTADOS.includes(String(body.estado).toLowerCase())) patch.estado = String(body.estado).toLowerCase();
    if (body.cuerpoTexto != null) patch.cuerpoTexto = String(body.cuerpoTexto).slice(0, 24000);
    if (body.asuntoSugerido != null) patch.asuntoSugerido = String(body.asuntoSugerido).slice(0, 400);
    if (body.adjuntosSugeridos != null)
      patch.adjuntosSugeridos = Array.isArray(body.adjuntosSugeridos)
        ? body.adjuntosSugeridos.map((x) => String(x).slice(0, 400)).filter(Boolean).slice(0, 24)
        : [];
    if (body.montoEstimado != null) {
      const n = Number.parseFloat(String(body.montoEstimado).replace(',', '.'));
      patch.montoEstimado = Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
    }
    if (body.enviadoAt != null) patch.enviadoAt = body.enviadoAt ? String(body.enviadoAt).slice(0, 40) : null;
    if (body.notaSeguimiento != null) {
      const nota = String(body.notaSeguimiento).trim().slice(0, 2000);
      if (nota) {
        const seg = Array.isArray(cur.seguimiento) ? [...cur.seguimiento] : [];
        seg.push({ at: new Date().toISOString(), nota, actor: String(actor || '').slice(0, 120) });
        patch.seguimiento = seg;
      }
    }
    const u = await commercialPropuestaRepository.update(cur.id, patch, actor, 'Patch comercial');
    return { entry: u };
  },

  /**
   * Jarvis (o UI) prepara borrador; nunca marca enviado automáticamente.
   */
  async upsertBorradorJarvis(body, actor) {
    const titulo = String(body?.titulo || 'Borrador correo Jarvis').trim().slice(0, 200);
    const r = await this.create(
      {
        tipo: 'borrador_correo_jarvis',
        titulo,
        leadId: body?.leadId,
        opportunityId: body?.opportunityId,
        cuerpoTexto: body?.cuerpoTexto,
        asuntoSugerido: body?.asuntoSugerido,
        adjuntosSugeridos: body?.adjuntosSugeridos,
        jarvisPreparado: true,
        estado: 'lista_revision',
      },
      actor
    );
    return r;
  },
};

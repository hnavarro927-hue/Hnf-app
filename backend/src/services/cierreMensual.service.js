import { cierreMensualRepository } from '../repositories/cierreMensual.repository.js';
import { otRepository } from '../repositories/ot.repository.js';
import { normalizeOtEstadoStored } from '../utils/otEstado.js';

const round2 = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

async function otEnOtroCierreActivo(otId, excludeCierreId) {
  const cierres = await cierreMensualRepository.findAll();
  for (const c of cierres) {
    if (c.id === excludeCierreId) continue;
    if (['facturado'].includes(String(c.estado || '').toLowerCase())) continue;
    if ((c.otIds || []).includes(otId)) return c.id;
  }
  return null;
}

export const cierreMensualService = {
  async listTiendas() {
    const { tiendaFinancieraRepository } = await import('../repositories/tiendaFinanciera.repository.js');
    return tiendaFinancieraRepository.findAll();
  },

  async totalesCierre(cierre) {
    const ots = await otRepository.findAll();
    const set = new Set(cierre.otIds || []);
    const sel = ots.filter((o) => set.has(o.id));
    let costoTotal = 0;
    let valorReferencialTotal = 0;
    let utilidadEstimadaTotal = 0;
    for (const o of sel) {
      costoTotal += round2(o.costoTotal);
      valorReferencialTotal += round2(o.valorReferencialTienda);
      utilidadEstimadaTotal += round2(o.utilidadEstimada ?? 0);
    }
    return {
      cantidadOt: sel.length,
      costoTotal: round2(costoTotal),
      valorReferencialTotal: round2(valorReferencialTotal),
      utilidadEstimadaTotal: round2(utilidadEstimadaTotal),
    };
  },

  async listCierres() {
    const list = await cierreMensualRepository.findAll();
    const out = [];
    for (const c of list) {
      out.push({ ...c, totales: await this.totalesCierre(c) });
    }
    return out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  },

  async getCierre(id) {
    const c = await cierreMensualRepository.findById(id);
    if (!c) return { error: 'No encontrado' };
    const totales = await this.totalesCierre(c);
    const ots = await otRepository.findAll();
    const detalleOts = (c.otIds || []).map((oid) => ots.find((o) => o.id === oid)).filter(Boolean);
    return { ...c, totales, ots: detalleOts };
  },

  async candidatasPeriodo(periodo) {
    const p = String(periodo || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(p)) return { errors: ['periodo YYYY-MM obligatorio'] };
    const ots = await otRepository.findAll();
    return ots.filter((o) => {
      const tf = String(o.tipoFacturacion || 'inmediata').toLowerCase();
      const per = String(o.periodoFacturacion || '').slice(0, 7);
      const st = normalizeOtEstadoStored(o.estado);
      return tf === 'mensual' && per === p && st !== 'facturada';
    });
  },

  async crearCierre(body, actor) {
    const periodo = String(body?.periodo || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(periodo)) return { errors: ['periodo YYYY-MM obligatorio'] };
    return cierreMensualRepository.create(
      {
        periodo,
        clienteId: body?.clienteId || null,
        tiendaId: body?.tiendaId || null,
        tiendaNombreSnapshot: body?.tiendaNombreSnapshot || null,
      },
      actor
    );
  },

  async incluirOt(cierreId, otId, actor) {
    const c = await cierreMensualRepository.findById(cierreId);
    const ot = await otRepository.findById(otId);
    if (!c || !ot) return { error: 'Cierre u OT no encontrado' };
    if (String(c.estado) === 'facturado') return { errors: ['Cierre ya facturado'] };
    if (String(ot.tipoFacturacion || '').toLowerCase() !== 'mensual') {
      return { errors: ['Solo OT con facturación mensual'] };
    }
    if (String(ot.periodoFacturacion || '').slice(0, 7) !== String(c.periodo).slice(0, 7)) {
      return { errors: ['La OT no pertenece al período del cierre'] };
    }
    const bloqueo = await otEnOtroCierreActivo(otId, cierreId);
    if (bloqueo) return { errors: [`OT ya incluida en cierre ${bloqueo}`] };

    const otIds = [...new Set([...(c.otIds || []), otId])];
    await otRepository.patchCore(
      otId,
      { incluidaEnCierreMensual: true, cierreMensualId: cierreId },
      actor
    );
    const totales = await this.totalesCierre({ ...c, otIds });
    const updated = await cierreMensualRepository.update(
      cierreId,
      { otIds, totales },
      actor,
      `Incluye OT ${otId}`
    );
    return { ok: true, cierre: updated };
  },

  async excluirOt(cierreId, otId, actor) {
    const c = await cierreMensualRepository.findById(cierreId);
    if (!c) return { error: 'Cierre no encontrado' };
    if (String(c.estado) === 'facturado') return { errors: ['Cierre ya facturado'] };
    const otIds = (c.otIds || []).filter((x) => x !== otId);
    const ot = await otRepository.findById(otId);
    if (ot && String(ot.cierreMensualId) === String(cierreId)) {
      await otRepository.patchCore(
        otId,
        { incluidaEnCierreMensual: false, cierreMensualId: null },
        actor
      );
    }
    const totales = await this.totalesCierre({ ...c, otIds });
    const updated = await cierreMensualRepository.update(
      cierreId,
      { otIds, totales },
      actor,
      `Excluye OT ${otId}`
    );
    return { ok: true, cierre: updated };
  },

  async cerrarPeriodo(cierreId, actor) {
    const c = await cierreMensualRepository.findById(cierreId);
    if (!c) return { error: 'No encontrado' };
    if (String(c.estado) === 'facturado') return { errors: ['Ya facturado'] };
    const totales = await this.totalesCierre(c);
    const updated = await cierreMensualRepository.update(
      cierreId,
      { estado: 'cerrado', totales },
      actor,
      'Período cerrado'
    );
    return { ok: true, cierre: updated };
  },

  async marcarFacturado(cierreId, actor) {
    const c = await cierreMensualRepository.findById(cierreId);
    if (!c) return { error: 'No encontrado' };
    if (String(c.estado) !== 'cerrado') {
      return { errors: ['El cierre debe estar en estado cerrado'] };
    }
    for (const oid of c.otIds || []) {
      await otRepository.updateStatus(oid, 'facturada', actor);
    }
    const updated = await cierreMensualRepository.update(
      cierreId,
      { estado: 'facturado' },
      actor,
      'Marcado como facturado'
    );
    return { ok: true, cierre: updated };
  },
};

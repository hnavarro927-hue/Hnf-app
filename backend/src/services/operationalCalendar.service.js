import { operationalCalendarRepository } from '../repositories/operationalCalendar.repository.js';
import { planMantencionRepository } from '../repositories/planMantencion.repository.js';
import { planTiendaRepository } from '../repositories/planTienda.repository.js';
import { planClienteRepository } from '../repositories/planCliente.repository.js';
import { otRepository } from '../repositories/ot.repository.js';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const bloqueFromHoras = (hi, hf) => {
  const a = String(hi || '').trim();
  const b = String(hf || '').trim();
  if (a && b) return `${a}–${b}`;
  if (a || b) return a || b;
  return '—';
};

const mapMantEstado = (estado) => {
  const e = String(estado || '').toLowerCase();
  if (e === 'realizado') return 'ejecutado';
  if (e === 'pendiente' || e === 'programado') return 'programado';
  return 'programado';
};

const mapTipoMantToUnidad = (tipo) => (String(tipo || '').toLowerCase() === 'preventivo' ? 'UI' : 'UE');

function findOtForSlot(ots, { fecha, clienteNombre, tiendaNombre }) {
  const cn = norm(clienteNombre);
  const tn = norm(tiendaNombre);
  for (const o of ots) {
    if (String(o.tipoServicio || 'clima').toLowerCase() === 'flota') continue;
    if (String(o.fecha || '').slice(0, 10) !== fecha) continue;
    const oc = norm(o.cliente);
    if (!oc) continue;
    if (cn && (oc === cn || oc.includes(cn) || cn.includes(oc))) return o;
    if (tn && oc.includes(tn)) return o;
    if (tn && tn.split(' ').filter((w) => w.length > 3).some((w) => oc.includes(w))) return o;
  }
  return null;
}

/**
 * Merge registros persistidos + mantenciones del plan (sin duplicar por referenciaMantencionId).
 */
export async function getMergedOperationalCalendar(desde, hasta) {
  const d0 = String(desde || '').slice(0, 10);
  const d1 = String(hasta || '').slice(0, 10);

  const [stored, mantAll, tiendas, clientes, ots] = await Promise.all([
    operationalCalendarRepository.findInRange(d0, d1),
    planMantencionRepository.findAll(),
    planTiendaRepository.findAll(),
    planClienteRepository.findAll(),
    otRepository.findAll(),
  ]);

  const tiendaById = Object.fromEntries(tiendas.map((t) => [t.id, t]));
  const clienteById = Object.fromEntries(clientes.map((c) => [c.id, c]));

  const coveredMant = new Set(
    stored.map((e) => e.referenciaMantencionId).filter(Boolean)
  );

  const merged = [];

  for (const e of stored) {
    const t = tiendaById[e.tiendaId];
    const c = t ? clienteById[t.clienteId] : null;
    let refOt = e.referenciaOtId;
    if (!refOt) {
      const hit = findOtForSlot(ots, {
        fecha: e.fecha,
        clienteNombre: e.cliente || c?.nombre,
        tiendaNombre: e.tiendaNombre || t?.nombre,
      });
      if (hit) refOt = hit.id;
    }
    merged.push({
      ...e,
      virtual: false,
      tiendaNombre: e.tiendaNombre || t?.nombre || e.tiendaId,
      cliente: e.cliente || c?.nombre || '—',
      referenciaOtId: refOt || null,
    });
  }

  for (const m of mantAll) {
    const f = String(m.fecha || '').slice(0, 10);
    if (f < d0 || f > d1) continue;
    if (coveredMant.has(m.id)) continue;

    const t = tiendaById[m.tiendaId];
    const c = t ? clienteById[t.clienteId] : null;
    const clienteNombre = c?.nombre || '—';
    const tiendaNombre = t?.nombre || m.tiendaId;
    const ot = findOtForSlot(ots, { fecha: f, clienteNombre, tiendaNombre });

    merged.push({
      id: `virt-MNT-${m.id}`,
      virtual: true,
      cliente: clienteNombre,
      tiendaId: m.tiendaId,
      tiendaNombre,
      fecha: f,
      horaInicio: m.horaInicio || '',
      horaFin: m.horaFin || '',
      bloqueHorario: bloqueFromHoras(m.horaInicio, m.horaFin),
      tipoUnidad: mapTipoMantToUnidad(m.tipo),
      tecnicoAsignado: m.tecnico || '',
      estado: mapMantEstado(m.estado),
      observacion: `Desde mantención plan · tipo ${m.tipo}`,
      fuente: 'sistema',
      referenciaMantencionId: m.id,
      referenciaOtId: ot?.id || null,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    });
  }

  merged.sort((a, b) => {
    const c = String(a.fecha).localeCompare(String(b.fecha));
    if (c !== 0) return c;
    return String(a.horaInicio || '').localeCompare(String(b.horaInicio || ''));
  });

  return {
    desde: d0,
    hasta: d1,
    entries: merged,
    storedCount: stored.length,
    virtualCount: merged.length - stored.length,
  };
}

export async function createOperationalEntry(body, actor) {
  const tiendas = await planTiendaRepository.findAll();
  const clientes = await planClienteRepository.findAll();
  const t = tiendas.find((x) => x.id === String(body.tiendaId || '').trim());
  if (!t) return { error: 'Tienda no encontrada en planificación.' };
  const c = clientes.find((x) => x.id === t.clienteId);
  const row = await operationalCalendarRepository.create(
    {
      cliente: body.cliente || c?.nombre || '—',
      tiendaId: t.id,
      tiendaNombre: body.tiendaNombre || t.nombre,
      fecha: body.fecha,
      horaInicio: body.horaInicio ?? '',
      horaFin: body.horaFin ?? '',
      bloqueHorario: body.bloqueHorario || bloqueFromHoras(body.horaInicio, body.horaFin),
      tipoUnidad: body.tipoUnidad || 'UE',
      tecnicoAsignado: body.tecnicoAsignado ?? '',
      estado: body.estado || 'programado',
      observacion: body.observacion ?? '',
      fuente: body.fuente || 'romina',
      referenciaMantencionId: body.referenciaMantencionId || null,
      referenciaOtId: body.referenciaOtId || null,
    },
    actor
  );
  return { entry: row };
}

export async function patchOperationalEntry(id, patch, actor) {
  const cur = await operationalCalendarRepository.findById(id);
  if (!cur) return { error: 'Registro no encontrado.' };
  const allowed = [
    'fecha',
    'horaInicio',
    'horaFin',
    'bloqueHorario',
    'tipoUnidad',
    'tecnicoAsignado',
    'estado',
    'observacion',
    'referenciaOtId',
    'referenciaMantencionId',
    'fuente',
    'cliente',
    'tiendaNombre',
  ];
  const next = {};
  for (const k of allowed) {
    if (k in patch) next[k] = patch[k];
  }
  const row = await operationalCalendarRepository.update(id, next, actor);
  return { entry: row };
}

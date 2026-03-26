/**
 * Ciclo automático del servidor (cada 5 min): recalcula tareas y resumen económico en memoria.
 * No usar la palabra "cron" en respuestas al cliente; exponer ultima_revision / proxima_actualizacion.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { otRepository } from '../repositories/ot.repository.js';
import { getEvidenceGapsForOt } from '../utils/ot-evidence-gaps.js';
import {
  responsibilityStore,
  setCashSnapshot,
  setOperationalSummary,
  syncTasksFromCycle,
} from '../modules/responsibility-tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../data');

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

async function readJsonFile(name, fallback) {
  try {
    const raw = await readFile(path.join(dataDir, name), 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseTs(t) {
  const x = t ? new Date(t).getTime() : NaN;
  return Number.isFinite(x) ? x : Date.now();
}

function nivelPresionDesdeAntiguedad(horas, gravedad) {
  let n = 1;
  if (gravedad === 'CRITICA') {
    if (horas >= 0.25) n = 2;
    if (horas >= 1) n = 3;
    if (horas >= 6) n = 4;
  } else if (gravedad === 'ALTA') {
    if (horas >= 1) n = 2;
    if (horas >= 4) n = 3;
    if (horas >= 12) n = 4;
  } else {
    if (horas >= 8) n = 2;
    if (horas >= 24) n = 3;
    if (horas >= 72) n = 4;
  }
  return n;
}

function textoTiempoObjetivo(gravedad) {
  if (gravedad === 'CRITICA') return 'Inmediata';
  if (gravedad === 'ALTA') return 'Dentro de 1 hora';
  return 'Dentro del día';
}

export async function runJarvisOperationalCycle() {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const ots = await otRepository.findAll();
  const openOts = ots.filter((o) => String(o?.estado || '') !== 'terminado');

  let otsSinEvidencia = 0;
  let riesgoEvidencia = 0;
  let riesgoOtAbierta = 0;
  const msDay = 86400000;

  for (const ot of openOts) {
    const gaps = getEvidenceGapsForOt(ot);
    if (gaps.length) {
      otsSinEvidencia += 1;
      const m = roundMoney(ot.montoCobrado) || roundMoney(ot.estimacionMonto) || roundMoney(ot.monto);
      riesgoEvidencia += m > 0 ? m : 0;
    }
    const age = now - parseTs(ot.updatedAt || ot.fechaVisita || ot.createdAt);
    if (age > 7 * msDay) {
      const m = roundMoney(ot.montoCobrado) || roundMoney(ot.estimacionMonto) || 0;
      riesgoOtAbierta += m;
    }
  }

  const outlook = await readJsonFile('outlook_feed.json', {});
  const wa = await readJsonFile('whatsapp_feed.json', {});
  const opps = await readJsonFile('commercial_opportunities.json', []);
  const calRaw = await readJsonFile('operational_calendar.json', []);
  const docs = await readJsonFile('technical_documents.json', []);

  const outlookN = Array.isArray(outlook?.messages) ? outlook.messages.length : 0;
  const waN = Array.isArray(wa?.messages) ? wa.messages.length : 0;
  const oppsN = Array.isArray(opps) ? opps.length : 0;
  const calN = Array.isArray(calRaw) ? calRaw.length : Array.isArray(calRaw?.entries) ? calRaw.entries.length : 0;
  const docsN = Array.isArray(docs) ? docs.length : 0;

  const tasks = [];
  const ts = new Date().toISOString();

  if (otsSinEvidencia > 0) {
    tasks.push({
      id: 'sea_ot_evidencia',
      tipo: 'OT · evidencias',
      descripcion: `Faltan evidencias en ${otsSinEvidencia} OT abiertas`,
      responsable: 'Romina',
      estado: 'pendiente',
      gravedad: 'CRITICA',
      impacto: 'Cierre detenido; cobro y trazabilidad en riesgo',
      tiempo_objetivo: textoTiempoObjetivo('CRITICA'),
      tiempoLimiteMs: now + 15 * 60 * 1000,
      nivel_presion: nivelPresionDesdeAntiguedad(0, 'CRITICA'),
      timestamp: ts,
    });
  }

  if (outlookN === 0) {
    tasks.push({
      id: 'sea_outlook',
      tipo: 'Correos',
      descripcion: 'No hay correos registrados en el sistema',
      responsable: 'Gery',
      estado: 'pendiente',
      gravedad: openOts.length ? 'ALTA' : 'NORMAL',
      impacto: 'Seguimiento comercial sin visibilidad desde bandeja',
      tiempo_objetivo: textoTiempoObjetivo(openOts.length ? 'ALTA' : 'NORMAL'),
      tiempoLimiteMs: now + (openOts.length ? 60 : 480) * 60 * 1000,
      nivel_presion: 1,
      timestamp: ts,
    });
  }

  if (waN === 0) {
    tasks.push({
      id: 'sea_whatsapp',
      tipo: 'WhatsApp',
      descripcion: 'No hay conversaciones WhatsApp registradas',
      responsable: 'Gery',
      estado: 'pendiente',
      gravedad: 'NORMAL',
      impacto: 'Mensajes de obra y clientes no centralizados',
      tiempo_objetivo: textoTiempoObjetivo('NORMAL'),
      tiempoLimiteMs: now + 8 * 3600000,
      nivel_presion: 1,
      timestamp: ts,
    });
  }

  if (oppsN === 0) {
    tasks.push({
      id: 'sea_oportunidades',
      tipo: 'Oportunidades comerciales',
      descripcion: 'No hay oportunidades comerciales ingresadas',
      responsable: 'Gery',
      estado: 'pendiente',
      gravedad: 'ALTA',
      impacto: 'Proyección de ventas sin base en el sistema',
      tiempo_objetivo: textoTiempoObjetivo('ALTA'),
      tiempoLimiteMs: now + 3600000,
      nivel_presion: 1,
      timestamp: ts,
    });
  }

  if (calN === 0) {
    tasks.push({
      id: 'sea_calendario',
      tipo: 'Planificación',
      descripcion: 'Calendario operativo sin entradas visibles',
      responsable: 'Gery',
      estado: 'pendiente',
      gravedad: 'ALTA',
      impacto: 'Visitas y choques de agenda sin control',
      tiempo_objetivo: textoTiempoObjetivo('ALTA'),
      tiempoLimiteMs: now + 3600000,
      nivel_presion: 1,
      timestamp: ts,
    });
  }

  if (docsN === 0 && openOts.length > 0) {
    tasks.push({
      id: 'sea_documentos',
      tipo: 'Documentos técnicos',
      descripcion: 'No hay documentos técnicos cargados',
      responsable: 'Lyn',
      estado: 'pendiente',
      gravedad: 'NORMAL',
      impacto: 'Aprobaciones y respaldo técnico limitados',
      tiempo_objetivo: textoTiempoObjetivo('NORMAL'),
      tiempoLimiteMs: now + 8 * 3600000,
      nivel_presion: 1,
      timestamp: ts,
    });
  }

  for (const t of tasks) {
    const created = new Date(t.timestamp).getTime();
    const horas = (now - created) / 3600000;
    t.nivel_presion = nivelPresionDesdeAntiguedad(horas, t.gravedad);
    if (t.nivel_presion >= 3) t.etiqueta_critico = true;
    if (t.nivel_presion >= 4) t.etiqueta_bloqueo = true;
  }

  syncTasksFromCycle(tasks);

  const riesgo_total = Math.round(riesgoEvidencia + riesgoOtAbierta);
  const recuperable_hoy = Math.round(
    openOts.reduce((s, o) => s + (getEvidenceGapsForOt(o).length === 0 ? roundMoney(o.montoCobrado) : 0), 0)
  );
  const fuga_estimada = Math.round(riesgoOtAbierta * 0.15);
  let prioridad = 'BAJA';
  if (riesgo_total > 500000) prioridad = 'CRITICA';
  else if (riesgo_total > 150000) prioridad = 'ALTA';
  else if (riesgo_total > 40000) prioridad = 'MEDIA';

  setCashSnapshot({
    riesgo_total,
    recuperable_hoy,
    fuga_estimada,
    prioridad,
  });

  const pend = tasks.length;
  setOperationalSummary(
    pend
      ? `${pend} tema(s) operativo(s) requieren acción · riesgo estimado $${riesgo_total.toLocaleString('es-CL')}`
      : 'Sin temas obligatorios detectados en este ciclo'
  );

  responsibilityStore.lastCycleAt = nowIso;
  responsibilityStore.nextCycleAt = new Date(now + 5 * 60 * 1000).toISOString();
}

let timer = null;

export function startJarvisOperationalCycleTimer() {
  if (timer) return;
  runJarvisOperationalCycle().catch((e) => console.error('[HNF ciclo operativo]', e.message));
  timer = setInterval(() => {
    runJarvisOperationalCycle().catch((e) => console.error('[HNF ciclo operativo]', e.message));
  }, 5 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}

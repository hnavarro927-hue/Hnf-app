import { jsPDF } from 'jspdf';
import { getPdfEquipoEvidenceBlock } from '../utils/ot-evidence.js';

const sanitizeSegment = (value, fallback) => {
  const base = String(value ?? fallback ?? '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 48);
  return base || fallback;
};

export const buildOtPdfFileName = (ot) => {
  const id = ot?.id || 'OT-000';
  const numero = id.replace(/^OT-/i, '');
  const cliente = sanitizeSegment(ot?.cliente, 'cliente');
  const fecha = sanitizeSegment(ot?.fecha, 'fecha');
  return `OT-${numero}-${cliente}-${fecha}.pdf`;
};

const readBlobAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export const blobToDataUrl = readBlobAsDataUrl;

const splitLines = (doc, text, maxWidth) => doc.splitTextToSize(String(text || '—'), maxWidth);

const detectImageFormat = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const head = dataUrl.slice(0, 48).toLowerCase();
  if (head.startsWith('data:image/png')) return 'PNG';
  if (head.startsWith('data:image/jpeg') || head.startsWith('data:image/jpg')) return 'JPEG';
  if (head.startsWith('data:image/webp')) return 'WEBP';
  if (head.startsWith('data:image/gif')) return 'GIF';
  return null;
};

const drawHeaderBar = (doc, margin, y, pageWidth) => {
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, 6, 16, 16, 'F');
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('HNF', margin + 3, 15);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('HNF Servicios Integrales', margin + 20, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Informe técnico · Orden de trabajo HVAC / Clima', margin + 20, 20);
  doc.setTextColor(0, 0, 0);
  return 36;
};

/** Solo data URLs de imagen base64 reales; descarta referencias rotas o no técnicas. */
const isValidTechnicalEvidenceDataUrl = (url) => {
  if (typeof url !== 'string') return false;
  const u = url.trim();
  if (!u.startsWith('data:image/')) return false;
  const comma = u.indexOf(',');
  if (comma < 12 || comma > 4096) return false;
  const head = u.slice(0, comma).toLowerCase();
  if (!head.includes(';base64')) return false;
  const b64 = u.slice(comma + 1).replace(/\s/g, '');
  return b64.length >= 32;
};

const filterPdfEvidenceItems = (items) => {
  const list = Array.isArray(items) ? items : [];
  return list.filter((item) => item && isValidTechnicalEvidenceDataUrl(item.url));
};

const sectionTitle = (doc, margin, y, title) => {
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, y, 196, y);
  y += 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216);
  doc.text(title, margin, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  return y + 6;
};

const appendParagraph = (doc, margin, y, label, body, maxW, bottom) => {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`${label}`, margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  const lines = splitLines(doc, body, maxW);
  for (const line of lines) {
    if (y > bottom) {
      doc.addPage();
      y = 22;
    }
    doc.text(line, margin, y);
    y += 4;
  }
  return y + 3;
};

const appendEvidencePhotos = (doc, margin, y, items, bottom, aliasPrefix = 'ev') => {
  const list = filterPdfEvidenceItems(items);
  doc.setFontSize(8);
  let imgIdx = 0;
  for (const item of list) {
    const fmt = detectImageFormat(item.url);
    if (!fmt) continue;
    try {
      if (y > bottom - 75) {
        doc.addPage();
        y = 22;
      }
      const safeId = String(item.id || imgIdx).replace(/[^\w-]/g, '').slice(0, 40);
      const alias = `${aliasPrefix}-${imgIdx}-${safeId}`;
      imgIdx += 1;
      doc.setFont('helvetica', 'italic');
      doc.text(item.name || 'Imagen', margin, y);
      y += 4;
      doc.addImage(item.url, fmt, margin, y, 85, 62, alias);
      y += 66;
      doc.setFont('helvetica', 'normal');
    } catch {
      doc.text(`(imagen no disponible: ${item.name || ''})`, margin, y);
      y += 5;
    }
  }
  if (
    !list.length &&
    Array.isArray(items) &&
    items.some((i) => typeof i?.url === 'string' && i.url.trim().length > 0)
  ) {
    if (y > bottom) {
      doc.addPage();
      y = 22;
    }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('(Hay referencias de imagen no válidas para PDF en este bloque — vuelva a cargar fotos)', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
  }
  return y;
};

export const generateOtPdfBlob = async (ot) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const bottom = 282;
  let y = drawHeaderBar(doc, margin, 0, pageW);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`OT ${ot.id || ''} · ${ot.fecha || ''} ${ot.hora || ''}`, margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const meta = [
    `Cliente: ${ot.cliente || '—'}`,
    `Ubicación: ${ot.direccion || '—'}, ${ot.comuna || '—'}`,
    `Contacto terreno: ${ot.contactoTerreno || '—'} · Tel: ${ot.telefonoContacto || '—'}`,
    `Servicio: ${ot.tipoServicio || '—'} / ${ot.subtipoServicio || '—'}`,
    `Técnico: ${ot.tecnicoAsignado || '—'} · Estado OT: ${ot.estado || '—'}`,
  ];
  for (const line of meta) {
    const lines = splitLines(doc, line, 182);
    for (const ln of lines) {
      if (y > bottom) {
        doc.addPage();
        y = 22;
      }
      doc.text(ln, margin, y);
      y += 5;
    }
  }

  y += 4;
  y = sectionTitle(doc, margin, y, 'Resumen general');
  y = appendParagraph(doc, margin, y, 'Observaciones generales', ot.observaciones || 'Sin observaciones.', 182, bottom);
  y = appendParagraph(doc, margin, y, 'Resumen del trabajo', ot.resumenTrabajo || 'Sin resumen.', 182, bottom);
  y = appendParagraph(doc, margin, y, 'Recomendaciones generales', ot.recomendaciones || 'Sin recomendaciones.', 182, bottom);

  const equipos = Array.isArray(ot.equipos) ? ot.equipos : [];

  if (equipos.length > 0) {
    equipos.forEach((eq, idx) => {
      if (y > bottom - 40) {
        doc.addPage();
        y = 22;
      }
      y += 4;
      y = sectionTitle(
        doc,
        margin,
        y,
        `Equipo ${idx + 1}: ${eq.nombreEquipo || 'Sin nombre'} · Estado: ${eq.estadoEquipo || '—'}`
      );

      y = appendParagraph(doc, margin, y, 'Observaciones del equipo', eq.observaciones || '—', 182, bottom);
      y = appendParagraph(doc, margin, y, 'Acciones realizadas', eq.accionesRealizadas || '—', 182, bottom);
      y = appendParagraph(doc, margin, y, 'Recomendaciones', eq.recomendaciones || '—', 182, bottom);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      if (y > bottom - 20) {
        doc.addPage();
        y = 22;
      }
      doc.text('Evidencias — Antes', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      y = appendEvidencePhotos(
        doc,
        margin,
        y,
        getPdfEquipoEvidenceBlock(eq, 'antes'),
        bottom,
        `${ot.id || 'OT'}-e${idx}-antes`
      );

      doc.setFont('helvetica', 'bold');
      if (y > bottom - 10) {
        doc.addPage();
        y = 22;
      }
      doc.text('Evidencias — Durante', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      y = appendEvidencePhotos(
        doc,
        margin,
        y,
        getPdfEquipoEvidenceBlock(eq, 'durante'),
        bottom,
        `${ot.id || 'OT'}-e${idx}-durante`
      );

      doc.setFont('helvetica', 'bold');
      if (y > bottom - 10) {
        doc.addPage();
        y = 22;
      }
      doc.text('Evidencias — Después', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      y = appendEvidencePhotos(
        doc,
        margin,
        y,
        getPdfEquipoEvidenceBlock(eq, 'despues'),
        bottom,
        `${ot.id || 'OT'}-e${idx}-despues`
      );
    });
  } else {
    y += 4;
    y = sectionTitle(doc, margin, y, 'Evidencias generales de la visita');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Antes', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    y = appendEvidencePhotos(doc, margin, y, ot.fotografiasAntes, bottom, `${ot.id || 'OT'}-visita-antes`);
    doc.setFont('helvetica', 'bold');
    doc.text('Durante', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    y = appendEvidencePhotos(doc, margin, y, ot.fotografiasDurante, bottom, `${ot.id || 'OT'}-visita-durante`);
    doc.setFont('helvetica', 'bold');
    doc.text('Después', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    appendEvidencePhotos(doc, margin, y, ot.fotografiasDespues, bottom, `${ot.id || 'OT'}-visita-despues`);
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`HNF Servicios Integrales · ${ot.id || ''} · Pág. ${p}/${pageCount}`, margin, 290);
    doc.setTextColor(0, 0, 0);
  }

  const fileName = buildOtPdfFileName(ot);
  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  return { blob, fileName };
};

const drawPlanificacionHeader = (doc, margin, pageWidth) => {
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, 6, 16, 16, 'F');
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('HNF', margin + 3, 15);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('HNF Servicios Integrales', margin + 20, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Calendario de mantenciones · Clima / HVAC', margin + 20, 19);
  doc.setTextColor(0, 0, 0);
  return 34;
};

export const buildClienteCalendarioFileName = (clienteNombre) => {
  const c = sanitizeSegment(clienteNombre, 'cliente');
  const d = sanitizeSegment(new Date().toISOString().slice(0, 10), 'fecha');
  return `Calendario-Mantenciones-${c}-${d}.pdf`;
};

/**
 * @param {object} params
 * @param {string} params.clienteNombre
 * @param {Array<{ tiendaNombre: string, direccion: string, comuna: string, fecha: string, horarioAM: string, horarioPM: string, tecnico: string, tipo: string, estado: string }>} params.rows
 */
export const generateClienteCalendarioPdfBlob = ({ clienteNombre, rows = [] }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const bottom = 282;
  let y = drawPlanificacionHeader(doc, margin, pageW);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Cliente: ${clienteNombre || '—'}`, margin, y);
  y += 7;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Registros incluidos: ${rows.length}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  const sorted = [...rows].sort((a, b) => {
    const ro = (Number(a.ordenRuta) || 999) - (Number(b.ordenRuta) || 999);
    if (ro !== 0) return ro;
    const co = String(a.comuna || '').localeCompare(String(b.comuna || ''));
    if (co !== 0) return co;
    const ti = String(a.tiendaNombre || '').localeCompare(String(b.tiendaNombre || ''));
    if (ti !== 0) return ti;
    return String(a.fecha || '').localeCompare(String(b.fecha || ''));
  });

  if (!sorted.length) {
    doc.setFont('helvetica', 'italic');
    doc.text('No hay mantenciones registradas para este cliente.', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
  }

  for (const r of sorted) {
    if (y > bottom - 28) {
      doc.addPage();
      y = 22;
    }
    doc.setDrawColor(210, 218, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(String(r.tiendaNombre || '—'), margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const ubiLines = splitLines(doc, `${r.direccion || '—'}, ${r.comuna || '—'}`, pageW - margin * 2);
    for (const line of ubiLines) {
      if (y > bottom - 8) {
        doc.addPage();
        y = 22;
      }
      doc.text(line, margin, y);
      y += 3.6;
    }
    if (y > bottom - 12) {
      doc.addPage();
      y = 22;
    }
    const ventana =
      r.horaInicio && r.horaFin ? `${r.horaInicio}–${r.horaFin}` : 'Jornada completa / sin franja';
    doc.text(
      `Fecha mantención: ${r.fecha || '—'}  ·  Ventana técnico: ${ventana}  ·  AM tienda: ${r.horarioAM || '—'}  ·  PM: ${r.horarioPM || '—'}`,
      margin,
      y
    );
    y += 4;
    doc.text(
      `Técnico: ${r.tecnico || '—'}  ·  Tipo: ${r.tipo || '—'}  ·  Estado: ${r.estado || '—'}  ·  Ruta: ${r.ordenRuta ?? '—'}`,
      margin,
      y
    );
    y += 7;
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`HNF · Planificación Clima · ${clienteNombre || ''} · Pág. ${p}/${pageCount}`, margin, 290);
    doc.setTextColor(0, 0, 0);
  }

  const fileName = buildClienteCalendarioFileName(clienteNombre);
  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  return { blob, fileName };
};

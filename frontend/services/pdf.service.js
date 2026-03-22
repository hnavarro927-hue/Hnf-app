import { jsPDF } from '../node_modules/jspdf/dist/jspdf.es.min.js';

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
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return null;
};

const appendLines = (doc, lines, x, yStart, lineHeight, pageBottom) => {
  let y = yStart;
  const pageHeight = pageBottom || 280;
  for (const line of lines) {
    if (y > pageHeight) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
};

const appendEvidenceBlock = (doc, title, items, yStart) => {
  let y = yStart;
  const margin = 14;
  const pageBottom = 275;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  y = appendLines(doc, [title], margin, y, 7, pageBottom);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return appendLines(doc, ['(Sin evidencias en este bloque)'], margin + 4, y, 6, pageBottom) + 4;
  }

  for (const item of list) {
    const nameLines = splitLines(doc, item.name || 'Sin nombre', 180);
    y = appendLines(doc, nameLines, margin + 4, y, 5, pageBottom);

    const fmt = detectImageFormat(item.url);
    if (fmt && item.url) {
      try {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }
        doc.addImage(item.url, fmt, margin + 4, y, 90, 68);
        y += 72;
      } catch {
        y = appendLines(doc, ['(No se pudo incrustar la imagen)'], margin + 4, y, 5, pageBottom);
      }
    }
    y += 2;
  }

  return y + 4;
};

export const generateOtPdfBlob = async (ot) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = 18;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('HNF Servicios Integrales', margin, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Informe OT ${ot.id || ''}`, margin, y);
  y += 8;

  const blocks = [
    ['Cliente', ot.cliente || '—'],
    ['Dirección', ot.direccion || '—'],
    ['Comuna', ot.comuna || '—'],
    ['Contacto en terreno', ot.contactoTerreno || '—'],
    ['Teléfono', ot.telefonoContacto || '—'],
    ['Tipo / subtipo', `${ot.tipoServicio || '—'} / ${ot.subtipoServicio || '—'}`],
    ['Técnico asignado', ot.tecnicoAsignado || '—'],
    ['Fecha y hora', `${ot.fecha || '—'} · ${ot.hora || '—'}`],
    ['Estado', ot.estado || '—'],
  ];

  doc.setFontSize(10);
  for (const [label, value] of blocks) {
    const lines = splitLines(doc, `${label}: ${value}`, 182);
    y = appendLines(doc, lines, margin, y, 5, 275);
  }

  y += 4;
  doc.setFont('helvetica', 'bold');
  y = appendLines(doc, ['Observaciones'], margin, y, 7, 275);
  doc.setFont('helvetica', 'normal');
  y = appendLines(doc, splitLines(doc, ot.observaciones || 'Sin observaciones.', 182), margin, y, 5, 275);

  doc.setFont('helvetica', 'bold');
  y = appendLines(doc, ['Resumen del trabajo'], margin, y, 7, 275);
  doc.setFont('helvetica', 'normal');
  y = appendLines(doc, splitLines(doc, ot.resumenTrabajo || 'Sin resumen.', 182), margin, y, 5, 275);

  doc.setFont('helvetica', 'bold');
  y = appendLines(doc, ['Recomendaciones'], margin, y, 7, 275);
  doc.setFont('helvetica', 'normal');
  y = appendLines(doc, splitLines(doc, ot.recomendaciones || 'Sin recomendaciones.', 182), margin, y, 5, 275);

  y += 2;
  y = appendEvidenceBlock(doc, 'Evidencias antes', ot.fotografiasAntes, y);
  y = appendEvidenceBlock(doc, 'Evidencias durante', ot.fotografiasDurante, y);
  appendEvidenceBlock(doc, 'Evidencias después', ot.fotografiasDespues, y);

  const fileName = buildOtPdfFileName(ot);
  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  return { blob, fileName };
};

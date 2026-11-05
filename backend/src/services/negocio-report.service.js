import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { pdfSafe } from './report-pdf.service.js';

/*
 * Reporte del mes de un negocio para el contador (FT-0018), en Excel o PDF, con los colores de
 * FinTrack. Lleva el estado de resultados, el punto de equilibrio, el reparto entre socios y la
 * lista de movimientos con quién registró cada uno.
 */

const KIND_LABEL = {
  sale: 'Venta',
  otherIncome: 'Otro ingreso',
  cost: 'Costo de venta',
  fixed: 'Gasto fijo',
  variable: 'Gasto variable',
  withdrawal: 'Retiro de socio',
};
const INCOME = new Set(['sale', 'otherIncome']);
const CATEGORY_LABEL = {
  ventas: 'Ventas',
  insumos: 'Insumos',
  arriendo: 'Arriendo',
  nomina: 'Nómina',
  servicios: 'Servicios',
  publicidad: 'Publicidad',
  transporte: 'Transporte',
  impuestos: 'Impuestos',
  otros: 'Otros',
  retiros: 'Retiros',
};
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const moneyFormat = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
const money = (n) => moneyFormat.format(n);
const pct = (n) => `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`;

/**
 * @param {string} month AAAA-MM.
 * @returns {string} p. ej. `noviembre de 2026`.
 */
export function monthTitle(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/**
 * Nombre del archivo: `negocio-arepas-dona-rosa-2026-11.xlsx`.
 * @param {string} name
 * @param {string} month
 * @param {'xlsx'|'pdf'} extension
 * @returns {string}
 */
export function reportFilename(name, month, extension) {
  const slug =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'negocio';
  return `negocio-${slug}-${month}.${extension}`;
}

/**
 * Filas del estado de resultados: [etiqueta, valor, ¿es total?].
 * @param {object} panel
 * @returns {Array<[string, number, boolean]>}
 */
export function resultLines(panel) {
  const lines = [
    ['Ventas', panel.sale, false],
    ['Costo de venta', -panel.cost, false],
    ['Utilidad bruta', panel.grossProfit, true],
    ['Gastos variables', -panel.variable, false],
    ['Gastos fijos', -panel.fixed, false],
  ];
  if (panel.otherIncome > 0) lines.push(['Otros ingresos', panel.otherIncome, false]);
  lines.push(['Utilidad neta', panel.netProfit, true]);
  if (panel.withdrawal > 0) {
    lines.push(['Retiros de socios', -panel.withdrawal, false]);
    lines.push(['Quedó en el negocio', panel.retained, true]);
  }
  return lines;
}

/**
 * @param {{ registeredBy: { name: string|null }|null }} m
 * @returns {string}
 */
const who = (m) => (m.registeredBy ? m.registeredBy.name || 'Un socio' : 'Exsocio');
const signed = (m) => (INCOME.has(m.kind) ? m.amount : -m.amount);

/* ---------- Excel ---------- */

const XL = {
  brand: 'FF6142FF',
  brandSoft: 'FFECE8FF',
  muted: 'FF6B6880',
  line: 'FFE4E2EE',
  white: 'FFFFFFFF',
  positive: 'FF087A59',
  negative: 'FFC8321F',
};
const MONEY_FMT = '"$" #,##0;[Red]-"$" #,##0';

/**
 * Arma el Excel del mes del negocio.
 * @param {{ business: { name: string, nit: string|null }, month: string, movements: object[], panel: object, distribution: object }} report
 * @returns {Promise<Buffer>}
 */
export async function buildBusinessWorkbook(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FinTrack';
  wb.created = new Date();
  const { business, panel } = report;

  const sheet = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  sheet.columns = [{ width: 34 }, { width: 20 }, { width: 18 }, { width: 18 }];
  const title = sheet.addRow([business.name]);
  title.font = { bold: true, size: 16, color: { argb: XL.brand } };
  sheet.addRow([
    `Reporte de ${monthTitle(report.month)}${business.nit ? ` · NIT ${business.nit}` : ''}`,
  ]).font = { color: { argb: XL.muted } };
  sheet.addRow([]);

  const header = (text) => {
    const row = sheet.addRow([text]);
    row.font = { bold: true, color: { argb: XL.white } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } };
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } };
  };

  header('Estado de resultados');
  for (const [label, value, total] of resultLines(panel)) {
    const row = sheet.addRow([label, value]);
    row.getCell(2).numFmt = MONEY_FMT;
    if (total) {
      row.font = { bold: true };
      row.getCell(1).border = { top: { style: 'thin', color: { argb: XL.line } } };
      row.getCell(2).border = { top: { style: 'thin', color: { argb: XL.line } } };
    }
  }
  if (panel.netMargin !== null) sheet.addRow(['Margen neto', pct(panel.netMargin)]);
  sheet.addRow([]);

  header('Punto de equilibrio');
  if (panel.breakEven === null) {
    sheet.addRow([
      panel.fixed === 0
        ? 'Sin gastos fijos registrados en el mes'
        : 'Con estos costos, vender no cubre los gastos fijos',
    ]);
  } else {
    const row = sheet.addRow(['Ventas necesarias para no perder', panel.breakEven]);
    row.getCell(2).numFmt = MONEY_FMT;
    sheet.addRow(['Margen de contribución', pct(panel.contributionMargin)]);
    sheet.addRow(['¿Se alcanzó?', panel.breakEvenReached ? 'Sí' : 'No']);
  }

  if (report.distribution.items.length > 0) {
    sheet.addRow([]);
    header('Reparto de utilidades');
    const cols = sheet.addRow(['Socio', 'Participación', 'Le toca', 'Ya retiró']);
    cols.font = { bold: true, color: { argb: XL.muted } };
    for (const item of report.distribution.items) {
      const row = sheet.addRow([item.name || 'Socio', pct(item.share), item.due, item.withdrawn]);
      row.getCell(3).numFmt = MONEY_FMT;
      row.getCell(4).numFmt = MONEY_FMT;
    }
  }

  const list = wb.addWorksheet('Movimientos', { views: [{ state: 'frozen', ySplit: 1 }] });
  list.columns = [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Tipo', key: 'kind', width: 16 },
    { header: 'Categoría', key: 'category', width: 14 },
    { header: 'Descripción', key: 'description', width: 40 },
    { header: 'Monto', key: 'amount', width: 16 },
    { header: 'Lo registró', key: 'who', width: 20 },
  ];
  const head = list.getRow(1);
  head.font = { bold: true, color: { argb: XL.white } };
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } };
  });
  for (const m of [...report.movements].reverse()) {
    const row = list.addRow({
      date: m.date,
      kind: KIND_LABEL[m.kind],
      category: CATEGORY_LABEL[m.category] ?? m.category,
      description: m.description,
      amount: signed(m),
      who: who(m),
    });
    row.getCell('amount').numFmt = MONEY_FMT;
  }
  list.autoFilter = { from: 'A1', to: 'F1' };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------- PDF ---------- */

const PAGE = { width: 612, height: 792 };
const MARGIN = 40;
const CONTENT = PAGE.width - MARGIN * 2;
const BOTTOM = PAGE.height - 50;
const C = {
  brand: '#6142ff',
  brandSoft: '#ece8ff',
  ink: '#16141f',
  muted: '#6b6880',
  line: '#e4e2ee',
  track: '#efedf6',
  positive: '#087a59',
  negative: '#c8321f',
};

/**
 * Arma el PDF del mes del negocio.
 * @param {{ business: { name: string, nit: string|null }, month: string, movements: object[], panel: object, distribution: object }} report
 * @returns {Promise<Buffer>}
 */
export function buildBusinessPdf(report) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 0,
    bufferPages: true,
    info: { Title: `Reporte de ${pdfSafe(report.business.name)}`, Author: 'FinTrack' },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const { panel } = report;

  // Encabezado
  doc.rect(0, 0, PAGE.width, 90).fill(C.brand);
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#ffffff')
    .text(pdfSafe(report.business.name), MARGIN, 28, { width: CONTENT });
  doc
    .font('Helvetica')
    .fontSize(11)
    .text(
      `Reporte de ${monthTitle(report.month)}${report.business.nit ? ` · NIT ${pdfSafe(report.business.nit)}` : ''}`,
      MARGIN,
      56,
    );
  let y = 115;

  const heading = (text) => {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.ink).text(text, MARGIN, y);
    y += 22;
  };
  const line = (label, value, { bold = false, color = C.ink } = {}) => {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(10.5)
      .fillColor(bold ? C.ink : C.muted)
      .text(label, MARGIN, y, { width: 300 });
    doc.fillColor(color).text(value, MARGIN + 300, y, { width: CONTENT - 300, align: 'right' });
    y += 18;
  };

  heading('Estado de resultados');
  for (const [label, value, total] of resultLines(panel)) {
    if (total) {
      doc
        .moveTo(MARGIN, y - 3)
        .lineTo(MARGIN + CONTENT, y - 3)
        .lineWidth(0.6)
        .strokeColor(C.line)
        .stroke();
    }
    const color = total ? (value < 0 ? C.negative : value > 0 ? C.positive : C.ink) : C.ink;
    line(label, money(value), { bold: total, color });
  }
  if (panel.netMargin !== null) line('Margen neto', pct(panel.netMargin));
  y += 10;

  heading('Punto de equilibrio');
  if (panel.breakEven === null) {
    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor(C.muted)
      .text(
        panel.fixed === 0
          ? 'No hay gastos fijos registrados en el mes.'
          : 'Con estos costos, vender no alcanza a cubrir los gastos fijos.',
        MARGIN,
        y,
      );
    y += 20;
  } else {
    line('Ventas necesarias para no perder', money(panel.breakEven), { bold: true });
    const progress = Math.min(1, panel.sale / panel.breakEven);
    doc.roundedRect(MARGIN, y, CONTENT, 8, 4).fill(C.track);
    doc
      .roundedRect(MARGIN, y, Math.max(8, CONTENT * progress), 8, 4)
      .fill(panel.breakEvenReached ? C.positive : C.brand);
    y += 16;
    line(
      panel.breakEvenReached ? 'Ya se alcanzó' : 'Avance',
      `${Math.round(progress * 100)} % · margen de contribución ${pct(panel.contributionMargin)}`,
    );
  }
  y += 10;

  if (report.distribution.items.length > 0) {
    heading('Reparto de utilidades');
    for (const item of report.distribution.items) {
      line(
        `${pdfSafe(item.name || 'Socio')} (${item.share} %)`,
        `Le toca ${money(item.due)} · ya retiró ${money(item.withdrawn)}`,
      );
    }
    y += 10;
  }

  // Movimientos
  const columns = [
    { label: 'Fecha', width: 62 },
    { label: 'Tipo', width: 90 },
    { label: 'Descripción', width: 200 },
    { label: 'Lo registró', width: 90 },
    { label: 'Monto', width: CONTENT - 442, align: 'right' },
  ];
  const tableHeader = () => {
    doc.rect(MARGIN, y, CONTENT, 20).fill(C.brandSoft);
    let x = MARGIN + 6;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.brand);
    for (const col of columns) {
      doc.text(col.label, x, y + 6, { width: col.width - 8, align: col.align ?? 'left' });
      x += col.width;
    }
    y += 24;
  };
  if (y + 60 > BOTTOM) {
    doc.addPage();
    y = 40;
  }
  heading(`Movimientos (${report.movements.length})`);
  tableHeader();
  for (const m of [...report.movements].reverse()) {
    if (y + 18 > BOTTOM) {
      doc.addPage();
      y = 40;
      tableHeader();
    }
    const amount = signed(m);
    const cells = [
      m.date,
      KIND_LABEL[m.kind],
      pdfSafe(m.description),
      pdfSafe(who(m)),
      `${amount < 0 ? '-' : '+'}${money(Math.abs(amount))}`,
    ];
    let x = MARGIN + 6;
    doc.font('Helvetica').fontSize(9);
    cells.forEach((text, i) => {
      const col = columns[i];
      doc.fillColor(i === 4 ? (amount < 0 ? C.ink : C.positive) : C.ink).text(text, x, y, {
        width: col.width - 8,
        align: col.align ?? 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += col.width;
    });
    y += 18;
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(C.muted)
      .text(`FinTrack · Página ${i + 1} de ${range.count}`, MARGIN, PAGE.height - 30, {
        width: CONTENT,
        align: 'center',
        lineBreak: false,
      });
  }
  doc.end();
  return done;
}

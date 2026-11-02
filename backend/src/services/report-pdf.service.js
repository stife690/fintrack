import PDFDocument from 'pdfkit';

/** @typedef {InstanceType<typeof PDFDocument>} PdfDoc Documento de pdfkit. */

/*
 * Reporte en PDF del periodo, con el diseño de FinTrack (FT-0012).
 *
 * Página 1: encabezado, indicadores, gráficos (gastos por categoría y evolución), top 5 de gastos y
 * presupuestos del mes. Páginas siguientes: la tabla de movimientos. Todo se dibuja como vectores
 * con pdfkit: nítido al ampliar o imprimir y liviano. Las cifras vienen de buildReport, las mismas
 * del Excel.
 */

const PAGE = { width: 612, height: 792 }; // Carta, en puntos (1/72 de pulgada)
const MARGIN = 40;
const CONTENT = PAGE.width - MARGIN * 2;
const FOOTER_Y = PAGE.height - 34;
const BOTTOM = FOOTER_Y - 16; // Hasta dónde puede llegar el contenido antes de saltar de página

const C = {
  brand: '#6142ff',
  brandStrong: '#5b3df5',
  brandSoft: '#ece8ff',
  ink: '#16141f',
  muted: '#6b6880',
  canvas: '#f5f4f9',
  track: '#efedf6',
  line: '#e4e2ee',
  white: '#ffffff',
  positive: '#087a59',
  negative: '#c8321f',
  caution: '#9a5b00',
};

/** Color de cada categoría, el mismo que usa la app (lib/categoryStyles.js del frontend). */
const CATEGORY_COLORS = {
  Alimentación: '#f97316',
  Transporte: '#0ea5e9',
  Vivienda: '#f59e0b',
  'Servicios públicos': '#ca8a04',
  Salud: '#f43f5e',
  Educación: '#14b8a6',
  Entretenimiento: '#d946ef',
  'Ropa y accesorios': '#ec4899',
  Tecnología: '#6366f1',
  'Ahorro/Inversión': '#10b981',
  Otros: '#64748b',
  Salario: '#10b981',
  Freelance: '#06b6d4',
  'Inversión y rendimientos': '#65a30d',
  'Otros ingresos': '#22c55e',
};

const LEVEL = {
  none: { label: 'Bien', color: C.positive },
  warning_80: { label: 'Cerca del límite', color: C.caution },
  at_limit: { label: 'En el límite', color: C.caution },
  exceeded_100: { label: 'Excedido', color: C.negative },
};

const FONT = 'Helvetica';
const BOLD = 'Helvetica-Bold';
const MAX_CATEGORIES = 6;
const WARNING_AT = 0.8;

const moneyFormat = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 1 });

/**
 * @param {number} n
 * @returns {string} Pesos sin decimales, p. ej. `$ 18.000`.
 */
const money = (n) => moneyFormat.format(n);

/**
 * @param {number} n Proporción (0.445 = 44,5 %).
 * @returns {string}
 */
const percent = (n) => percentFormat.format(n);

/**
 * @param {string} iso AAAA-MM-DD
 * @param {Intl.DateTimeFormatOptions} options
 * @returns {string} Fecha en español sin pasar por la zona horaria del servidor.
 */
const dateText = (iso, options) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', { ...options, timeZone: 'UTC' });
};
const longDate = (iso) => dateText(iso, { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (iso) => dateText(iso, { day: 'numeric', month: 'short' });

/**
 * @param {string} month AAAA-MM
 * @returns {string} `oct 2026`.
 */
const shortMonth = (month) => dateText(`${month}-01`, { month: 'short', year: 'numeric' });

/** Caracteres fuera de Latin-1 que la fuente Helvetica del PDF sí sabe dibujar (WinAnsi). */
const EXTRA_GLYPHS = new Set('…–—‘’“”•€·'.split(''));

/**
 * Quita lo que Helvetica no puede dibujar (emojis, otros alfabetos, caracteres dañados): sin esto
 * aparecerían símbolos raros en el PDF. Tildes, ñ, ¿ y ¡ se conservan.
 * @param {string} text
 * @returns {string}
 */
export function pdfSafe(text) {
  return [...String(text)]
    .filter((ch) => {
      const code = ch.codePointAt(0);
      return (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || EXTRA_GLYPHS.has(ch);
    })
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Recorta un texto para que quepa en un ancho, terminando en "…".
 * @param {PdfDoc} doc
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
function fit(doc, text, width) {
  if (doc.widthOfString(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.widthOfString(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * Escribe texto en una posición fija, sin saltos de línea automáticos.
 * @param {PdfDoc} doc
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {{ size?: number, font?: string, color?: string, width?: number, align?: 'left'|'right'|'center' }} [o]
 * @returns {void}
 */
function write(doc, text, x, y, { size = 9, font = FONT, color = C.ink, width, align = 'left' } = {}) {
  doc.font(font).fontSize(size).fillColor(color);
  const clean = pdfSafe(text);
  const shown = width ? fit(doc, clean, width) : clean;
  doc.text(shown, x, y, { lineBreak: false, ...(width && { width, align }) });
}

/**
 * Título de sección: texto violeta en negrita con una línea debajo.
 * @param {PdfDoc} doc
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @returns {number} La posición y donde empieza el contenido de la sección.
 */
function sectionTitle(doc, text, x, y, width) {
  write(doc, text, x, y, { size: 11, font: BOLD, color: C.brand });
  doc.moveTo(x, y + 15).lineTo(x + width, y + 15).lineWidth(1.2).strokeColor(C.brand).stroke();
  return y + 24;
}

/**
 * Encabezado violeta de la primera página.
 * @param {PdfDoc} doc
 * @param {object} report
 * @returns {number} y siguiente.
 */
function drawHeader(doc, report) {
  doc.rect(0, 0, PAGE.width, 84).fill(C.brand);
  write(doc, 'FinTrack', MARGIN, 24, { size: 20, font: BOLD, color: C.white });
  write(doc, 'Reporte de movimientos', MARGIN, 30, { size: 11, color: C.white, width: CONTENT, align: 'right' });
  const who = report.owner.name || report.owner.email;
  const period = `Del ${longDate(report.period.from)} al ${longDate(report.period.to)}`;
  write(doc, `${who} · ${period} · Generado el ${longDate(report.generatedOn)}`, MARGIN, 56, {
    size: 9.5,
    color: C.brandSoft,
    width: CONTENT,
  });
  return 104;
}

/**
 * Las 4 tarjetas de indicadores y la línea de promedio diario.
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} y
 * @returns {number} y siguiente.
 */
function drawKpis(doc, report, y) {
  const t = report.totals;
  const cards = [
    { label: 'Ingresos', value: money(t.income), color: C.positive },
    { label: 'Gastos', value: money(t.expense), color: C.negative },
    { label: 'Balance', value: money(t.balance), color: t.balance < 0 ? C.negative : C.ink },
    { label: 'Tasa de ahorro', value: t.savingsRate === null ? '—' : percent(t.savingsRate), color: C.brandStrong, soft: true },
  ];
  const gap = 10;
  const width = (CONTENT - gap * 3) / 4;
  cards.forEach((card, i) => {
    const x = MARGIN + i * (width + gap);
    doc.roundedRect(x, y, width, 52, 6).fill(card.soft ? C.brandSoft : C.canvas);
    write(doc, card.label, x + 10, y + 10, { size: 8.5, color: C.muted });
    write(doc, card.value, x + 10, y + 25, { size: 14, font: BOLD, color: card.color, width: width - 20 });
  });
  const days = `${t.daysElapsed} ${t.daysElapsed === 1 ? 'día' : 'días'}`;
  const count = `${t.count} ${t.count === 1 ? 'movimiento' : 'movimientos'}`;
  write(doc, `Gasto promedio diario: ${money(t.dailyAverageExpense)} · ${count} en ${days}`, MARGIN, y + 62, {
    size: 9,
    color: C.muted,
  });
  return y + 86;
}

/**
 * Barras horizontales de gastos por categoría (las 6 mayores; el resto se suma en "Otras").
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @returns {number} y donde termina.
 */
function drawCategoryBars(doc, report, x, y, width) {
  let top = sectionTitle(doc, 'Gastos por categoría', x, y, width);
  const groups = [...report.expenseByCategory];
  if (groups.length > MAX_CATEGORIES) {
    const rest = groups.splice(MAX_CATEGORIES - 1);
    groups.push({
      name: `Otras (${rest.length})`,
      amount: rest.reduce((s, g) => s + g.amount, 0),
      share: rest.reduce((s, g) => s + g.share, 0),
    });
  }
  if (groups.length === 0) {
    write(doc, 'Sin gastos en el periodo.', x, top, { color: C.muted });
    return top + 16;
  }
  const labelWidth = 84;
  const valueWidth = 92;
  const barMax = width - labelWidth - valueWidth - 8;
  const max = Math.max(...groups.map((g) => g.amount));
  for (const g of groups) {
    write(doc, g.name, x, top, { width: labelWidth - 6 });
    const barWidth = max > 0 ? Math.max(2, (g.amount / max) * barMax) : 2;
    doc.roundedRect(x + labelWidth, top + 1, barWidth, 9, 2).fill(CATEGORY_COLORS[g.name] ?? C.brand);
    write(doc, `${money(g.amount)} · ${percent(g.share)}`, x + width - valueWidth, top, {
      size: 8.5,
      color: C.muted,
      width: valueWidth,
      align: 'right',
    });
    top += 18;
  }
  return top;
}

/**
 * Evolución: gasto por día si el periodo es de un mes o menos; ingresos vs gastos por mes si abarca
 * varios meses.
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @returns {number} y donde termina.
 */
function drawEvolution(doc, report, x, y, width) {
  const monthly = report.byMonth.length > 1;
  const top = sectionTitle(doc, monthly ? 'Ingresos y gastos por mes' : 'Gasto por día', x, y, width);
  const height = 96;
  const base = top + height;

  let bars;
  if (monthly) {
    bars = report.byMonth.map((m) => ({ label: shortMonth(m.month), values: [m.income, m.expense] }));
  } else {
    const perDay = new Map();
    for (const row of report.rows) if (row.type === 'gasto') perDay.set(row.date, (perDay.get(row.date) ?? 0) + row.amount);
    bars = [];
    const [y0, m0, d0] = report.period.from.split('-').map(Number);
    for (let day = new Date(Date.UTC(y0, m0 - 1, d0)); day.toISOString().slice(0, 10) <= report.period.to; day.setUTCDate(day.getUTCDate() + 1)) {
      const iso = day.toISOString().slice(0, 10);
      bars.push({ label: iso, values: [perDay.get(iso) ?? 0] });
    }
  }

  const max = Math.max(1, ...bars.flatMap((b) => b.values));
  const slot = width / bars.length;
  const colors = monthly ? [C.positive, C.negative] : [C.negative];
  const barWidth = Math.max(1, (slot * 0.7) / colors.length);
  bars.forEach((bar, i) => {
    bar.values.forEach((value, j) => {
      if (value <= 0) return;
      const h = Math.max(1.5, (value / max) * height);
      doc.rect(x + i * slot + slot * 0.15 + j * barWidth, base - h, barWidth, h).fill(colors[j]);
    });
  });
  doc.moveTo(x, base).lineTo(x + width, base).lineWidth(0.5).strokeColor(C.line).stroke();

  if (monthly) {
    bars.forEach((bar, i) => write(doc, bar.label, x + i * slot, base + 4, { size: 7.5, color: C.muted, width: slot, align: 'center' }));
    const legendY = base + 18;
    doc.rect(x, legendY + 1, 7, 7).fill(C.positive);
    write(doc, 'Ingresos', x + 10, legendY, { size: 8, color: C.muted });
    doc.rect(x + 60, legendY + 1, 7, 7).fill(C.negative);
    write(doc, 'Gastos', x + 70, legendY, { size: 8, color: C.muted });
    return legendY + 16;
  }
  write(doc, shortDate(bars[0].label), x, base + 4, { size: 7.5, color: C.muted });
  write(doc, shortDate(bars.at(-1).label), x, base + 4, { size: 7.5, color: C.muted, width, align: 'right' });
  write(doc, `Día de mayor gasto: ${money(max === 1 ? 0 : max)}`, x, base + 16, { size: 8, color: C.muted, width, align: 'center' });
  return base + 30;
}

/**
 * Tabla del top 5 de gastos.
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} y
 * @returns {number} y siguiente.
 */
function drawTopExpenses(doc, report, y) {
  if (report.topExpenses.length === 0) return y;
  let top = sectionTitle(doc, `Top ${report.topExpenses.length} gastos más grandes`, MARGIN, y, CONTENT);
  report.topExpenses.forEach((e, i) => {
    if (i % 2 === 0) doc.rect(MARGIN, top - 3, CONTENT, 16).fill(C.canvas);
    write(doc, `${i + 1}. ${e.description}`, MARGIN + 6, top, { width: 250 });
    write(doc, e.categoryName ?? 'Sin clasificar', MARGIN + 262, top, { color: C.muted, width: 110 });
    write(doc, shortDate(e.date), MARGIN + 378, top, { color: C.muted, width: 60 });
    write(doc, money(e.amount), MARGIN + CONTENT - 96, top, { font: BOLD, color: C.negative, width: 90, align: 'right' });
    top += 16;
  });
  return top + 12;
}

/**
 * Barras de progreso de los presupuestos del mes, con la marca fija del 80 % (RN-04).
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} y
 * @returns {number} y siguiente.
 */
function drawBudgets(doc, report, y) {
  if (report.budgets.length === 0) return y;
  const month = dateText(report.period.from, { month: 'long' });
  let top = sectionTitle(doc, `Presupuestos de ${month}`, MARGIN, y, CONTENT);
  const barX = MARGIN + 110;
  const barWidth = 220;
  for (const b of report.budgets) {
    const level = LEVEL[b.level] ?? LEVEL.none;
    write(doc, b.category, MARGIN, top, { width: 104 });
    doc.roundedRect(barX, top + 1, barWidth, 8, 4).fill(C.track);
    doc.roundedRect(barX, top + 1, Math.max(4, Math.min(b.usage, 1) * barWidth), 8, 4).fill(level.color);
    const mark = barX + barWidth * WARNING_AT;
    doc.moveTo(mark, top - 2).lineTo(mark, top + 12).lineWidth(1.2).strokeColor(C.ink).stroke();
    write(doc, `${percent(b.usage)} · ${level.label}`, barX + barWidth + 10, top, { font: BOLD, color: level.color, width: 110 });
    write(doc, `${money(b.spent)} de ${money(b.limit)}`, MARGIN + CONTENT - 92, top, { color: C.muted, width: 92, align: 'right' });
    top += 20;
  }
  write(doc, 'La línea vertical marca el 80 % del límite.', MARGIN, top, { size: 7.5, color: C.muted });
  return top + 20;
}

const COLUMNS = [
  { label: 'Fecha', width: 62 },
  { label: 'Descripción', width: 186 },
  { label: 'Categoría', width: 104 },
  { label: 'Ingreso', width: 90, align: 'right' },
  { label: 'Gasto', width: 90, align: 'right' },
];

/**
 * Encabezado de la tabla de movimientos (se repite en cada página).
 * @param {PdfDoc} doc
 * @param {number} y
 * @returns {number} y de la primera fila.
 */
function tableHeader(doc, y) {
  doc.rect(MARGIN, y, CONTENT, 20).fill(C.brand);
  let x = MARGIN + 6;
  for (const col of COLUMNS) {
    write(doc, col.label, x, y + 6, { font: BOLD, color: C.white, width: col.width - 8, align: col.align });
    x += col.width;
  }
  return y + 24;
}

/**
 * Tabla completa de movimientos en las páginas siguientes, con totales al final.
 * @param {PdfDoc} doc
 * @param {object} report
 * @returns {void}
 */
function drawMovements(doc, report) {
  doc.addPage();
  let y = sectionTitle(doc, `Movimientos (${report.rows.length})`, MARGIN, 40, CONTENT);
  y = tableHeader(doc, y);
  report.rows.forEach((row, i) => {
    if (y > BOTTOM - 16) {
      doc.addPage();
      y = tableHeader(doc, 40);
    }
    if (i % 2 === 1) doc.rect(MARGIN, y - 4, CONTENT, 16).fill(C.canvas);
    const income = row.type === 'ingreso';
    const cells = [
      shortDate(row.date),
      row.description,
      row.categoryName ?? 'Sin clasificar',
      income ? money(row.amount) : '',
      income ? '' : money(row.amount),
    ];
    let x = MARGIN + 6;
    cells.forEach((text, j) => {
      const col = COLUMNS[j];
      const color = j === 3 ? C.positive : j === 4 ? C.negative : j === 0 || j === 2 ? C.muted : C.ink;
      write(doc, text, x, y, { color, width: col.width - 8, align: col.align });
      x += col.width;
    });
    y += 16;
  });

  if (y > BOTTOM - 24) {
    doc.addPage();
    y = 40;
  }
  doc.rect(MARGIN, y - 2, CONTENT, 20).fill(C.brandSoft);
  const incomeX = MARGIN + 6 + COLUMNS.slice(0, 3).reduce((s, c) => s + c.width, 0);
  write(doc, 'Total', MARGIN + 6, y + 4, { font: BOLD });
  write(doc, money(report.totals.income), incomeX, y + 4, { font: BOLD, color: C.positive, width: COLUMNS[3].width - 8, align: 'right' });
  write(doc, money(report.totals.expense), incomeX + COLUMNS[3].width, y + 4, {
    font: BOLD,
    color: C.negative,
    width: COLUMNS[4].width - 8,
    align: 'right',
  });
}

/**
 * Pie de página en todas las páginas: nombre del reporte y "Página X de Y".
 * @param {PdfDoc} doc
 * @returns {void}
 */
function drawFooters(doc) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i += 1) {
    doc.switchToPage(i);
    doc.moveTo(MARGIN, FOOTER_Y - 6).lineTo(PAGE.width - MARGIN, FOOTER_Y - 6).lineWidth(0.5).strokeColor(C.line).stroke();
    write(doc, 'FinTrack · Reporte de movimientos', MARGIN, FOOTER_Y, { size: 8, color: C.muted });
    write(doc, `Página ${i - start + 1} de ${count}`, MARGIN, FOOTER_Y, { size: 8, color: C.muted, width: CONTENT, align: 'right' });
  }
}

/**
 * Arma el PDF del reporte.
 * @param {Awaited<ReturnType<typeof import('./report-data.service.js').buildReport>>} report
 * @returns {Promise<Buffer>} Contenido del archivo .pdf.
 */
export function buildPdf(report) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 0, // Las posiciones se manejan a mano; sin margen pdfkit no agrega páginas por su cuenta.
    bufferPages: true, // Necesario para escribir "Página X de Y" al final.
    info: { Title: 'Reporte de movimientos', Author: 'FinTrack', Creator: 'FinTrack' },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  let y = drawHeader(doc, report);
  y = drawKpis(doc, report, y);
  const leftWidth = 300;
  const gap = 24;
  const afterBars = drawCategoryBars(doc, report, MARGIN, y, leftWidth);
  const afterChart = drawEvolution(doc, report, MARGIN + leftWidth + gap, y, CONTENT - leftWidth - gap);
  y = Math.max(afterBars, afterChart) + 8;

  // Si el top 5 y los presupuestos no caben, pasan a una página propia.
  const needed = (report.topExpenses.length ? 50 + report.topExpenses.length * 16 : 0) + (report.budgets.length ? 60 + report.budgets.length * 20 : 0);
  if (y + needed > BOTTOM) {
    doc.addPage();
    y = 40;
  }
  y = drawTopExpenses(doc, report, y);
  drawBudgets(doc, report, y);

  drawMovements(doc, report);
  drawFooters(doc);
  doc.end();
  return done;
}

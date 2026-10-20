import ExcelJS from 'exceljs';

/*
 * Reporte en Excel (.xlsx) del periodo, con el diseño de FinTrack (FT-0012).
 *
 * Hojas:
 * - "Resumen": totales, gastos e ingresos por categoría, top 5 de gastos y presupuestos del mes.
 * - "Movimientos": una fila por movimiento, con filtros y totales que respetan el filtro.
 * - "Por mes": solo si el periodo abarca varios meses.
 *
 * Las cifras del Resumen son fórmulas que leen la hoja Movimientos: si alguien corrige un monto en
 * Excel, todo se recalcula. Cada fórmula lleva además su resultado ya calculado, para que se vea
 * bien en visores que no recalculan (vista previa del celular, Google Drive).
 */

const COLORS = {
  brand: 'FF6142FF',
  brandSoft: 'FFECE8FF',
  ink: 'FF16141F',
  muted: 'FF6B6880',
  canvas: 'FFF5F4F9',
  line: 'FFE4E2EE',
  white: 'FFFFFFFF',
  positive: 'FF087A59',
  negative: 'FFC8321F',
  caution: 'FF9A5B00',
  positiveSoft: 'FFE3F5EE',
  negativeSoft: 'FFFBE6E3',
  cautionSoft: 'FFFDF1DC',
};

const MONEY = '"$" #,##0;[Red]-"$" #,##0';
const PERCENT = '0.0%';
const DATE = 'dd/mm/yyyy';
const MOVEMENTS = 'Movimientos';
const FONT = 'Calibri';

const TYPE_LABELS = { gasto: 'Gasto', ingreso: 'Ingreso' };
const SOURCE_LABELS = { manual: 'Manual', ia: 'IA', sin_clasificar: 'Sin clasificar' };
const LEVEL = {
  none: { label: 'Bien', color: COLORS.positive, fill: COLORS.positiveSoft },
  warning_80: { label: 'Cerca del límite', color: COLORS.caution, fill: COLORS.cautionSoft },
  exceeded_100: { label: 'Excedido', color: COLORS.negative, fill: COLORS.negativeSoft },
};

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const font = (opts = {}) => ({ name: FONT, size: 11, color: { argb: COLORS.ink }, ...opts });
const bottomLine = { bottom: { style: 'thin', color: { argb: COLORS.line } } };

/**
 * Texto para usar dentro de una fórmula de Excel: entre comillas y con las comillas duplicadas.
 * @param {string} text
 * @returns {string}
 */
const q = (text) => `"${String(text).replace(/"/g, '""')}"`;

/**
 * `2026-10-17` → fecha de Excel (sin hora, en UTC para que no se corra un día).
 * @param {string} iso AAAA-MM-DD
 * @returns {Date}
 */
const toDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/**
 * `2026-10-01` → `1 de oct de 2026`.
 * @param {string} iso AAAA-MM-DD
 * @returns {string}
 */
const longDate = (iso) =>
  toDate(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * `2026-10` → `Octubre de 2026`.
 * @param {string} month AAAA-MM
 * @returns {string}
 */
const monthLabel = (month) => {
  const text = toDate(`${month}-01`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Hoja de movimientos: encabezado fijo, filtros, filas alternadas y totales con SUBTOTAL
 * (suman solo las filas visibles cuando se filtra).
 * @param {ExcelJS.Workbook} workbook
 * @param {object} report Datos de buildReport.
 * @returns {{ first: number, last: number }} Filas de datos, para las fórmulas del resumen.
 */
function addMovementsSheet(workbook, report) {
  const ws = workbook.addWorksheet(MOVEMENTS, {
    properties: { tabColor: { argb: COLORS.brand } },
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [
    { header: 'Fecha', key: 'date', width: 12, style: { numFmt: DATE } },
    { header: 'Descripción', key: 'description', width: 38 },
    { header: 'Categoría', key: 'category', width: 22 },
    { header: 'Tipo', key: 'type', width: 10 },
    { header: 'Ingreso', key: 'income', width: 15, style: { numFmt: MONEY } },
    { header: 'Gasto', key: 'expense', width: 15, style: { numFmt: MONEY } },
    { header: 'Origen', key: 'source', width: 14 },
  ];

  const header = ws.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = font({ bold: true, color: { argb: COLORS.white } });
    cell.fill = fill(COLORS.brand);
    cell.alignment = { vertical: 'middle' };
  });

  report.rows.forEach((row, i) => {
    const income = row.type === 'ingreso';
    const added = ws.addRow({
      date: toDate(row.date),
      // Texto que empieza por = + - @ se guarda como texto: exceljs no lo interpreta como fórmula.
      description: row.description,
      category: row.categoryName ?? 'Sin clasificar',
      type: TYPE_LABELS[row.type],
      income: income ? row.amount : null,
      expense: income ? null : row.amount,
      source: SOURCE_LABELS[row.source],
    });
    added.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = font(col === 5 ? { color: { argb: COLORS.positive } } : col === 6 ? { color: { argb: COLORS.negative } } : {});
      if (i % 2 === 1) cell.fill = fill(COLORS.canvas);
      cell.border = bottomLine;
    });
  });

  const first = 2;
  const last = report.rows.length + 1;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: last, column: 7 } };

  const totals = ws.addRow([]);
  totals.getCell(2).value = 'Total (respeta los filtros)';
  totals.getCell(5).value = { formula: `SUBTOTAL(109,E${first}:E${last})`, result: report.totals.income };
  totals.getCell(6).value = { formula: `SUBTOTAL(109,F${first}:F${last})`, result: report.totals.expense };
  totals.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > 7) return;
    cell.font = font({ bold: true, color: { argb: col === 5 ? COLORS.positive : col === 6 ? COLORS.negative : COLORS.ink } });
    cell.fill = fill(COLORS.brandSoft);
    cell.border = { top: { style: 'thin', color: { argb: COLORS.brand } } };
  });
  totals.height = 22;

  return { first, last };
}

/**
 * Hoja "Por mes" para periodos de varios meses. Cada cifra es SUMIFS sobre Movimientos.
 * @param {ExcelJS.Workbook} workbook
 * @param {object} report Datos de buildReport.
 * @param {{ first: number, last: number }} rows Filas de datos de la hoja Movimientos.
 * @returns {void}
 */
function addMonthsSheet(workbook, report, { first, last }) {
  const ws = workbook.addWorksheet('Por mes', {
    properties: { tabColor: { argb: COLORS.positive } },
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  });
  ws.columns = [
    { header: 'Mes', width: 20 },
    { header: 'Ingresos', width: 16, style: { numFmt: MONEY } },
    { header: 'Gastos', width: 16, style: { numFmt: MONEY } },
    { header: 'Balance', width: 16, style: { numFmt: MONEY } },
  ];
  ws.getRow(1).eachCell((cell) => {
    cell.font = font({ bold: true, color: { argb: COLORS.white } });
    cell.fill = fill(COLORS.brand);
  });

  const dates = `${MOVEMENTS}!$A$${first}:$A$${last}`;
  report.byMonth.forEach((m, i) => {
    const r = i + 2;
    const [y, mo] = m.month.split('-').map(Number);
    const inMonth = `${dates},">="&DATE(${y},${mo},1),${dates},"<"&DATE(${y},${mo + 1},1)`;
    ws.getCell(`A${r}`).value = monthLabel(m.month);
    ws.getCell(`B${r}`).value = { formula: `SUMIFS(${MOVEMENTS}!$E$${first}:$E$${last},${inMonth})`, result: m.income };
    ws.getCell(`C${r}`).value = { formula: `SUMIFS(${MOVEMENTS}!$F$${first}:$F$${last},${inMonth})`, result: m.expense };
    ws.getCell(`D${r}`).value = { formula: `B${r}-C${r}`, result: m.balance };
    ws.getRow(r).eachCell((cell) => {
      cell.font = font();
      cell.border = bottomLine;
      if (i % 2 === 1) cell.fill = fill(COLORS.canvas);
    });
  });
}

/**
 * Título de una sección del resumen: texto violeta en negrita y una línea debajo.
 * @param {ExcelJS.Worksheet} ws
 * @param {number} row
 * @param {string} text
 * @returns {void}
 */
function sectionTitle(ws, row, text) {
  ws.mergeCells(`A${row}:F${row}`);
  const cell = ws.getCell(`A${row}`);
  cell.value = text;
  cell.font = font({ bold: true, size: 13, color: { argb: COLORS.brand } });
  cell.border = { bottom: { style: 'medium', color: { argb: COLORS.brand } } };
  ws.getRow(row).height = 22;
}

/**
 * Encabezados de una tabla del resumen.
 * @param {ExcelJS.Worksheet} ws
 * @param {number} row
 * @param {string[]} labels
 * @returns {void}
 */
function tableHeader(ws, row, labels) {
  labels.forEach((label, i) => {
    const cell = ws.getRow(row).getCell(i + 1);
    cell.value = label;
    cell.font = font({ bold: true, size: 10, color: { argb: COLORS.muted } });
    cell.fill = fill(COLORS.canvas);
    cell.alignment = { horizontal: i === 0 ? 'left' : 'right' };
  });
}

/**
 * Hoja de resumen: encabezado de marca, indicadores y tablas.
 * @param {ExcelJS.Workbook} workbook
 * @param {object} report Datos de buildReport.
 * @param {{ first: number, last: number }} rows Filas de datos de la hoja Movimientos.
 * @returns {void}
 */
function addSummarySheet(workbook, report, { first, last }) {
  const ws = workbook.addWorksheet('Resumen', {
    properties: { tabColor: { argb: COLORS.brand } },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [{ width: 32 }, { width: 18 }, { width: 14 }, { width: 22 }, { width: 18 }, { width: 18 }];

  const range = (col) => `${MOVEMENTS}!$${col}$${first}:$${col}$${last}`;
  const incomeRange = range('E');
  const expenseRange = range('F');
  const categoryRange = range('C');

  // Encabezado de marca
  ws.mergeCells('A1:F1');
  Object.assign(ws.getCell('A1'), {
    value: 'FinTrack · Reporte de movimientos',
    font: font({ bold: true, size: 18, color: { argb: COLORS.white } }),
    fill: fill(COLORS.brand),
    alignment: { vertical: 'middle', indent: 1 },
  });
  ws.getRow(1).height = 36;
  ws.mergeCells('A2:F2');
  const who = report.owner.name || report.owner.email;
  Object.assign(ws.getCell('A2'), {
    value: `${who} · Del ${longDate(report.period.from)} al ${longDate(report.period.to)} · Generado el ${longDate(report.generatedOn)}`,
    font: font({ color: { argb: COLORS.muted } }),
    fill: fill(COLORS.brandSoft),
    alignment: { vertical: 'middle', indent: 1 },
  });
  ws.getRow(2).height = 22;

  // Indicadores: dos columnas de etiqueta y valor
  sectionTitle(ws, 4, 'Resumen del periodo');
  const t = report.totals;
  const kpi = (cellLabel, cellValue, label, value, numFmt, color) => {
    ws.getCell(cellLabel).value = label;
    ws.getCell(cellLabel).font = font({ color: { argb: COLORS.muted } });
    const cell = ws.getCell(cellValue);
    cell.value = value;
    cell.numFmt = numFmt;
    cell.font = font({ bold: true, size: 14, color: { argb: color } });
    cell.alignment = { horizontal: 'right' };
  };
  kpi('A5', 'B5', 'Ingresos', { formula: `SUM(${incomeRange})`, result: t.income }, MONEY, COLORS.positive);
  kpi('A6', 'B6', 'Gastos', { formula: `SUM(${expenseRange})`, result: t.expense }, MONEY, COLORS.negative);
  kpi('A7', 'B7', 'Balance (ingresos − gastos)', { formula: 'B5-B6', result: t.balance }, MONEY, t.balance < 0 ? COLORS.negative : COLORS.ink);
  kpi('D5', 'E5', 'Tasa de ahorro', { formula: 'IF(B5>0,B7/B5,"—")', result: t.savingsRate ?? '—' }, PERCENT, COLORS.brand);
  kpi('D6', 'E6', 'Gasto promedio diario', { formula: `B6/${t.daysElapsed}`, result: t.dailyAverageExpense }, MONEY, COLORS.ink);
  kpi('D7', 'E7', 'Movimientos', { formula: `COUNTA(${range('A')})`, result: t.count }, '0', COLORS.ink);
  for (const row of [5, 6, 7]) {
    ws.getRow(row).height = 22;
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => (ws.getCell(`${col}${row}`).border = bottomLine));
  }
  ws.getCell('F6').value = `en ${t.daysElapsed} ${t.daysElapsed === 1 ? 'día' : 'días'}`;
  ws.getCell('F6').font = font({ size: 10, color: { argb: COLORS.muted } });

  let row = 9;

  /**
   * Tabla de categorías con barra de datos en el monto.
   * @param {string} title
   * @param {Array<{ name: string, amount: number, count: number, share: number }>} groups
   * @param {string} amountRange Rango de la columna Ingreso o Gasto en Movimientos.
   * @param {string} typeLabel Gasto o Ingreso.
   * @param {number} total
   * @param {string} color Color ARGB de la barra.
   * @returns {void}
   */
  const categoryTable = (title, groups, amountRange, typeLabel, total, color) => {
    if (groups.length === 0) return;
    sectionTitle(ws, row, title);
    tableHeader(ws, row + 1, ['Categoría', 'Monto', '% del total', 'Movimientos']);
    const start = row + 2;
    groups.forEach((g, i) => {
      const r = start + i;
      ws.getCell(`A${r}`).value = g.name;
      ws.getCell(`B${r}`).value = { formula: `SUMIFS(${amountRange},${categoryRange},${q(g.name)})`, result: g.amount };
      ws.getCell(`C${r}`).value = { formula: `IF(B$${start + groups.length}>0,B${r}/B$${start + groups.length},0)`, result: g.share };
      ws.getCell(`D${r}`).value = {
        formula: `COUNTIFS(${categoryRange},${q(g.name)},${range('D')},${q(typeLabel)})`,
        result: g.count,
      };
      ws.getCell(`B${r}`).numFmt = MONEY;
      ws.getCell(`C${r}`).numFmt = PERCENT;
      ['A', 'B', 'C', 'D'].forEach((col) => {
        const cell = ws.getCell(`${col}${r}`);
        cell.font = font();
        cell.border = bottomLine;
        if (col !== 'A') cell.alignment = { horizontal: 'right' };
      });
    });
    const end = start + groups.length - 1;
    const totalRow = end + 1;
    ws.getCell(`A${totalRow}`).value = 'Total';
    ws.getCell(`B${totalRow}`).value = { formula: `SUM(B${start}:B${end})`, result: total };
    ws.getCell(`C${totalRow}`).value = { formula: `IF(B${totalRow}>0,1,0)`, result: total > 0 ? 1 : 0 };
    ws.getCell(`D${totalRow}`).value = { formula: `SUM(D${start}:D${end})`, result: groups.reduce((s, g) => s + g.count, 0) };
    ws.getCell(`B${totalRow}`).numFmt = MONEY;
    ws.getCell(`C${totalRow}`).numFmt = PERCENT;
    ['A', 'B', 'C', 'D'].forEach((col) => {
      const cell = ws.getCell(`${col}${totalRow}`);
      cell.font = font({ bold: true });
      cell.fill = fill(COLORS.brandSoft);
      if (col !== 'A') cell.alignment = { horizontal: 'right' };
    });
    // Barra proporcional dentro de la celda del monto: se lee de un vistazo qué pesa más.
    ws.addConditionalFormatting({
      ref: `B${start}:B${end}`,
      rules: [{ type: 'dataBar', priority: 1, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: color }, gradient: false }],
    });
    row = totalRow + 2;
  };

  categoryTable('Gastos por categoría', report.expenseByCategory, expenseRange, 'Gasto', t.expense, 'FFF4A49A');
  categoryTable('Ingresos por categoría', report.incomeByCategory, incomeRange, 'Ingreso', t.income, 'FF8FD9BE');

  // Top 5 de gastos
  if (report.topExpenses.length > 0) {
    sectionTitle(ws, row, `Top ${report.topExpenses.length} gastos más grandes`);
    tableHeader(ws, row + 1, ['Gasto', 'Monto', 'Fecha', 'Categoría', '% del gasto']);
    report.topExpenses.forEach((e, i) => {
      const r = row + 2 + i;
      ws.getCell(`A${r}`).value = `${i + 1}. ${e.description}`;
      ws.getCell(`B${r}`).value = e.amount;
      ws.getCell(`C${r}`).value = toDate(e.date);
      ws.getCell(`D${r}`).value = e.categoryName ?? 'Sin clasificar';
      ws.getCell(`E${r}`).value = { formula: `IF($B$6>0,B${r}/$B$6,0)`, result: t.expense > 0 ? e.amount / t.expense : 0 };
      ws.getCell(`B${r}`).numFmt = MONEY;
      ws.getCell(`C${r}`).numFmt = DATE;
      ws.getCell(`E${r}`).numFmt = PERCENT;
      ['A', 'B', 'C', 'D', 'E'].forEach((col) => {
        const cell = ws.getCell(`${col}${r}`);
        cell.font = font(col === 'B' ? { bold: true, color: { argb: COLORS.negative } } : {});
        cell.border = bottomLine;
        if (col !== 'A' && col !== 'D') cell.alignment = { horizontal: 'right' };
      });
    });
    row += report.topExpenses.length + 3;
  }

  // Presupuestos del mes
  if (report.budgets.length > 0) {
    sectionTitle(ws, row, `Presupuestos de ${monthLabel(report.period.from.slice(0, 7)).toLowerCase()}`);
    tableHeader(ws, row + 1, ['Categoría', 'Límite', 'Gastado', 'Disponible', 'Uso', 'Estado']);
    report.budgets.forEach((b, i) => {
      const r = row + 2 + i;
      const level = LEVEL[b.level] ?? LEVEL.none;
      ws.getCell(`A${r}`).value = b.category;
      ws.getCell(`B${r}`).value = b.limit;
      ws.getCell(`C${r}`).value = { formula: `SUMIFS(${expenseRange},${categoryRange},${q(b.category)})`, result: b.spent };
      ws.getCell(`D${r}`).value = { formula: `B${r}-C${r}`, result: b.available };
      ws.getCell(`E${r}`).value = { formula: `IF(B${r}>0,C${r}/B${r},0)`, result: b.usage };
      ws.getCell(`F${r}`).value = level.label;
      ['B', 'C', 'D'].forEach((col) => (ws.getCell(`${col}${r}`).numFmt = MONEY));
      ws.getCell(`E${r}`).numFmt = PERCENT;
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
        const cell = ws.getCell(`${col}${r}`);
        cell.font = font(col === 'F' || col === 'E' ? { bold: true, color: { argb: level.color } } : {});
        cell.border = bottomLine;
        if (col !== 'A') cell.alignment = { horizontal: col === 'F' ? 'center' : 'right' };
      });
      ws.getCell(`F${r}`).fill = fill(level.fill);
    });
    row += report.budgets.length + 3;
  }

  ws.mergeCells(`A${row}:F${row}`);
  Object.assign(ws.getCell(`A${row}`), {
    value: 'Las cifras son fórmulas que leen la hoja Movimientos: si corriges un monto allí, el resumen se actualiza.',
    font: font({ italic: true, size: 9, color: { argb: COLORS.muted } }),
  });
}

/**
 * Arma el libro de Excel del reporte.
 * @param {Awaited<ReturnType<typeof import('./report-data.service.js').buildReport>>} report
 * @returns {Promise<Buffer>} Contenido del archivo .xlsx.
 */
export async function buildWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FinTrack';
  workbook.created = new Date();
  workbook.title = 'Reporte de movimientos';
  // Al abrir, Excel recalcula todas las fórmulas.
  workbook.calcProperties = { fullCalcOnLoad: true };

  // Se arma primero Movimientos: las fórmulas del resumen necesitan saber en qué filas quedan los datos.
  const rowsInfo = addMovementsSheet(workbook, report);
  if (report.byMonth.length > 1) addMonthsSheet(workbook, report, rowsInfo);
  addSummarySheet(workbook, report, rowsInfo);
  // Orden de las pestañas al abrir: Resumen, Movimientos, Por mes.
  const order = ['Resumen', MOVEMENTS, 'Por mes'];
  workbook.worksheets.forEach((ws) => (ws.orderNo = order.indexOf(ws.name)));
  workbook.views = [{ activeTab: 0, firstSheet: 0 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/* The P&G as an .xlsx, one column per month plus the range total, with the PUC
 * code beside every category. Values are whole pesos (numbers, not text) so the
 * accountant can sum them. Same structure as PygView. */

const columnLabel = (period) => {
  if (period === 'total') return 'Total';
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
};

/** [{ label, puc, values: [per month..., total], style }] from the statement. */
export function pygRows(statement) {
  const columns = [...statement.months, { period: 'total', ...statement.totals }];
  const row = (label, pick, { puc = '', style = '' } = {}) => ({
    label, puc, style, values: columns.map(pick),
  });
  const categoryRows = (group) => statement.totals[group].byCategory.map((category) => row(
    category.name,
    (column) => column[group].byCategory.find((c) => c.categoryId === category.categoryId)?.total ?? 0,
    { puc: category.pucCode, style: 'indent' },
  ));

  return [
    row('Ventas de productos', (c) => c.orders.productSales),
    row('Costo de ventas', (c) => c.orders.cogs),
    row('Utilidad bruta', (c) => c.orders.grossProfit, { style: 'total' }),
    row('Otros ingresos', (c) => c.otherRevenue.total),
    row('Domicilios', (c) => c.orders.deliveryFees, { style: 'indent' }),
    ...categoryRows('otherRevenue'),
    row('Gastos', (c) => c.expenses.total, { style: 'total' }),
    row('Costo de domicilios', (c) => c.orders.deliveryCosts, { style: 'indent' }),
    ...categoryRows('expenses'),
    row('Utilidad neta', (c) => c.netProfit, { style: 'total' }),
    row('Margen neto (%)', (c) => c.netMarginPct, { style: 'percent' }),
    row('Compras de insumos del mes (informativo)', (c) => c.purchasesTotal, { style: 'memo' }),
    row('Inversiones del mes (informativo)', (c) => c.investments.total, { style: 'memo' }),
  ];
}

export async function exportPyg(statement) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('P&G');

  const periods = [...statement.months.map((m) => m.period), 'total'];
  sheet.addRow(['Concepto', 'PUC', ...periods.map(columnLabel)]).font = { bold: true };

  pygRows(statement).forEach((r) => {
    const added = sheet.addRow([r.label, r.puc, ...r.values]);
    if (r.style === 'total') added.font = { bold: true };
    if (r.style === 'memo') added.font = { italic: true };
    if (r.style !== 'percent') added.eachCell((cell, index) => { if (index > 2) cell.numFmt = '#,##0'; });
  });

  sheet.getColumn(1).width = 42;
  sheet.getColumn(2).width = 10;
  for (let i = 3; i <= periods.length + 2; i += 1) sheet.getColumn(i).width = 14;

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `pyg_${statement.from}_${statement.to}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

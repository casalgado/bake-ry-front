import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// Function to transform order data into rows
const transformOrderToRows = (order, orderIndex) => {
  const baseRow = {
    pedido: orderIndex + 1, // Order-level index
    id: order.id,
    fecha_venta: new Date(order.preparationDate).toISOString().split('T')[0],
    pago_recibido: order.isPaid ? 'si' : 'no',
    metodo: getPaymentMethodText(order.paymentMethod),
    cliente: order.userName || '',
    razon_social: order.userLegalName || '',
    correo: order.userEmail || '',
    nationalId: order.userNationalId || '',
    direccion: order.deliveryAddress || '',
    telefono: order.userPhone || '',
    categoria: '',
    producto: '',
    variacion: '',
    cantidad: '',
    subtotal: '',
    total: order.total || '',
  };

  // Create rows for each order item
  const itemRows = [];
  if (Array.isArray(order.orderItems)) {
    order.orderItems.forEach((item, itemIndex) => {
      itemRows.push({
        pedido: orderIndex + 1, // Order-level index
        id: '',
        fecha_venta: '',
        pago_recibido: '',
        metodo: '',
        cliente: '',
        correo: '',
        nationalId: '',
        direccion: '',
        telefono: '',
        categoria: categoryShortener(item.collectionName) || item.collectionName || '',
        producto: item.productName || '',
        variacion: item.combination?.name || '',
        cantidad: item.quantity || '',
        subtotal: item.subtotal || '',
        total: '',
      });
    });
  }

  // If there's delivery, add it as an item
  if (order.fulfillmentType === 'delivery' && order.deliveryFee) {
    itemRows.push({
      pedido: orderIndex + 1, // Order-level index
      id: '',
      fecha_venta: '',
      pago_recibido: '',
      metodo: '',
      cliente: '',
      correo: '',
      nationalId: '',
      direccion: '',
      telefono: '',
      categoria: 'servicio',
      producto: 'domicilio',
      variacion: '',
      cantidad: 1,
      subtotal: order.deliveryFee,
      total: '',
    });
  }

  // Add empty row after items
  const emptyRow = {
    pedido: orderIndex + 1, // Order-level index
    id: '',
    fecha_venta: '',
    pago_recibido: '',
    metodo: '',
    cliente: '',
    correo: '',
    nationalId: '',
    direccion: '',
    telefono: '',
    categoria: '',
    producto: '',
    variacion: '',
    cantidad: '',
    subtotal: '',
    total: '',
  };

  return [baseRow, ...itemRows, emptyRow];
};

// Helper function to convert payment method to text
const getPaymentMethodText = (method) => {
  const methodMap = {
    cash: 'efectivo',
    transfer: 'transferencia',
    card: 'tarjeta',
    complimentary: 'cortesia',
    davivienda: 'davivienda',
    bancolombia: 'bancolombia',
    bbva: 'bbva',
    nequi: 'nequi',
  };
  return methodMap[method] || method;
};

const categoryShortener = (text) => {
  if (text == 'sourdough') return 'Pan';
  return '';
};

// Main export function
const exportOrders = (orders) => {
  // Ensure orders is an array
  const ordersArray = Array.isArray(orders) ? orders : [];

  // Transform all orders into rows
  const allRows = ordersArray.flatMap((order, orderIndex) =>
    transformOrderToRows(order, orderIndex),
  );

  // Add a global index to each row
  const indexedRows = allRows.map((row, orden) => ({
    orden: orden + 1, // Add a global index starting from 1
    ...row,
  }));

  // Create Excel worksheet
  const worksheet = XLSX.utils.json_to_sheet(indexedRows);

  // Set column widths for better readability
  worksheet['!cols'] = [
    { width: 8 }, // orden
    { width: 10 }, // pedido
    { width: 12 }, // id
    { width: 12 }, // fecha_venta
    { width: 15 }, // pago_recibido
    { width: 15 }, // metodo
    { width: 20 }, // cliente
    { width: 25 }, // razon_social
    { width: 25 }, // correo
    { width: 15 }, // nationalId
    { width: 30 }, // direccion
    { width: 15 }, // telefono
    { width: 15 }, // categoria
    { width: 20 }, // producto
    { width: 15 }, // variacion
    { width: 10 }, // cantidad
    { width: 12 }, // subtotal
    { width: 12 }, // total
  ];

  // Create workbook and add worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

  // Generate filename with current date
  const filename = `orders_export_${
    new Date().toISOString().split('T')[0]
  }.xlsx`;

  // Download the Excel file
  XLSX.writeFile(workbook, filename);
};

// EXPORT PRODUCTS BELOW
// Function to add delivery fee as a separate product entry
const addDeliveryProduct = (productMap, order) => {
  const deliveryFee = order.deliveryFee || 0;

  if (deliveryFee > 0 && order.fulfillmentType === 'delivery') {
    const deliveryKey = 'domicilio - -';

    // Get or create delivery product entry
    if (!productMap.has(deliveryKey)) {
      productMap.set(deliveryKey, {
        producto: 'domicilio',
        variacion: '-',
        cantidad_total: 0,
        ingresos_totales: 0,
        precio_promedio: 0,
        pedidos_count: new Set(),
      });
    }

    const deliveryData = productMap.get(deliveryKey);

    // Update delivery data (quantity = 1 per order with delivery)
    deliveryData.cantidad_total += 1;
    deliveryData.ingresos_totales += deliveryFee;
    deliveryData.pedidos_count.add(order.id);
  }
};

// Function to aggregate product sales data
const aggregateProductSales = (orders) => {
  const productMap = new Map();

  orders.forEach((order) => {
    // Only process paid orders
    if (!order.isPaid) return;

    // Process each order item
    if (Array.isArray(order.orderItems)) {
      order.orderItems.forEach((item) => {
        // Create unique product key (product + variation)
        const productName = item.productName || 'Producto sin nombre';
        const variationName = item.variation?.name || '-';
        const productKey = `${productName} - ${variationName}`;

        // Get or create product entry
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            producto: productName,
            variacion: variationName,
            cantidad_total: 0,
            ingresos_totales: 0,
            precio_promedio: 0,
            pedidos_count: new Set(), // Track unique orders
          });
        }

        const productData = productMap.get(productKey);

        // Update aggregated data
        productData.cantidad_total += item.quantity || 0;
        productData.ingresos_totales += item.subtotal || 0;
        productData.pedidos_count.add(order.id);
      });
    }

    // Add delivery fee as a separate product
    addDeliveryProduct(productMap, order);
  });

  // Convert Map to array and calculate averages
  const productSales = Array.from(productMap.values()).map((product) => ({
    producto: product.producto,
    variacion: product.variacion,
    cantidad_total: product.cantidad_total,
    ingresos_totales: Math.round(product.ingresos_totales * 100) / 100, // Round to 2 decimals
    precio_promedio:
      product.cantidad_total > 0
        ? Math.round(
          (product.ingresos_totales / product.cantidad_total) * 100,
        ) / 100
        : 0,
    pedidos_unicos: product.pedidos_count.size,
  }));

  // Sort by total revenue (highest first)
  return productSales.sort((a, b) => b.ingresos_totales - a.ingresos_totales);
};

// Function to add summary statistics
const addSummaryStats = (productSales) => {
  const totalProducts = productSales.length;
  const totalQuantity = productSales.reduce(
    (sum, product) => sum + product.cantidad_total,
    0,
  );
  const totalRevenue = productSales.reduce(
    (sum, product) => sum + product.ingresos_totales,
    0,
  );
  const totalOrders = new Set(
    productSales.flatMap((product) =>
      Array.from({ length: product.pedidos_unicos }, (_, i) => i),
    ),
  ).size;

  // Add summary rows
  const summaryRows = [
    {
      producto: '',
      variacion: '',
      cantidad_total: '',
      ingresos_totales: '',
      precio_promedio: '',
      pedidos_unicos: '',
    },
    {
      producto: 'RESUMEN',
      variacion: '',
      cantidad_total: '',
      ingresos_totales: '',
      precio_promedio: '',
      pedidos_unicos: '',
    },

    {
      producto: 'Total productos únicos:',
      variacion: totalProducts,
      cantidad_total: '',
      ingresos_totales: '',
      precio_promedio: '',
      pedidos_unicos: '',
    },
    {
      producto: 'Cantidad total vendida:',
      variacion: totalQuantity,
      cantidad_total: '',
      ingresos_totales: '',
      precio_promedio: '',
      pedidos_unicos: '',
    },
    {
      producto: 'Ingresos totales:',
      variacion: `$${Math.round(totalRevenue * 100) / 100}`,
      cantidad_total: '',
      ingresos_totales: '',
      precio_promedio: '',
      pedidos_unicos: '',
    },
    {
      producto: 'Precio promedio general:',
      variacion:
        totalQuantity > 0
          ? `$${Math.round((totalRevenue / totalQuantity) * 100) / 100}`
          : '$0',
      cantidad_total: '',
      ingresos_totales: '',
      precio_promedio: '',
      pedidos_unicos: '',
    },
  ];

  return [...productSales, ...summaryRows];
};

// Main export function
const exportProducts = (orders, options = {}) => {
  // Ensure orders is an array
  const ordersArray = Array.isArray(orders) ? orders : [];
  // Filter orders by date range if provided
  let filteredOrders = ordersArray;
  if (options.startDate || options.endDate) {
    filteredOrders = ordersArray.filter((order) => {
      const orderDate = new Date(order.preparationDate);
      const start = options.startDate
        ? new Date(options.startDate)
        : new Date('1900-01-01');
      const end = options.endDate
        ? new Date(options.endDate)
        : new Date('2100-12-31');
      return orderDate >= start && orderDate <= end;
    });
  }

  // Aggregate product sales data
  const productSales = aggregateProductSales(filteredOrders);

  // Add summary statistics
  const finalData =
    options.includeSummary !== false
      ? addSummaryStats(productSales)
      : productSales;

  // Create Excel worksheet
  const worksheet = XLSX.utils.json_to_sheet(finalData);

  // Set column widths for better readability
  worksheet['!cols'] = [
    { width: 30 }, // producto
    { width: 20 }, // variacion
    { width: 15 }, // cantidad_total
    { width: 18 }, // ingresos_totales
    { width: 18 }, // precio_promedio
    { width: 15 }, // pedidos_unicos
  ];

  // Create workbook and add worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Sales');

  // Generate filename with current date and optional date range
  let filename = `product_sales_export_${
    new Date().toISOString().split('T')[0]
  }`;
  if (options.startDate || options.endDate) {
    const start = options.startDate ? options.startDate : 'inicio';
    const end = options.endDate ? options.endDate : 'fin';
    filename += `_${start}_to_${end}`;
  }
  filename += '.xlsx';

  // Download the Excel file
  XLSX.writeFile(workbook, filename);

  // Return the data for potential further processing
  return {
    data: finalData,
    summary: {
      totalProducts: productSales.length,
      totalQuantity: productSales.reduce(
        (sum, product) => sum + product.cantidad_total,
        0,
      ),
      totalRevenue: productSales.reduce(
        (sum, product) => sum + product.ingresos_totales,
        0,
      ),
      dateRange: {
        start: options.startDate || null,
        end: options.endDate || null,
        ordersProcessed: filteredOrders.length,
      },
    },
  };
};

// Function to create payment entries similar to the Vue component logic
const createPaymentEntries = (orders) => {
  const entries = [];

  orders.forEach((order) => {
    // Skip complimentary orders
    if (order.isComplimentary) {
      return;
    }

    // Handle partial payments (always show if exists)
    if (order.partialPaymentDate && order.partialPaymentAmount > 0) {
      entries.push({
        id: `${order.id}-partial`,
        paymentDate: order.partialPaymentDate,
        paymentType: 'parcial',
        paymentAmount: order.partialPaymentAmount,
        order: order,
      });

      // Only show balance payment if order is fully paid
      if (order.isPaid) {
        const remaining = order.total - order.partialPaymentAmount;
        if (remaining > 0 && order.paymentDate) {
          entries.push({
            id: `${order.id}-final`,
            paymentDate: order.paymentDate,
            paymentType: 'saldo',
            paymentAmount: remaining,
            order: order,
          });
        }
      }
    }
    // Handle full payments only for paid orders with payment date
    else if (order.isPaid && order.paymentDate) {
      entries.push({
        id: order.id,
        paymentDate: order.paymentDate,
        paymentType: 'completo',
        paymentAmount: order.total,
        order: order,
      });
    }
  });

  // Sort by payment date
  return entries.sort(
    (a, b) => new Date(a.paymentDate || 0) - new Date(b.paymentDate || 0),
  );
};

// Function to transform payment entry into rows (similar to the original order export)
const transformPaymentEntryToRows = (entry, entryIndex) => {
  const order = entry.order;

  const baseRow = {
    entrada: entryIndex + 1, // Payment entry index
    fecha_pago: new Date(entry.paymentDate).toISOString().split('T')[0],
    fecha_pedido: order.dueDate
      ? new Date(order.dueDate).toISOString().split('T')[0]
      : '',
    tipo_pago: entry.paymentType,
    cliente: order.userName || '',
    razon_social: order.userLegalName || '',
    correo: order.userEmail || '',
    nationalId: order.userNationalId || '',
    direccion: order.deliveryAddress || '',
    telefono: order.userPhone || '',
    metodo_pago: getPaymentMethodText(order.paymentMethod),
    total_pago: entry.paymentAmount || '',
    total_pedido: order.total || '',
    pedido_id: order.id || '',
    categoria: '',
    producto: '',
    variacion: '',
    cantidad: '',
    subtotal: '',
  };

  // Create rows for each order item
  const itemRows = [];
  if (Array.isArray(order.orderItems)) {
    order.orderItems.forEach((item, itemIndex) => {
      itemRows.push({
        entrada: entryIndex + 1, // Payment entry index
        fecha_pago: '',
        fecha_pedido: '',
        tipo_pago: '',
        cliente: '',
        razon_social: '',
        correo: '',
        nationalId: '',
        direccion: '',
        telefono: '',
        metodo_pago: '',
        total_pago: '',
        total_pedido: '',
        pedido_id: '',
        categoria: categoryShortener(item.collectionName) || item.collectionName || '',
        producto: item.productName || '',
        variacion: item.combination?.name || '',
        cantidad: item.quantity || '',
        subtotal: item.subtotal || '',
      });
    });
  }

  // If there's delivery, add it as an item
  if (order.fulfillmentType === 'delivery' && order.deliveryFee) {
    itemRows.push({
      entrada: entryIndex + 1, // Payment entry index
      fecha_pago: '',
      fecha_pedido: '',
      tipo_pago: '',
      cliente: '',
      razon_social: '',
      correo: '',
      nationalId: '',
      direccion: '',
      telefono: '',
      metodo_pago: '',
      total_pago: '',
      total_pedido: '',
      pedido_id: '',
      categoria: 'servicio',
      producto: 'domicilio',
      variacion: '',
      cantidad: 1,
      subtotal: order.deliveryFee,
    });
  }

  // Add empty row after items for visual separation
  const emptyRow = {
    entrada: entryIndex + 1, // Payment entry index
    fecha_pago: '',
    fecha_pedido: '',
    tipo_pago: '',
    cliente: '',
    razon_social: '',
    correo: '',
    nationalId: '',
    direccion: '',
    telefono: '',
    metodo_pago: '',
    total_pago: '',
    total_pedido: '',
    pedido_id: '',
    categoria: '',
    producto: '',
    variacion: '',
    cantidad: '',
    subtotal: '',
  };

  return [baseRow, ...itemRows, emptyRow];
};

// Main export function
const exportPaymentReport = (orders, options = {}) => {
  // Ensure orders is an array
  const ordersArray = Array.isArray(orders) ? orders : [];

  // Create payment entries following the same logic as the Vue component
  const paymentEntries = createPaymentEntries(ordersArray);

  // Transform all payment entries into rows
  const allRows = paymentEntries.flatMap((entry, entryIndex) =>
    transformPaymentEntryToRows(entry, entryIndex),
  );

  // Add a global index to each row
  const indexedRows = allRows.map((row, orden) => ({
    orden: orden + 1, // Add a global index starting from 1
    ...row,
  }));

  // Create Excel worksheet
  const worksheet = XLSX.utils.json_to_sheet(indexedRows);

  // Set column widths for better readability
  worksheet['!cols'] = [
    { width: 8 }, // orden
    { width: 10 }, // entrada
    { width: 12 }, // fecha_pago
    { width: 12 }, // fecha_pedido
    { width: 12 }, // tipo_pago
    { width: 20 }, // cliente
    { width: 25 }, // razon_social
    { width: 25 }, // correo
    { width: 15 }, // nationalId
    { width: 30 }, // direccion
    { width: 15 }, // telefono
    { width: 15 }, // metodo_pago
    { width: 12 }, // total_pago
    { width: 12 }, // total_pedido
    { width: 15 }, // pedido_id
    { width: 15 }, // categoria
    { width: 20 }, // producto
    { width: 15 }, // variacion
    { width: 10 }, // cantidad
    { width: 12 }, // subtotal
  ];

  // Create workbook and add worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Report');

  // Generate filename with current date and optional suffix
  let filename = `payment_report_${new Date().toISOString().split('T')[0]}`;
  if (options.suffix) {
    filename += `_${options.suffix}`;
  }
  filename += '.xlsx';

  // Download the Excel file
  XLSX.writeFile(workbook, filename);

  // Return summary data for potential further processing
  return {
    paymentEntries: paymentEntries.length,
    totalRows: indexedRows.length,
    summary: {
      totalPayments: paymentEntries.reduce(
        (sum, entry) => sum + (entry.paymentAmount || 0),
        0,
      ),
      partialPayments: paymentEntries.filter(
        (entry) => entry.paymentType === 'parcial',
      ).length,
      fullPayments: paymentEntries.filter(
        (entry) => entry.paymentType === 'completo',
      ).length,
      balancePayments: paymentEntries.filter(
        (entry) => entry.paymentType === 'saldo',
      ).length,
    },
  };
};

// Helper functions for ExcelJS
function applyHeaderStyle(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
}

function centerDataCells(worksheet, colKey) {
  worksheet.getColumn(colKey).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) cell.alignment = { horizontal: 'center' };
  });
}

// Convert to clean number (no decimal tails)
function toNum(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  if (isNaN(n)) return null;
  // If it's a whole number, return integer
  if (n % 1 === 0) return Math.round(n);
  // Otherwise, round to 2 decimals
  return Math.round(n * 100) / 100;
}

async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// EXPORT PRODUCT REPORT (ExcelJS version)
const exportProductReport = async (reportData, options = {}) => {
  const { products = [], metadata = {} } = reportData;
  const format = options.format || 'xlsx';
  const hasSegments = metadata.options?.segment === 'all';
  const metrics = metadata.options?.metrics || 'both';
  const showIngresos = metrics === 'both' || metrics === 'ingresos';
  const showCantidad = metrics === 'both' || metrics === 'cantidad';

  // Collect all period keys from products
  const allPeriods = new Set();
  products.forEach((product) => {
    if (product.periods) {
      Object.keys(product.periods).forEach((period) => allPeriods.add(period));
    }
  });
  const sortedPeriods = Array.from(allPeriods).sort();

  // Auto-detect combination data
  const hasCombinations = products.length > 0 && products[0].combinationName !== undefined;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Ventas por Producto');

  // Build column definitions with better ordering
  const columns = [
    { header: 'Categoría', key: 'categoria', width: 20 },
    { header: 'Producto', key: 'producto', width: 30 },
  ];

  if (hasCombinations) {
    columns.push({ header: 'Combinación', key: 'combinacion', width: 20 });
  }

  // Better column order: Cantidad -> Ingresos -> Precio
  if (showCantidad) {
    columns.push({ header: 'Total Cantidad', key: 'total_cantidad', width: 12 });
  }
  if (showIngresos) {
    columns.push({ header: 'Total Ingresos', key: 'total_ingresos', width: 15 });
  }
  // Precio Promedio only makes sense when we have both cantidad and ingresos
  if (showCantidad && showIngresos) {
    columns.push({ header: 'Precio Promedio', key: 'precio_promedio', width: 12 });
  }

  // Add B2B/B2C columns
  if (hasSegments) {
    if (showCantidad) {
      columns.push({ header: 'B2B Cantidad', key: 'b2b_cantidad', width: 10 });
      columns.push({ header: 'B2C Cantidad', key: 'b2c_cantidad', width: 10 });
    }
    if (showIngresos) {
      columns.push({ header: 'B2B Ingresos', key: 'b2b_ingresos', width: 12 });
      columns.push({ header: 'B2C Ingresos', key: 'b2c_ingresos', width: 12 });
    }
  }

  // Add period columns with simplified headers
  sortedPeriods.forEach((period) => {
    if (showCantidad) {
      columns.push({ header: 'Cantidad', key: `${period}_cantidad`, width: 10 });
    }
    if (showIngresos) {
      columns.push({ header: 'Ingresos', key: `${period}_ingresos`, width: 12 });
    }
    if (hasSegments) {
      if (showCantidad) {
        columns.push({ header: 'B2B Cant', key: `${period}_b2b_cantidad`, width: 9 });
        columns.push({ header: 'B2C Cant', key: `${period}_b2c_cantidad`, width: 9 });
      }
      if (showIngresos) {
        columns.push({ header: 'B2B Ing', key: `${period}_b2b_ingresos`, width: 11 });
        columns.push({ header: 'B2C Ing', key: `${period}_b2c_ingresos`, width: 11 });
      }
    }
  });

  worksheet.columns = columns;

  // Create merged period headers if periods exist
  if (sortedPeriods.length > 0) {
    // Insert a new row at the top for period headers
    worksheet.insertRow(1, []);

    // Calculate base column count (before periods start)
    let currentCol = 1; // Start from column 1
    currentCol++; // categoria
    currentCol++; // producto
    if (hasCombinations) currentCol++;
    if (showCantidad) currentCol++; // total_cantidad
    if (showIngresos) currentCol++; // total_ingresos
    if (showCantidad && showIngresos) currentCol++; // precio_promedio (only when both metrics)

    if (hasSegments) {
      if (showCantidad) currentCol += 2; // b2b_cantidad, b2c_cantidad
      if (showIngresos) currentCol += 2; // b2b_ingresos, b2c_ingresos
    }

    // Add merged cells for each period
    sortedPeriods.forEach((period) => {
      // Calculate columns per period
      let colsPerPeriod = 0;
      if (showCantidad) colsPerPeriod++;
      if (showIngresos) colsPerPeriod++;
      if (hasSegments) {
        if (showCantidad) colsPerPeriod += 2; // b2b/b2c cantidad
        if (showIngresos) colsPerPeriod += 2; // b2b/b2c ingresos
      }

      const startCol = currentCol;
      const endCol = currentCol + colsPerPeriod - 1;

      // Merge cells for this period
      worksheet.mergeCells(1, startCol, 1, endCol);

      // Set the period label
      const periodCell = worksheet.getCell(1, startCol);
      periodCell.value = period;
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
      periodCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

      currentCol += colsPerPeriod;
    });
  }

  // Transform and add data rows
  products.forEach((product) => {
    const row = {
      categoria: product.categoryName || '',
      producto: product.productName || '',
    };

    if (hasCombinations) {
      row.combinacion = product.combinationName || '';
    }

    if (showCantidad) {
      row.total_cantidad = toNum(product.totalCantidad);
    }
    if (showIngresos) {
      row.total_ingresos = toNum(product.totalIngresos);
    }
    // Precio Promedio only makes sense when we have both cantidad and ingresos
    if (showCantidad && showIngresos) {
      row.precio_promedio = toNum(product.avgPrice);
    }

    // Add B2B/B2C data
    if (hasSegments) {
      if (showCantidad) {
        row.b2b_cantidad = toNum(product.b2bCantidad);
        row.b2c_cantidad = toNum(product.b2cCantidad);
      }
      if (showIngresos) {
        row.b2b_ingresos = toNum(product.b2bIngresos);
        row.b2c_ingresos = toNum(product.b2cIngresos);
      }
    }

    // Add period data
    sortedPeriods.forEach((period) => {
      const periodData = product.periods?.[period] || {};

      if (showCantidad) {
        row[`${period}_cantidad`] = toNum(periodData.cantidad);
      }
      if (showIngresos) {
        row[`${period}_ingresos`] = toNum(periodData.ingresos);
      }

      if (hasSegments) {
        if (showCantidad) {
          row[`${period}_b2b_cantidad`] = toNum(periodData.b2bCantidad);
          row[`${period}_b2c_cantidad`] = toNum(periodData.b2cCantidad);
        }
        if (showIngresos) {
          row[`${period}_b2b_ingresos`] = toNum(periodData.b2bIngresos);
          row[`${period}_b2c_ingresos`] = toNum(periodData.b2cIngresos);
        }
      }
    });

    worksheet.addRow(row);
  });

  // Apply styling to headers
  const headerRowNum = sortedPeriods.length > 0 ? 2 : 1; // Row 2 if periods exist, row 1 otherwise
  applyHeaderStyle(worksheet.getRow(headerRowNum));

  // Apply number formatting and centering
  const quantityColumns = [];
  const moneyColumns = []; // Start empty, add conditionally

  // Only add columns that actually exist based on metrics
  if (showCantidad) {
    quantityColumns.push('total_cantidad');
    if (hasSegments) {
      quantityColumns.push('b2b_cantidad', 'b2c_cantidad');
    }
  }

  if (showIngresos) {
    moneyColumns.push('total_ingresos');
    if (hasSegments) {
      moneyColumns.push('b2b_ingresos', 'b2c_ingresos');
    }
  }

  // Precio Promedio only when both metrics are shown
  if (showCantidad && showIngresos) {
    moneyColumns.push('precio_promedio');
  }

  sortedPeriods.forEach((period) => {
    if (showCantidad) {
      quantityColumns.push(`${period}_cantidad`);
      if (hasSegments) {
        quantityColumns.push(`${period}_b2b_cantidad`, `${period}_b2c_cantidad`);
      }
    }
    if (showIngresos) {
      moneyColumns.push(`${period}_ingresos`);
      if (hasSegments) {
        moneyColumns.push(`${period}_b2b_ingresos`, `${period}_b2c_ingresos`);
      }
    }
  });

  // Apply formatting to quantity columns (thousand separators)
  const dataStartRow = sortedPeriods.length > 0 ? 3 : 2; // Row 3 if periods exist, row 2 otherwise
  quantityColumns.forEach(colKey => {
    const column = worksheet.getColumn(colKey);
    if (column) {
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber >= dataStartRow) {
          cell.alignment = { horizontal: 'center' };
          cell.numFmt = '#,##0'; // Thousand separators, no decimals
        }
      });
    }
  });

  // Apply formatting to money columns (currency)
  moneyColumns.forEach(colKey => {
    const column = worksheet.getColumn(colKey);
    if (column) {
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber >= dataStartRow) {
          cell.alignment = { horizontal: 'center' };
          cell.numFmt = '$#,##0'; // Currency format with thousand separators, no decimals
        }
      });
    }
  });

  // Add thick vertical borders to separate periods
  if (sortedPeriods.length > 0) {
    const totalRows = products.length + 2; // +2 for both header rows

    // Calculate base column count (categoria, producto, [combinacion], totals, [segments])
    let baseColCount = 2; // categoria, producto
    if (hasCombinations) baseColCount++;
    if (showCantidad) baseColCount++; // total_cantidad
    if (showIngresos) baseColCount++; // total_ingresos
    if (showCantidad && showIngresos) baseColCount++; // precio_promedio (only when both metrics)

    if (hasSegments) {
      if (showCantidad) baseColCount += 2; // b2b_cantidad, b2c_cantidad
      if (showIngresos) baseColCount += 2; // b2b_ingresos, b2c_ingresos
    }

    // Add borders for each period
    sortedPeriods.forEach((period, periodIndex) => {
      // Calculate columns per period
      let colsPerPeriod = 0;
      if (showCantidad) colsPerPeriod++;
      if (showIngresos) colsPerPeriod++;
      if (hasSegments) {
        if (showCantidad) colsPerPeriod += 2; // b2b/b2c cantidad
        if (showIngresos) colsPerPeriod += 2; // b2b/b2c ingresos
      }

      // Calculate start column for this period
      const periodStartCol = baseColCount + (periodIndex * colsPerPeriod) + 1;
      const periodEndCol = periodStartCol + colsPerPeriod - 1;

      // Add thick left border to period start
      for (let row = 1; row <= totalRows; row++) {
        const cell = worksheet.getCell(row, periodStartCol);
        cell.border = { ...cell.border, left: { style: 'thick' } };
      }

      // Add thick right border to period end
      for (let row = 1; row <= totalRows; row++) {
        const cell = worksheet.getCell(row, periodEndCol);
        cell.border = { ...cell.border, right: { style: 'thick' } };
      }
    });
  }

  // Freeze header rows
  const freezeYSplit = sortedPeriods.length > 0 ? 2 : 1; // Freeze 2 rows if periods exist, 1 otherwise
  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: freezeYSplit }];

  // Generate descriptive filename based on query parameters
  const dateRange = options.startDate && options.endDate
    ? `${options.startDate}_${options.endDate}`
    : new Date().toISOString().split('T')[0];

  let filename = 'ventas';

  // Add detail level
  const detailLevel = metadata.options?.detailLevel;
  if (detailLevel === 'product') filename += '_producto';
  else if (detailLevel === 'combination') filename += '_combinacion';

  // Add metrics type
  const metricsType = metadata.options?.metrics;
  if (metricsType === 'cantidad') filename += '_cantidad';
  else if (metricsType === 'ingresos') filename += '_ingresos';
  else if (metricsType === 'both') filename += '_ingresos_y_cantidad';

  // Add segment type
  const segment = metadata.options?.segment;
  if (segment === 'b2b') filename += '_b2b';
  else if (segment === 'b2c') filename += '_b2c';
  else if (segment === 'all') filename += '_b2b_b2c';

  // Add period grouping
  const period = metadata.options?.period;
  if (period === 'daily') filename += '_diario';
  else if (period === 'weekly') filename += '_semanal';
  else if (period === 'monthly') filename += '_mensual';

  // Add date range and extension
  filename += `_${dateRange}.xlsx`;

  // Download file
  await downloadWorkbook(workbook, filename);

  return { products, periods: sortedPeriods };
};

// EXPORT INCOME STATEMENT
const exportIncomeStatement = (reportData, options = {}) => {
  const { format = 'xlsx', bakeryName = 'Mi Panaderia', startDate, endDate } = options;
  const periods = reportData.periods || [];
  const totals = reportData.totals || {};
  const excludedProducts = reportData.excludedProducts || [];

  // Create rows for main report
  const rows = [];

  // Add header info
  rows.push({
    concepto: 'Rentabilidad',
    periodo: `${startDate} a ${endDate}`,
  });
  rows.push({ concepto: '', periodo: '' });

  // Column headers
  const headers = ['Concepto'];
  periods.forEach((period) => {
    headers.push(formatMonthLabel(period.month));
  });
  headers.push('TOTAL');

  // Add blank row for structure
  rows.push({ concepto: '', periodo: '' });

  // Helper to add section rows
  const addRow = (label, dataKey, suffix = '') => {
    const row = { concepto: label };
    periods.forEach((period) => {
      const value = getNestedValue(period, dataKey);
      row[`mes_${period.month}`] = format === 'csv' ? value : value;
    });
    const totalValue = getNestedValue(totals, dataKey);
    row.total = format === 'csv' ? totalValue : totalValue;
    rows.push(row);
  };

  // Helper to get nested value (for revenue.productSales, etc)
  const getNestedValue = (obj, path) => {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      value = value?.[key];
    }
    return value || 0;
  };

  // INGRESOS
  rows.push({ concepto: 'INGRESOS', periodo: '' });
  addRow('  Ventas de Productos', 'revenue.productSales');
  addRow('  Domicilios Cobrados', 'revenue.deliveryFees');
  addRow('  Impuestos Cobrados', 'revenue.taxesCollected');
  addRow('Total Ingresos', 'revenue.totalRevenue');
  rows.push({ concepto: '', periodo: '' });

  // COSTOS
  rows.push({ concepto: 'COSTOS', periodo: '' });
  addRow('  Costo de Productos', 'costs.cogs');
  addRow('  Costo de Domicilios', 'costs.deliveryCosts');
  addRow('Total Costos', 'costs.totalCosts');
  rows.push({ concepto: '', periodo: '' });

  // Rentabilidad
  rows.push({ concepto: 'Rentabilidad', periodo: '' });
  addRow('  Utilidad Bruta', 'grossProfit.amount');
  addRow('  Margen Bruto (%)', 'grossProfit.marginPercent');
  rows.push({ concepto: '', periodo: '' });

  // COBERTURA
  rows.push({ concepto: 'COBERTURA DE COSTOS', periodo: '' });
  const coverageRow = { concepto: '  Porcentaje Cubierto (%)' };
  periods.forEach((period) => {
    coverageRow[`mes_${period.month}`] = period.coverage.percentCovered.toFixed(1);
  });
  coverageRow.total = totals.coverage?.percentCovered?.toFixed(1) || '0';
  rows.push(coverageRow);

  // Add excluded products section
  if (excludedProducts.length > 0) {
    rows.push({ concepto: '', periodo: '' });
    rows.push({ concepto: 'PRODUCTOS SIN COSTO DEFINIDO', periodo: '' });
    excludedProducts.forEach((product) => {
      rows.push({
        concepto: `  ${product.name}`,
        periodo: `${product.orderCount} pedidos, ${product.totalQuantity} unidades`,
      });
    });
  }

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { width: 30 },
    ...periods.map(() => ({ width: 18 })),
    { width: 18 },
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rentabilidad');

  // Generate filename
  const filename = `rentabilidad_bruta_${startDate}_${endDate}.${format === 'csv' ? 'csv' : 'xlsx'}`;

  // Download
  if (format === 'csv') {
    XLSX.writeFile(workbook, filename, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, filename);
  }
};

// Helper function to format month label (used in export)
const formatMonthLabel = (monthStr) => {
  const [year, month] = monthStr.split('-');
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${months[parseInt(month) - 1]} ${year}`;
};

// EXPORT CLIENT LIST (from ClientPersistencyReport)
// `clients` are normalised rows:
//   { group, name, email, phone, legalName, nationalId, address, total,
//     lastOrderDate, periodTotals? }
// `periodColumns` (bucket export only): period labels; each client carries a
// `periodTotals` array aligned to them, and the money column becomes one column
// per period plus a range total.

const dateOnly = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? '' : d.toISOString().split('T')[0];
};

const buildStandardClientSheet = (clients, { groupHeader, segment, periodColumns }) => {
  const idHeader = segment === 'b2b' ? 'Razón social' : 'Cédula';
  const idField = segment === 'b2b' ? 'legalName' : 'nationalId';
  const lead = [groupHeader, 'Nombre', 'Email', 'Teléfono', idHeader, 'Dirección'];
  const money = periodColumns?.length ? [...periodColumns, 'Total del rango'] : ['Total del período'];
  const headers = [...lead, ...money, 'Última orden'];
  const rows = clients.map((c) => [
    c.group || '',
    c.name || '',
    c.email || '',
    c.phone || '',
    c[idField] || '',
    c.address || '',
    ...(periodColumns?.length
      ? [...(c.periodTotals || periodColumns.map(() => 0)), c.total || 0]
      : [c.total || 0]),
    dateOnly(c.lastOrderDate),
  ]);
  const cols = [22, 24, 26, 15, 22, 30, ...money.map(() => 13), 12];
  return { headers, rows, cols };
};

const UNIT_PLURAL = { weekly: 'semanas', biweekly: 'quincenas', monthly: 'meses' };

// WhatsApp Business bulk-broadcast contact-import template. Columns are fixed by
// WhatsApp, not by us.
const whatsappBroadcastSheet = (clients) => {
  const headers = [
    'Identificador del contacto (Número de teléfono/Username)',
    'Tipo de identificador',
    'Argumentos del mensaje',
    'URL del Header (Opcional)',
    'Sufijo de la URL dinámica del Botón (Opcional)',
  ];
  const rows = clients.map((c) => {
    const d = String(c.phone || '').replace(/\D/g, '');
    // ponytail: 10-digit == CO mobile heuristic; revisit if they onboard bulk foreign numbers
    const id = !d ? '' : d.length === 10 ? `+57${d}` : `+${d}`;
    return [id, d ? 'TELEFONO' : 'USERNAME', c.name || '', '', ''];
  });
  return { headers, rows, cols: [50, 20, 24, 20, 36] };
};

const CLIENT_EXPORT_PRESETS = {
  // ponytail: hardcoded per-bakery custom export shapes. Move to bakery settings
  // (features.reports.clientExport) only if a 3rd bakery needs one.
  'es-alimento': { label: 'B2Chat', build: whatsappBroadcastSheet },
};

// Non-null when this bakery has an extra export shape; drives the second export
// button in ClientPersistencyReport. Standard export stays available regardless.
const clientExportPreset = (bakeryId) => CLIENT_EXPORT_PRESETS[bakeryId] || null;

const writeClientSheet = ({ headers, rows, cols }, filename) => {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = cols.map((width) => ({ width }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
  XLSX.writeFile(workbook, filename);
};

const exportClientList = (clients, { bakeryId, preset, groupHeader, segment, filenameStem, period, count, periodColumns }) => {
  const presetDef = preset ? CLIENT_EXPORT_PRESETS[bakeryId] : null;
  const sheet = presetDef
    ? presetDef.build(clients)
    : buildStandardClientSheet(clients, { groupHeader, segment, periodColumns });

  const unit = UNIT_PLURAL[period] || period;
  const today = new Date().toISOString().split('T')[0];
  const stem = presetDef ? `${filenameStem}-b2chat` : filenameStem;
  writeClientSheet(sheet, `${stem}_${segment}_ultimos-${count}-${unit}_${today}.xlsx`);
};

// One contact per client: a period repeats the same user across many orders.
const exportOrderClientsPreset = (orders, bakeryId) => {
  const presetDef = CLIENT_EXPORT_PRESETS[bakeryId];
  const clients = [...new Map(orders.map((o) => [o.userId, { name: o.userName, phone: o.userPhone }])).values()];
  const today = new Date().toISOString().split('T')[0];
  writeClientSheet(presetDef.build(clients), `pedidos-${presetDef.label.toLowerCase()}_${today}.xlsx`);
};

export { exportOrders, exportProducts, exportPaymentReport, exportProductReport, exportIncomeStatement, exportClientList, exportOrderClientsPreset, clientExportPreset };

import * as XLSX from 'xlsx';

// Function to transform order data into rows
const transformOrderToRows = (order, orderIndex) => {
  console.log(order);
  const baseRow = {
    pedido: orderIndex + 1, // Order-level index
    id: order.id,
    fecha_venta: new Date(order.preparationDate).toISOString().split('T')[0],
    pago_recibido: order.isPaid ? 'si' : 'no',
    metodo: getPaymentMethodText(order.paymentMethod),
    cliente: order.userName || '',
    correo: order.userEmail || '',
    nationalId: order.userNationalId || '',
    direccion: order.deliveryAddress || '',
    telefono: order.userPhone || '',
    producto: '',
    cantidad: '',
    subtotal: '',
    total: order.total || '',
  };

  // Create rows for each order item
  const itemRows = [];
  if (Array.isArray(order.orderItems)) {
    order.orderItems.forEach((item, itemIndex) => {
      const productName = [item.productName || '', item.variation?.name || '']
        .filter(Boolean)
        .join(' ');

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
        producto: productName,
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
      producto: 'domicilio',
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
    producto: '',
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
  };
  return methodMap[method] || method;
};

// Main export function
const exportOrders = (orders) => {
  // Ensure orders is an array
  const ordersArray = Array.isArray(orders) ? orders : [];

  // Transform all orders into rows
  const allRows = ordersArray.flatMap((order, orderIndex) =>
    transformOrderToRows(order, orderIndex)
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
    { width: 25 }, // correo
    { width: 15 }, // nationalId
    { width: 30 }, // direccion
    { width: 15 }, // telefono
    { width: 25 }, // producto
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
// Function to distribute delivery fee in intervals of 500
const distributeDeliveryFee = (deliveryFee, itemCount) => {
  if (!deliveryFee || itemCount === 0) {
    return new Array(itemCount).fill(0);
  }

  const baseAmount = Math.floor(deliveryFee / 500) * 500; // Round down to nearest 500
  const remainder = deliveryFee - baseAmount;

  const basePerItem = Math.floor(baseAmount / itemCount / 500) * 500; // Base amount per item (in 500 intervals)
  const remainingBase = baseAmount - basePerItem * itemCount;

  // Create distribution array
  const distribution = new Array(itemCount).fill(basePerItem);

  // Distribute remaining base amount in 500 chunks
  let remainingChunks = remainingBase / 500;
  for (let i = 0; i < itemCount && remainingChunks > 0; i++) {
    distribution[i] += 500;
    remainingChunks--;
  }

  // Add the remainder to the last item
  if (remainder > 0) {
    distribution[itemCount - 1] += remainder;
  }

  return distribution;
};

// Function to aggregate product sales data
const aggregateProductSales = (orders) => {
  const productMap = new Map();

  orders.forEach((order) => {
    // Only process paid orders
    console.log(order);
    if (!order.isPaid) return;

    // Process each order item
    if (Array.isArray(order.orderItems) && order.orderItems.length > 0) {
      // Get delivery fee distribution for this order's items
      const deliveryFee = order.deliveryFee || 0;
      const deliveryDistribution = distributeDeliveryFee(
        deliveryFee,
        order.orderItems.length
      );

      order.orderItems.forEach((item, index) => {
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

        // Calculate item subtotal including its share of delivery fee
        const itemSubtotal = (item.subtotal || 0) + deliveryDistribution[index];

        // Update aggregated data
        productData.cantidad_total += item.quantity || 0;
        productData.ingresos_totales += itemSubtotal;
        productData.pedidos_count.add(order.id);
      });
    }
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
            (product.ingresos_totales / product.cantidad_total) * 100
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
    0
  );
  const totalRevenue = productSales.reduce(
    (sum, product) => sum + product.ingresos_totales,
    0
  );
  const totalOrders = new Set(
    productSales.flatMap((product) =>
      Array.from({ length: product.pedidos_unicos }, (_, i) => i)
    )
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
      producto: 'NOTA IMPORTNTE:',
      variacion:
        'Este reporte distribuye proporcionalmente el costo de domicilio entre los productos de cada pedido. Los valores mostrados incluyen esta distribución',
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
        0
      ),
      totalRevenue: productSales.reduce(
        (sum, product) => sum + product.ingresos_totales,
        0
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
    (a, b) => new Date(a.paymentDate || 0) - new Date(b.paymentDate || 0)
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
    correo: order.userEmail || '',
    nationalId: order.userNationalId || '',
    direccion: order.deliveryAddress || '',
    telefono: order.userPhone || '',
    metodo_pago: getPaymentMethodText(order.paymentMethod),
    total_pago: entry.paymentAmount || '',
    total_pedido: order.total || '',
    pedido_id: order.id || '',
    producto: '',
    cantidad: '',
    subtotal: '',
  };

  // Create rows for each order item
  const itemRows = [];
  if (Array.isArray(order.orderItems)) {
    order.orderItems.forEach((item, itemIndex) => {
      const productName = [item.productName || '', item.variation?.name || '']
        .filter(Boolean)
        .join(' ');

      itemRows.push({
        entrada: entryIndex + 1, // Payment entry index
        fecha_pago: '',
        fecha_pedido: '',
        tipo_pago: '',
        cliente: '',
        correo: '',
        nationalId: '',
        direccion: '',
        telefono: '',
        metodo_pago: '',
        total_pago: '',
        total_pedido: '',
        pedido_id: '',
        producto: productName,
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
      correo: '',
      nationalId: '',
      direccion: '',
      telefono: '',
      metodo_pago: '',
      total_pago: '',
      total_pedido: '',
      pedido_id: '',
      producto: 'domicilio',
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
    correo: '',
    nationalId: '',
    direccion: '',
    telefono: '',
    metodo_pago: '',
    total_pago: '',
    total_pedido: '',
    pedido_id: '',
    producto: '',
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
    transformPaymentEntryToRows(entry, entryIndex)
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
    { width: 25 }, // correo
    { width: 15 }, // nationalId
    { width: 30 }, // direccion
    { width: 15 }, // telefono
    { width: 15 }, // metodo_pago
    { width: 12 }, // total_pago
    { width: 12 }, // total_pedido
    { width: 15 }, // pedido_id
    { width: 25 }, // producto
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
        0
      ),
      partialPayments: paymentEntries.filter(
        (entry) => entry.paymentType === 'parcial'
      ).length,
      fullPayments: paymentEntries.filter(
        (entry) => entry.paymentType === 'completo'
      ).length,
      balancePayments: paymentEntries.filter(
        (entry) => entry.paymentType === 'saldo'
      ).length,
    },
  };
};

export { exportOrders, exportProducts, exportPaymentReport };

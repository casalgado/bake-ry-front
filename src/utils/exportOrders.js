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

export default exportOrders;

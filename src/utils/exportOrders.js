// Function to transform order data into CSV rows
const transformOrderToCSVRows = (order, orderIndex) => {
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
      const productName = [
        item.productName || '',
        item.variation?.name || '',
      ].filter(Boolean).join(' ');

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

  // Transform all orders into CSV rows
  const allRows = ordersArray.flatMap((order, orderIndex) =>
    transformOrderToCSVRows(order, orderIndex),
  );

  // Add a global index to each row
  const indexedRows = allRows.map((row, orden) => ({
    orden: orden + 1, // Add a global index starting from 1
    ...row,
  }));

  // Convert to CSV string
  const headers = ['orden', 'pedido', 'id', 'fecha_venta', 'pago_recibido', 'metodo',
    'cliente', 'correo', 'nationalId', 'direccion', 'telefono', 'producto',
    'cantidad', 'subtotal', 'total'];

  const csvContent = [
    headers.join(','),
    ...indexedRows.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === undefined || value === null || value === '') return '';

        // Convert value to string and escape special characters
        const stringValue = String(value)
          .replace(/"/g, '""') // Escape quotes
          .replace(/\n/g, ' '); // Replace newlines with spaces

        return `"${stringValue}"`;
      }).join(','),
    ),
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default exportOrders;

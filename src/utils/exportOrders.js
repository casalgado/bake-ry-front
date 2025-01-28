// Function to transform order data into CSV rows
const transformOrderToCSVRows = (order, index) => {
  const baseRow = {
    o: index + 1,
    id: order.id,
    fecha_venta: new Date(order.preparationDate).toISOString().split('T')[0],
    pago_recibido: order.isPaid ? 'si' : 'no',
    metodo: getPaymentMethodText(order.paymentMethod),
    cliente: order.userName || '',
    correo: order.email || '',
    cedula: order.document || '',
    direccion: order.address || '',
    telefono: order.phone || '',
    producto: '',
    cantidad: '',
    subtotal: '',
    total: order.total || '',
  };

  // Create rows for each order item
  const itemRows = order.orderItems.map(item => ({
    o: '',
    id: '',
    fecha_venta: '',
    pago_recibido: '',
    metodo: '',
    cliente: '',
    correo: '',
    cedula: '',
    direccion: '',
    telefono: '',
    producto: item.name,
    cantidad: item.quantity,
    subtotal: item.price * item.quantity,
    total: '',
  }));

  // If there's delivery, add it as an item
  if (order.fulfillmentType === 'delivery' && order.deliveryFee) {
    itemRows.push({
      o: '',
      id: '',
      fecha_venta: '',
      pago_recibido: '',
      metodo: '',
      cliente: '',
      correo: '',
      cedula: '',
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
    o: '',
    id: '',
    fecha_venta: '',
    pago_recibido: '',
    metodo: '',
    cliente: '',
    correo: '',
    cedula: '',
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
  // Transform all orders into CSV rows
  const allRows = orders.flatMap((order, index) =>
    transformOrderToCSVRows(order, index),
  );

  // Convert to CSV string
  const headers = ['o', 'id', 'fecha_venta', 'pago_recibido', 'metodo',
    'cliente', 'correo', 'cedula', 'direccion', 'telefono', 'producto',
    'cantidad', 'subtotal', 'total'];

  const csvContent = [
    headers.join(','),
    ...allRows.map(row =>
      headers.map(header =>
      // Escape commas and quotes in values
        row[header] !== undefined && row[header] !== null
          ? `"${String(row[header]).replace(/"/g, '""')}"`
          : '',
      ).join(','),
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

<script setup>
import { ref, computed, onMounted } from 'vue';
import { formatMoney } from '@/utils/helpers';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

const props = defineProps({
  orders: {
    type: Array,
    required: true,
  },
  invoiceType: {
    type: String,
    default: 'invoice', // 'invoice' or 'quote'
  },
  invoiceNumber: {
    type: String,
    default: '',
  },
});

const settingsStore = useBakerySettingsStore();
const bakerySettings = ref(null);

onMounted(async () => {
  await settingsStore.fetchById('default');
  bakerySettings.value = settingsStore.items[0];
});

// Compute invoice title based on type and payment status
const invoiceTitle = computed(() => {
  if (props.invoiceType === 'quote') {
    return 'COTIZACIÓN';
  }
  return 'FACTURA';
});

// Compute combined items from all orders
const combinedItems = computed(() => {
  const items = [];

  props.orders.forEach(order => {
    if (order.orderItems && Array.isArray(order.orderItems)) {
      order.orderItems.forEach(item => {
        items.push({
          orderId: order.id,
          preparationDate: order.preparationDate,
          productName: item.productName || 'Producto',
          variation: item.variation?.name || '',
          quantity: item.quantity || 0,
          unitPrice: (item.subtotal / item.quantity) || 0,
          subtotal: item.subtotal || 0,
        });
      });
    }

    // Add delivery fee as a line item if applicable
    if (order.fulfillmentType === 'delivery' && order.deliveryFee > 0) {
      items.push({
        orderId: order.id,
        preparationDate: order.preparationDate,
        productName: 'Servicio de Domicilio',
        variation: '',
        quantity: 1,
        unitPrice: order.deliveryFee,
        subtotal: order.deliveryFee,
      });
    }
  });

  return items;
});

// Compute totals
const totals = computed(() => {
  let subtotal = 0;
  let deliveryTotal = 0;

  props.orders.forEach(order => {
    subtotal += order.subtotal || 0;
    if (order.fulfillmentType === 'delivery') {
      deliveryTotal += order.deliveryFee || 0;
    }
  });

  return {
    subtotal,
    delivery: deliveryTotal,
    total: subtotal + deliveryTotal,
  };
});

// Get client info from first order (all should be same client)
const clientInfo = computed(() => {
  if (!props.orders.length) return {};
  const firstOrder = props.orders[0];
  return {
    name: firstOrder.userName || '',
    legalName: firstOrder.userLegalName || '',
    email: firstOrder.userEmail || '',
    phone: firstOrder.userPhone || '',
    nationalId: firstOrder.userNationalId || '',
    address: firstOrder.deliveryAddress || '',
  };
});

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Format date with time
const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Get date range for multiple orders
const dateRange = computed(() => {
  if (props.orders.length === 1) {
    return formatDate(props.orders[0].preparationDate);
  }

  const dates = props.orders.map(o => new Date(o.preparationDate));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  if (minDate.toDateString() === maxDate.toDateString()) {
    return formatDate(minDate);
  }

  return `${formatDate(minDate)} - ${formatDate(maxDate)}`;
});

// Trigger print
const handlePrint = () => {
  window.print();
};
</script>

<template>
  <div class="invoice-container">
    <!-- Print button (hidden during print) -->
    <div class="print-controls">
      <button @click="handlePrint" class="print-btn">
        Imprimir
      </button>
    </div>

    <!-- Invoice content -->
    <div class="invoice-content">
      <!-- Header with logo and business info -->
      <div class="invoice-header">
        <div class="logo-section">
          <img
            v-if="bakerySettings?.branding?.logos?.medium"
            :src="bakerySettings.branding.logos.medium"
            :alt="bakerySettings?.name"
            class="company-logo"
          />
          <div v-else class="company-name">
            {{ bakerySettings?.name || 'Mi Panadería' }}
          </div>
        </div>

        <div class="business-info">
          <h1 class="invoice-title">{{ invoiceTitle }}</h1>
          <p v-if="invoiceNumber" class="invoice-number">No. {{ invoiceNumber }}</p>
          <p v-else-if="orders.length === 1" class="invoice-number">
            Pedido #{{ orders[0].id }}
          </p>
          <p v-else class="invoice-number">
            {{ orders.length }} pedidos combinados
          </p>
          <p class="invoice-date">{{ dateRange }}</p>
        </div>
      </div>

      <!-- Company details -->
      <div class="company-details" v-if="bakerySettings">
        <div>
          <strong>{{ bakerySettings.name }}</strong><br>
          <span v-if="bakerySettings.legalName">{{ bakerySettings.legalName }}<br></span>
          <span v-if="bakerySettings.nationalId">NIT: {{ bakerySettings.nationalId }}<br></span>
          <span v-if="bakerySettings.address">{{ bakerySettings.address }}<br></span>
          <span v-if="bakerySettings.phone">Tel: {{ bakerySettings.phone }}<br></span>
          <span v-if="bakerySettings.email">{{ bakerySettings.email }}</span>
        </div>
      </div>

      <!-- Client information -->
      <div class="client-section">
        <h2>Información del Cliente</h2>
        <div class="client-info">
          <div class="info-row">
            <span class="label">Cliente:</span>
            <span class="value">{{ clientInfo.name }}</span>
          </div>
          <div v-if="clientInfo.legalName" class="info-row">
            <span class="label">Razón Social:</span>
            <span class="value">{{ clientInfo.legalName }}</span>
          </div>
          <div v-if="clientInfo.nationalId" class="info-row">
            <span class="label">NIT/CC:</span>
            <span class="value">{{ clientInfo.nationalId }}</span>
          </div>
          <div v-if="clientInfo.address" class="info-row">
            <span class="label">Dirección:</span>
            <span class="value">{{ clientInfo.address }}</span>
          </div>
          <div v-if="clientInfo.phone" class="info-row">
            <span class="label">Teléfono:</span>
            <span class="value">{{ clientInfo.phone }}</span>
          </div>
          <div v-if="clientInfo.email" class="info-row">
            <span class="label">Email:</span>
            <span class="value">{{ clientInfo.email }}</span>
          </div>
        </div>
      </div>

      <!-- Order items table -->
      <div class="items-section">
        <h2>Detalle</h2>
        <table class="items-table">
          <thead>
            <tr>
              <th class="text-left">Producto</th>
              <th v-if="orders.length > 1" class="text-center">Pedido</th>
              <th v-if="orders.length > 1" class="text-center">Fecha</th>
              <th class="text-center">Cantidad</th>
              <th class="text-right">Precio Unit.</th>
              <th class="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in combinedItems" :key="index">
              <td class="text-left">
                {{ item.productName }}
                <span v-if="item.variation" class="item-variation">
                  ({{ item.variation }})
                </span>
              </td>
              <td v-if="orders.length > 1" class="text-center">
                #{{ item.orderId }}
              </td>
              <td v-if="orders.length > 1" class="text-center">
                {{ formatDate(item.preparationDate) }}
              </td>
              <td class="text-center">{{ item.quantity }}</td>
              <td class="text-right">{{ formatMoney(item.unitPrice) }}</td>
              <td class="text-right">{{ formatMoney(item.subtotal) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="totals-separator">
              <td :colspan="orders.length > 1 ? 6 : 4"></td>
            </tr>
            <tr class="subtotal-row">
              <td :colspan="orders.length > 1 ? 5 : 3" class="text-right">
                <strong>Subtotal:</strong>
              </td>
              <td class="text-right">{{ formatMoney(totals.subtotal) }}</td>
            </tr>
            <tr v-if="totals.delivery > 0" class="delivery-row">
              <td :colspan="orders.length > 1 ? 5 : 3" class="text-right">
                <strong>Domicilios:</strong>
              </td>
              <td class="text-right">{{ formatMoney(totals.delivery) }}</td>
            </tr>
            <tr class="total-row">
              <td :colspan="orders.length > 1 ? 5 : 3" class="text-right">
                <strong>TOTAL:</strong>
              </td>
              <td class="text-right total-amount">
                <strong>{{ formatMoney(totals.total) }}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Payment information -->
      <div class="payment-section" v-if="orders.length === 1">
        <div class="payment-info">
          <span v-if="orders[0].isPaid" class="paid-badge">PAGADO</span>
          <span v-else class="unpaid-badge">PENDIENTE DE PAGO</span>
          <span v-if="orders[0].paymentMethod" class="payment-method">
            - Método: {{ orders[0].paymentMethod }}
          </span>
        </div>
      </div>

      <!-- Footer -->
      <div class="invoice-footer">
        <p class="footer-text">
          Gracias por su preferencia
        </p>
        <p v-if="bakerySettings?.website" class="footer-website">
          {{ bakerySettings.website }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Regular styles */
.invoice-container {
  background: white;
  min-height: 100vh;
}

.print-controls {
  padding: 1rem;
  text-align: center;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.print-btn {
  background: #3b82f6;
  color: white;
  padding: 0.5rem 2rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.2s;
}

.print-btn:hover {
  background: #2563eb;
}

.invoice-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #1f2937;
}

.logo-section {
  flex: 1;
}

.company-logo {
  max-height: 80px;
  max-width: 200px;
  object-fit: contain;
}

.company-name {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
}

.business-info {
  text-align: right;
}

.invoice-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.invoice-number {
  color: #6b7280;
  margin: 0.25rem 0;
}

.invoice-date {
  color: #6b7280;
  margin: 0.25rem 0;
}

.company-details {
  margin-bottom: 2rem;
  color: #4b5563;
  line-height: 1.5;
}

.client-section {
  margin-bottom: 2rem;
}

.client-section h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.client-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.info-row {
  display: flex;
  gap: 0.5rem;
}

.info-row .label {
  font-weight: 500;
  color: #6b7280;
  min-width: 100px;
}

.info-row .value {
  color: #1f2937;
}

.items-section {
  margin-bottom: 2rem;
}

.items-section h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th {
  background: #f9fafb;
  padding: 0.75rem 0.5rem;
  font-weight: 600;
  color: #1f2937;
  border-bottom: 2px solid #e5e7eb;
}

.items-table td {
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
}

.item-variation {
  color: #6b7280;
  font-size: 0.875rem;
  margin-left: 0.25rem;
}

.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

.totals-separator td {
  border-bottom: 2px solid #e5e7eb;
  padding: 0.5rem 0;
}

.subtotal-row td,
.delivery-row td {
  padding: 0.5rem;
  color: #4b5563;
}

.total-row td {
  padding: 0.75rem 0.5rem;
  font-size: 1.125rem;
  color: #1f2937;
  border-top: 2px solid #1f2937;
  border-bottom: 2px solid #1f2937;
}

.total-amount {
  color: #1f2937;
  font-size: 1.25rem;
}

.payment-section {
  margin: 2rem 0;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.375rem;
}

.payment-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.paid-badge {
  background: #10b981;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-weight: 500;
}

.unpaid-badge {
  background: #ef4444;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-weight: 500;
}

.payment-method {
  color: #6b7280;
}

.invoice-footer {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  text-align: center;
}

.footer-text {
  color: #6b7280;
  margin: 0.5rem 0;
}

.footer-website {
  color: #3b82f6;
  font-weight: 500;
}

/* Print styles */
@media print {
  .print-controls {
    display: none !important;
  }

  .invoice-container {
    background: white;
  }

  .invoice-content {
    max-width: 100%;
    padding: 0;
    margin: 0;
  }

  .invoice-header {
    page-break-inside: avoid;
  }

  .items-table {
    page-break-inside: auto;
  }

  .items-table tr {
    page-break-inside: avoid;
  }

  .payment-section {
    page-break-inside: avoid;
  }

  .invoice-footer {
    page-break-inside: avoid;
  }

  /* Ensure colors print properly */
  .paid-badge,
  .unpaid-badge {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Adjust font sizes for print */
  body {
    font-size: 12pt;
  }

  .invoice-title {
    font-size: 18pt;
  }

  .total-amount {
    font-size: 14pt;
  }
}
</style>

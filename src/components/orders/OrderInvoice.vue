<script setup>
import { computed } from 'vue';
import { formatMoney } from '@/utils/helpers';

const props = defineProps({
  orders: {
    type: Array,
    required: true,
  },
  bakerySettings: {
    type: Object,
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

// Format date for display - short format dd/mm/yy for tables
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${day}/${month}/${year}`;
};

// Format date for header - long format 01 Oct 2025
const formatDateLong = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

// Format order ID to show first 5 characters
const formatOrderId = (orderId) => {
  if (!orderId) return '';
  return orderId.toString().slice(0, 5);
};

// Get date range for multiple orders
const dateRange = computed(() => {
  if (props.orders.length === 1) {
    return formatDateLong(props.orders[0].preparationDate);
  }

  const dates = props.orders.map(o => new Date(o.preparationDate));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  if (minDate.toDateString() === maxDate.toDateString()) {
    return formatDateLong(minDate);
  }

  return `${formatDateLong(minDate)} - ${formatDateLong(maxDate)}`;
});

// Trigger print
const handlePrint = () => {
  window.print();
};
</script>

<template>
  <div class="bg-white min-h-screen">

    <!-- Invoice content -->
    <div class="max-w-4xl mx-auto p-8">
      <!-- Header with logo and business info -->
      <div class="flex justify-between items-start mb-8 pb-4 border-b-2 border-gray-800">
        <div class="flex-1">
          <img
            v-if="props.bakerySettings?.branding?.logos?.medium || props.bakerySettings?.branding?.logos?.original"
            :src="props.bakerySettings.branding.logos.medium || props.bakerySettings.branding.logos.original"
            :alt="props.bakerySettings?.name"
            class="h-20 max-w-xs object-contain"
          />
          <div v-else class="text-2xl font-bold text-gray-800">
            {{ props.bakerySettings?.name || 'Mi Panadería' }}
          </div>
        </div>

        <div class="text-right">
          <h1 class="text-2xl font-bold text-gray-800 mb-2">{{ invoiceTitle }}</h1>
          <p v-if="invoiceNumber" class="text-gray-700">No. {{ invoiceNumber }}</p>
          <p v-else-if="orders.length === 1" class="text-gray-700">
            Pedido #{{ formatOrderId(orders[0].id) }}
          </p>
          <p v-else class="text-gray-700">
            {{ orders.length }} pedidos
          </p>
          <p class="text-gray-700">{{ dateRange }}</p>
        </div>
      </div>

      <!-- Company details -->
      <div class="mb-8 text-gray-700 leading-relaxed">
        <div>
          <strong class="text-gray-800">{{ props.bakerySettings.name }}</strong><br>
          <span v-if="props.bakerySettings.legalName">{{ props.bakerySettings.legalName }}<br></span>
          <span v-if="props.bakerySettings.nationalId">NIT: {{ props.bakerySettings.nationalId }}<br></span>
          <span v-if="props.bakerySettings.address">{{ props.bakerySettings.address }}<br></span>
          <span v-if="props.bakerySettings.phone">Tel: {{ props.bakerySettings.phone }}<br></span>
          <span v-if="props.bakerySettings.email">{{ props.bakerySettings.email }}</span>
        </div>
      </div>

      <!-- Client information -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
          Información del Cliente
        </h2>
        <div class="grid grid-cols-2 gap-2">
          <div class="flex gap-2">
            <span class="font-medium text-gray-700 min-w-[100px]">Cliente:</span>
            <span class="text-gray-800">{{ clientInfo.name }}</span>
          </div>
          <div v-if="clientInfo.legalName" class="flex gap-2">
            <span class="font-medium text-gray-700 min-w-[100px]">Razón Social:</span>
            <span class="text-gray-800">{{ clientInfo.legalName }}</span>
          </div>
          <div v-if="clientInfo.nationalId" class="flex gap-2">
            <span class="font-medium text-gray-700 min-w-[100px]">NIT/CC:</span>
            <span class="text-gray-800">{{ clientInfo.nationalId }}</span>
          </div>
          <div v-if="clientInfo.address" class="flex gap-2">
            <span class="font-medium text-gray-700 min-w-[100px]">Dirección:</span>
            <span class="text-gray-800">{{ clientInfo.address }}</span>
          </div>
          <div v-if="clientInfo.phone" class="flex gap-2">
            <span class="font-medium text-gray-700 min-w-[100px]">Teléfono:</span>
            <span class="text-gray-800">{{ clientInfo.phone }}</span>
          </div>
          <div v-if="clientInfo.email" class="flex gap-2">
            <span class="font-medium text-gray-700 min-w-[100px]">Email:</span>
            <span class="text-gray-800">{{ clientInfo.email }}</span>
          </div>
        </div>
      </div>

      <!-- Order items table -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
          Detalle
        </h2>
        <table class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b-2 border-gray-200">
              <th class="text-left py-3 px-2 font-semibold text-gray-800">Producto</th>
              <th v-if="orders.length > 1" class="text-center py-3 px-2 font-semibold text-gray-800">Pedido</th>
              <th v-if="orders.length > 1" class="text-center py-3 px-2 font-semibold text-gray-800 text-sm">Fecha</th>
              <th class="text-center py-3 px-2 font-semibold text-gray-800">Cant.</th>
              <th class="text-right py-3 px-2 font-semibold text-gray-800">P. Unit.</th>
              <th class="text-right py-3 px-2 font-semibold text-gray-800">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in combinedItems" :key="index" class="border-b border-gray-100">
              <td class="text-left py-3 px-2 text-gray-800">
                {{ item.productName }}
                <span v-if="item.variation" class="text-gray-700 text-sm ml-1">
                  ({{ item.variation }})
                </span>
              </td>
              <td v-if="orders.length > 1" class="text-center py-3 px-2 text-gray-700">
                #{{ formatOrderId(item.orderId) }}
              </td>
              <td v-if="orders.length > 1" class="text-center py-3 px-2 text-gray-700 text-sm">
                {{ formatDate(item.preparationDate) }}
              </td>
              <td class="text-center py-3 px-2 text-gray-800">{{ item.quantity }}</td>
              <td class="text-right py-3 px-2 text-gray-800">{{ formatMoney(item.unitPrice) }}</td>
              <td class="text-right py-3 px-2 text-gray-800">{{ formatMoney(item.subtotal) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td :colspan="orders.length > 1 ? 6 : 4" class="py-2 border-b-2 border-gray-200"></td>
            </tr>
            <tr>
              <td :colspan="orders.length > 1 ? 5 : 3" class="text-right py-2 px-2">
                <strong class="text-gray-700">Subtotal:</strong>
              </td>
              <td class="text-right py-2 px-2 text-gray-800">{{ formatMoney(totals.subtotal) }}</td>
            </tr>
            <tr v-if="totals.delivery > 0">
              <td :colspan="orders.length > 1 ? 5 : 3" class="text-right py-2 px-2">
                <strong class="text-gray-700">Domicilios:</strong>
              </td>
              <td class="text-right py-2 px-2 text-gray-800">{{ formatMoney(totals.delivery) }}</td>
            </tr>
            <tr class="border-t-2 border-b-2 border-gray-800">
              <td :colspan="orders.length > 1 ? 5 : 3" class="text-right py-3 px-2">
                <strong class="text-gray-800 text-lg">TOTAL:</strong>
              </td>
              <td class="text-right py-3 px-2">
                <strong class="text-gray-800 text-xl">{{ formatMoney(totals.total) }}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Footer -->
      <div v-if="props.bakerySettings?.website" class="mt-12 pt-4 border-t border-gray-200 text-center">
        <p class="text-blue-500 font-medium">
          {{ props.bakerySettings.website }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>

@media print {

  .print-controls {
    display: none !important;
  }

  /* Ensure proper page breaks */
  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
  }

  /* Ensure colors print properly */
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }
}
</style>

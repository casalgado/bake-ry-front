<script setup>
import { ref, computed, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { formatMoney, capitalize } from '@/utils/helpers';

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

const emit = defineEmits(['update']);

// Editable state for Terms & Conditions
const editableTerms = ref('');

// Track which descriptions are being edited
const editingDescriptions = ref(new Set());

const startEditingDescription = (uniqueKey) => {
  editingDescriptions.value.add(uniqueKey);
};

// Load terms from order or settings
const termsSource = computed(() =>
  props.orders[0]?.invoiceCustomizations?.termsAndConditions ||
  props.bakerySettings?.features?.invoicing?.defaultTermsAndConditions ||
  '',
);

// Initialize terms when source changes
watch(termsSource, (value) => {
  editableTerms.value = value;
}, { immediate: true });

// Debounced update handlers (1 second delay)
const updateDescription = useDebounceFn((orderIndex, itemIndex, value) => {
  emit('update', {
    type: 'description',
    orderIndex,
    itemIndex,
    value: value.trim(),
  });
}, 1000);

const updateTerms = useDebounceFn((value) => {
  emit('update', {
    type: 'terms',
    value: value.trim(),
  });
}, 1500);

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

  props.orders.forEach((order, orderIndex) => {
    if (order.orderItems && Array.isArray(order.orderItems)) {
      order.orderItems.forEach((item, itemIndex) => {
        items.push({
          orderId: order.id,
          preparationDate: order.preparationDate,
          productName: item.productName || 'Producto',
          productDescription: item.productDescription || '',
          variation: item.variation?.name || '',
          quantity: item.quantity || 0,
          unitPrice: (item.subtotal / item.quantity) || 0,
          subtotal: item.subtotal || 0,
          orderIndex,
          itemIndex,
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
  <div class="bg-white">

    <!-- Invoice content -->
    <div class="max-w-4xl mx-auto p-6 pt-0">
      <!-- Header with logo and business info -->
      <div class="flex justify-between items-start mb-4 pb-3 border-b-2 border-gray-800">
        <div class="flex-1">
          <img
            v-if="props.bakerySettings?.branding?.logos?.medium || props.bakerySettings?.branding?.logos?.original"
            :src="props.bakerySettings.branding.logos.medium || props.bakerySettings.branding.logos.original"
            :alt="props.bakerySettings?.name"
            class="h-16 max-w-xs object-contain"
          />
          <div v-else class="text-2xl font-bold text-gray-800">
            {{ props.bakerySettings?.name || '' }}
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
      <div class="mb-4 text-gray-700 leading-relaxed">
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
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-200">
          Información del Cliente
        </h2>
        <div class="grid grid-cols-2 gap-1">
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
          <div v-if="clientInfo.email && !clientInfo.email.startsWith('pendiente@')" class="flex gap-2">
            <span class="font-medium text-gray-700 min-w-[100px]">Email:</span>
            <span class="text-gray-800">{{ clientInfo.email }}</span>
          </div>
        </div>
      </div>

      <!-- Order items table -->
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-gray-800 mb-3 pb-1 border-b border-gray-200">
          Detalle
        </h2>
        <table class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b-2 border-gray-200">
              <th class="text-left py-2 px-2 font-semibold text-gray-800">Producto</th>
              <th v-if="orders.length > 1" class="text-center py-2 px-2 font-semibold text-gray-800">Pedido</th>
              <th v-if="orders.length > 1" class="text-center py-2 px-2 font-semibold text-gray-800 text-sm">Fecha</th>
              <th class="text-center py-2 px-2 font-semibold text-gray-800">Cant.</th>
              <th class="text-right py-2 px-2 font-semibold text-gray-800">P. Unit.</th>
              <th class="text-right py-2 px-2 font-semibold text-gray-800">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in combinedItems" :key="index" class="border-b border-gray-200">
              <td class="text-left py-2 px-2 text-gray-800">
                <div>
                  {{ capitalize(item.productName) }}
                  <span v-if="item.variation" class="text-gray-700 text-sm ml-1">
                    ({{ capitalize(item.variation) }})
                  </span>
                </div>
                <!-- Show description if it exists OR is being edited -->
                <div
                  v-if="item.orderIndex !== undefined && (item.productDescription || editingDescriptions.has(`${item.orderIndex}-${item.itemIndex}`))"
                  contenteditable="true"
                  @input="e => updateDescription(item.orderIndex, item.itemIndex, e.target.textContent)"
                  @focus="startEditingDescription(`${item.orderIndex}-${item.itemIndex}`)"
                  class="text-sm text-gray-600 mt-1 p-1 rounded hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  :data-placeholder="'Descripción del producto...'"
                >{{ item.productDescription }}</div>
                <!-- Show add button when empty and not editing -->
                <button
                  v-else-if="item.orderIndex !== undefined"
                  @click="startEditingDescription(`${item.orderIndex}-${item.itemIndex}`)"
                  class="text-xs text-blue-600 hover:text-blue-800 mt-1 print:hidden"
                >
                  + Agregar descripción
                </button>
              </td>
              <td v-if="orders.length > 1" class="text-center py-2 px-2 text-gray-700">
                #{{ formatOrderId(item.orderId) }}
              </td>
              <td v-if="orders.length > 1" class="text-center py-2 px-2 text-gray-700 text-sm">
                {{ formatDate(item.preparationDate) }}
              </td>
              <td class="text-center py-2 px-2 text-gray-800">{{ item.quantity }}</td>
              <td class="text-right py-2 px-2 text-gray-800">{{ formatMoney(item.unitPrice) }}</td>
              <td class="text-right py-2 px-2 text-gray-800">{{ formatMoney(item.subtotal) }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Totals Section -->
        <div class="mt-2 border-t-2 border-gray-200 pt-2">
          <div class="flex justify-between py-2 px-2">
            <strong class="text-gray-700">Subtotal:</strong>
            <span class="text-gray-800">{{ formatMoney(totals.subtotal) }}</span>
          </div>
          <div v-if="totals.delivery > 0" class="flex justify-between py-2 px-2">
            <strong class="text-gray-700">Domicilios:</strong>
            <span class="text-gray-800">{{ formatMoney(totals.delivery) }}</span>
          </div>
          <div class="flex justify-between py-3 px-2 border-t-2 border-b-2 border-gray-800">
            <strong class="text-gray-800 text-lg">TOTAL:</strong>
            <strong class="text-gray-800 text-xl">{{ formatMoney(totals.total) }}</strong>
          </div>
        </div>
      </div>

      <!-- Terms & Conditions -->
      <div v-if="orders.length === 1" class="mt-4 pt-4 border-t border-gray-200">
        <h3 class="text-sm font-semibold text-gray-800 mb-2">
          Términos y Condiciones
        </h3>
        <div
          contenteditable="true"
          @input="e => updateTerms(e.target.textContent)"
          v-text="editableTerms"
          class="text-xs text-gray-600 p-2 rounded border border-transparent hover:border-gray-200 focus:border-gray-300 focus:outline-none min-h-[40px] whitespace-pre-wrap"
          :data-placeholder="'Agregar términos y condiciones...'"
        />
      </div>

      <!-- Footer -->
      <div v-if="props.bakerySettings?.website" class="mt-6 pt-4 border-t border-gray-200 text-center">
        <p class="text-blue-500 font-medium">
          {{ props.bakerySettings.website }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Editable field styles - placeholder only shows when empty AND focused */
[contenteditable]:empty:focus:before {
  content: attr(data-placeholder);
  color: #9ca3af;
}

[contenteditable]:focus {
  background-color: #f9fafb;
}

@media print {
  /* Remove browser default headers/footers */
  @page {
    margin: 0;
    padding-top: 1cm;
    padding-bottom: 1cm;
    size: auto;
  }

  .print-controls {
    display: none !important;
  }

  /* Hide all buttons and empty editable divs when printing */
  button {
    display: none !important;
  }

  [contenteditable]:empty {
    display: none !important;
  }

  /* Hide edit UI when printing */
  [contenteditable] {
    border: none !important;
    background: transparent !important;
  }

  /* Ensure proper page breaks */
  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
  }

  /* Ensure colors and fonts print properly */
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }

  /* Fix bold 'l' rendering issue in PDFs */
  body, * {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
</style>

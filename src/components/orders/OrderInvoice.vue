<script setup>
import { ref, computed, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { PhCaretUp, PhCaretDown } from '@phosphor-icons/vue';
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
const updateDescription = useDebounceFn((orderIndex, itemId, value) => {
  emit('update', {
    type: 'description',
    orderIndex,
    itemId,
    value: value.trim(),
  });
}, 1000);

const updateTitle = useDebounceFn((orderIndex, itemId, value) => {
  emit('update', {
    type: 'title',
    orderIndex,
    itemId,
    value: value.trim(),
  });
}, 1000);

// Convert newlines to <br> for contenteditable display
const formatDescriptionForDisplay = (text) => {
  if (!text) return '';
  return text.replace(/\n/g, '<br>');
};

const updateTerms = useDebounceFn((value) => {
  emit('update', {
    type: 'terms',
    value: value.trim(),
  });
}, 1500);

// Reorder item within an order
const reorderItem = (orderIndex, itemId, direction) => {
  emit('update', {
    type: 'reorder',
    orderIndex,
    itemId,
    direction,
  });
};

// Check if item is first in its order (sorted by displayOrder)
const isFirstItemInOrder = (item) => {
  if (item.orderIndex === undefined) return true;
  const orderItems = props.orders[item.orderIndex]?.orderItems || [];
  const sorted = [...orderItems].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  return sorted[0]?.id === item.id;
};

// Check if item is last in its order (sorted by displayOrder)
const isLastItemInOrder = (item) => {
  if (item.orderIndex === undefined) return true;
  const orderItems = props.orders[item.orderIndex]?.orderItems || [];
  const sorted = [...orderItems].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  return sorted[sorted.length - 1]?.id === item.id;
};

// Convert newlines to <br> for terms display
const formattedTerms = computed(() => formatDescriptionForDisplay(editableTerms.value));

// Compute invoice title based on type and payment status
const invoiceTitle = computed(() => {
  if (props.invoiceType === 'quote') {
    return 'COTIZACIÓN';
  }
  return 'FACTURA';
});

// Compute combined items from all orders
// Uses pre-tax prices in the table; tax totals shown at bottom
const combinedItems = computed(() => {
  const items = [];

  props.orders.forEach((order, orderIndex) => {
    if (order.orderItems && Array.isArray(order.orderItems)) {
      // Sort items by displayOrder before processing
      const sortedItems = order.orderItems
        .slice()
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

      sortedItems.forEach((item, itemIndex) => {
        // Use preTaxPrice for unit price (price without tax)
        const preTaxUnitPrice = item.preTaxPrice || item.currentPrice || 0;
        items.push({
          id: item.id,
          orderId: order.id,
          preparationDate: order.preparationDate,
          productName: item.productName || 'Producto',
          productDescription: item.productDescription || '',
          invoiceTitle: item.invoiceTitle || '',
          variation: item.variation || null,
          combination: item.combination || null,
          quantity: item.quantity || 0,
          unitPrice: preTaxUnitPrice,
          lineTotal: preTaxUnitPrice * (item.quantity || 0),
          taxPercentage: item.taxPercentage || 0,
          orderIndex,
          itemIndex,
        });
      });
    }

    // Add delivery fee as a line item if applicable (no tax on delivery)
    if (order.fulfillmentType === 'delivery' && order.deliveryFee > 0) {
      items.push({
        orderId: order.id,
        preparationDate: order.preparationDate,
        productName: 'Servicio de Domicilio',
        variation: '',
        quantity: 1,
        unitPrice: order.deliveryFee,
        lineTotal: order.deliveryFee,
        taxPercentage: 0,
      });
    }
  });

  return items;
});

// Compute totals
const totals = computed(() => {
  let subtotal = 0;
  let preTaxTotal = 0;
  let totalTaxAmount = 0;
  let deliveryTotal = 0;
  let orderDiscountAmount = 0;

  props.orders.forEach(order => {
    subtotal += order.subtotal || 0;
    preTaxTotal += order.preTaxTotal || 0;
    totalTaxAmount += order.totalTaxAmount || 0;
    orderDiscountAmount += order.orderDiscountAmount || 0;
    if (order.fulfillmentType === 'delivery') {
      deliveryTotal += order.deliveryFee || 0;
    }
  });

  return {
    preTaxTotal,
    totalTaxAmount,
    subtotal,
    delivery: deliveryTotal,
    orderDiscountAmount,
    total: subtotal - orderDiscountAmount + deliveryTotal,
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

// Parse date string as local date to avoid timezone issues
const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  // Extract just the date part (YYYY-MM-DD) if it includes time
  const datePart = dateString.split('T')[0];
  // Parse YYYY-MM-DD as local date (not UTC)
  const [year, month, day] = datePart.split('-').map(Number);
  // Validate the parsed values
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
};

// Format date for display - short format dd/mm/yy for tables
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = parseLocalDate(dateString);
  if (!date) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${day}/${month}/${year}`;
};

// Format date for header - long format 01 Oct 2025
const formatDateLong = (dateString) => {
  if (!dateString) return '';
  const date = parseLocalDate(dateString);
  if (!date) return '';
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

  const dates = props.orders.map(o => parseLocalDate(o.preparationDate)).filter(Boolean);
  if (dates.length === 0) return '';

  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  if (minDate.toDateString() === maxDate.toDateString()) {
    return formatDateLong(props.orders[0].preparationDate);
  }

  // Find the orders with min and max dates
  const minOrder = props.orders.find(o => parseLocalDate(o.preparationDate)?.getTime() === minDate.getTime());
  const maxOrder = props.orders.find(o => parseLocalDate(o.preparationDate)?.getTime() === maxDate.getTime());

  return `${formatDateLong(minOrder?.preparationDate)} - ${formatDateLong(maxOrder?.preparationDate)}`;
});

// Get primary color from bakery settings with fallback
const primaryColor = computed(() => {
  return props.bakerySettings?.branding?.primaryColor || '#6b9e3e';
});

// Get taxMode from first order (defaults to inclusive for backwards compatibility)
const taxMode = computed(() => {
  return props.orders[0]?.taxMode || 'inclusive';
});

// Dynamic label for pre-tax total based on tax mode
const preTaxLabel = computed(() => {
  return taxMode.value === 'exclusive' ? 'Subtotal:' : 'Subtotal (sin IVA):';
});

// Trigger print
const handlePrint = () => {
  window.print();
};
</script>

<template>
  <div class="invoice-container">
    <!-- Header -->
    <div class="invoice-header">
      <div class="logo-section">
        <img
          v-if="props.bakerySettings?.branding?.logos?.medium || props.bakerySettings?.branding?.logos?.original"
          :src="props.bakerySettings.branding.logos.medium || props.bakerySettings.branding.logos.original"
          :alt="props.bakerySettings?.name"
          class="logo-img"
        />
        <div v-else class="logo-text">
          {{ props.bakerySettings?.name || '' }}
        </div>
      </div>

      <div class="header-right">
        <div class="invoice-title">{{ invoiceTitle }}</div>
        <div class="company-info">
          <strong>{{ props.bakerySettings.legalName ? props.bakerySettings.legalName : props.bakerySettings.name }}</strong><br>
          <span v-if="props.bakerySettings.address">{{ props.bakerySettings.address }}<br></span>
          <span v-if="props.bakerySettings.email">{{ props.bakerySettings.email }}<br></span>
          <span v-if="props.bakerySettings.phone">{{ props.bakerySettings.phone }}</span>
        </div>
      </div>
    </div>

    <!-- Info Section -->
    <div class="info-section">
      <div class="bill-to">
        <h3>FACTURAR A</h3>
        <p>{{ capitalize(clientInfo.name) }}</p>
        <div v-if="clientInfo.legalName" class="client-detail">{{ clientInfo.legalName }}</div>
        <div v-if="clientInfo.nationalId" class="client-detail">NIT/CC: {{ clientInfo.nationalId }}</div>
        <div v-if="clientInfo.address" class="client-detail">{{ clientInfo.address }}</div>
        <div v-if="clientInfo.phone" class="client-detail">Tel: {{ clientInfo.phone }}</div>
        <div v-if="clientInfo.email && !clientInfo.email.startsWith('pendiente@') && !clientInfo.email.endsWith('pendiente.com')" class="client-detail">{{ clientInfo.email }}</div>
      </div>

      <div class="invoice-details">
        <table>
          <tr v-if="invoiceNumber">
            <td>Número de {{ invoiceType === 'quote' ? 'Cotización' : 'Factura' }}:</td>
            <td>{{ invoiceNumber }}</td>
          </tr>
          <tr v-else-if="orders.length === 1">
            <td>Número de Pedido:</td>
            <td>#{{ formatOrderId(orders[0].id) }}</td>
          </tr>
          <tr v-else>
            <td>Número de Pedidos:</td>
            <td>{{ orders.length }}</td>
          </tr>
          <tr>
            <td>Fecha:</td>
            <td>{{ dateRange }}</td>
          </tr>
          <tr class="total-highlight">
            <td>Total (COP):</td>
            <td>{{ formatMoney(totals.total) }}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead :style="{ backgroundColor: primaryColor }">
        <tr>
          <th>Productos</th>
          <th v-if="orders.length > 1">Pedido</th>
          <th v-if="orders.length > 1">Fecha</th>
          <th>Cantidad</th>
          <th>Precio</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in combinedItems" :key="index">
          <td class="relative">
            <!-- Reorder arrows (absolutely positioned, hidden on print) -->
            <div
              v-if="item.orderIndex !== undefined"
              class="reorder-arrows print:hidden"
            >
              <button
                type="button"
                @click="reorderItem(item.orderIndex, item.id, 'up')"
                :disabled="isFirstItemInOrder(item)"
                class="reorder-btn"
              >
                <PhCaretUp class="w-3 h-3" />
              </button>
              <button
                type="button"
                @click="reorderItem(item.orderIndex, item.id, 'down')"
                :disabled="isLastItemInOrder(item)"
                class="reorder-btn"
              >
                <PhCaretDown class="w-3 h-3" />
              </button>
            </div>

            <!-- Editable item title for order items -->
            <div
              v-if="item.orderIndex !== undefined"
              contenteditable="true"
              @input="e => updateTitle(item.orderIndex, item.id, e.target.innerText)"
              class="item-title editable-title"
            >{{ item.invoiceTitle }}</div>
            <!-- Non-editable title for delivery fee -->
            <div v-else class="item-title">
              {{ item.productName }}
            </div>
            <!-- Show description if it exists OR is being edited -->
            <div
              v-if="item.orderIndex !== undefined && (item.productDescription || editingDescriptions.has(`${item.orderIndex}-${item.id}`))"
              contenteditable="true"
              @input="e => updateDescription(item.orderIndex, item.id, e.target.innerText)"
              @focus="startEditingDescription(`${item.orderIndex}-${item.id}`)"
              class="item-description editable"
              :data-placeholder="'Descripción del producto...'"
              v-html="formatDescriptionForDisplay(item.productDescription)"
            />
            <!-- Show add button when empty and not editing -->
            <button
              v-else-if="item.orderIndex !== undefined"
              @click="startEditingDescription(`${item.orderIndex}-${item.id}`)"
              class="add-description-btn print:hidden"
            >
              + Agregar descripción
            </button>
          </td>
          <td v-if="orders.length > 1" class="text-center">
            #{{ formatOrderId(item.orderId) }}
          </td>
          <td v-if="orders.length > 1" class="text-center">
            {{ formatDate(item.preparationDate) }}
          </td>
          <td class="text-center">{{ item.quantity }}</td>
          <td class="text-right">{{ formatMoney(item.unitPrice) }}</td>
          <td class="text-right">{{ formatMoney(item.lineTotal) }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Grand Total Section with Tax Breakdown -->
    <div class="grand-total">
      <div class="totals-breakdown">
        <div class="total-row">
          <span class="total-label">{{ preTaxLabel }}</span>
          <span class="total-amount">{{ formatMoney(totals.preTaxTotal) }}</span>
        </div>
        <div v-if="totals.totalTaxAmount > 0" class="total-row">
          <span class="total-label">IVA:</span>
          <span class="total-amount">{{ formatMoney(totals.totalTaxAmount) }}</span>
        </div>
        <div v-if="totals.orderDiscountAmount > 0" class="total-row discount-row">
          <span class="total-label">Descuento:</span>
          <span class="total-amount">-{{ formatMoney(totals.orderDiscountAmount) }}</span>
        </div>
        <div v-if="totals.delivery > 0" class="total-row">
          <span class="total-label">Domicilio:</span>
          <span class="total-amount">{{ formatMoney(totals.delivery) }}</span>
        </div>
        <div class="total-row total-final">
          <span class="grand-total-label">Total (COP):</span>
          <span class="grand-total-amount">{{ formatMoney(totals.total) }}</span>
        </div>
      </div>
    </div>

    <!-- Terms & Conditions -->
    <div v-if="orders.length === 1" class="notes-section">
      <h3>Notas / Términos</h3>
      <div
        contenteditable="true"
        @input="e => updateTerms(e.target.innerText)"
        v-html="formattedTerms"
        class="notes-content editable"
        :data-placeholder="'Agregar términos y condiciones...'"
      />
    </div>

    <!-- Footer -->
    <div v-if="props.bakerySettings?.website" class="invoice-footer">
      <p>{{ props.bakerySettings.website }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Container */
.invoice-container {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  line-height: 1.6;
  color: #333;
}

/* Header */
.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 30px 40px 20px;
  border-bottom: 3px solid #e0e0e0;
}

.logo-section {
  flex: 1;
}

.logo-img {
  height: 60px;
  max-width: 300px;
  object-fit: contain;
}

.logo-text {
  font-size: 32px;
  font-weight: 300;
  color: #333;
}

.header-right {
  text-align: right;
}

.invoice-title {
  font-size: 32px;
  font-weight: 300;
  margin-bottom: 15px;
  letter-spacing: 2px;
}

.company-info {
  font-size: 14px;
  line-height: 1.8;
  color: #333;
}

/* Info Section */
.info-section {
  display: flex;
  justify-content: space-between;
  padding: 20px 40px;
  background: #fafafa;
}

.bill-to h3 {
  font-size: 12px;
  color: #999;
  font-weight: 400;
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.bill-to p {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.client-detail {
  font-size: 14px;
  color: #555;
  line-height: 1.6;
}

.invoice-details {
  text-align: right;
}

.invoice-details table {
  border-collapse: collapse;
  margin-left: auto;
}

.invoice-details td {
  padding: 4px 0;
  font-size: 14px;
  color: #333;
}

.invoice-details td:first-child {
  text-align: right;
  padding-right: 15px;
  font-weight: 500;
}

.invoice-details td:last-child {
  text-align: right;
}

.total-highlight {
  font-weight: 700;
  font-size: 16px;
}

/* Items Table */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-left: 24px;
  width: calc(100% - 24px);
}

.items-table thead {
  color: white;
}

.items-table th {
  padding: 12px 15px;
  text-align: left;
  font-weight: 500;
  font-size: 14px;
}

.items-table th:last-child,
.items-table td:last-child {
  text-align: right;
}

.items-table tbody td {
  padding: 15px;
  vertical-align: top;
  border-bottom: 1px solid #e0e0e0;
  color: #333;
}

.item-title {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 8px;
  color: #333;
}

.item-title.editable-title {
  padding: 4px 8px;
  margin: -4px -8px 8px -8px;
  border-radius: 4px;
  outline: none;
}

.item-title.editable-title:hover {
  background: #f9fafb;
}

.item-title.editable-title:focus {
  background: #f9fafb;
  outline: 1px solid #e0e0e0;
}

.item-variation {
  font-weight: 400;
  font-size: 14px;
  color: #555;
}

.item-description {
  font-size: 14px;
  color: #555;
  line-height: 1.8;
  margin-top: 10px;
  white-space: pre-wrap;
}

.item-description.editable {
  padding: 8px;
  border-radius: 4px;
  min-height: 40px;
}

.item-description.editable:hover {
  background: #f9fafb;
}

.item-description.editable:focus {
  background: #f9fafb;
  outline: 1px solid #e0e0e0;
}

.add-description-btn {
  font-size: 12px;
  color: #3b82f6;
  margin-top: 8px;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
}

.add-description-btn:hover {
  color: #2563eb;
}

/* Reorder arrows */
.reorder-arrows {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) translateX(-100%);
  padding-right: 4px;
  display: flex;
  flex-direction: column;
}

.reorder-btn {
  padding: 2px;
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reorder-btn:hover:not(:disabled) {
  color: #4b5563;
}

.reorder-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

/* Grand Total */
.grand-total {
  text-align: right;
  padding: 20px 40px;
  background: #fafafa;
}

.grand-total-label {
  font-size: 16px;
  font-weight: 600;
  display: inline-block;
  margin-right: 30px;
  color: #333;
}

.grand-total-amount {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

/* Totals Breakdown */
.totals-breakdown {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.total-row {
  display: flex;
  justify-content: flex-end;
  gap: 30px;
  font-size: 14px;
  color: #555;
}

.total-row .total-label {
  text-align: right;
}

.total-row .total-amount {
  min-width: 100px;
  text-align: right;
}

.total-row.total-final {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
}

/* Notes Section */
.notes-section {
  padding: 20px 40px;
}

.notes-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
}

.notes-content {
  font-size: 13px;
  line-height: 1.8;
  color: #555;
  white-space: pre-wrap;
  min-height: 60px;
}

.notes-content.editable {
  padding: 12px;
  border-radius: 4px;
  border: 1px solid transparent;
}

.notes-content.editable:hover {
  border-color: #e0e0e0;
}

.notes-content.editable:focus {
  outline: none;
  border-color: #d0d0d0;
  background: #f9fafb;
}

/* Footer */
.invoice-footer {
  text-align: center;
  padding: 20px;
  border-top: 1px solid #e0e0e0;
}

.invoice-footer p {
  color: #3b82f6;
  font-weight: 500;
  font-size: 14px;
}

/* Editable placeholder */
.editable:empty:focus:before {
  content: attr(data-placeholder);
  color: #9ca3af;
}

/* Print Styles */
@media print {
  @page {
    margin: 0;
    padding: 1cm;
    size: auto;
  }

  .print-controls {
    display: none !important;
  }

  .reorder-arrows {
    display: none !important;
  }

  .items-table {
    margin-left: 0 !important;
    width: 100% !important;
  }

  button {
    display: none !important;
  }

  .editable:empty {
    display: none !important;
  }

  .editable,
  .editable-title {
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    margin: 0 0 8px 0 !important;
  }

  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
  }

  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }

  body, * {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
</style>

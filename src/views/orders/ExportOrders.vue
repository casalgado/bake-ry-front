<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Dialog, DialogPanel } from '@headlessui/vue';
import OrderInvoice from '@/components/orders/OrderInvoice.vue';
import OrderForm from '@/components/forms/OrderForm.vue';
import ToastNotification from '@/components/ToastNotification.vue';
import { Order } from '@/models/Order.js';
import { PhPen, PhPrinter, PhX } from '@phosphor-icons/vue';
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useBakeryStore } from '@/stores/bakeryStore';
import { useAuthenticationStore } from '@/stores/authentication';

const route = useRoute();
const router = useRouter();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const bakeryStore = useBakeryStore();
const authStore = useAuthenticationStore();

const orders = ref([]);
const bakerySettings = ref(null);
const loading = ref(true);
const error = ref(null);
const toastRef = ref(null);

// Edit form dialog state
const isFormOpen = ref(false);

// Check if single order (editing only for single orders)
const isSingleOrder = computed(() => orders.value.length === 1);

// Parse order IDs from query params
const orderIds = computed(() => {
  const ids = route.query.orderIds;
  console.log('Route query orderIds:', ids);
  if (!ids) return [];
  return ids.split(',');
});

// Computed filename for the PDF
const documentTitle = computed(() => {
  if (orders.value.length === 0) return 'Factura';

  const invoiceType = orders.value.every(order => order.paymentMethod === 'quote') ? 'Cotizacion' : 'Factura';
  const clientName = orders.value[0]?.userName || 'Cliente';
  const cleanClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');

  const date = new Date(orders.value[0]?.preparationDate || new Date());
  const dateStr = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;

  return `${invoiceType}_${cleanClientName}_${dateStr}`;
});

// Store original title for restoration
const originalTitle = document.title;

// Set up print event listeners for reliable PDF filename
const setupPrintListeners = () => {
  window.addEventListener('beforeprint', () => {
    document.title = documentTitle.value;
    console.log('beforeprint - Setting title to:', documentTitle.value);
  });

  window.addEventListener('afterprint', () => {
    document.title = originalTitle;
    console.log('afterprint - Restoring title to:', originalTitle);
  });
};

onMounted(async () => {
  try {
    if (orderIds.value.length === 0) {
      error.value = 'No se especificaron órdenes para imprimir';
      loading.value = false;
      return;
    }

    console.log('Fetching orders for IDs:', orderIds.value);

    // Fetch orders, bakery, and settings in parallel
    const [fetchedOrders, bakeryData] = await Promise.all([
      Promise.all(orderIds.value.map(async (id) => {
        try {
          await orderStore.fetchById(id);
          return orderStore.items.find(order => order.id === id);
        } catch (err) {
          console.error(`Error fetching order ${id}:`, err);
          return null;
        }
      })),
      // Fetch bakery entity and settings
      (async () => {
        const bakeryId = authStore.getBakeryId;
        await Promise.all([
          bakeryStore.fetchBakeryById(bakeryId),
          settingsStore.fetchById('default'),
        ]);

        // Merge bakery entity data with settings
        const bakery = bakeryStore.currentBakery;
        const settings = settingsStore.items[0];

        return {
          ...settings,
          // Add bakery entity fields
          name: bakery?.name || settings?.name,
          address: bakery?.address || '',
          phone: bakery?.phone || '',
          email: bakery?.email || '',
          legalName: bakery?.legalName || '',
          nationalId: bakery?.nationalId || '',
        };
      })(),
    ]);

    bakerySettings.value = bakeryData;

    // Filter out any null values (failed fetches)
    orders.value = fetchedOrders.filter(Boolean);

    if (orders.value.length === 0) {
      error.value = 'No se encontraron las órdenes especificadas';
    } else if (orders.value.length < orderIds.value.length) {
      console.warn(`Only found ${orders.value.length} of ${orderIds.value.length} orders`);
    }

    loading.value = false;

    // Set document title and setup print listeners
    if (orders.value.length > 0) {
      document.title = documentTitle.value;
      setupPrintListeners();
      console.log('Initial document title set to:', documentTitle.value);
    }

  } catch (err) {
    console.error('Error fetching orders:', err);
    error.value = 'Error al cargar las órdenes: ' + err.message;
    loading.value = false;
  }
});

// Handle invoice updates with auto-save
const handleInvoiceUpdate = async ({ type, orderIndex, itemIndex, itemId, direction, value, discountType, discountValue }) => {
  if (!orders.value.length) return;

  try {
    const orderData = orders.value[orderIndex || 0];

    if (type === 'description' && itemId) {
      // Find item by id and update description
      const item = orderData.orderItems?.find(i => i.id === itemId);
      if (item) {
        item.productDescription = value;
        await orderStore.patch(orderData.id, {
          orderItems: orderData.orderItems,
        });
      }
    } else if (type === 'title' && itemId) {
      // Find item by id and update invoice title
      const item = orderData.orderItems?.find(i => i.id === itemId);
      if (item) {
        item.invoiceTitle = value;
        await orderStore.patch(orderData.id, {
          orderItems: orderData.orderItems,
        });
      }
    } else if (type === 'terms') {
      // Update terms & conditions
      await orderStore.patch(orderData.id, {
        invoiceCustomizations: {
          ...orderData.invoiceCustomizations,
          termsAndConditions: value,
        },
      });
    } else if (type === 'reorder' && itemId && direction) {
      // Instantiate Order model to use reorderItem method
      const order = new Order(orderData);
      const success = order.reorderItem(itemId, direction);

      if (success) {
        // Update local state and save
        orderData.orderItems = order.orderItems.map(item => item.toPlainObject());
        await orderStore.patch(orderData.id, {
          orderItems: orderData.orderItems,
        });
      }
    } else if (type === 'discount') {
      // Update order discount
      const order = new Order(orderData);
      order.orderDiscountType = discountType;
      order.orderDiscountValue = discountValue;
      order.calculatePricing();

      // Update local state with recalculated values
      orders.value[orderIndex] = order.toPlainObject();

      await orderStore.patch(orderData.id, {
        orderDiscountType: discountType,
        orderDiscountValue: discountValue,
        orderDiscountAmount: order.orderDiscountAmount,
        subtotal: order.subtotal,
        preTaxTotal: order.preTaxTotal,
        totalTaxAmount: order.totalTaxAmount,
        total: order.total,
      });
    }

    // Show success toast
    toastRef.value?.showSuccess('Cambios guardados exitosamente');
  } catch (error) {
    console.error('Error saving invoice changes:', error);
    toastRef.value?.showError('Error al guardar', 'No se pudieron guardar los cambios');
  }
};

const handlePrint = () => {
  // Ensure title is set right before printing
  document.title = documentTitle.value;
  console.log('Print - document.title:', document.title);
  window.print();
};

// Handle order form submit
const handleFormSubmit = async (formData) => {
  try {
    await orderStore.update(orders.value[0].id, formData);
    // Refresh order data
    await orderStore.fetchById(orders.value[0].id);
    orders.value[0] = orderStore.items.find(order => order.id === orders.value[0].id);
    isFormOpen.value = false;
    toastRef.value?.showSuccess('Pedido actualizado');
  } catch (err) {
    console.error('Failed to update order:', err);
    toastRef.value?.showError('Error al actualizar', err.message);
  }
};

const closeDialog = () => {
  isFormOpen.value = false;
};

const handleClose = () => {
  window.close();
  // If window.close() doesn't work (e.g., not opened by script), navigate back
  if (!window.closed) {
    router.back();
  }
};
</script>

<template>
  <div class="min-h-screen bg-gray-50 pb-6">
    <!-- Print controls - hidden during actual printing -->
    <div class="print-controls bg-white border-b sticky top-0 z-10 shadow-sm px-8 py-2">
      <div class="flex justify-between items-center">
        <h1 class="text-lg font-semibold mb-0">Vista Previa</h1>
        <div class="flex gap-2">
          <button
            v-if="isSingleOrder && !loading"
            @click="isFormOpen = true"
            class="action-btn flex items-center gap-2"
          >
            <PhPen class="h-4 w-4" />
            Editar
          </button>
          <button
            @click="handlePrint"
            class="action-btn flex items-center gap-2"
            :disabled="loading || error"
          >
            <PhPrinter class="h-4 w-4" />
            Imprimir
          </button>
          <button
            @click="handleClose"
            class="action-btn-inverse flex items-center gap-1"
          >
            <PhX class="h-4 w-4" />
            Cerrar
          </button>
        </div>
      </div>

      <div v-if="error" class="mt-2 px-3 py-2 bg-red-100 text-red-800 rounded text-sm">
        {{ error }}
      </div>
    </div>

    <!-- Edit Form Dialog -->
    <Dialog
      :open="isFormOpen"
      @close="closeDialog"
      class="relative z-50"
    >
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <OrderForm
            v-if="orders[0]"
            title="Editar Pedido"
            :key="orders[0].id"
            :initial-data="orders[0]"
            :loading="orderStore.loading"
            class="w-full"
            @submit="handleFormSubmit"
            @cancel="closeDialog"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Loading state -->
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
      <div class="spinner"></div>
      <p>Cargando órdenes...</p>
    </div>

    <!-- Invoice content -->
    <div v-else-if="orders.length > 0 && bakerySettings" class="bg-white max-w-[210mm] mx-auto my-8 p-8 shadow-sm print:my-0 print:p-0 print:shadow-none">
      <OrderInvoice
        :orders="orders"
        :bakery-settings="bakerySettings"
        :invoice-type="orders.every(order => order.paymentMethod === 'quote') ? 'quote' : 'invoice'"
        @update="handleInvoiceUpdate"
      />
    </div>

    <!-- Toast Notifications -->
    <ToastNotification ref="toastRef" />
  </div>
</template>

<style scoped>
.spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media print {
  .print-controls {
    display: none !important;
  }
}
</style>

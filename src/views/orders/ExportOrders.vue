<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import OrderInvoice from '@/components/orders/OrderInvoice.vue';
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

const route = useRoute();
const router = useRouter();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();

const orders = ref([]);
const bakerySettings = ref(null);
const loading = ref(true);
const error = ref(null);

// Parse order IDs from query params
const orderIds = computed(() => {
  const ids = route.query.orderIds;
  console.log('Route query orderIds:', ids);
  if (!ids) return [];
  return ids.split(',');
});

onMounted(async () => {
  try {
    if (orderIds.value.length === 0) {
      error.value = 'No se especificaron órdenes para imprimir';
      loading.value = false;
      return;
    }

    console.log('Fetching orders for IDs:', orderIds.value);

    // Fetch orders and settings in parallel
    const [fetchedOrders] = await Promise.all([
      Promise.all(orderIds.value.map(async (id) => {
        try {
          await orderStore.fetchById(id);
          return orderStore.items.find(order => order.id === id);
        } catch (err) {
          console.error(`Error fetching order ${id}:`, err);
          return null;
        }
      })),
      // Fetch bakery settings
      settingsStore.fetchById('default').then(() => {
        bakerySettings.value = settingsStore.items[0];
      }),
    ]);

    // Filter out any null values (failed fetches)
    orders.value = fetchedOrders.filter(Boolean);

    if (orders.value.length === 0) {
      error.value = 'No se encontraron las órdenes especificadas';
    } else if (orders.value.length < orderIds.value.length) {
      console.warn(`Only found ${orders.value.length} of ${orderIds.value.length} orders`);
    }

    loading.value = false;

  } catch (err) {
    console.error('Error fetching orders:', err);
    error.value = 'Error al cargar las órdenes: ' + err.message;
    loading.value = false;
  }
});

const handlePrint = () => {
  window.print();
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
  <div class="print-view">
    <!-- Print controls - hidden during actual printing -->
    <div class="print-controls">
      <div class="controls-header">
        <h1 class="text-xl font-semibold">Vista previa de factura</h1>
        <div class="buttons">
          <button
            @click="handlePrint"
            class="print-button"
            :disabled="loading || error"
          >
            Imprimir
          </button>
          <button
            @click="handleClose"
            class="close-button"
          >
            Cerrar
          </button>
        </div>
      </div>
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Cargando órdenes...</p>
    </div>

    <!-- Invoice content -->
    <div v-else-if="orders.length > 0 && bakerySettings" class="invoice-container">
      <OrderInvoice
        :orders="orders"
        :bakery-settings="bakerySettings"
        :invoice-type="'invoice'"
      />
    </div>
  </div>
</template>

<style scoped>
.print-view {
  min-height: 100vh;
  background-color: #f3f4f6;
}

.print-controls {
  background-color: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem 2rem;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.controls-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.buttons {
  display: flex;
  gap: 0.5rem;
}

.print-button,
.close-button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
}

.print-button {
  background-color: #3b82f6;
  color: white;
  border: none;
}

.print-button:hover:not(:disabled) {
  background-color: #2563eb;
}

.print-button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.close-button {
  background-color: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.close-button:hover {
  background-color: #f9fafb;
}

.error-message {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background-color: #fee2e2;
  color: #991b1b;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  color: #6b7280;
}

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

.invoice-container {
  background-color: white;
  max-width: 210mm; /* A4 width */
  margin: 2rem auto;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Print-specific styles */
@media print {
  .print-view {
    background-color: white;
  }

  .print-controls {
    display: none !important;
  }

  .invoice-container {
    margin: 0;
    padding: 0;
    box-shadow: none;
    max-width: none;
  }
}
</style>

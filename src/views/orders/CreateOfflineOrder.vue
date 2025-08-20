<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useOrderStore } from '@/stores/orderStore';
import OrderForm from '@/components/forms/OrderForm.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { useRouter } from 'vue-router';
import { formatMoney } from '@/utils/helpers';
import {
  PhCloudSlash,
  PhWifiHigh,
  PhTrash,
  PhCloudArrowUp,
} from '@phosphor-icons/vue';

const router = useRouter();
const orderStore = useOrderStore();
const orderForm = ref(null);
const isOnline = ref(navigator.onLine);
const isSyncing = ref(false);
const syncErrors = ref([]);

const OFFLINE_ORDERS_KEY = 'bakery_offline_orders';

// Confirmation dialog state
const showConfirmDialog = ref(false);
const confirmAction = ref(null);
const confirmTitle = ref('');
const confirmMessage = ref('');
const confirmText = ref('Confirmar');
const cancelText = ref('Cancelar');

// Network status detection
const updateNetworkStatus = () => {
  isOnline.value = navigator.onLine;
};

onMounted(() => {
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
});

onUnmounted(() => {
  window.removeEventListener('online', updateNetworkStatus);
  window.removeEventListener('offline', updateNetworkStatus);
});

// Offline orders management
const offlineOrders = ref([]);

const loadOfflineOrders = () => {
  try {
    const stored = localStorage.getItem(OFFLINE_ORDERS_KEY);
    if (stored) {
      offlineOrders.value = JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading offline orders:', error);
  }
};

const saveOfflineOrders = () => {
  try {
    localStorage.setItem(
      OFFLINE_ORDERS_KEY,
      JSON.stringify(offlineOrders.value),
    );
  } catch (error) {
    console.error('Error saving offline orders:', error);
  }
};

const addOfflineOrder = (orderData) => {
  const offlineOrder = {
    id: Date.now().toString(),
    ...orderData,
    createdAt: new Date().toISOString(),
    isOffline: true,
  };

  offlineOrders.value.unshift(offlineOrder);
  saveOfflineOrders();
};

const removeOfflineOrder = (orderId) => {
  offlineOrders.value = offlineOrders.value.filter(
    (order) => order.id !== orderId,
  );
  saveOfflineOrders();
};

const clearOfflineOrders = () => {
  offlineOrders.value = [];
  localStorage.removeItem(OFFLINE_ORDERS_KEY);
};

// Confirmation dialog handlers
const openConfirmDialog = (title, message, action, confirmButtonText = 'Confirmar') => {
  confirmTitle.value = title;
  confirmMessage.value = message;
  confirmAction.value = action;
  confirmText.value = confirmButtonText;
  showConfirmDialog.value = true;
};

const handleConfirm = () => {
  if (confirmAction.value) {
    confirmAction.value();
  }
  showConfirmDialog.value = false;
  confirmAction.value = null;
};

const handleCancel = () => {
  showConfirmDialog.value = false;
  confirmAction.value = null;
};

const confirmClearAllOrders = () => {
  openConfirmDialog(
    'Limpiar Todos los Pedidos',
    '¿Estás seguro de que quieres eliminar todos los pedidos offline? Esta acción no se puede deshacer.',
    clearOfflineOrders,
    'Eliminar Todo',
  );
};

const confirmRemoveOrder = (orderId) => {
  openConfirmDialog(
    'Eliminar Pedido',
    '¿Estás seguro de que quieres eliminar este pedido offline?',
    () => removeOfflineOrder(orderId),
    'Eliminar',
  );
};

// Form submission
const handleSubmit = async (formData) => {
  if (!isOnline.value) {
    // Save to localStorage if offline
    addOfflineOrder(formData);

    // Reset the form
    if (orderForm.value) {
      orderForm.value.resetForm();
    }

    // Scroll to top
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    return;
  }

  // If online, create order normally
  try {
    await orderStore.create(formData);

    if (orderForm.value) {
      orderForm.value.resetForm();
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  } catch (error) {
    console.error('Failed to create order:', error);
  }
};

// Sync functionality
const syncOfflineOrders = async () => {
  if (!isOnline.value || offlineOrders.value.length === 0) return;

  isSyncing.value = true;
  syncErrors.value = [];

  const ordersToSync = [...offlineOrders.value];

  for (const order of ordersToSync) {
    try {
      // Remove offline-specific properties
      const { id, createdAt, isOffline, ...orderData } = order;

      // Create the order via API
      await orderStore.create(orderData);

      // Remove from offline orders on success
      removeOfflineOrder(order.id);
    } catch (error) {
      console.error(`Failed to sync order ${order.id}:`, error);
      syncErrors.value.push({
        orderId: order.id,
        error: error.message || 'Error desconocido',
      });
    }
  }

  isSyncing.value = false;
};

const handleCancelForm = () => {
  router.push('/orders');
};

// Computed properties
const totalOfflineOrders = computed(() => offlineOrders.value.length);
const canSync = computed(
  () => isOnline.value && totalOfflineOrders.value > 0 && !isSyncing.value,
);

// Calculate totals for each order
const getOrderTotal = (order) => {
  const subtotal = order.orderItems.reduce((sum, item) => {
    return sum + (item.isComplimentary ? 0 : item.quantity * item.currentPrice);
  }, 0);

  if (order.paymentMethod === 'complimentary') return 0;
  if (order.fulfillmentType === 'pickup') return subtotal;

  return subtotal + order.deliveryFee;
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Load offline orders on component mount
onMounted(() => {
  loadOfflineOrders();
});
</script>

<template>
  <div class="form-container space-y-4">
    <!-- Network Status Banner -->
    <div
      class="base-card flex items-center gap-3 p-3"
      :class="
        isOnline
          ? 'bg-green-50 border-green-200'
          : 'bg-orange-50 border-orange-200'
      "
    >
      <PhWifiHigh v-if="isOnline" class="w-5 h-5 text-green-600" />
      <PhCloudSlash v-else class="w-5 h-5 text-orange-600" />

      <div class="flex-1 flex items-center gap-2">
        <p
          class="font-medium"
          :class="isOnline ? 'text-green-800' : 'text-orange-800'"
        >
          {{ isOnline ? "Conectado" : "Sin conexión" }}
        </p>
        <p
          class="text-sm"
          :class="isOnline ? 'text-green-600' : 'text-orange-600'"
        >
          {{
            isOnline
              ? "Los pedidos se guardarán directamente en la base de datos"
              : "Los pedidos se guardarán localmente hasta que se restaure la conexión"
          }}
        </p>
      </div>

      <!-- Sync Button -->
      <button
        v-if="canSync"
        @click="syncOfflineOrders"
        class="action-btn flex"
        :disabled="isSyncing"
      >
        <PhCloudArrowUp class="w-4 h-4 mr-2" />
        {{
          isSyncing
            ? "Sincronizando..."
            : `Sincronizar ${totalOfflineOrders} Pedido${totalOfflineOrders > 1 ? 's' : ''}`
        }}
      </button>
    </div>
  </div>

  <!-- Order Form -->
  <OrderForm
    ref="orderForm"
    :title="isOnline ? 'Crear Pedido' : 'Crear Pedido (Offline)'"
    :loading="orderStore.loading || isSyncing"
    :isOffline="!isOnline"
    @submit="handleSubmit"
    @cancel="handleCancelForm"
  />
  <div class="form-container">
    <!-- Form Error -->
    <div v-if="orderStore.error" class="base-card bg-red-50 border-red-200 p-3">
      <p class="text-red-800">{{ orderStore.error }}</p>
    </div>

    <!-- Sync Errors -->
    <div
      v-if="syncErrors.length > 0"
      class="base-card bg-red-50 border-red-200 p-3"
    >
      <h3 class="font-medium text-red-800 mb-2">Errores de Sincronización</h3>
      <ul class="text-sm text-red-600 space-y-1">
        <li v-for="error in syncErrors" :key="error.orderId">
          Pedido {{ error.orderId }}: {{ error.error }}
        </li>
      </ul>
    </div>

    <!-- Offline Orders List -->
    <div v-if="totalOfflineOrders > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">
          Pedidos Pendientes: {{ totalOfflineOrders }}
        </h2>
        <button
          @click="confirmClearAllOrders"
          class="danger-btn flex items-center"
          :disabled="isSyncing"
        >
          <PhTrash class="w-4 h-4 mr-2" />
          Limpiar Todo
        </button>
      </div>

      <div class="grid gap-3">
        <div
          v-for="order in offlineOrders"
          :key="order.id"
          class="base-card p-4 bg-neutral-50 border-neutral-200"
        >
          <div class="flex items-start justify-between mb-3">
            <div>
              <h3 class="font-medium">{{ order.userName }}</h3>
              <p class="text-sm text-gray-800">
                {{ formatDate(order.createdAt) }}
              </p>
            </div>
            <div class="text-right">
              <p class="font-bold">{{ formatMoney(getOrderTotal(order)) }}</p>
              <p class="text-sm text-gray-800">
                {{
                  order.fulfillmentType === "delivery" ? "Domicilio" : "Recoger"
                }}
              </p>
            </div>
          </div>

          <div class="space-y-2">
            <!-- Order Items -->
            <div class="text-sm">
              <p class="font-medium mb-1">Productos:</p>
              <ul class="list-disc list-inside space-y-1">
                <li
                  v-for="item in order.orderItems"
                  :key="`${item.productId}-${item.variation?.id}`"
                >
                  {{ item.quantity }}x {{ item.productName }}
                  <span v-if="item.variation">- {{ item.variation.name }}</span>
                  <span class="text-gray-800"
                    >({{ formatMoney(item.currentPrice) }} c/u)</span
                  >
                </li>
              </ul>
            </div>

            <!-- Delivery Info -->
            <div v-if="order.fulfillmentType === 'delivery'" class="text-sm">
              <p class="font-medium">Dirección:</p>
              <p class="text-gray-800">{{ order.deliveryAddress }}</p>
            </div>

            <!-- Dates -->
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="font-medium">Preparación:</p>
                <p class="text-gray-800">
                  {{
                    new Date(order.preparationDate).toLocaleDateString("es-ES")
                  }}
                </p>
              </div>
              <div>
                <p class="font-medium">Entrega:</p>
                <p class="text-gray-800">
                  {{ new Date(order.dueDate).toLocaleDateString("es-ES") }}
                </p>
              </div>
            </div>

            <!-- Notes -->
            <div
              v-if="order.internalNotes || order.deliveryNotes"
              class="text-sm space-y-1"
            >
              <div v-if="order.internalNotes">
                <p class="font-medium">Notas Producción:</p>
                <p class="text-gray-800">{{ order.internalNotes }}</p>
              </div>
              <div v-if="order.deliveryNotes">
                <p class="font-medium">Notas Domicilio:</p>
                <p class="text-gray-800">{{ order.deliveryNotes }}</p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end pt-2 border-t border-neutral-200">
              <button
                @click="confirmRemoveOrder(order.id)"
                class="danger-btn flex items-center"
                :disabled="isSyncing"
              >
                <PhTrash class="w-4 h-4 mr-1" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Confirmation Dialog -->
  <ConfirmDialog
    :isOpen="showConfirmDialog"
    :title="confirmTitle"
    :message="confirmMessage"
    :confirmText="confirmText"
    :cancelText="cancelText"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

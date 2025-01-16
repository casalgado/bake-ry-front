<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import OrderForm from '@/components/forms/OrderForm.vue';
import DataTable from '@/components/DataTable/index.vue';
import ClientCell from '@/components/DataTable/renderers/ClientCell.vue';
import DateCell from '@/components/DataTable/renderers/DateCell.vue';
import ItemsCell from '@/components/DataTable/renderers/ItemsCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import IsPaidCell from '@/components/DataTable/renderers/isPaidCell.vue';
import { PhPen, PhExport, PhTrash, PhMoney, PhCreditCard, PhDeviceMobile, PhGift, PhClockCounterClockwise } from '@phosphor-icons/vue';
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import ShowOrderHistory from '@/components/orders/ShowOrderHistory.vue';
import { formatMoney } from '@/utils/helpers';

const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const unsubscribeRef = ref(null);
const b2bClients = ref([]);

const dataTable = ref(null);
const isFormOpen = ref(false);
const isHistoryOpen = ref(false);
const orderHistory = ref([]);
const selectedOrder = ref(null);
const actionLoading = ref({});
const toggleLoading = ref({});
const searchableColumns = ref(['userName', 'items']);

// Process orders to add userCategory
const processedOrders = computed(() => {
  // Log B2B client IDs
  console.log('B2B Client IDs:', b2bClients.value.map(client => client.id));

  return orderStore.items.map(order => {
    // Log each order for inspection
    console.log('Processing Order:', {
      orderId: order.id,
      userId: order.userId,
      userName: order.userName,
      isB2B: b2bClients.value.map(client => client.id).includes(order.userId),
    });

    return {
      ...order,
      userCategory: b2bClients.value.map(client => client.id).includes(order.userId) ? 'B2B' : 'B2C',
    };
  });
});

// Compute totals
const totals = computed(() => {
  const b2bTotal = processedOrders.value
    .filter(order => order.userCategory === 'B2B')
    .reduce((sum, order) => sum + order.total, 0);

  const b2cTotal = processedOrders.value
    .filter(order => order.userCategory === 'B2C')
    .reduce((sum, order) => sum + order.total, 0);

  return {
    b2b: b2bTotal,
    b2c: b2cTotal,
    total: b2bTotal + b2cTotal,
  };
});

// Column definitions
const columns = [
  {
    id: 'userName',
    label: 'Client',
    field: 'userName',
    sortable: true,
    component: ClientCell,
    getProps: (row) => ({
      name: row.userName,
      comment: row.internalNotes,
    }),
  },
  {
    id: 'userCategory',
    label: 'Tipo',
    field: 'userCategory',
    sortable: true,
  },
  {
    id: 'dueDate',
    label: 'Fecha de Entrega',
    field: 'dueDate',
    sortable: true,
    component: DateCell,
    getProps: (row) => ({
      value: row.dueDate,
      showTime: true,
    }),
  },
  {
    id: 'items',
    label: 'Items',
    field: 'items',
    sortable: false,
    component: ItemsCell,
    getProps: (row) => ({
      items: row.orderItems,
      maxDisplay: 10,
    }),
  },
  {
    id: 'paymentMethod',
    label: 'Pago',
    field: 'paymentMethod',
    sortable: true,
    type: 'toggle',
    options: [
      { value: 'cash', displayText: 'efectivo', icon: PhMoney },
      { value: 'transfer', displayText: 'transferencia', icon: PhDeviceMobile },
    ],
  },
  {
    id: 'fulfillmentType',
    label: 'Entrega',
    field: 'fulfillmentType',
    sortable: true,
    type: 'toggle',
    options: [
      { value: 'pickup', displayText: 'recogen' },
      { value: 'delivery', displayText: 'domicilio' },
    ],
  },
  {
    id: 'isPaid',
    label: 'Pagado',
    field: 'isPaid',
    sortable: true,
    type: 'toggle',
    options: [{ value: true, displayText: '✓' }, { value: false, displayText: '-' }],
    component: IsPaidCell,
    getProps: (row) => ({
      isPaid: row.isPaid,
      isComplimentary: row.isComplimentary,
    }),
  },
  {
    id: 'total',
    label: 'Total',
    field: 'total',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.total,
    }),
  },
];

const tableFilters = [
  {
    field: 'userCategory',
    options: [
      { label: 'B2B', value: 'B2B' },
      { label: 'B2C', value: 'B2C' },
    ],
  },

];

// Table actions
const tableActions = [
  {
    id: 'edit',
    label: 'Editar',
    icon: PhPen,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
  {
    id: 'delete',
    label: 'Eliminar',
    icon: PhTrash,
    minSelected: 1,
    maxSelected: 1,
    variant: 'danger',
  },
  {
    id: 'history',
    label: 'Historial',
    icon: PhClockCounterClockwise,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
  {
    id: 'export',
    label: 'Exportar',
    icon: PhExport,
    minSelected: 2,
    variant: 'primary',
  },
];

// Handlers
const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedOrder.value = orderStore.items.find(order => order.id === selectedIds[0]);
  } else {
    selectedOrder.value = null;
  }
};

const handleToggleUpdate = async ({ rowIds, field, value }) => {
  try {
    // Set loading state for all affected rows
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = true;
    });

    // Prepare updates array
    const updates = rowIds.map(id => ({
      id,
      data: { [field]: value },
    }));

    // Single API call
    await orderStore.patchAll(updates);
    await nextTick();
  } catch (error) {
    console.error('Failed to update orders:', error);
  } finally {
    // Clear loading state
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = false;
    });
  }
};

const handleAction = async ({ actionId, selectedIds }) => {
  actionLoading.value[actionId] = true;

  try {
    switch (actionId) {
    case 'edit':
      selectedOrder.value = orderStore.items.find(order => order.id === selectedIds[0]);
      isFormOpen.value = true;
      break;
    case 'delete':
      if (window.confirm('¿Estás seguro de querer eliminar este pedido?')) {
        selectedOrder.value = orderStore.items.find(order => order.id === selectedIds[0]);
        await orderStore.remove(selectedOrder.value.id);
        dataTable.value?.clearSelection();
      }
      break;
    case 'history':
      selectedOrder.value = orderStore.items.find(order => order.id === selectedIds[0]);
      orderHistory.value = await orderStore.getHistory(selectedOrder.value.id);
      isHistoryOpen.value = true;
      break;
    }
  } catch (error) {
    console.error('Action failed:', error);
  } finally {
    actionLoading.value[actionId] = false;
  }
};

const handleSubmit = async (formData) => {
  try {
    if (selectedOrder.value) {
      await orderStore.update(selectedOrder.value.id, formData);
    }
    closeDialog();
  } catch (error) {
    console.error('Failed to update order:', error);
  }
};

const closeDialog = () => {
  isFormOpen.value = false;
  isHistoryOpen.value = false;
  selectedOrder.value = null;
};

onMounted(async () => {
  try {
    // First fetch settings to get B2B clients
    await settingsStore.fetchById('default');
    b2bClients.value = await settingsStore.b2b_clients;

    // Then fetch unpaid orders
    await orderStore.fetchAll({
      filters: {
        isPaid: false,
      },
    });

    unsubscribeRef.value = await orderStore.subscribeToChanges();
    console.log('🔄 Real-time updates enabled for orders');
  } catch (error) {
    console.error('Failed to initialize orders:', error);
  }
});

onUnmounted(() => {
  if (unsubscribeRef.value) {
    unsubscribeRef.value();
    orderStore.unsubscribe();
  }
});
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Pedidos por Cobrar</h2>

      <!-- Totals Summary -->
      <div class="flex items-center gap-6 bg-white px-6 py-3 rounded-lg shadow-sm">
        <div class="flex items-center gap-2">
          <span class="text-neutral-700">B2B:</span>
          <span class="font-bold text-neutral-800">{{ formatMoney(totals.b2b) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-neutral-700">B2C:</span>
          <span class="font-bold text-neutral-800">{{ formatMoney(totals.b2c) }}</span>
        </div>
        <div class="flex items-center gap-2 border-l pl-6 border-neutral-200">
          <span class="text-neutral-700">Total:</span>
          <span class="font-bold text-neutral-800">{{ formatMoney(totals.total) }}</span>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

    <!-- Edit Form Dialog -->
    <Dialog
      :open="isFormOpen"
      @close="closeDialog"
      class="relative z-50 form-container"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <!-- Full-screen container for centering -->
      <div class="fixed inset-0 flex items-center justify-center p-4 ">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">

          <OrderForm
            v-if="selectedOrder"
            :title="'Editar Pedido'"
            :key="selectedOrder.id"
            :initial-data="selectedOrder"
            :loading="orderStore.loading"
            class="w-full"
            @submit="handleSubmit"
            @cancel="closeDialog"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- History Dialog -->
    <Dialog
      :open="isHistoryOpen"
      @close="closeDialog"
      class="relative z-50 form-container"
    >
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 class="text-2xl font-bold text-neutral-800 mb-4">Historial de Cambios</h2>
          <ShowOrderHistory :history="orderHistory" />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :data="processedOrders"
        :columns="columns"
        :searchable-columns="searchableColumns"
        :filters="tableFilters"
        :actions="tableActions"
        :action-loading="actionLoading"
        :toggle-loading="toggleLoading"
        :data-loading="orderStore.loading"
        @selection-change="handleSelectionChange"
        @toggle-update="handleToggleUpdate"
        @action="handleAction"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.dialog-overlay {
  @apply bg-black bg-opacity-50;
}

.dialog-content {
  @apply bg-white rounded-lg shadow-xl transform transition-all;

  &:focus {
    @apply outline-none;
  }
}

* {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

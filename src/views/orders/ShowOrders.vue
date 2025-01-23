<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import OrderForm from '@/components/forms/OrderForm.vue';
import   DataTable, {
  ClientCell,
  DateCell,
  ItemsCell,
  MoneyCell,
  IsPaidCell,
} from '@carsalhaz/vue-data-table';
import { PhPen, PhExport, PhTrash, PhMoney, PhCreditCard, PhDeviceMobile, PhGift, PhClockCounterClockwise, PhMopedFront, PhStorefront } from '@phosphor-icons/vue';
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';
import ShowOrderHistory from '@/components/orders/ShowOrderHistory.vue';
import TotalsSummary from '@/components/common/TotalsSummary.vue';
import { formatMoney } from '@/utils/helpers';

const periodStore = usePeriodStore();
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
  return orderStore.items.map(order => ({
    ...order,
    userCategory: b2bClients.value.map(client => client.id).includes(order.userId) ? 'B2B' : 'B2C',
  }));
});

// Compute totals
const totals = computed(() => {
  const orders = processedOrders.value;

  // Helper function to calculate sales without delivery
  const calcSalesWithoutDelivery = (ordersArray) =>
    ordersArray.reduce((sum, order) => sum + order.subtotal, 0);

  return [
    { label: 'Venta', value: calcSalesWithoutDelivery(orders) },
  ];
});

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
    id: 'preparationDate',
    label: 'Preparación',
    field: 'preparationDate',
    sortable: true,
    component: DateCell,
    getProps: (row) => ({
      value: row.preparationDate,
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
      { value: 'cash', displayText: 'E', icon: PhMoney },
      { value: 'transfer', displayText: 'T', icon: PhDeviceMobile },
      { value: 'card', displayText: 'B', icon: PhCreditCard, skipWhenToggled: true },
      { value: 'complimentary', displayText: 'R', icon: PhGift, skipWhenToggled: true },
    ],
  },
  {
    id: 'fulfillmentType',
    label: 'Entrega',
    field: 'fulfillmentType',
    sortable: true,
    type: 'toggle',
    options: [
      { value: 'pickup', displayText: 'R', icon: PhStorefront },
      { value: 'delivery', displayText: 'D', icon: PhMopedFront },
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
      valueBelow: row.deliveryFee,
      hideBelow: row.fulfillmentType === 'pickup',
    }),
  },
];

const tableFilters = [
  {
    field: 'fulfillmentType',
    options: [
      { label: 'recogen', value: 'pickup' },
      { label: 'domicilio', value: 'delivery' },
    ],
  },
  {
    field: 'isPaid',
    options: [
      { label: 'pagado', value: true },
      { label: 'por cobrar', value: false },
    ],
  },
];

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

const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedOrder.value = orderStore.items.find(order => order.id === selectedIds[0]);
  } else {
    selectedOrder.value = null;
  }
};

const handleToggleUpdate = async ({ rowIds, field, value }) => {
  try {
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = true;
    });

    const updates = rowIds.map(id => ({
      id,
      data: { [field]: value },
    }));

    await orderStore.patchAll(updates);
    await nextTick();
  } catch (error) {
    console.error('Failed to update orders:', error);
  } finally {
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

watch(
  () => periodStore.periodRange,
  async (newRange) => {
    try {
      await orderStore.fetchAll({
        filters: {
          dateRange: {
            dateField: 'preparationDate',
            startDate: newRange.start.toISOString(),
            endDate: newRange.end.toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  },
  { deep: true },
);

onMounted(async () => {
  try {
    // First fetch settings to get B2B clients
    await settingsStore.fetchById('default');
    b2bClients.value = await settingsStore.b2b_clients;

    await orderStore.fetchAll({
      filters: {
        dateRange: {
          dateField: 'preparationDate',
          startDate: periodStore.periodRange.start.toISOString(),
          endDate: periodStore.periodRange.end.toISOString(),
        },
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
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4 gap-2">
      <TotalsSummary :categories="totals" :format-value="formatMoney"/>
      <PeriodSelector />
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
        :data="orderStore.items"
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
        :wrapper-class="`bg-white shadow-lg rounded-lg`"
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

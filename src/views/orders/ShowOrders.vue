<script setup>
// Vue and Headless UI
import { ref, computed, watch } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';

// DataTable Core
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';

// DataTable Renderers
import ClientCell from '@/components/DataTable/renderers/ClientCell.vue';
import DateCell from '@/components/DataTable/renderers/DateCell.vue';
import ItemsCell from '@/components/DataTable/renderers/ItemsCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import IsPaidCell from '@/components/DataTable/renderers/IsPaidCell.vue';

// Components
import OrderForm from '@/components/forms/OrderForm.vue';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import ShowOrderHistory from '@/components/orders/ShowOrderHistory.vue';
import TotalsSummary from '@/components/common/TotalsSummary.vue';

// Stores
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { usePeriodStore } from '@/stores/periodStore';

// Icons
import {
  PhPen,
  PhExport,
  PhTrash,
  PhMoney,
  PhCreditCard,
  PhDeviceMobile,
  PhGift,
  PhClockCounterClockwise,
  PhMopedFront,
  PhStorefront,
} from '@phosphor-icons/vue';
import BancolombiaIcon from '@/assets/icons/bancolombia.svg'; // Ensure this path is correct
import DaviviendaIcon from '@/assets/icons/outline_davivenda.svg'; // Ensure this path is correct

// Utils
import { formatMoney } from '@/utils/helpers';
import { exportOrders } from '@/utils/exportOrders';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const b2bClients = ref([]);

// Dialog state
const isFormOpen = ref(false);
const isHistoryOpen = ref(false);
const orderHistory = ref([]);

// Process data function for the table
const processData = (orders) => {
  return orders.map((order) => ({
    ...order,
    userCategory: b2bClients.value
      .map((client) => client.id)
      .includes(order.userId)
      ? 'B2B'
      : 'B2C',
  }));
};

// Initialize useDataTable with custom handlers
const {
  dataTable,
  toggleLoading,
  actionLoading,
  selectedItems,
  searchableColumns,
  isLoading,
  tableData,
  handleSelectionChange,
  handleToggleUpdate,
  handleAction,
  clearSelection,
} = useDataTable(orderStore, {
  searchableColumns: ['userName', 'items'],
  processData,
  subscribeToChanges: true,
  fetchAll: {
    filters: {
      dateRange: {
        dateField: 'preparationDate',
        startDate: periodStore.periodRange.start.toISOString(),
        endDate: periodStore.periodRange.end.toISOString(),
      },
    },
  },
  // Initial setup before fetching data
  async onBeforeFetch() {
    await settingsStore.fetchById('default');
    b2bClients.value = await settingsStore.b2b_clients;
  },
  // Action handler
  async onAction({ actionId, selectedItems }) {
    const selectedOrder = selectedItems[0];

    switch (actionId) {
    case 'edit':
      isFormOpen.value = true;
      break;
    case 'delete':
      if (window.confirm('¿Estás seguro de querer eliminar este pedido?')) {
        await orderStore.remove(selectedOrder.id);
        clearSelection();
      }
      break;
    case 'history':
      orderHistory.value = await orderStore.getHistory(selectedOrder.id);
      isHistoryOpen.value = true;
      break;
    case 'export':
      console.log('Selected items for export:', selectedItems);
      exportOrders(selectedItems);
      break;
    }
  },
});

// Compute totals
const totals = computed(() => {
  // Use selected orders if any are selected, otherwise use all table data
  const ordersToCalculate =
    selectedItems.value.length > 0 ? selectedItems.value : tableData.value;

  const calcSalesWithoutDelivery = (ordersArray) =>
    ordersArray.reduce((sum, order) => sum + order.subtotal, 0);
  const calcSalesWithDelivery = (ordersArray) =>
    ordersArray.reduce((sum, order) => sum + order.total, 0);

  return [
    {
      label: 'Venta',
      value: calcSalesWithoutDelivery(ordersToCalculate),
    },
    {
      label: 'Ingreso',
      value: calcSalesWithDelivery(ordersToCalculate),
    },
  ];
});

// get Bakery Features from settings
const features = computed(() => {
  if (!settingsStore.items.length) return {};
  return settingsStore.items[0].features;
});

// Helper function to check if a payment method should be skipped
const shouldSkipPaymentMethod = (paymentMethod) => {
  const additionalMethods = ['bancolombia', 'davivienda'];

  // If it's not an additional method, use existing skipWhenToggled logic
  if (!additionalMethods.includes(paymentMethod)) {
    return false;
  }

  // If features aren't loaded yet, skip additional methods by default
  if (!features.value?.order?.additionalPaymentMethods) {
    return true;
  }

  // Skip if the payment method is not in the bakery's additional payment methods
  return !features.value.order.additionalPaymentMethods.includes(paymentMethod);
};

// Column definitions (now computed to handle dynamic payment methods)
const columns = computed(() => [
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
  {
    id: 'isPaid',
    label: 'Pagado',
    field: 'isPaid',
    sortable: true,
    type: 'toggle',
    options: [
      { value: true, displayText: '✓' },
      { value: false, displayText: '-' },
    ],
    component: IsPaidCell,
    getProps: (row) => ({
      isPaid: row.isPaid,
      isComplimentary: row.isComplimentary,
      orderStatus: row.status,
      paymentDate: row.paymentDate,
      partialPaymentAmount: row.partialPaymentAmount,
      partialPaymentDate: row.partialPaymentDate,
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
      {
        value: 'card',
        displayText: 'D',
        icon: PhCreditCard,
        skipWhenToggled: true,
      },
      {
        value: 'bancolombia',
        displayText: 'B',
        icon: BancolombiaIcon,
        skipWhenToggled: shouldSkipPaymentMethod('bancolombia'),
      },
      {
        value: 'davivienda',
        displayText: 'D',
        icon: DaviviendaIcon,
        skipWhenToggled: shouldSkipPaymentMethod('davivienda'),
      },
      {
        value: 'complimentary',
        displayText: 'R',
        icon: PhGift,
        skipWhenToggled: true,
      },
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
]);

const tableFilters = [
  {
    field: 'fulfillmentType',
    options: [
      { label: 'recogen', value: 'pickup' },
      { label: 'domicilio', value: 'delivery' },
    ],
  },
  {
    field: 'paymentMethod',
    options: [
      { label: 'efectivo', value: 'cash' },
      { label: 'transferencia', value: 'transfer' },
      { label: 'bold', value: 'card' },
      { label: 'regalo', value: 'complimentary' },
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
    minSelected: 1,
    variant: 'primary',
  },
];

const handleSubmit = async (formData) => {
  try {
    if (selectedItems.value[0]) {
      await orderStore.update(selectedItems.value[0].id, formData);
    }
    closeDialog();
  } catch (error) {
    console.error('Failed to update order:', error);
  }
};

const closeDialog = () => {
  isFormOpen.value = false;
  isHistoryOpen.value = false;
  clearSelection();
};

// Watch for period changes and refetch data
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
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div
      class="flex flex-col lg:flex-row-reverse justify-between items-center mb-4 gap-2"
    >
      <TotalsSummary
        class="relative md:fixed md:bottom-10 md:left-10 z-[9]"
        :categories="totals"
        :format-value="formatMoney"
      />
      <div class="flex flex-col">
        <PeriodSelector />
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
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <OrderForm
            v-if="selectedItems[0]"
            :title="'Editar Pedido'"
            :key="selectedItems[0].id"
            :initial-data="selectedItems[0]"
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
        <DialogPanel
          class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <h2 class="text-2xl font-bold text-neutral-800 mb-4">
            Historial de Cambios
          </h2>
          <ShowOrderHistory :history="orderHistory" />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :data="tableData"
        :columns="columns"
        :searchable-columns="searchableColumns"
        :filters="tableFilters"
        :actions="tableActions"
        :action-loading="actionLoading"
        :toggle-loading="toggleLoading"
        :data-loading="orderStore.loading || isLoading"
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

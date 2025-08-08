<script setup>
// Vue and Headless UI
import { ref, computed } from 'vue';
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
import ShowOrderHistory from '@/components/orders/ShowOrderHistory.vue';
import TotalsSummary from '@/components/common/TotalsSummary.vue';

// Stores
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

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
  PhStorefront,
  PhMopedFront,
} from '@phosphor-icons/vue';
import BancolombiaIcon from '@/assets/icons/bancolombia.svg'; // Ensure this path is correct
import DaviviendaIcon from '@/assets/icons/outline_davivenda.svg'; // Ensure this path is correct

// Utils
import { formatMoney } from '@/utils/helpers';

const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const b2bClients = ref([]);

// Dialog state
const isFormOpen = ref(false);
const isHistoryOpen = ref(false);
const orderHistory = ref([]);

// Process data function for the table
const processData = (orders) => {
  return orders.map(order => ({
    ...order,
    userCategory: b2bClients.value.map(client => client.id).includes(order.userId) ? 'B2B' : 'B2C',
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
  searchableColumns: ['userName', 'items', 'userCategory'],
  processData,
  subscribeToChanges: true,
  fetchAll: {
    filters: {
      isPaid: false,
      isComplimentary: false,
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
    }
  },
});

// Computed properties
const totals = computed(() => {

  const ordersToCalculate = selectedItems.value.length > 0
    ? selectedItems.value.map(order => ({
      ...order,
      userCategory: b2bClients.value.map(client => client.id).includes(order.userId) ? 'B2B' : 'B2C',
    }))
    : tableData.value;

  console.log(ordersToCalculate);

  const b2bTotal = ordersToCalculate
    .filter(order => order.userCategory === 'B2B')
    .reduce((sum, order) => sum + order.total, 0);

  const b2cTotal = ordersToCalculate
    .filter(order => order.userCategory === 'B2C')
    .reduce((sum, order) => sum + order.total, 0);

  return [
    { label: 'B2B', value: b2bTotal },
    { label: 'B2C', value: b2cTotal },
    { label: 'Total', value: b2bTotal + b2cTotal },
  ];
});

// get Bakery Features from settings
const features = computed(() => {
  if (!settingsStore.items.length) return {};
  return settingsStore.items[0].features;
});

// Payment method icon mapping
const paymentIconMap = {
  cash: PhMoney,
  transfer: PhDeviceMobile,
  card: PhCreditCard,
  bancolombia: BancolombiaIcon,
  davivienda: DaviviendaIcon,
  complimentary: PhGift,
};

// Get payment method options from bakery settings
const paymentMethodOptions = computed(() => {
  if (!settingsStore.items.length) return [];

  const settings = settingsStore.items[0];
  const availablePaymentMethods = settings.availablePaymentMethods || [];
  const activePaymentMethods = settings.features?.order?.activePaymentMethods || [];

  // Filter available methods to only show active ones
  return availablePaymentMethods.filter(method =>
    activePaymentMethods.includes(method.value),
  );
});

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
    id: 'userCategory',
    label: 'Tipo',
    field: 'userCategory',
    sortable: true,
  },
  {
    id: 'dueDate',
    label: 'Entrega',
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
    get options() {
      return paymentMethodOptions.value.map(method => ({
        value: method.value,
        displayText: method.displayText,
        icon: paymentIconMap[method.value] || PhMoney,
        skipWhenToggled: method.value === 'complimentary',
      }));
    },
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
    }),
  },
]);

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
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Por Cobrar</h2>
      <TotalsSummary class="relative md:fixed md:bottom-10 md:left-10 z-[9]" :categories="totals" :format-value="formatMoney"/>
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
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <OrderForm
            v-if="selectedItems[0]"
            title="Editar Pedido"
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

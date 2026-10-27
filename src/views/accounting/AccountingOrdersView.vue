<script setup>
// Vue and Headless UI
import { ref, computed, watch } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useRouter } from 'vue-router';

// DataTable Core
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';

// DataTable Renderers
import ClientCell from '@/components/DataTable/renderers/ClientCell.vue';
import DateCell from '@/components/DataTable/renderers/DateCell.vue';
import ItemsCell from '@/components/DataTable/renderers/ItemsCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import IsPaidCell from '@/components/DataTable/renderers/IsPaidCell.vue';
import EinvoiceCell from '@/components/DataTable/renderers/EinvoiceCell.vue';

// Components
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import ShowOrderHistory from '@/components/orders/ShowOrderHistory.vue';
import TotalsSummary from '@/components/common/TotalsSummary.vue';

// Stores
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { usePeriodStore } from '@/stores/periodStore';

// Icons
import {
  PhMoney,
  PhClockCounterClockwise,
  PhDownloadSimple,
  PhReceipt,
} from '@phosphor-icons/vue';
import { paymentIconMap } from '@/utils/paymentIcons';

// Utils
import { formatMoney } from '@/utils/helpers';
import { exportOrders } from '@/utils/exportOrders';

// The accountant's orders: what was sold, whether it was invoiced, paid and
// delivered. Payment can be marked here; the order itself is edited elsewhere.

const router = useRouter();

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const systemSettingsStore = useSystemSettingsStore();
const b2bClients = ref([]);

const isHistoryOpen = ref(false);
const orderHistory = ref([]);

// Order.status, as ShowDelivery moves it.
const STATUS_LABELS = ['recibido', 'producido', 'enviado', 'entregado'];

const processData = (orders) => {
  const b2bIds = b2bClients.value.map((client) => client.id);
  return orders.map((order) => ({
    ...order,
    userCategory: b2bIds.includes(order.userId) ? 'B2B' : 'B2C',
    // A rejected invoice doesn't count: the order still has to be invoiced.
    invoiced: order.einvoice && order.einvoice.status !== 'rejected' ? 'yes' : 'no',
    paid: order.isPaid ? 'yes' : 'no',
  }));
};

const periodFilters = (range) => ({
  filters: {
    dateRange: {
      dateField: 'preparationDate',
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
    },
  },
});

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
} = useDataTable(orderStore, {
  searchableColumns: ['userName', 'items'],
  processData,
  subscribeToChanges: true,
  async onBeforeFetch() {
    await settingsStore.fetchById('default');
    await systemSettingsStore.fetchSettings();
    b2bClients.value = await settingsStore.b2b_clients;
    return periodFilters(periodStore.periodRange);
  },
  async onAction({ actionId, selectedItems }) {
    const selectedOrder = selectedItems[0];

    switch (actionId) {
    case 'einvoice':
      window.open(router.resolve({ name: 'einvoice', params: { orderId: selectedOrder.id } }).href, '_blank');
      break;
    case 'history':
      orderHistory.value = await orderStore.getHistory(selectedOrder.id);
      isHistoryOpen.value = true;
      break;
    case 'export':
      exportOrders(selectedItems.length > 0 ? selectedItems : tableData.value);
      break;
    }
  },
});

const totals = computed(() => {
  const orders = selectedItems.value.length > 0 ? selectedItems.value : tableData.value;
  const sum = (list, field) => list.reduce((acc, order) => acc + (order[field] || 0), 0);

  return [
    { label: 'Venta', value: sum(orders, 'subtotal') },
    { label: 'Ingreso', value: sum(orders, 'total') },
    { label: 'Por cobrar', value: sum(orders.filter((o) => !o.isPaid && !o.isComplimentary), 'total') },
  ];
});

const paymentMethodOptions = computed(() => {
  const activePaymentMethods = settingsStore.items[0]?.features?.order?.activePaymentMethods || [];
  return (systemSettingsStore.availablePaymentMethods || [])
    .filter((method) => activePaymentMethods.includes(method.value));
});

const columns = computed(() => [
  {
    id: 'userName',
    label: 'Cliente',
    field: 'userName',
    sortable: true,
    component: ClientCell,
    getProps: (row) => ({
      category: row.userCategory,
      legalName: row.userLegalName,
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
      order: row,
    }),
  },
  {
    id: 'paymentMethod',
    label: 'Pago',
    field: 'paymentMethod',
    sortable: true,
    type: 'toggle',
    get options() {
      return paymentMethodOptions.value.map((method) => ({
        value: method.value,
        displayText: method.displayText,
        icon: paymentIconMap[method.value] || PhMoney,
        skipWhenToggled: method.value === 'complimentary',
      }));
    },
  },
  // Entrega and Estado are read-only here: delivery moves them.
  {
    id: 'fulfillmentType',
    label: 'Entrega',
    field: 'fulfillmentType',
    sortable: true,
    displayText: { pickup: 'recogen', delivery: 'domicilio' },
  },
  {
    id: 'status',
    label: 'Estado',
    field: 'status',
    sortable: true,
    displayText: STATUS_LABELS,
  },
  ...(settingsStore.isEinvoicingEnabled ? [{
    id: 'einvoice',
    label: 'Factura',
    field: 'invoiced',
    sortable: true,
    component: EinvoiceCell,
    getProps: (row) => ({ einvoice: row.einvoice }),
  }] : []),
]);

const tableFilters = computed(() => [
  {
    field: 'userCategory',
    options: [
      { label: 'b2b', value: 'B2B' },
      { label: 'b2c', value: 'B2C' },
    ],
  },
  ...(settingsStore.isEinvoicingEnabled ? [{
    field: 'invoiced',
    options: [
      { label: 'facturada', value: 'yes' },
      { label: 'por facturar', value: 'no' },
    ],
  }] : []),
  {
    field: 'paid',
    options: [
      { label: 'pagado', value: 'yes' },
      { label: 'sin pagar', value: 'no' },
    ],
  },
  {
    field: 'paymentMethod',
    options: paymentMethodOptions.value.map((method) => ({
      label: method.label.toLowerCase(),
      value: method.value,
    })),
  },
]);

const tableActions = computed(() => [
  ...(settingsStore.isEinvoicingEnabled ? [{
    id: 'einvoice',
    label: 'Facturar',
    icon: PhReceipt,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  }] : []),
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
    icon: PhDownloadSimple,
    minSelected: 0,
    variant: 'primary',
  },
]);

watch(
  () => periodStore.periodRange,
  async (newRange) => {
    try {
      await orderStore.fetchAll(periodFilters(newRange));
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  },
  { deep: true },
);
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4 gap-2">
      <h2 class="text-2xl font-bold text-neutral-800">Pedidos</h2>
      <div class="flex flex-col gap-2 items-center lg:items-stretch">
        <PeriodSelector />
        <TotalsSummary
          class="relative lg:fixed lg:bottom-5 lg:left-[216px] z-[9]"
          :categories="totals"
          :format-value="formatMoney"
        />
      </div>
    </div>

    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

    <Dialog :open="isHistoryOpen" class="relative z-50 form-container" @close="isHistoryOpen = false">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 class="text-2xl font-bold text-neutral-800 mb-4">Historial de Cambios</h2>
          <ShowOrderHistory :history="orderHistory" />
        </DialogPanel>
      </div>
    </Dialog>

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
      wrapper-class="bg-white shadow-lg rounded-lg"
      @selection-change="handleSelectionChange"
      @toggle-update="handleToggleUpdate"
      @action="handleAction"
    />
  </div>
</template>

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
import OrderForm from '@/components/forms/OrderForm.vue';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import ShowOrderHistory from '@/components/orders/ShowOrderHistory.vue';
import TotalsSummary from '@/components/common/TotalsSummary.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

// Stores
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { usePeriodStore } from '@/stores/periodStore';
import { useAuthenticationStore } from '@/stores/authentication';

// Icons
import {
  PhPen,
  PhTrash,
  PhMoney,
  PhClockCounterClockwise,
  PhMopedFront,
  PhStorefront,
  PhPrinter,
  PhCopy,
  PhDownloadSimple,
  PhReceipt,
} from '@phosphor-icons/vue';
import { paymentIconMap } from '@/utils/paymentIcons';

// Utils
import { formatMoney } from '@/utils/helpers';
import { exportOrders, exportOrderClientsPreset, clientExportPreset } from '@/utils/exportOrders';
import { deliveryRoundColumns, deliveryRoundFilters } from '@/utils/deliveryRounds';

// Router
const router = useRouter();

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const systemSettingsStore = useSystemSettingsStore();
const authStore = useAuthenticationStore();
const b2bClients = ref([]);

// Non-null only for bakeries listed in CLIENT_EXPORT_PRESETS (es-alimento → B2Chat).
const exportPreset = computed(() => clientExportPreset(authStore.getBakeryId));

// Dialog state
const isFormOpen = ref(false);
const isHistoryOpen = ref(false);
const isPrintOpen = ref(false);
const isConfirmOpen = ref(false);
const orderHistory = ref([]);
const duplicateData = ref(null);
const orderToDelete = ref(null);

// Process data function for the table
const processData = (orders) => {
  return orders.map((order) => ({
    ...order,
    userCategory: b2bClients.value
      .map((client) => client.id)
      .includes(order.userId)
      ? 'B2B'
      : 'B2C',
    // A rejected invoice doesn't count: the order still has to be invoiced.
    invoiced: order.einvoice && order.einvoice.status !== 'rejected' ? 'yes' : 'no',
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
    // Static options can go here, filters will be dynamic
  },
  // Initial setup before fetching data
  async onBeforeFetch() {
    await settingsStore.fetchById('default');
    await systemSettingsStore.fetchSettings();
    b2bClients.value = await settingsStore.b2b_clients;

    // Return dynamic filters based on current period state
    return {
      filters: {
        dateRange: {
          dateField: 'preparationDate',
          startDate: periodStore.periodRange.start.toISOString(),
          endDate: periodStore.periodRange.end.toISOString(),
        },
      },
    };
  },
  // Action handler
  async onAction({ actionId, selectedItems }) {
    const selectedOrder = selectedItems[0];

    switch (actionId) {
    case 'edit':
      isFormOpen.value = true;
      break;
    case 'einvoice':
      window.open(router.resolve({ name: 'einvoice', params: { orderId: selectedOrder.id } }).href, '_blank');
      break;
    case 'delete':
      // The backend refuses it too; this says why before the confirm dialog.
      if (selectedOrder.einvoice && selectedOrder.einvoice.status !== 'rejected' && !selectedOrder.einvoice.annulled) {
        alert(`El pedido tiene la factura ${selectedOrder.einvoice.number}: anúlala con una nota crédito antes de eliminarlo.`);
        return;
      }
      orderToDelete.value = selectedOrder;
      isConfirmOpen.value = true;
      break;
    case 'duplicate': {
      const {
        id, createdAt, updatedAt, lastEditedBy,
        status, isPaid, paymentDate, isDeliveryPaid, driverMarkedAsPaid,
        partialPaymentAmount, partialPaymentDate, deliveryDriverId,
        preparationDate, dueDate, einvoice,
        ...rest
      } = selectedOrder;
      void einvoice; // a copy is a new sale, never invoiced
      duplicateData.value = {
        ...rest,
        // Where a line's units come from is decided again for the copy: the stock
        // the original found may be gone.
        orderItems: rest.orderItems.map(({ fulfillmentSource, sourceWarehouseId, ...line }) => line),
        status: 0,
        isPaid: false,
        paymentDate: null,
        isDeliveryPaid: false,
        driverMarkedAsPaid: false,
        partialPaymentAmount: 0,
        partialPaymentDate: null,
        deliveryDriverId: '-',
        preparationDate: null,
        dueDate: null,
      };
      isFormOpen.value = true;
      break;
    }
    case 'history':
      orderHistory.value = await orderStore.getHistory(selectedOrder.id);
      isHistoryOpen.value = true;
      break;
    case 'print': {
      // Validate all orders are from the same client
      const clientIds = [
        ...new Set(selectedItems.map((order) => order.userId)),
      ];
      if (clientIds.length > 1) {
        alert(
          'Por favor selecciona pedidos del mismo cliente para exportar un recibo combinado.',
        );
        return;
      }

      // Open export view in new tab with selected order IDs
      const orderIds = selectedItems.map(order => order.id).join(',');
      const exportUrl = router.resolve({
        name: 'export-orders',
        query: { orderIds },
      }).href;

      window.open(exportUrl, '_blank');
      break;
    }
    case 'export': {
      // Export selected orders if any, otherwise export all visible orders
      const ordersToExport = selectedItems.length > 0 ? selectedItems : tableData.value;
      exportOrders(ordersToExport);
      break;
    }
    case 'export-preset': {
      const ordersToExport = selectedItems.length > 0 ? selectedItems : tableData.value;
      exportOrderClientsPreset(ordersToExport, authStore.getBakeryId);
      break;
    }
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

// Get payment method options from bakery settings (active payment methods only)
const paymentMethodOptions = computed(() => {
  const settings = settingsStore.items[0];
  const activePaymentMethods = settings?.features?.order?.activePaymentMethods || [];
  const allSystemMethods = systemSettingsStore.availablePaymentMethods || [];

  // Filter system payment methods to only include active ones for this bakery
  return allSystemMethods.filter(method =>
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
      const settings = settingsStore.items[0];
      const activePaymentMethods =
        settings?.features?.order?.activePaymentMethods || [];

      return paymentMethodOptions.value.map((method) => ({
        value: method.value,
        displayText: method.displayText,
        icon: paymentIconMap[method.value] || PhMoney,
        skipWhenToggled:
          method.value === 'complimentary' ||
          !activePaymentMethods.includes(method.value),
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
  ...deliveryRoundColumns(authStore.getBakeryId),
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
  {
    field: 'fulfillmentType',
    options: [
      { label: 'recogen', value: 'pickup' },
      { label: 'domicilio', value: 'delivery' },
    ],
  },
  {
    field: 'paymentMethod',
    options: paymentMethodOptions.value.map((method) => ({
      label: method.label.toLowerCase(),
      value: method.value,
    })),
  },
  ...deliveryRoundFilters(authStore.getBakeryId),
  ...(settingsStore.isEinvoicingEnabled ? [{
    field: 'invoiced',
    options: [
      { label: 'facturada', value: 'yes' },
      { label: 'por facturar', value: 'no' },
    ],
  }] : []),
]);

const tableActions = computed(() => [
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
    id: 'duplicate',
    label: 'Duplicar',
    icon: PhCopy,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
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
    id: 'print',
    label: 'Imprimir',
    icon: PhPrinter,
    minSelected: 1,
    variant: 'primary',
  },
  ...(settingsStore.isEinvoicingEnabled ? [{
    id: 'einvoice',
    label: 'Facturar',
    icon: PhReceipt,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  }] : []),
  {
    id: 'export',
    label: 'Exportar',
    icon: PhDownloadSimple,
    minSelected: 0,
    variant: 'primary',
  },
  ...(exportPreset.value
    ? [{
      id: 'export-preset',
      label: exportPreset.value.label,
      icon: PhDownloadSimple,
      minSelected: 0,
      variant: 'primary',
    }]
    : []),
]);

const handleSubmit = async (formData) => {
  try {
    if (duplicateData.value) {
      await orderStore.create(formData);
    } else {
      await orderStore.update(selectedItems.value[0].id, formData);
    }
    closeDialog();
  } catch (error) {
    console.error('Failed to save order:', error);
  }
};

const closeDialog = () => {
  isFormOpen.value = false;
  isHistoryOpen.value = false;
  isPrintOpen.value = false;
  isConfirmOpen.value = false;
  duplicateData.value = null;
  orderToDelete.value = null;
  clearSelection();
};

const handleConfirmDelete = async () => {
  try {
    if (orderToDelete.value) {
      await orderStore.remove(orderToDelete.value.id);
    }
  } catch (error) {
    console.error('Failed to delete order:', error);
  } finally {
    closeDialog();
  }
};

const handleCancelDelete = () => {
  isConfirmOpen.value = false;
  orderToDelete.value = null;
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
      <div class="flex flex-col gap-2 items-center lg:items-stretch">
        <PeriodSelector />
        <TotalsSummary
          class="relative lg:fixed lg:bottom-5 lg:left-[216px] z-[9]"
          :categories="totals"
          :format-value="formatMoney"
        />
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
      class="relative z-50"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <!-- Full-screen container for centering -->
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <!-- No surface of its own: the form is a ui-app and paints itself. -->
        <DialogPanel
          class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto"
          style="--ui-form-w: 72rem"
        >
          <OrderForm
            v-if="isFormOpen"
            :title="duplicateData ? 'Duplicar Pedido' : 'Editar Pedido'"
            :key="duplicateData ? 'duplicate-' + selectedItems[0]?.id : selectedItems[0]?.id"
            :initial-data="duplicateData ?? selectedItems[0]"
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

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog
      :is-open="isConfirmOpen"
      title="Eliminar Pedido"
      message="¿Estás seguro de querer eliminar este pedido? Esta acción no se puede deshacer."
      confirm-text="Eliminar"
      cancel-text="Cancelar"
      :loading="orderStore.loading"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
    />

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

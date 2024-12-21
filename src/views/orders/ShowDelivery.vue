<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';

import OrderForm from '@/components/forms/OrderForm.vue';
import DataTable from '@/components/DataTable/index.vue';
import ClientCell from '@/components/DataTable/renderers/ClientCell.vue';
import DateCell from '@/components/DataTable/renderers/DateCell.vue';
import ItemsCell from '@/components/DataTable/renderers/ItemsCell.vue';
import CheckboxCell from '@/components/DataTable/renderers/CheckboxCell.vue';

import {
  PhPen,
  PhExport,
  PhTrash,
  PhMoney,
  PhCreditCard,
  PhDeviceMobile,
  PhGift,
  PhCurrencyDollar,
} from '@phosphor-icons/vue';
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const unsubscribeRef = ref(null);

const dataTable = ref(null);
const isFormOpen = ref(false);
const isDeliveryPriceDialogOpen = ref(false);
const selectedOrder = ref(null);
const actionLoading = ref({});
const toggleLoading = ref({});
const selectedDeliveryCost = ref(7000);

const deliveryDrivers = ref([]);

const deliveryFeeOptions = [
  { value: 5000, label: '5000' },
  { value: 6000, label: '6000' },
  { value: 7000, label: '7000' },
  { value: 8000, label: '8000' },
];

// Column definitions / "id must be the same as field for sorting to work"
const columns = [
  {
    id: 'userName',
    label: 'Client',
    field: 'userName',
    sortable: true,
    component: ClientCell,
    getProps: (row) => ({
      name: row.userName,
    }),
  },
  {
    id: 'dueDate',
    label: 'Due Date',
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
      maxDisplay: 2,
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
      { value: 'bold', displayText: 'bold', icon: PhCreditCard },
      { value: 'transfer', displayText: 'transferencia', icon: PhDeviceMobile },
      { value: 'complimentary', displayText: 'regalo', icon: PhGift },
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
    id: 'deliveryDriver',
    label: 'Conductor',
    field: 'deliveryDriver',
    sortable: true,
    type: 'toggle',
    options: [{ value: '-', displayText: '-' }],
  },
  {
    id: 'isPaid',
    label: 'Pagado',
    field: 'isPaid',
    sortable: true,
    type: 'toggle',
    options: [{ value: true, displayText: '✓' }, { value: false, displayText: '-' }],
    component: CheckboxCell,
    getProps: (row) => ({
      isChecked: row.isPaid,
    }),
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
    id: 'set_delivery_price',
    label: 'Valor Domi',
    icon: PhCurrencyDollar,
    minSelected: 1,
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

const handleDeliveryPriceSubmit = async (selectedIds) => {
  try {
    actionLoading.value['set_delivery_price'] = true;
    const updates = selectedIds.map(id => ({
      id,
      data: { deliveryFee: selectedDeliveryCost.value },
    }));

    await orderStore.patchAll(updates);
    isDeliveryPriceDialogOpen.value = false;
  } catch (error) {
    console.error('Failed to update delivery prices:', error);
  } finally {
    actionLoading.value['set_delivery_price'] = false;
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
    case 'set_delivery_price':
      isDeliveryPriceDialogOpen.value = true;
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
    closeForm();
  } catch (error) {
    console.error('Failed to update order:', error);
  }
};

const closeForm = () => {
  isFormOpen.value = false;
  selectedOrder.value = null;
};

const closeDeliveryPriceDialog = () => {
  isDeliveryPriceDialogOpen.value = false;
  selectedDeliveryCost.value = 7000;
};

// Watch for period changes and fetch new data
watch(
  () => periodStore.periodRange,
  async (newRange) => {
    try {
      await orderStore.fetchAll({
        filters: {
          dateRange: {
            dateField: 'dueDate',
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

watch(deliveryDrivers, (newDrivers) => {
  const driverColumn = columns.find(col => col.id === 'deliveryDriver');
  if (driverColumn) {
    driverColumn.options = [{ value: '-', displayText: '-' }, ...newDrivers];
  }
}, { deep: true });

onMounted(async () => {
  try {
    await orderStore.fetchAll({
      filters: {
        dateRange: {
          dateField: 'dueDate',
          startDate: periodStore.periodRange.start.toISOString(),
          endDate: periodStore.periodRange.end.toISOString(),
        },
      },
    });
    unsubscribeRef.value = await orderStore.subscribeToChanges();
    console.log('🔄 Real-time updates enabled for orders');
    const staff = await settingsStore.staff;
    deliveryDrivers.value = staff.filter(staff => staff.role === 'delivery_assistant').map(staff => ({
      value: staff.first_name,
      displayText: `${staff.first_name}`,
    }));
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
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Entrega</h2>
      <PeriodSelector />
    </div>

    <!-- Error State -->
    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

    <!-- Edit Form Dialog -->
    <Dialog
      :open="isFormOpen"
      @close="closeForm"
      class="relative z-50 form-container"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <!-- Full-screen container for centering -->
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <OrderForm
            v-if="selectedOrder"
            :title="'Editar Pedido'"
            :key="selectedOrder.id"
            :initial-data="selectedOrder"
            :loading="orderStore.loading"
            class="w-full"
            @submit="handleSubmit"
            @cancel="closeForm"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Delivery Price Dialog -->
    <Dialog
      :open="isDeliveryPriceDialogOpen"
      @close="closeDeliveryPriceDialog"
      class="relative z-50"
    >
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="form-container bg-white rounded-lg p-6 max-w-md w-full">
          <h3 class="text-lg font-medium mb-4">Valor del Domicilio</h3>

          <div class="grid grid-cols-4 gap-2 mb-4">
            <button
              v-for="option in deliveryFeeOptions"
              :key="option.value"
              @click="selectedDeliveryCost = option.value"
              class="utility-btn-inactive py-1 px-2 rounded-md hover:utility-btn-active"
              :class="{ 'utility-btn-active': selectedDeliveryCost === option.value }"
            >
              {{ option.label }}
            </button>
          </div>

          <input
            type="number"
            v-model="selectedDeliveryCost"
            min="0"
            step="500"
            placeholder="Valor del domicilio"
            class="w-full mb-4 p-2 border rounded"
          />

          <div class="flex justify-end gap-2">
            <button
              @click="closeDeliveryPriceDialog"
              class="utility-btn"
            >
              Cancelar
            </button>
            <button
              @click="handleDeliveryPriceSubmit"
              :disabled="actionLoading.set_delivery_price"
              class="action-btn"
            >
              {{ actionLoading.set_delivery_price ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :key="deliveryDrivers.length"
        :data="orderStore.items"
        :columns="columns"
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

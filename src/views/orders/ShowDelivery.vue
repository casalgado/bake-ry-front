<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import DataTable, {
  ClientCell,
  ItemsCell,
  DriverCell,
  DeliveryAddressCell,
  NumberOfBagsCell,
} from '@carsalhaz/vue-data-table';

import OrderForm from '@/components/forms/OrderForm.vue';

import {
  PhPen, PhTrash, PhCurrencyDollar, PhMapPin, PhCheckSquare, PhMinus, PhMoped, PhPackage, PhStorefront, PhMopedFront,
} from '@phosphor-icons/vue';
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();
const unsubscribeRef = ref(null);

const dataTable = ref(null);
const isFormOpen = ref(false);
const isDeliveryPriceDialogOpen = ref(false);
const isNumberOfBagsDialogOpen = ref(false);
const isDriverDialogOpen = ref(false);
const selectedOrder = ref(null);
const actionLoading = ref({});
const toggleLoading = ref({});
const selectedDeliveryCost = ref(5000);
const selectedNumberOfBags = ref(0);
const selectedIds = ref([]);
const isAddressDialogOpen = ref(false);
const editingAddress = ref('');

const deliveryDrivers = ref([]);

const deliveryFeeOptions = [
  { value: 5000, label: '5000' },
  { value: 6000, label: '6000' },
  { value: 7000, label: '7000' },
  { value: 8000, label: '8000' },
];

// Column definitions
const columns = [
  {
    id: 'userName',
    label: 'Cliente',
    field: 'userName',
    sortable: true,
    component: ClientCell,
    getProps: (row) => ({
      name: row.userName,
      comment: row.internalNotes,
    }),
  },
  {
    id: 'deliveryAddress',
    label: 'Dirección',
    field: 'deliveryAddress',
    sortable: true,
    component: DeliveryAddressCell,
    getProps: (row) => ({
      address: row.deliveryAddress,
      show: row.fulfillmentType === 'delivery',
    }),
  },
  {
    id: 'deliveryCost',
    label: '$Dom',
    field: 'deliveryCost',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.deliveryCost,
    }),
  },
  {
    id: 'isDeliveryPaid',
    label: 'Pagado',
    field: 'isDeliveryPaid',
    sortable: true,
    type: 'toggle',
    options: [{ value: true, icon: PhCheckSquare }, { value: false, icon: PhMinus }],
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
    id: 'fulfillmentType',
    label: 'Tipo Entrega',
    field: 'fulfillmentType',
    sortable: true,
    type: 'toggle',
    options: [
      { value: 'pickup', displayText: 'R', icon: PhStorefront },
      { value: 'delivery', displayText: 'D', icon: PhMopedFront },
    ],
  },
  {
    id: 'numberOfBags',
    label: 'Bolsas',
    field: 'numberOfBags',
    sortable: true,
    component: NumberOfBagsCell,
    getProps: (row) => ({
      numberOfBags: row.numberOfBags,
      show: row.fulfillmentType === 'delivery',
    }),
  },
  {
    id: 'deliveryDriverId',
    label: 'Conductor',
    field: 'deliveryDriverId',
    sortable: true,
    component: DriverCell,
    getProps: (row) => ({
      driverId: row.deliveryDriverId,
      drivers: deliveryDrivers.value,
    }),
  },

  {
    id: 'status',
    label: 'Estado',
    field: 'status',
    sortable: true,
    type: 'toggle',
    options: [{ value: 0, displayText: '-' }, { value: 2, displayText: '', icon: PhMoped }],
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
    id: 'set_address',
    label: 'Dirección',
    icon: PhMapPin,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
  {
    id: 'set_number_of_bags',
    label: 'Bolsas',
    icon: PhPackage,
    minSelected: 1,
    variant: 'primary',
  },
  {
    id: 'set_driver',
    label: 'Conductor',
    icon: PhMoped,
    minSelected: 1,
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

const handleDeliveryPriceSubmit = async () => {
  try {
    actionLoading.value['set_delivery_price'] = true;
    const updates = selectedIds.value.map(id => ({
      id,
      data: { deliveryCost: selectedDeliveryCost.value },
    }));

    await orderStore.patchAll(updates);
    isDeliveryPriceDialogOpen.value = false;
  } catch (error) {
    console.error('Failed to update delivery prices:', error);
  } finally {
    actionLoading.value['set_delivery_price'] = false;
  }
};

const handleDriverSubmit = async (driverId) => {
  try {
    actionLoading.value['set_driver'] = true;
    const updates = selectedIds.value.map(id => ({
      id,
      data: { deliveryDriverId: driverId },
    }));

    await orderStore.patchAll(updates);
    isDriverDialogOpen.value = false;
  } catch (error) {
    console.error('Failed to update driver:', error);
  } finally {
    actionLoading.value['set_driver'] = false;
  }
};

const handleNumberOfBagsSubmit = async () => {
  try {
    actionLoading.value['set_number_of_bags'] = true;
    const updates = selectedIds.value.map(id => ({
      id,
      data: { numberOfBags: selectedNumberOfBags.value },
    }));

    await orderStore.patchAll(updates);
    isNumberOfBagsDialogOpen.value = false;
  } catch (error) {
    console.error('Failed to update number of bags:', error);
  } finally {
    actionLoading.value['set_number_of_bags'] = false;
  }
};

// Add handler for address updates
const handleAddressSubmit = async () => {
  try {
    actionLoading.value['set_address'] = true;
    await orderStore.update(selectedIds.value[0], {
      deliveryAddress: editingAddress.value,
    });
    isAddressDialogOpen.value = false;
  } catch (error) {
    console.error('Failed to update address:', error);
  } finally {
    actionLoading.value['set_address'] = false;
  }
};

const closeAddressDialog = () => {
  isAddressDialogOpen.value = false;
  editingAddress.value = '';
};

const closeNumberOfBagsDialog = () => {
  isNumberOfBagsDialogOpen.value = false;
  selectedNumberOfBags.value = 0;
};

const closeDriverDialog = () => {
  isDriverDialogOpen.value = false;
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

const handleAction = async ({ actionId, selectedIds: ids }) => {
  actionLoading.value[actionId] = true;

  try {
    switch (actionId) {
    case 'edit':
      selectedOrder.value = orderStore.items.find(order => order.id === ids[0]);
      isFormOpen.value = true;
      break;
    // case 'delete':
    //   if (window.confirm('¿Estás seguro de querer eliminar este pedido?')) {
    //     selectedOrder.value = orderStore.items.find(order => order.id === ids[0]);
    //     await orderStore.remove(selectedOrder.value.id);
    //     dataTable.value?.clearSelection();
    //   }
    //   break;
    case 'set_delivery_price':
      selectedDeliveryCost.value = 5000;
      selectedIds.value = ids;
      isDeliveryPriceDialogOpen.value = true;
      break;
    case 'set_number_of_bags':
      selectedNumberOfBags.value = 0;
      selectedIds.value = ids;
      isNumberOfBagsDialogOpen.value = true;
      break;
    case 'set_driver':
      selectedIds.value = ids;
      isDriverDialogOpen.value = true;
      break;
    case 'set_address':
      selectedOrder.value = orderStore.items.find(order => order.id === ids[0]);
      editingAddress.value = selectedOrder.value.deliveryAddress || '';
      selectedIds.value = [ids[0]];
      isAddressDialogOpen.value = true;
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
  selectedDeliveryCost.value = 5000;
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
    deliveryDrivers.value = staff
      .filter(staff => staff.role === 'delivery_assistant')
      .map(staff => ({
        value: staff.id,
        displayText: staff.firstName,
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
    <div class="flex flex-col lg:flex-row  justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Entrega</h2>
      <PeriodSelector onlyFor="day" />
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

    <!-- Driver Selection Dialog -->
    <Dialog
      :open="isDriverDialogOpen"
      @close="closeDriverDialog"
      class="relative z-50"
    >
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="form-container bg-white rounded-lg p-6 max-w-md w-full">
          <h3 class="text-lg font-medium mb-4">Asignar Conductor</h3>

          <div class="grid grid-cols-2 gap-2 mb-4">
            <button
              v-for="driver in deliveryDrivers"
              :key="driver.value"
              @click="handleDriverSubmit(driver.value)"
              :disabled="actionLoading.set_driver"
              class="utility-btn-inactive py-2 px-3 rounded-md hover:utility-btn-active"
            >
              {{ driver.displayText }}
            </button>
            <button
              @click="handleDriverSubmit('-')"
              :disabled="actionLoading.set_driver"
              class="utility-btn-inactive py-2 px-3 rounded-md hover:utility-btn-active col-span-2"
            >
              Sin Asignar
            </button>
          </div>

          <div class="flex justify-end">
            <button
              @click="closeDriverDialog"
              class="utility-btn"
            >
              Cancelar
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Number of Bags Dialog -->
    <Dialog
      :open="isNumberOfBagsDialogOpen"
      @close="closeNumberOfBagsDialog"
      class="relative z-50"
    >
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="form-container bg-white rounded-lg p-6 max-w-md w-full">
          <h3 class="text-lg font-medium mb-4">Número de Bolsas</h3>

          <div class="grid grid-cols-3 gap-2 mb-4">
            <button
              v-for="number in [1, 2, 3, 4, 5, 6]"
              :key="number"
              @click="selectedNumberOfBags = number"
              class="utility-btn-inactive py-1 px-2 rounded-md hover:utility-btn-active"
              :class="{ 'utility-btn-active': selectedNumberOfBags === number }"
            >
              {{ number }}
            </button>
          </div>

          <input
            type="number"
            v-model="selectedNumberOfBags"
            min="0"
            placeholder="Otro"
            class="w-full mb-4 p-2 border rounded"
          />

          <div class="flex justify-end gap-2">
            <button
              @click="closeNumberOfBagsDialog"
              class="utility-btn"
            >
              Cancelar
            </button>
            <button
              @click="handleNumberOfBagsSubmit"
              :disabled="actionLoading.set_number_of_bags"
              class="action-btn"
            >
              {{ actionLoading.set_number_of_bags ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
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

    <!-- Address Dialog -->
    <Dialog
      :open="isAddressDialogOpen"
      @close="closeAddressDialog"
      class="relative z-50"
    >
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="form-container bg-white rounded-lg p-6 max-w-md w-full">
          <h3 class="text-lg font-medium mb-4">Dirección de Entrega</h3>

          <textarea
            v-model="editingAddress"
            rows="3"
            placeholder="Dirección de entrega"
            class="w-full mb-4 p-2 border rounded"
          />

          <div class="flex justify-end gap-2">
            <button
              @click="closeAddressDialog"
              class="utility-btn"
            >
              Cancelar
            </button>
            <button
              @click="handleAddressSubmit"
              :disabled="actionLoading.set_address"
              class="action-btn"
            >
              {{ actionLoading.set_address ? 'Guardando...' : 'Guardar' }}
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

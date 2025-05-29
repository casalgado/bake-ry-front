<script setup>
// Vue and Headless UI
import { ref, watch } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';

// DataCalendar Core
import  DataCalendar from '@/components/DataCalendar/index.vue';
import { useDataCalendar } from '@/components/DataCalendar/composables/useDataCalendar.js';

// DataCalendar Renderers
import ClientCell from '@/components/DataCalendar/renderers/ClientCell.vue';
import ItemsCell from '@/components/DataCalendar/renderers/ItemsCell.vue';
import DriverCell from '@/components/DataCalendar/renderers/DriverCell.vue';
import DeliveryAddressCell from '@/components/DataCalendar/renderers/DeliveryAddressCell.vue';
import NumberOfBagsCell from '@/components/DataCalendar/renderers/NumberOfBagsCell.vue';
import MoneyCell from '@/components/DataCalendar/renderers/MoneyCell.vue';

// Components
import OrderForm from '@/components/forms/OrderForm.vue';
import PeriodSelector from '@/components/common/PeriodSelector.vue';

// Stores
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { usePeriodStore } from '@/stores/periodStore';

// Icons
import {
  PhPen,
  PhCurrencyDollar,
  PhMapPin,
  PhCheckSquare,
  PhMinus,
  PhMoped,
  PhPackage,
  PhStorefront,
  PhMopedFront,
  PhBuilding,
  PhOven,
} from '@phosphor-icons/vue';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const settingsStore = useBakerySettingsStore();

// Dialog states
const isFormOpen = ref(false);
const isDeliveryPriceDialogOpen = ref(false);
const isNumberOfBagsDialogOpen = ref(false);
const isDriverDialogOpen = ref(false);
const isAddressDialogOpen = ref(false);

// Dialog-specific state
const selectedDeliveryCost = ref(5000);
const selectedNumberOfBags = ref(0);
const editingAddress = ref('');
const deliveryDrivers = ref([]);

const deliveryFeeOptions = [
  { value: 5000, label: '5000' },
  { value: 6000, label: '6000' },
  { value: 7000, label: '7000' },
  { value: 8000, label: '8000' },
];

// Initialize useDataTable with custom handlers
const {
  dataCalendar,
  toggleLoading,
  actionLoading,
  selectedItems,
  isLoading,
  calendarData,
  handleSelectionChange,
  handleToggleUpdate,
  handleAction,
  clearSelection,
} = useDataCalendar(orderStore, {
  subscribeToChanges: true,
  fetchAll: {
    filters: {
      dateRange: {
        dateField: 'dueDate',
        startDate: (() => {
          periodStore.setPeriodType('day');
          const startDate = new Date(periodStore.periodRange.start);
          return startDate.toISOString();
        })(),
        endDate: (() => {
          periodStore.setPeriodType('day');
          const endDate = new Date(periodStore.periodRange.end);
          return endDate.toISOString();
        })(),
      },
    },
  },
  // Initial setup before fetching data
  async onBeforeFetch() {
    const staff = await settingsStore.staff;
    deliveryDrivers.value = staff
      .filter(staff => staff.role === 'delivery_assistant')
      .map(staff => ({
        value: staff.id,
        displayText: staff.firstName,
      }));
  },
  // Action handler
  async onAction({ actionId, selectedItems: items }) {
    switch (actionId) {
    case 'edit':
      isFormOpen.value = true;
      break;
    case 'set_delivery_price':
      selectedDeliveryCost.value = 5000;
      isDeliveryPriceDialogOpen.value = true;
      break;
    case 'set_number_of_bags':
      selectedNumberOfBags.value = 0;
      isNumberOfBagsDialogOpen.value = true;
      break;
    case 'set_driver':
      isDriverDialogOpen.value = true;
      break;
    case 'set_address':
      editingAddress.value = items[0].deliveryAddress || '';
      isAddressDialogOpen.value = true;
      break;
    }
  },
});

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
      comment: `${row.internalNotes}${row.internalNotes ? '. ' : ' '}${row.deliveryNotes}`,
      phone: row.userPhone,
      showIsPaid: row.isPaid,
      dueTime: row.dueTime,

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
    id: 'numberOfBags',
    label: 'Bolsas',
    field: 'numberOfBags',
    sortable: true,
    component: NumberOfBagsCell,
    getProps: (row) => ({
      numberOfBags: row.numberOfBags,
      show: true,
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
    id: 'isDeliveryPaid',
    label: 'Pagado',
    field: 'isDeliveryPaid',
    sortable: true,
    type: 'toggle',
    options: [{ value: true, icon: PhCheckSquare }, { value: false, icon: PhMinus }],
  },
  {
    id: 'status',
    label: 'Estado',
    field: 'status',
    sortable: true,

    type: 'toggle',
    options: [{ value: 0, displayText: '0'  }, { value: 1, displayText: '', icon: PhOven }, { value: 2, displayText: '', icon: PhMoped }, { value: 3, displayText: '', icon: PhBuilding }],
  },
];

// Table actions
const tableActions = [
  // {
  //   id: 'delete',
  //   label: 'Eliminar',
  //   icon: PhTrash,
  //   minSelected: 1,
  //   maxSelected: 1,
  //   variant: 'danger',
  // },
  {
    id: 'set_delivery_price',
    label: 'Valor Domi',
    icon: PhCurrencyDollar,
    minSelected: 1,
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
  {
    id: 'set_address',
    label: 'Dirección',
    icon: PhMapPin,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
  {
    id: 'edit',
    label: 'Editar Pedido',
    icon: PhPen,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
];
// Dialog handlers
const handleDeliveryPriceSubmit = async () => {
  try {
    actionLoading.value['set_delivery_price'] = true;
    const updates = selectedItems.value.map(item => ({
      id: item.id,
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
    const updates = selectedItems.value.map(item => ({
      id: item.id,
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
    const updates = selectedItems.value.map(item => ({
      id: item.id,
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

const handleAddressSubmit = async () => {
  try {
    actionLoading.value['set_address'] = true;
    await orderStore.update(selectedItems.value[0].id, {
      deliveryAddress: editingAddress.value,
    });
    isAddressDialogOpen.value = false;
  } catch (error) {
    console.error('Failed to update address:', error);
  } finally {
    actionLoading.value['set_address'] = false;
  }
};

// Dialog close handlers
const closeForm = () => {
  isFormOpen.value = false;
  clearSelection();
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

const closeDeliveryPriceDialog = () => {
  isDeliveryPriceDialogOpen.value = false;
  selectedDeliveryCost.value = 5000;
};

// Form submit handler
const handleSubmit = async (formData) => {
  try {
    if (selectedItems.value[0]) {
      await orderStore.update(selectedItems.value[0].id, formData);
    }
    closeForm();
  } catch (error) {
    console.error('Failed to update order:', error);
  }
};

// Watch period changes
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
</script>
<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Calendario de Entregas</h2>
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
            v-if="selectedItems[0]"
            :title="'Editar Pedido'"
            :key="selectedItems[0].id"
            :initial-data="selectedItems[0]"
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

      <DataCalendar
        ref="dataCalendar"
        :key="deliveryDrivers.length"
        :data="calendarData"
        :columns="columns"
        :period-range="periodStore.periodRange"
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
    display: none !important;
  }
  -ms-overflow-style: none !important;
  scrollbar-width: none !important;
}
</style>

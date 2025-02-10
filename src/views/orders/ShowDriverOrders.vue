<script setup>
// Vue Core
import { ref, computed, watch } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';

// DataTable Core
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';

// DataTable Renderers
import ClientCell from '@/components/DataTable/renderers/ClientCell.vue';
import ItemsCell from '@/components/DataTable/renderers/ItemsCell.vue';
import CheckboxCell from '@/components/DataTable/renderers/CheckboxCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import NumberOfBagsCell from '@/components/DataTable/renderers/NumberOfBagsCell.vue';

// Stores
import { usePeriodStore } from '@/stores/periodStore';
import { useOrderStore } from '@/stores/orderStore';
import { useAuthenticationStore } from '@/stores/authentication';

// Components
import PeriodSelector from '@/components/common/PeriodSelector.vue';

// Icons
import {
  PhMoney,
  PhCreditCard,
  PhDeviceMobile,
  PhGift,
  PhMoped,
  PhBuilding,
  PhListNumbers,
} from '@phosphor-icons/vue';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const authStore = useAuthenticationStore();
const isSequenceDialogOpen = ref(false);
const selectedSequence = ref(1);

const userId = computed(() => authStore.getUserData?.uid);

// Data processing function to filter orders by driver
const processData = (orders) => {
  return orders.filter(order => order.deliveryDriverId === userId.value);
};

// Initialize useDataTable with custom handlers
const {
  toggleLoading,
  actionLoading,
  selectedItems,
  isLoading,
  tableData,
  handleSelectionChange,
  handleToggleUpdate,
  handleAction,
  clearSelection,
} = useDataTable(orderStore, {
  processData,
  subscribeToChanges: true,
  async onAction({ actionId }) {
    switch (actionId) {
    case 'set_sequence':
      selectedSequence.value = 1;
      isSequenceDialogOpen.value = true;
      console.log('set_sequence');
      break;
    }
  },
  fetchAll: {
    filters: {
      dateRange: {
        dateField: 'dueDate',
        startDate: periodStore.periodRange.start.toISOString(),
        endDate: periodStore.periodRange.end.toISOString(),
      },
    },
  },
});

const closeSequenceDialog = () => {
  isSequenceDialogOpen.value = false;
  selectedSequence.value = 0;
};

// Add with other submit handlers
const handleSequenceSubmit = async () => {
  try {
    actionLoading.value['set_sequence'] = true;
    const updates = selectedItems.value.map(item => ({
      id: item.id,
      data: { deliverySequence: selectedSequence.value },
    }));
    await orderStore.patchAll(updates);
    isSequenceDialogOpen.value = false;
    clearSelection();
  } catch (error) {
    console.error('Failed to update sequence:', error);
  } finally {
    actionLoading.value['set_sequence'] = false;
  }
};

const tableActions = [
  {
    id: 'set_sequence',
    label: 'Secuencia',
    icon: PhListNumbers,  // You'll need to import this icon
    minSelected: 1,
    variant: 'primary',
  },
];

// Column definitions
const columns = [
  {
    id: 'deliverySequence',
    label: 'ORD',
    field: 'deliverySequence',
    sortable: true,
    type: 'action',  // This makes it clickable
    onClick: (row) => {
      selectedSequence.value = row.deliverySequence || 0;
      isSequenceDialogOpen.value = true;
    },
  },
  {
    id: 'userName',
    label: 'Cliente',
    field: 'userName',
    sortable: true,
    component: ClientCell,
    getProps: (row) => ({
      name: row.userName,
      phone: row.userPhone,
      comment: row.deliveryNotes,
      dueTime: row.dueTime,
    }),
  },
  {
    id: 'deliveryAddress',
    label: 'Dirección',
    field: 'deliveryAddress',
    sortable: true,
  },
  {
    id: 'deliveryCost',
    label: 'Domi',
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
    id: 'total',
    label: '$Tot',
    field: 'total',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.total,
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
    id: 'driverMarkedAsPaid',
    label: 'Pagado',
    field: 'driverMarkedAsPaid',
    sortable: true,
    type: 'toggle',
    options: [{ value: true, displayText: '✓' }, { value: false, displayText: '-' }],
    component: CheckboxCell,
    getProps: (row) => ({
      isChecked: row.driverMarkedAsPaid,
    }),
  },
  {
    id: 'status',
    label: 'Estado',
    field: 'status',
    sortable: true,
    type: 'toggle',
    options: [{ value: 0, displayText: '0', lockedValue: true, skipWhenToggled: true }, { value: 2, displayText: '', icon: PhMoped }, { value: 3, displayText: '', icon: PhBuilding }],
  },
];
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
);</script>
<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Mis Entregas</h2>
      <PeriodSelector onlyFor="day" />
    </div>

    <!-- Error State -->
    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

        <!-- Delivery Sequence Dialog -->
    <Dialog
      :open="isSequenceDialogOpen"
      @close="closeSequenceDialog"
      class="relative z-50"
    >
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="form-container bg-white rounded-lg p-6 max-w-md w-full">
          <h3 class="text-lg font-medium mb-4">Secuencia de Entrega</h3>

          <div class="grid grid-cols-3 gap-2 mb-4">
            <button
              v-for="number in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]"
              :key="number"
              @click="selectedSequence = number"
              class="utility-btn-inactive py-1 px-2 rounded-md hover:utility-btn-active"
              :class="{ 'utility-btn-active': selectedSequence === number }"
            >
              {{ number }}
            </button>
          </div>

          <input
            type="number"
            v-model="selectedSequence"
            min="0"
            placeholder="Otro número"
            class="w-full mb-4 p-2 border rounded"
          />

          <div class="flex justify-end gap-2">
            <button
              @click="closeSequenceDialog"
              class="utility-btn"
            >
              Cancelar
            </button>
            <button
              @click="handleSequenceSubmit"
              :disabled="actionLoading.set_sequence"
              class="action-btn"
            >
              {{ actionLoading.set_sequence ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Table -->
    <div>
      <DataTable
        :data="tableData"
        :columns="columns"
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
* {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

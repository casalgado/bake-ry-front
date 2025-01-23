<script setup>
import { ref, computed, watch } from 'vue';
import DataTable, {
  ClientCell,
  ItemsCell,
  CheckboxCell,
  MoneyCell,
  useDataTable,
} from '@carsalhaz/vue-data-table';
import {
  PhMoney,
  PhCreditCard,
  PhDeviceMobile,
  PhGift,
  PhStorefront,
  PhMopedFront,
} from '@phosphor-icons/vue';

import { useOrderStore } from '@/stores/orderStore';
import { useAuthenticationStore } from '@/stores/authentication';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const authStore = useAuthenticationStore();

const userId = computed(() => authStore.getUserData?.uid);

// Data processing function to filter orders by driver
const processData = (orders) => {
  return orders.filter(order => order.deliveryDriverId === userId.value);
};

// Initialize useDataTable with custom handlers
const {
  toggleLoading,
  isLoading,
  tableData,
  handleToggleUpdate,
} = useDataTable(orderStore, {
  processData,
  subscribeToChanges: true,
  filters: {
    dateRange: {
      dateField: 'dueDate',
      startDate: periodStore.periodRange.start.toISOString(),
      endDate: periodStore.periodRange.end.toISOString(),
    },
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
    label: 'Valor Domi',
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
    component: CheckboxCell,
    getProps: (row) => ({
      isChecked: row.isPaid,
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

    <!-- Table -->
    <div>
      <DataTable
        :data="tableData"
        :columns="columns"
        :toggle-loading="toggleLoading"
        :data-loading="orderStore.loading || isLoading"
        @toggle-update="handleToggleUpdate"
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

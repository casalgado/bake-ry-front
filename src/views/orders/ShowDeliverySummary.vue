<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useOrderStore } from '@/stores/orderStore';
import { usePeriodStore } from '@/stores/periodStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import DataTable from '@/components/DataTable/index.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import DeliveryAddressCell from '@/components/DataTable/renderers/DeliveryAddressCell.vue';
import ClientCell from '@/components/DataTable/renderers/ClientCell.vue';
import { PhCheckSquare, PhMinus } from '@phosphor-icons/vue';
import TotalsSummary from '@/components/common/TotalsSummary.vue';
import _ from 'lodash';

const orderStore = useOrderStore();
const periodStore = usePeriodStore();
const settingsStore = useBakerySettingsStore();
const expandedDriver = ref(null);
const unsubscribeRef = ref(null);
const toggleLoading = ref({});
const drivers = ref([]);
const dataTableRef = ref(null);

const props = defineProps({
  singleDriverMode: { type: Boolean, default: false },
  driverId: { type: String, default: null },
});
// Helper function to filter orders by day range
const filterOrdersByDays = (orders, days) => {
  return orders.filter(order => {
    const weekday = new Date(order.preparationDate)
      .toLocaleDateString('es-ES', { weekday: 'long' })
      .toLowerCase();
    return days.includes(weekday);
  });
};

// Compute summary for a set of orders with default values
const computeSummary = (orders = []) => {
  const paidDeliveries = orders.filter(order => order.isDeliveryPaid).length;
  const unpaidOrders = orders.filter(order => !order.isDeliveryPaid);
  const unpaidAmount = _.sumBy(unpaidOrders, 'deliveryCost') || 0;

  return {
    totalDeliveries: orders.length,
    totalAmount: _.sumBy(orders, 'deliveryCost') || 0,
    paidDeliveries,
    unpaidDeliveries: orders.length - paidDeliveries,
    unpaidAmount,
  };
};

// Modified driverSummaries computed property with error handling
const driverSummaries = computed(() => {
  if (!orderStore.items) return [];

  let orders = (orderStore.items || [])
    .filter(order => order.fulfillmentType === 'delivery')
    .map(order => ({
      ...order,
      weekday: new Date(order.preparationDate)
        .toLocaleDateString('es-ES', { weekday: 'long' })
        .toLowerCase(),
    })).sort((a, b) => a.preparationDate.localeCompare(b.preparationDate));

  if (props.singleDriverMode && props.driverId) {
    orders = orders.filter(order => order.deliveryDriverId === props.driverId);
  }

  const driverGroups = _.groupBy(orders, 'deliveryDriverId');

  return Object.entries(driverGroups).map(([deliveryDriverId, driverOrders]) => {
    const earlyWeekOrders = filterOrdersByDays(driverOrders, ['lunes', 'martes', 'miércoles']);
    const lateWeekOrders = filterOrdersByDays(driverOrders, ['jueves', 'viernes', 'sábado']);

    return {
      id: deliveryDriverId,
      name: drivers.value.find(driver => driver.id == deliveryDriverId)?.name || 'Sin Asignar',
      summaries: {
        total: computeSummary(driverOrders),
        earlyWeek: computeSummary(earlyWeekOrders),
        lateWeek: computeSummary(lateWeekOrders),
      },
      deliveries: driverOrders,
    };
  });
});

// Global summary computed with error handling
const globalSummary = computed(() => ({
  totalDeliveries: _.sumBy(driverSummaries.value, 'summaries.total.totalDeliveries') || 0,
  totalAmount: _.sumBy(driverSummaries.value, 'summaries.total.totalAmount') || 0,
  totalPending: _.sumBy(driverSummaries.value, 'summaries.total.unpaidDeliveries') || 0,
  totalPendingAmount: _.sumBy(driverSummaries.value, 'summaries.total.unpaidAmount') || 0,
}));

// Summary categories with error handling
const deliveriesSummary = computed(() => ([
  { label: 'Total Domicilios', value: globalSummary.value.totalDeliveries || 0 },
]));

const pendingSummary = computed(() => ([
  { label: 'Por Pagar', value: `$${(globalSummary.value.totalPendingAmount || 0).toLocaleString()}  (${globalSummary.value.totalPending || 0})` },
]));

const amountSummary = computed(() => ([
  { label: 'Total Semana', value: `$${(globalSummary.value.totalAmount || 0).toLocaleString()}` },
]));

const tableFilters = [
  {
    field: 'weekday',
    options: [
      {
        label: 'Lunes-Miércoles',
        value: ['lunes', 'martes', 'miércoles'],  // Group first three days
      },
      {
        label: 'Jueves-Sábado',
        value: ['jueves', 'viernes', 'sábado'],   // Group last three days
      },
    ],
  },
];

// Table Columns for expanded view
const columns = [
  {
    id: 'weekday',
    label: 'Día',
    field: 'weekday',
    sortable: true,

  },
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
    options: [
      { value: true, icon: PhCheckSquare },
      { value: false, icon: PhMinus },
    ],
  },
];

const tableColumns = computed(() => {
  return columns.filter(col => !(props.singleDriverMode && col.id === 'isDeliveryPaid'));
});

// Handle toggle updates
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
  } catch (error) {
    console.error('Failed to update orders:', error);
  } finally {
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = false;
    });
  }
};

// Handle marking period as paid
const handleMarkPeriodPaid = async (driverId) => {
  const driverSummary = driverSummaries.value.find(d => d.id === driverId);
  if (!driverSummary) return;

  try {
    // Get unpaid deliveries
    const unpaidDeliveries = driverSummary.deliveries.filter(order => !order.isDeliveryPaid);

    if (unpaidDeliveries.length === 0) return;

    // Store the previous state
    const previousState = unpaidDeliveries.map(order => ({
      id: order.id,
      isDeliveryPaid: false,
    }));

    // Create updates
    const updates = unpaidDeliveries.map(order => ({
      id: order.id,
      data: { isDeliveryPaid: true },
    }));

    // Add to undo history
    console.log(dataTableRef.value[0]);
    dataTableRef.value[0]?.addToHistory({
      type: 'markPeriodPaid',
      description: `Mark period paid for ${driverSummary.name}`,
      undo: async () => {
        // Restore previous state
        const undoUpdates = previousState.map(state => ({
          id: state.id,
          data: { isDeliveryPaid: state.isDeliveryPaid },
        }));
        await orderStore.patchAll(undoUpdates);
      },
      redo: async () => {
        // Reapply the changes
        await orderStore.patchAll(updates);
      },
    });

    // Execute the updates
    await orderStore.patchAll(updates);
  } catch (error) {
    console.error('Failed to mark period as paid:', error);
  }
};

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
    // First fetch settings to get B2B clients
    await settingsStore.fetchById('default');
    drivers.value = await settingsStore.staff;
    drivers.value = drivers.value.filter(driver => driver.role == 'delivery_assistant');

    await orderStore.fetchAll({
      filters: {
        dateRange: {
          dateField: 'preparationDate',
          startDate: periodStore.periodRange.start.toISOString(),
          endDate: periodStore.periodRange.end.toISOString(),
        },
      },
      sort: { field: 'preparationDate', direction: 'asc' },
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
    <!-- Header -->
    <div class="flex flex-col lg:flex-row justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-neutral-800">
        {{ props.singleDriverMode ? 'Resumen de Domicilios' : 'Resumen de Domicilios' }}</h2>

      <PeriodSelector />
    </div>

    <!-- Global Summary -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <TotalsSummary :categories="deliveriesSummary" />
      <TotalsSummary :categories="pendingSummary" />
      <TotalsSummary :categories="amountSummary" />
    </div>

    <!-- Driver Cards -->
    <div class="space-y-4">
      <div v-for="driver in driverSummaries" :key="driver.id"
        class="bg-neutral-100 rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <!-- Driver Summary -->
        <div class="p-4 flex flex-wrap items-center gap-0 cursor-pointer "
          @click="expandedDriver = expandedDriver === driver.id ? null : driver.id">
          <!-- Driver Name -->
          <div class="">
            <h3 class="text-lg font-semibold text-neutral-800">{{ driver.name }}</h3>
          </div>

          <!-- Stats Grid -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">

            <!-- Early Week -->
            <div class="space-y-1 p-3 bg-white rounded-lg">
              <h4 class="text-sm font-medium text-center">Lunes - Miércoles</h4>
              <div class="grid grid-cols-3 gap-2">
                <div class="text-center">
                  <p class="text-xs text-neutral-500">Total</p>
                  <p class="font-semibold text-neutral-800 text-sm md:text-md">${{ driver.summaries.earlyWeek.totalAmount.toLocaleString()
                    }}</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-neutral-500">Pagados</p>
                  <p class="font-semibold text-neutral-800 text-sm md:text-md">
                    {{ driver.summaries.earlyWeek.paidDeliveries }}/{{ driver.summaries.earlyWeek.totalDeliveries }}
                  </p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-neutral-500">Pendiente</p>
                  <p class="font-semibold text-neutral-800 text-sm md:text-md">${{ driver.summaries.earlyWeek.unpaidAmount.toLocaleString()
                    }}</p>
                </div>
              </div>
            </div>

            <!-- Late Week -->
            <div class="space-y-1 p-3 bg-white rounded-lg">
              <h4 class="text-sm font-medium text-center">Jueves - Sábado</h4>
              <div class="grid grid-cols-3 gap-2">
                <div class="text-center">
                  <p class="text-xs text-neutral-500">Total</p>
                  <p class="font-semibold text-neutral-800 text-sm md:text-md">${{ driver.summaries.lateWeek.totalAmount.toLocaleString()
                    }}</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-neutral-500">Pagados</p>
                  <p class="font-semibold text-neutral-800 text-sm md:text-md">
                    {{ driver.summaries.lateWeek.paidDeliveries }}/{{ driver.summaries.lateWeek.totalDeliveries }}
                  </p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-neutral-500">Pendiente</p>
                  <p class="font-semibold text-neutral-800 text-sm md:text-md">${{ driver.summaries.lateWeek.unpaidAmount.toLocaleString()
                    }}</p>
                </div>
              </div>
            </div>

            <!-- Total Period -->
            <div class="space-y-1 p-3 bg-white rounded-lg">
              <h4 class="text-sm font-medium text-center">Semana Completa</h4>
              <div class="grid grid-cols-3 gap-2">
                <div class="text-center">
                  <p class="text-xs text-neutral-500">Total</p>
                  <p class="font-semibold text-neutral-800 text-sm md:text-md">${{ driver.summaries.total.totalAmount.toLocaleString() }}
                  </p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-neutral-500">Pagados</p>
                  <p class="font-semibold text-neutral-800 text-sm md:text-md">
                    {{ driver.summaries.total.paidDeliveries }}/{{ driver.summaries.total.totalDeliveries }}
                  </p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-neutral-500">Pendiente</p>
                  <p class="font-semibold text-neutral-800 text-sm md:text-md">${{ driver.summaries.total.unpaidAmount.toLocaleString() }}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Expanded Details -->
        <div v-if="expandedDriver === driver.id" class="border-t border-neutral-200 p-4">
          <div class="flex justify-between mb-4">
            <h4 class="font-semibold text-neutral-700">Detalle de Domicilios</h4>
            <div v-if="!props.singleDriverMode" class="flex gap-2">
              <button @click="handleMarkPeriodPaid(driver.id)" class="utility-btn">
                Marcar Todo Pagado
              </button>
            </div>
          </div>

          <DataTable ref="dataTableRef" :data="driver.deliveries" :columns="tableColumns"
            :toggle-loading="toggleLoading" :data-loading="orderStore.loading" :visible-filters="true"
            :filters="tableFilters" @toggle-update="handleToggleUpdate" class="bg-white" />
        </div>
      </div>
    </div>
  </div>
</template>

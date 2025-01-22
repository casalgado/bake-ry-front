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

const props = defineProps({
  singleDriverMode: { type: Boolean, default: false },
  driverId: { type: String, default: null },
});

// Transform orders into driver summary
const driverSummaries = computed(() => {

  // Step 1: Get base list of delivery orders
  let orders = orderStore.items.filter(order =>
    order.fulfillmentType === 'delivery',
  );

  // Step 2: Apply driver filter when in single-driver mode
  if (props.singleDriverMode && props.driverId) {
    orders = orders.filter(order =>
      order.deliveryDriverId === props.driverId,
    );
  }

  // Step 3: Group the filtered orders by driver
  const driverGroups = _.groupBy(orders, 'deliveryDriverId');

  return Object.entries(driverGroups).map(([deliveryDriverId, driverOrders]) => {
    const paidDeliveries = driverOrders.filter(order => order.isDeliveryPaid).length;
    const unpaidOrders = driverOrders.filter(order => !order.isDeliveryPaid);
    const unpaidAmount = _.sumBy(unpaidOrders, 'deliveryCost');

    return {
      id: deliveryDriverId,
      name: drivers.value.find(driver => driver.id == deliveryDriverId)?.name || 'Sin Asignar',
      summary: {
        totalDeliveries: driverOrders.length,
        totalAmount: _.sumBy(driverOrders, 'deliveryCost'),
        paidDeliveries,
        unpaidDeliveries: driverOrders.length - paidDeliveries,
        unpaidAmount,
        isPeriodPaid: false,
      },
      deliveries: driverOrders,
    };
  });
});

// Global summary computed
const globalSummary = computed(() => ({
  totalDeliveries: _.sumBy(driverSummaries.value, 'summary.totalDeliveries'),
  totalAmount: _.sumBy(driverSummaries.value, 'summary.totalAmount'),
  totalPending: _.sumBy(driverSummaries.value, 'summary.unpaidDeliveries'),
  totalPendingAmount: _.sumBy(driverSummaries.value, 'summary.unpaidAmount'),
}));

// Summary categories for TotalsSummary components
const deliveriesSummary = computed(() => ([
  { label: 'Total Domicilios', value: globalSummary.value.totalDeliveries },
]));

const pendingSummary = computed(() => ([
  { label: 'Por Pagar', value: `$${globalSummary.value.totalPendingAmount.toLocaleString()}  (${globalSummary.value.totalPending})` },
]));

const amountSummary = computed(() => ([
  { label: 'Total Semana', value: `$${globalSummary.value.totalAmount.toLocaleString()}` },
]));

// Table Columns for expanded view
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
    const updates = driverSummary.deliveries
      .filter(order => !order.isDeliveryPaid)
      .map(order => ({
        id: order.id,
        data: { isDeliveryPaid: true },
      }));

    if (updates.length > 0) {
      await orderStore.patchAll(updates);
    }
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
      <h2 class="text-2xl font-bold text-neutral-800">{{ props.singleDriverMode ? 'Resumen de Domicilios' : 'Resumen de Domicilios' }}</h2>

      <PeriodSelector  />
    </div>

    <!-- Global Summary -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <TotalsSummary :categories="deliveriesSummary" />
      <TotalsSummary :categories="pendingSummary" />
      <TotalsSummary :categories="amountSummary" />
    </div>

    <!-- Driver Cards -->
    <div class="space-y-4">
      <div
        v-for="driver in driverSummaries"
        :key="driver.id"
        class="bg-neutral-50 rounded-lg shadow-sm border border-neutral-200 overflow-hidden"
      >
        <!-- Driver Summary -->
        <div
          class="p-4 flex flex-wrap items-center gap-4 cursor-pointer hover:bg-neutral-100"
          @click="expandedDriver = expandedDriver === driver.id ? null : driver.id"
        >
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-neutral-800">{{ driver.name }}</h3>
            <p class="text-sm text-neutral-600">{{ driver.summary.totalDeliveries }} domicilios</p>
          </div>

          <div class="flex items-center gap-8">
            <div class="text-center">
              <p class="text-sm text-neutral-600">Total</p>
              <p class="font-semibold text-neutral-800">
                ${{ driver.summary.totalAmount.toLocaleString() }}

              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-neutral-600">Pagados</p>
              <p class="font-semibold text-neutral-800">{{ driver.summary.paidDeliveries }} / {{ driver.summary.totalDeliveries }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-neutral-600">Por Pagar</p>
              <p class="font-bold text-lg text-neutral-800">
                ${{ driver.summary.unpaidAmount.toLocaleString() }}
              </p>
            </div>
          </div>
        </div>

        <!-- Expanded Details -->
        <div
          v-if="expandedDriver === driver.id"
          class="border-t border-neutral-200 p-4"
        >
          <div class="flex justify-between mb-4">
            <h4 class="font-semibold text-neutral-700">Detalle de Domicilios</h4>
            <div v-if="!props.singleDriverMode" class="flex gap-2">
              <button
                @click="handleMarkPeriodPaid(driver.id)"
                class="utility-btn"
              >
                Marcar Todo Pagado
              </button>
            </div>
          </div>

          <DataTable
            :data="driver.deliveries"
            :columns="tableColumns"
            :toggle-loading="toggleLoading"
            :data-loading="orderStore.loading"
            @toggle-update="handleToggleUpdate"
            class="bg-white"
          />
        </div>
      </div>
    </div>
  </div>
</template>

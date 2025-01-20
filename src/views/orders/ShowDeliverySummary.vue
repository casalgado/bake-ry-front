// views/delivery/DeliverySummary.vue
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
import _ from 'lodash';

const orderStore = useOrderStore();
const periodStore = usePeriodStore();
const settingsStore = useBakerySettingsStore();
const expandedDriver = ref(null);
const unsubscribeRef = ref(null);
const toggleLoading = ref({});
const drivers = ref([]);

// Transform orders into driver summary
const driverSummaries = computed(() => {
  const driverGroups = _.groupBy(orderStore.items.filter(order => order.fulfillmentType == 'delivery'), 'deliveryDriverId');

  return Object.entries(driverGroups).map(([deliveryDriverId, driverOrders]) => {
    const paidDeliveries = driverOrders.filter(order => order.isDeliveryPaid).length;

    return {
      id: deliveryDriverId,
      name: drivers.value.find(driver => driver.id == deliveryDriverId)?.name || 'Sin Asignar',
      summary: {
        totalDeliveries: driverOrders.length,
        totalAmount: _.sumBy(driverOrders, 'deliveryCost'),
        paidDeliveries,
        unpaidDeliveries: driverOrders.length - paidDeliveries,
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
}));

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
    {{  drivers }}
    <div class="flex flex-col lg:flex-row justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-neutral-800">Resumen de Domicilios</h2>
      <PeriodSelector onlyFor="week" />
    </div>

    <!-- Global Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="bg-primary-100 p-4 rounded-lg">
        <h3 class="text-lg font-semibold text-primary-800">Total Domicilios</h3>
        <p class="text-3xl font-bold text-primary-600">
          {{ globalSummary.totalDeliveries }}
        </p>
      </div>

      <div class="bg-neutral-100 p-4 rounded-lg">
        <h3 class="text-lg font-semibold text-neutral-800">Por Cobrar</h3>
        <p class="text-3xl font-bold text-neutral-600">
          {{ globalSummary.totalPending }}
        </p>
      </div>

      <div class="bg-success/10 p-4 rounded-lg">
        <h3 class="text-lg font-semibold text-success">Total a Pagar</h3>
        <p class="text-3xl font-bold text-success">
          ${{ globalSummary.totalAmount.toLocaleString() }}
        </p>
      </div>
    </div>

    <!-- Driver Cards -->
    <div class="space-y-4">
      <div
        v-for="driver in driverSummaries"
        :key="driver.id"
        class="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden"
      >
        <!-- Driver Summary -->
        <div
          class="p-4 flex flex-wrap items-center gap-4 cursor-pointer hover:bg-neutral-50"
          @click="expandedDriver = expandedDriver === driver.id ? null : driver.id"
        >
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-neutral-800">{{ driver.name }}</h3>
            <p class="text-sm text-neutral-600">{{ driver.summary.totalDeliveries }} domicilios</p>
          </div>

          <div class="flex items-center gap-8">
            <div class="text-center">
              <p class="text-sm text-neutral-600">Por Cobrar</p>
              <p class="font-semibold text-warning">{{ driver.summary.unpaidDeliveries }}</p>
            </div>
            <div class="text-center">
              <p class="text-sm text-neutral-600">Cobrados</p>
              <p class="font-semibold text-success">{{ driver.summary.paidDeliveries }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-neutral-600">Total</p>
              <p class="font-bold text-lg text-primary-600">
                ${{ driver.summary.totalAmount.toLocaleString() }}
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
            <div class="flex gap-2">
              <button
                @click="handleMarkPeriodPaid(driver.id)"
                class="px-3 py-1 text-sm bg-success/10 text-success rounded-md hover:bg-success/20"
              >
                Marcar Todo Pagado
              </button>
            </div>
          </div>

          <DataTable
            :data="driver.deliveries"
            :columns="columns"
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

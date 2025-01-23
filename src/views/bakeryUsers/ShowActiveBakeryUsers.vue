<script setup>
import { computed, watch } from 'vue';
import DataTable, { useDataTable } from '@carsalhaz/vue-data-table';
import { useOrderStore } from '@/stores/orderStore';
import { usePeriodStore } from '@/stores/periodStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';

const orderStore = useOrderStore();
const periodStore = usePeriodStore();

// Process data function for the table
const processData = (orders) => {
  // Group orders by userId
  const clientOrders = orders.reduce((acc, order) => {
    if (!acc[order.userId]) {
      acc[order.userId] = [];
    }
    acc[order.userId].push(order);
    return acc;
  }, {});

  // Create client summaries
  return Object.values(clientOrders).map(orders => {
    const sortedOrders = orders.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt),
    );
    const mostRecent = sortedOrders[0];

    return {
      id: mostRecent.userId,
      userName: mostRecent.userName,
      userEmail: mostRecent.userEmail,
      userPhone: mostRecent.userPhone,
      deliveryAddress: mostRecent.deliveryAddress,
      orderCount: orders.length,
    };
  });
};

// Initialize useDataTable with custom handlers
const {
  dataTable,
  isLoading,
  tableData,
} = useDataTable(orderStore, {
  processData,
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

// Column definitions
const columns = [
  {
    id: 'userName',
    label: 'Nombre',
    field: 'userName',
    sortable: true,
  },
  {
    id: 'userEmail',
    label: 'Mail',
    field: 'userEmail',
    sortable: true,
  },
  {
    id: 'userPhone',
    label: 'Teléfono',
    field: 'userPhone',
    sortable: true,
  },
  {
    id: 'deliveryAddress',
    label: 'Dirección',
    field: 'deliveryAddress',
    sortable: true,
  },
  {
    id: 'orderCount',
    label: '#PED',
    field: 'orderCount',
    sortable: true,
  },
];

// Watch for period changes and refetch data
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
      <h2 class="text-2xl font-bold text-neutral-800">Active Clients</h2>
      <PeriodSelector />
    </div>

    <!-- Error State -->
    <div
      v-if="orderStore.error"
      class="text-danger text-center py-4"
    >
      {{ orderStore.error }}
    </div>

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :data="tableData"
        :columns="columns"
        :data-loading="orderStore.loading || isLoading"
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

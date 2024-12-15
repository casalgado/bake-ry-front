<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { usePeriodStore } from '@/stores/periodStore';
import { useOrderStore } from '@/stores/orderStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import DataTable from '@/components/DataTable/index.vue';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const dataTable = ref(null);

const columns = [
  {
    id: 'userName',
    label: 'Name',
    field: 'userName',
    sortable: true,
  },
  {
    id: 'userEmail',
    label: 'Email',
    field: 'userEmail',
    sortable: true,
  },
  {
    id: 'userPhone',
    label: 'Phone',
    field: 'userPhone',
    sortable: true,
  },
  {
    id: 'deliveryAddress',
    label: 'Address',
    field: 'deliveryAddress',
    sortable: true,
  },
  {
    id: 'orderCount',
    label: 'Orders in Period',
    field: 'orderCount',
    sortable: true,
  },
];

const activeClients = computed(() => {
  // Group orders by userId
  const clientOrders = orderStore.items.reduce((acc, order) => {
    if (!acc[order.userId]) {
      acc[order.userId] = [];
    }
    acc[order.userId].push(order);
    return acc;
  }, {});

  // Create client summaries
  return Object.values(clientOrders).map(orders => {
    // Sort orders by date to get most recent
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
});

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
  } catch (error) {
    console.error('Failed to initialize orders:', error);
  }
});
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex justify-between items-center mb-4">
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
        :data="activeClients"
        :columns="columns"
        :data-loading="orderStore.loading"
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

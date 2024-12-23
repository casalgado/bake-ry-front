<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch, computed } from 'vue';
import DataTable from '@/components/DataTable/index.vue';
import ShowValuesCell from '@/components/DataTable/renderers/ShowValuesCell.vue';
import { useOrderStore } from '@/stores/orderStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const unsubscribeRef = ref(null);

const dataTable = ref(null);
const toggleLoading = ref({});

// Computed property to flatten order items
const flattenedOrderItems = computed(() => {
  return orderStore.items.flatMap(order =>
    order.orderItems.map(item => ({
      ...item,
      id: item.id,
      orderId: order.id,
      productionBatch: item.productionBatch || 0, // Using existing or default value
      status: item.status || 0,
    })),
  );
});

// Computed property to get unique collection names
const uniqueCollections = computed(() => {
  const collections = new Set();
  orderStore.items.forEach(order => {
    order.orderItems.forEach(item => {
      if (item.collectionName) {
        collections.add(item.collectionName);
      }
    });
  });
  return Array.from(collections);
});

// Column definitions
const columns = [
  {
    id: 'collectionName',
    label: 'Colección',
    field: 'collectionName',
    sortable: true,
  },
  {
    id: 'productName',
    label: 'Producto',
    field: 'productName',
    sortable: true,
  },
  {
    id: 'quantity',
    label: 'Ctd',
    field: 'quantity',
    sortable: true,
  },
  {
    id: 'variation',
    label: 'Variación',
    field: 'variation',
    sortable: false,
    component: ShowValuesCell,
    getProps: (row) => ({
      object: row.variation,
      fields: ['name'],

    }),
  },
  {
    id: 'productionBatch',
    label: 'Tanda',
    field: 'productionBatch',
    sortable: true,
  },
  {
    id: 'status',
    label: 'Completado',
    field: 'status',
    sortable: true,
    type: 'toggle',
    options: [{ value: 0, displayText: '-' }, { value: 1, displayText: 'completado' }, { value: 2, displayText: 'entregado' }],
  },

];

const tableFilters = computed(() => [
  {
    field: 'collectionName',
    options: uniqueCollections.value.map(collection => ({
      label: collection,
      value: collection,
    })),
  },
  {
    field: 'status',
    options: [
      { label: 'pendiente', value: 0 },
      { label: 'completado', value: 1 },
      { label: 'entregado', value: 2 },
    ],
  },
]);

const handleToggleUpdate = async ({ rowIds, field, value }) => {
  try {
    // Set loading state
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = true;
    });

    // Group items by order
    const orderUpdates = rowIds.reduce((acc, itemId) => {
      const orderItem = flattenedOrderItems.value.find(item => item.id === itemId);
      if (!orderItem) return acc;

      if (!acc[orderItem.orderId]) {
        acc[orderItem.orderId] = {
          itemIds: new Set(),
          orderItems: orderStore.items
            .find(order => order.id === orderItem.orderId)
            .orderItems,
        };
      }

      acc[orderItem.orderId].itemIds.add(itemId);
      return acc;
    }, {});

    // Prepare updates array
    const updates = Object.entries(orderUpdates).map(([orderId, { orderItems, itemIds }]) => ({
      id: orderId,
      data: {
        orderItems: orderItems.map(item => ({
          ...item,
          [field]: itemIds.has(item.id) ? value : item[field],
        })),
      },
    }));

    // Single API call
    await orderStore.patchAll(updates);
    await nextTick();
  } catch (error) {
    console.error('Failed to update order items:', error);
  } finally {
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = false;
    });
  }
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
    console.log(orderStore.items);
    console.log('orderStore.items', orderStore.items);
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
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Producción</h2>
      <PeriodSelector onlyFor="day" />
    </div>

    <!-- Error State -->
    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :data="flattenedOrderItems"
        :columns="columns"
        :actions="[]"
        :toggle-loading="toggleLoading"
        :filters="tableFilters"
        :data-loading="orderStore.loading"
        @toggle-update="handleToggleUpdate"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

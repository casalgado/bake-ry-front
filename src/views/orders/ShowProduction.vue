<script setup>
import { ref, onMounted, nextTick, onUnmounted, watch, computed } from 'vue';
import DataTable from '@/components/DataTable/index.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import ShowValuesCell from '@/components/DataTable/renderers/ShowValuesCell.vue';

import { useOrderStore } from '@/stores/orderStore';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import { usePeriodStore } from '@/stores/periodStore';
import CheckboxCell from '@/components/DataTable/renderers/CheckboxCell.vue';

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
    id: 'variation',
    label: 'Variación',
    field: 'variation',
    sortable: false,
    component: ShowValuesCell,
    getProps: (row) => ({
      object: row.variation,
      fields: ['name', 'isWholeGrain'],

    }),
  },
  {
    id: 'quantity',
    label: 'Ctd',
    field: 'quantity',
    sortable: true,
  },
  {
    id: 'currentPrice',
    label: 'Precio',
    field: 'currentPrice',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.currentPrice,
    }),
  },
  {
    id: 'status',
    label: 'Completado',
    field: 'status',
    sortable: true,
    type: 'toggle',
    options: [0, 1],
    component: CheckboxCell,
    getProps: (row) => ({
      isChecked: row.status,
    }),
  },
  {
    id: 'productionBatch',
    label: 'Tanda',
    field: 'productionBatch',
    sortable: true,
    type: 'toggle',
    options: [1, 2, 3, 4],
  },
];

// Handlers
const handleToggleUpdate = async ({ rowIds, field, value }) => {
  try {
    // Group items by orderId
    const orderUpdates = rowIds.reduce((acc, itemId) => {
      const orderItem = flattenedOrderItems.value.find(item => item.id === itemId);
      if (!orderItem) return acc;

      toggleLoading.value[`${itemId}-${field}`] = true;

      // Initialize array for this order if it doesn't exist
      if (!acc[orderItem.orderId]) {
        acc[orderItem.orderId] = {
          orderItems: orderStore.items.find(order => order.id === orderItem.orderId).orderItems,
          itemsToUpdate: new Set(),
        };
      }

      // Add this item to the set of items to update for this order
      acc[orderItem.orderId].itemsToUpdate.add(itemId);

      return acc;
    }, {});

    console.log('orderUpdates', orderUpdates);

    // Create and execute updates for each order
    const promises = Object.entries(orderUpdates).map(([orderId, { orderItems, itemsToUpdate }]) => {
      const updatedItems = orderItems.map(item => {
        if (itemsToUpdate.has(item.id)) {
          return { ...item, [field]: value };
        }
        return item;
      });
      console.log('updatedItems', updatedItems);
      return orderStore.patch(orderId, { orderItems: updatedItems });
    });

    await Promise.all(promises);
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
  <div class="container p-4">
    <div class="flex justify-between items-center mb-4">
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
        :data-loading="orderStore.loading"
        @toggle-update="handleToggleUpdate"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

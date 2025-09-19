<script setup>
// Vue
import { ref, onMounted, nextTick, onUnmounted, watch, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';

// DataTable
import DataTable from '@/components/DataTable/index.vue';
import CombinedProductionInfoCell from '@/components/DataTable/renderers/CombinedProductionInfoCell.vue';

// Components
import PeriodSelector from '@/components/common/PeriodSelector.vue';

// Stores
import { useOrderStore } from '@/stores/orderStore';
import { usePeriodStore } from '@/stores/periodStore';

// Icons & Utils
import { PhPlusMinus } from '@phosphor-icons/vue';
import { categoryOrder } from '@/utils/helpers';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const unsubscribeRef = ref(null);

const dataTable = ref(null);
const toggleLoading = ref({});
const actionLoading = ref({});
const isBatchDialogOpen = ref(false);
const selectedIds = ref([]);

const flattenedOrderItems = computed(() => {
  return orderStore.items
    .flatMap(order =>
      order.orderItems.map(item => ({
        ...item,
        id: item.id,
        orderId: order.id,
        productionBatch: item.productionBatch || 0,
        status: item.status || 0,
        collectionOrder: categoryOrder[item.collectionName?.toLowerCase()] || 999,
      })),
    )
    .sort((a, b) => {
      // First sort by collection order
      if (a.collectionOrder !== b.collectionOrder) {
        return a.collectionOrder - b.collectionOrder;
      }
      // Then by product name
      const productCompare = a.productName.localeCompare(b.productName);
      if (productCompare !== 0) {
        return productCompare;
      }
      // Finally by variation/combination name if present
      const getVariationName = (item) => {
        // Prioritize combination (new system)
        if (item.combination && typeof item.combination.getDisplayName === 'function') {
          return item.combination.getDisplayName();
        }

        return item.variation?.name || '';
      };

      const aVariationName = getVariationName(a);
      const bVariationName = getVariationName(b);

      if (aVariationName && bVariationName) {
        return aVariationName.localeCompare(bVariationName);
      }
      // If only one has variation, sort it after the non-variation item
      return (aVariationName ? 1 : 0) - (bVariationName ? 1 : 0);
    });
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
    id: 'productionBatch',
    label: 'T',
    field: 'productionBatch',
    sortable: true,
  },
  {
    id: 'collectionName',
    label: 'Categoría',
    field: 'collectionName',
    sortable: true,
  },
  {
    id: 'combinedInfo',
    label: 'Producto',
    field: 'productName',
    sortable: true,
    component: CombinedProductionInfoCell,
    getProps: (row) => ({
      productName: row.productName,
      variation: row.variation,
      combination: row.combination,
      totalQuantity: row.quantity,
    }),
  },
  {
    id: 'status',
    label: 'Estado',
    field: 'status',
    sortable: true,
    type: 'toggle',
    options: [
      { value: 0, displayText: '-' },
      { value: 1, displayText: 'producido' },
    ],
  },
];

// Table actions
const tableActions = [
  {
    id: 'setBatch',
    label: 'Asignar Tanda',
    icon: PhPlusMinus,
    minSelected: 1,
    variant: 'primary',
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
      { label: '-', value: 0 },
      { label: 'producido', value: 1 },
      { label: 'entregado', value: 2 },
    ],
  },
]);

const handleToggleUpdate = async ({ rowIds, field, value }) => {
  try {
    rowIds.forEach(id => {
      toggleLoading.value[`${id}-${field}`] = true;
    });

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

    const updates = Object.entries(orderUpdates).map(([orderId, { orderItems, itemIds }]) => ({
      id: orderId,
      data: {
        orderItems: orderItems.map(item => ({
          ...item,
          [field]: itemIds.has(item.id) ? value : item[field],
        })),
      },
    }));
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
const handleAction = async ({ actionId, selectedIds: rowIds }) => {  // Changed parameter destructuring
  actionLoading.value[actionId] = true;

  try {
    switch (actionId) {
    case 'setBatch':
      selectedIds.value = rowIds;  // Now correctly assigns the selected IDs
      isBatchDialogOpen.value = true;
      break;
    }
  } catch (error) {
    console.error('Action failed:', error);
  } finally {
    actionLoading.value[actionId] = false;
  }
};

const handleBatchSelect = async (batchNumber) => {
  if (!selectedIds.value?.length) return;  // Add safety check

  try {
    const orderUpdates = selectedIds.value.reduce((acc, itemId) => {
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

    const updates = Object.entries(orderUpdates).map(([orderId, { orderItems, itemIds }]) => ({
      id: orderId,
      data: {
        orderItems: orderItems.map(item => ({
          ...item,
          productionBatch: itemIds.has(item.id) ? batchNumber : item.productionBatch,
        })),
      },
    }));
    isBatchDialogOpen.value = false;
    await orderStore.patchAll(updates);
    await nextTick();
  } catch (error) {
    console.error('Failed to update production batch:', error);
  } finally {

    selectedIds.value = [];  // Clear selected IDs
    if (dataTable.value) {
      dataTable.value.clearSelection();
    }
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
            dateField: 'preparationDate',
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
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Individual</h2>
      <PeriodSelector :only-for="['day']" />
    </div>

    <!-- Error State -->
    <div v-if="orderStore.error" class="text-danger text-center py-4">
      {{ orderStore.error }}
    </div>

    <!-- Batch Selection Dialog -->
    <Dialog
      :open="isBatchDialogOpen"
      @close="isBatchDialogOpen = false"
      class="relative z-50"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <!-- Dialog content -->
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-sm w-full">
          <h3 class="text-lg font-medium text-neutral-800 mb-4 text-center">
            Seleccionar Tanda de Producción
          </h3>
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="batch in [1, 2, 3, 4, 5, 6]"
              :key="batch"
              @click="handleBatchSelect(batch)"
              class="utility-btn "
            >
              {{ batch }}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :data="flattenedOrderItems"
        :columns="columns"
        :actions="tableActions"
        :action-loading="actionLoading"
        :toggle-loading="toggleLoading"
        :filters="tableFilters"
        :data-loading="orderStore.loading"
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
</style>

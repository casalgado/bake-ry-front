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

// Flattened order items with additional references
const flattenedOrderItems = computed(() => {
  return orderStore.items.flatMap(order =>
    order.orderItems.map(item => ({
      ...item,
      id: item.id,
      orderId: order.id,
      productionBatch: item.productionBatch || 0,
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

// Then modify the groupedOrderItems to include the sorting value and make sorting case-insensitive
const groupedOrderItems = computed(() => {
  const groups = flattenedOrderItems.value.reduce((acc, item) => {
    const variationId = item.variation?.id || 'no-variation';
    const key = `${item.productId}-${variationId}`;

    // Convert collection name to lowercase for matching
    const collectionName = item.collectionName?.toLowerCase();

    if (!acc[key]) {
      acc[key] = {
        id: key,
        productId: item.productId,
        productName: item.productName,
        collectionName: item.collectionName,
        collectionOrder: categoryOrder[collectionName] || 999, // Case-insensitive lookup
        variation: item.variation || { name: '' },
        totalQuantity: 0,
        originalItems: [],
        batches: new Set(),
        statuses: new Set(),
      };
    }

    acc[key].totalQuantity += item.quantity;
    acc[key].originalItems.push(item);
    if (item.productionBatch) acc[key].batches.add(item.productionBatch);
    acc[key].statuses.add(item.status);

    return acc;
  }, {});

  return Object.values(groups)
    .sort((a, b) => {
      // First sort by collection order
      if (a.collectionOrder !== b.collectionOrder) {
        return a.collectionOrder - b.collectionOrder;
      }
      // Then by product name
      return a.productName.localeCompare(b.productName);
    })
    .map(group => ({
      ...group,
      productionBatch: group.batches.size === 1
        ? Array.from(group.batches)[0]
        : Array.from(group.batches).sort((a, b) => a - b).join(','),
      status: group.statuses.size === 1
        ? Array.from(group.statuses)[0]
        : 'Mixed',
      batches: Array.from(group.batches).sort().join(','),
    }));
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
    label: 'Colección',
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
      totalQuantity: row.totalQuantity,
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
      { value: 'Mixed', displayText: 'M', skipWhenToggled: true },
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
    // Find all original items that need to be updated
    const itemsToUpdate = rowIds.flatMap(groupId =>
      groupedOrderItems.value
        .find(group => group.id === groupId)
        ?.originalItems || [],
    );

    // Set loading state for all items
    itemsToUpdate.forEach(item => {
      toggleLoading.value[`${item.id}-${field}`] = true;
    });

    // Group updates by order
    const orderUpdates = itemsToUpdate.reduce((acc, item) => {
      if (!acc[item.orderId]) {
        acc[item.orderId] = {
          itemIds: new Set(),
          orderItems: orderStore.items
            .find(order => order.id === item.orderId)
            .orderItems,
        };
      }
      acc[item.orderId].itemIds.add(item.id);
      return acc;
    }, {});

    // Prepare updates
    const updates = Object.entries(orderUpdates).map(([orderId, { orderItems, itemIds }]) => ({
      id: orderId,
      data: {
        orderItems: orderItems.map(item => ({
          ...item,
          [field]: itemIds.has(item.id) ? value : item[field],
        })),
      },
    }));

    // Execute updates
    await orderStore.patchAll(updates);
    await nextTick();
  } catch (error) {
    console.error('Failed to update items:', error);
  } finally {
    // Clear loading states
    Object.keys(toggleLoading.value).forEach(key => {
      toggleLoading.value[key] = false;
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
  if (!selectedIds.value?.length) return;

  try {
    // First, get all original items that need to be updated from the selected groups
    const itemsToUpdate = selectedIds.value.flatMap(groupId =>
      groupedOrderItems.value
        .find(group => group.id === groupId)
        ?.originalItems || [],
    );

    // Now group updates by order using the actual order items
    const orderUpdates = itemsToUpdate.reduce((acc, orderItem) => {
      if (!acc[orderItem.orderId]) {
        acc[orderItem.orderId] = {
          itemIds: new Set(),
          orderItems: orderStore.items
            .find(order => order.id === orderItem.orderId)
            .orderItems,
        };
      }

      acc[orderItem.orderId].itemIds.add(orderItem.id);
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
    selectedIds.value = [];
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
      <h2 class="text-2xl font-bold text-neutral-800">Agrupado</h2>
      <PeriodSelector onlyFor="day" />
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
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
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
              class="p-2 text-center bg-neutral-100 hover:bg-primary-100
                     rounded-md transition-colors duration-200"
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
        :data="groupedOrderItems"
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

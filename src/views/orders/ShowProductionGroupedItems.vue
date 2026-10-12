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
import { useProductionRunStore } from '@/stores/productionRunStore';

// Icons & Utils
import { PhPlusMinus } from '@phosphor-icons/vue';
import { categoryOrder } from '@/utils/helpers';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const productionRunStore = useProductionRunStore();
const unsubscribeRef = ref(null);
const unsubscribeRunsRef = ref(null);

const dataTable = ref(null);
const actionLoading = ref({});
const isBatchDialogOpen = ref(false);
const selectedIds = ref([]);

// Production-run lines ("Vitrina"). They group apart from order items, so one
// tap never mixes "mark producido" with "move stock".
// Only runs for the day being prepared: the live listener adds any new run, so
// one sent for another date must not show up here.
const inPeriod = (run) => {
  const date = new Date(run.date);
  const { start, end } = periodStore.periodRange;
  return date >= start && date <= end;
};

const runRows = computed(() => productionRunStore.items.filter(inPeriod).flatMap((run) =>
  (run.lines || [])
    .filter((line) => line.status !== 'cancelled')
    .map((line) => ({
      id: `run-${run.id}-${line.id}`,
      source: 'run',
      runId: run.id,
      lineId: line.id,
      groupKey: `run-${line.item.type}-${line.item.id}-${line.item.combinationId || ''}`,
      productId: line.item.id,
      productName: line.unit && line.unit !== 'uds' ? `${line.name} (${line.unit})` : line.name,
      collectionName: line.collectionName,
      quantity: line.plannedQty,
      status: line.status === 'received' ? 1 : 0,
    }))));

// Flattened order items with additional references
const flattenedOrderItems = computed(() => {
  return [
    // A line taken from stock (Disponible) has nothing for the kitchen to make.
    ...orderStore.items.flatMap((order) =>
      order.orderItems.filter((item) => item.fulfillmentSource !== 'stock').map((item) => ({
        ...item,
        id: item.id,
        orderId: order.id,
        productionBatch: item.productionBatch || 0,
        status: item.status || 0,
        // Who the order is for: the key counts distinct clients, the label shows one.
        clientKey: order.userId || order.userName || order.id,
        clientLabel: order.userName || '',
      })),
    ),
    ...runRows.value,
  ];
});

// The collections of what is listed: a collection with only Disponible lines has
// nothing here to filter.
const uniqueCollections = computed(() => [
  ...new Set(flattenedOrderItems.value.map((item) => item.collectionName).filter(Boolean)),
]);

// One client: their name. Several: how many. A Vitrina group has no client.
const clientLabelOf = (group) => {
  if (group.origin === 'Vitrina') return 'Vitrina';
  if (group.clients.size > 1) return `${group.clients.size} clientes`;
  return [...group.clients.values()][0] || '-';
};

// Then modify the groupedOrderItems to include the sorting value and make sorting case-insensitive
const groupedOrderItems = computed(() => {
  const groups = flattenedOrderItems.value.reduce((acc, item) => {
    // Use combination for grouping if available, fallback to variation (legacy support)
    const variationId = item.combination?.id || item.variation?.id || 'no-variation';
    const key = item.groupKey || `${item.productId}-${variationId}`;

    if (!acc[key]) {
      acc[key] = {
        id: key,
        productId: item.productId,
        productName: item.productName,
        // A group is all Vitrina or all orders: the group key keeps them apart.
        origin: item.source === 'run' ? 'Vitrina' : 'Clientes',
        clients: new Map(),
        collectionName: item.collectionName,
        collectionOrder:
          categoryOrder[item.collectionName?.toLowerCase()] || 999,
        variation: item.variation || { name: '' },
        combination: item.combination || null,
        totalQuantity: 0,
        originalItems: [],
        producedCount: 0,
        totalItems: 0,
      };
    }

    acc[key].totalQuantity += item.quantity;
    acc[key].originalItems.push(item);
    if (item.source !== 'run') acc[key].clients.set(item.clientKey, item.clientLabel);
    acc[key].totalItems++;
    if (item.status === 1) {
      // 1 represents 'producido'
      acc[key].producedCount++;
    }

    return acc;
  }, {});

  return Object.values(groups)
    .sort((a, b) => {
      if (a.collectionOrder !== b.collectionOrder) {
        return a.collectionOrder - b.collectionOrder;
      }
      const byName = a.productName.localeCompare(b.productName);
      // Same product made for orders and for the vitrina: orders first.
      return byName || a.origin.localeCompare(b.origin);
    })
    .map((group) => ({
      ...group,
      clientName: clientLabelOf(group),
      status:
        group.producedCount === group.totalItems
          ? 1
          : group.producedCount === 0
            ? 0
            : `${group.producedCount}/${group.totalItems}`,
    }));
});

// Column definitions
const columns = [
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
      totalQuantity: row.totalQuantity,
    }),
  },
  {
    id: 'clientName',
    label: 'Cliente',
    field: 'clientName',
    sortable: true,
  },
  {
    id: 'status',
    label: 'Estado',
    field: 'status',
    sortable: true,

    options: [
      { value: 1, displayText: 'producido' },
      { value: 0, displayText: '-' },
      {
        test: (value) => typeof value === 'string' && value.includes('/'),
        displayText: (value) => value,
        skipWhenToggled: true,
      },
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
    options: uniqueCollections.value.map((collection) => ({
      label: collection,
      value: collection,
    })),
  },
  {
    field: 'origin',
    options: [
      { label: 'Clientes', value: 'Clientes' },
      { label: 'Vitrina', value: 'Vitrina' },
    ],
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

const handleAction = async ({ actionId, selectedIds: rowIds }) => {
  // Changed parameter destructuring
  actionLoading.value[actionId] = true;

  try {
    switch (actionId) {
    case 'setBatch':
      selectedIds.value = rowIds; // Now correctly assigns the selected IDs
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
    const itemsToUpdate = selectedIds.value.flatMap(
      (groupId) =>
        groupedOrderItems.value.find((group) => group.id === groupId)
          ?.originalItems || [],
    );

    // Now group updates by order using the actual order items. Tanda is an
    // order-item field; Vitrina rows have none.
    const orderUpdates = itemsToUpdate.filter((item) => item.source !== 'run').reduce((acc, orderItem) => {
      if (!acc[orderItem.orderId]) {
        acc[orderItem.orderId] = {
          itemIds: new Set(),
          orderItems: orderStore.items.find(
            (order) => order.id === orderItem.orderId,
          ).orderItems,
        };
      }

      acc[orderItem.orderId].itemIds.add(orderItem.id);
      return acc;
    }, {});

    const updates = Object.entries(orderUpdates).map(
      ([orderId, { orderItems, itemIds }]) => ({
        id: orderId,
        data: {
          orderItems: orderItems.map((item) => ({
            ...item,
            productionBatch: itemIds.has(item.id)
              ? batchNumber
              : item.productionBatch,
          })),
        },
      }),
    );

    isBatchDialogOpen.value = false;
    if (updates.length) await orderStore.patchAll(updates);
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

// Runs sent for the same day as the orders being prepared.
const fetchRuns = (range) => productionRunStore.fetchAll({
  filters: {
    dateRange: {
      dateField: 'date',
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
    },
  },
}).catch((error) => console.error('Failed to fetch production runs:', error));

// Watch for period changes and fetch new data
watch(
  () => periodStore.periodRange,
  async (newRange) => {
    fetchRuns(newRange);
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
  fetchRuns(periodStore.periodRange);
  // Its own step: a failed orders load must not also take the live runs down.
  try {
    unsubscribeRunsRef.value = await productionRunStore.subscribeToChanges();
  } catch (error) {
    console.error('Failed to subscribe to production runs:', error);
  }
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
  if (unsubscribeRunsRef.value) {
    unsubscribeRunsRef.value();
    productionRunStore.unsubscribe();
  }
});
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Agrupado</h2>
      <div class="flex flex-col">
        <PeriodSelector />
      </div>
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
              class="p-2 text-center bg-neutral-100 hover:bg-primary-100 rounded-md transition-colors duration-200"
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
        :filters="tableFilters"
        :data-loading="orderStore.loading"
        :history="false"
        @action="handleAction"
        class="production-table bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
// Estado is the last column and only reads "-", "producido" or "x/y". Without a
// fixed width the table resizes it every time a group toggles.
.production-table :deep(th:last-child),
.production-table :deep(td:last-child) {
  width: 7.5rem;
  min-width: 7.5rem;
}

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

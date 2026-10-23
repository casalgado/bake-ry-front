<script setup>
// Vue
import { ref, onMounted, nextTick, onUnmounted, watch, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';

// DataTable
import DataTable from '@/components/DataTable/index.vue';
import CombinedProductionInfoCell from '@/components/DataTable/renderers/CombinedProductionInfoCell.vue';
import CommentsCell from '@/components/DataTable/renderers/CommentsCell.vue';

// Components
import PeriodSelector from '@/components/common/PeriodSelector.vue';

// Stores
import { useOrderStore } from '@/stores/orderStore';
import { usePeriodStore } from '@/stores/periodStore';
import { useProductionRunStore } from '@/stores/productionRunStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

// Icons & Utils
import { PhPlusMinus, PhPencilSimple, PhTrash, PhArrowCounterClockwise } from '@phosphor-icons/vue';
import { categoryOrder, formatQty, capitalize } from '@/utils/helpers';
import { GAP_TEXT } from '@/utils/stockGaps';
import Combination from '@/models/Combination.js';

const periodStore = usePeriodStore();
const orderStore = useOrderStore();
const productionRunStore = useProductionRunStore();
const settingsStore = useBakerySettingsStore();
const unsubscribeRef = ref(null);
const unsubscribeRunsRef = ref(null);

const dataTable = ref(null);
const toggleLoading = ref({});
const actionLoading = ref({});
const isBatchDialogOpen = ref(false);
const selectedIds = ref([]);

// Production-run lines ("Vitrina") in the same row shape as order items. Ticking
// one receives the line, which moves stock, so it asks first and can't be
// un-ticked here. With inventory on, an order row may move stock too and
// behaves the same.
// Only runs for the day being prepared: the live listener adds any new run, so
// one sent for another date must not show up here.
const inPeriod = (run) => {
  const date = new Date(run.date);
  const { start, end } = periodStore.periodRange;
  return date >= start && date <= end;
};

const runRows = computed(() => productionRunStore.items.filter(inPeriod).flatMap(run =>
  (run.lines || [])
    .filter(line => line.status !== 'cancelled')
    .map(line => ({
      id: `run-${run.id}-${line.id}`,
      source: 'run',
      runId: run.id,
      lineId: line.id,
      item: line.item,
      productName: line.unit && line.unit !== 'uds' ? `${line.name} (${line.unit})` : line.name,
      collectionName: line.collectionName,
      quantity: line.plannedQty,
      variation: null,
      combination: null,
      productionBatch: 0,
      status: line.status === 'received' ? 1 : 0,
      collectionOrder: categoryOrder[line.collectionName?.toLowerCase()] || 999,
      clientName: 'Vitrina',
      orderComments: '',
    }))));

const asksFirst = (row) => row.source === 'run' || settingsStore.isInventoryEnabled;

const flattenedOrderItems = computed(() => {
  return [
    // A line taken from stock (Disponible) has nothing for the kitchen to make.
    ...orderStore.items.flatMap(order =>
      order.orderItems.filter(item => item.fulfillmentSource !== 'stock').map(item => ({
        ...item,
        id: item.id,
        orderId: order.id,
        productionBatch: item.productionBatch || 0,
        status: item.status || 0,
        collectionOrder: categoryOrder[item.collectionName?.toLowerCase()] || 999,
        // The customer tells an order line from a Vitrina one; the production
        // comments (`internalNotes`) stay in their own column.
        clientName: order.userName || '',
        orderComments: order.internalNotes || '',
      })),
    ),
    ...runRows.value,
  ]
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
// The collections of what is listed: a collection with only Disponible lines has
// nothing here to filter.
const uniqueCollections = computed(() => [
  ...new Set(flattenedOrderItems.value.map(item => item.collectionName).filter(Boolean)),
]);

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
    id: 'clientName',
    label: 'Cliente',
    field: 'clientName',
    sortable: true,
  },
  {
    id: 'comments',
    label: 'Comentarios',
    field: 'orderComments',
    sortable: true,
    component: CommentsCell,
    getProps: (row) => ({
      comments: row.orderComments,
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
    // A produced row that asked first doesn't un-tick: it may have moved stock. Say how instead of "→ -".
    tooltipFor: (row) => {
      if (!asksFirst(row) || row.status !== 1) return null;
      // A Vitrina line always moved stock; an order line only when it had a receipt.
      const moved = row.source === 'run' || row.producedQty > 0;
      return moved
        ? 'Producido: entró a la bodega y se descontó su receta. Para deshacer, selecciona la fila'
        : 'Para deshacer, selecciona la fila';
    },
  },
];

// Which rows are selected, to offer Vitrina actions only where they apply.
const selectedRowIds = ref([]);

const rowsById = computed(() => new Map(flattenedOrderItems.value.map(row => [row.id, row])));

const pendingRows = (ids) => ids
  .map(id => rowsById.value.get(id))
  .filter(row => row?.status === 0);

const pendingRunRows = (ids) => pendingRows(ids).filter(row => row.source === 'run');

// Any row, Vitrina or order: both can go back to pending.
const producedRows = (ids) => ids
  .map(id => rowsById.value.get(id))
  .filter(row => row?.status === 1);

// Table actions
const tableActions = computed(() => {
  const pending = pendingRunRows(selectedRowIds.value);
  const produced = producedRows(selectedRowIds.value);
  return [
    {
      id: 'setBatch',
      label: 'Asignar Tanda',
      icon: PhPlusMinus,
      minSelected: 1,
      variant: 'primary',
    },
    // A sent line can be edited or removed only while the kitchen hasn't made it.
    {
      id: 'editRunQty',
      label: 'Editar cantidad',
      icon: PhPencilSimple,
      variant: 'secondary',
      hideIf: selectedRowIds.value.length !== 1 || pending.length !== 1,
    },
    {
      id: 'removeRun',
      label: 'Quitar de producción',
      icon: PhTrash,
      variant: 'danger',
      hideIf: pending.length === 0,
    },
    // A produced row goes back to pending; a Vitrina line also gives its stock back.
    {
      id: 'undoProduced',
      label: 'Deshacer producido',
      icon: PhArrowCounterClockwise,
      variant: 'secondary',
      hideIf: produced.length === 0,
    },
  ];
});

/* ---------------- Vitrina actions, and undo for any row: each one asks first ---------------- */

// One dialog for all four: receive (the tick), undo, remove and edit quantity.
//   { kind, rows, ignored, qty, error, saving }
const runDialog = ref(null);

const DIALOG_TEXT = {
  receive: { title: 'Confirmar producción', confirm: 'Marcar producido' },
  undo: { title: 'Deshacer producción', confirm: 'Deshacer' },
  remove: { title: 'Quitar de producción', confirm: 'Quitar' },
  edit: { title: 'Editar cantidad', confirm: 'Guardar' },
};

// Named like the Producto column, so two "Original" of different products differ.
const rowLabel = (row) => {
  const combination = row.combination ? new Combination(row.combination).getDisplayName() : '';
  return `${formatQty(row.quantity)} ${capitalize(row.productName)}${combination ? ` ${combination}` : ''}`;
};

// A Vitrina line always moved stock; an order line only when it had a receipt.
const undoNote = (dialog) => (dialog.rows.some(row => row.source === 'run' || row.producedQty > 0)
  ? 'Vuelve a pendiente. La bodega se revierte.'
  : 'Vuelve a pendiente.');

// The server decides whether an order row's tick moves stock.
const tick = (row) => (row.source === 'run'
  ? productionRunStore.receiveLine(row.runId, row.lineId)
  : orderStore.produceItem(row.orderId, row.id));

function openRunDialog(kind, rows, ignored = 0) {
  runDialog.value = {
    kind, rows, ignored, qty: rows[0].quantity, error: '', saving: false,
    consumption: null, gaps: [], previewError: '',
  };
  if (kind === 'receive') loadConsumption(runDialog.value);
}

// What a receive dialog would consume, summed across its rows (two breads on
// harina show one harina). It warns, never blocks.
async function loadConsumption(dialog) {
  const runs = dialog.rows.filter(row => row.source === 'run');
  const orders = dialog.rows.filter(row => row.source !== 'run');
  try {
    const lines = (await Promise.all([
      runs.length ? productionRunStore.preview(runs.map(r => ({ item: r.item, plannedQty: r.quantity }))) : [],
      orders.length ? orderStore.previewProduce(orders.map(r => ({ orderId: r.orderId, itemId: r.id }))) : [],
    ])).flat();
    if (runDialog.value !== dialog) return;
    const byKey = new Map();
    lines.forEach(line => line.components.forEach((c) => {
      const key = `${c.item.type}:${c.item.id}:${c.item.combinationId ?? ''}`;
      const current = byKey.get(key) ?? { name: c.name, unit: c.unit, qty: 0 };
      current.qty += c.qty;
      byKey.set(key, current);
    }));
    dialog.consumption = [...byKey.values()];
    dialog.gaps = lines.flatMap(line => line.gaps);
  } catch {
    if (runDialog.value === dialog) dialog.previewError = 'No se pudo calcular lo que consume.';
  }
}

async function confirmRunDialog() {
  const dialog = runDialog.value;
  if (!dialog || dialog.saving) return;

  if (dialog.kind === 'edit') {
    const qty = Number(dialog.qty);
    if (!(qty > 0) || qty === dialog.rows[0].quantity) {
      dialog.error = 'Escribe una cantidad mayor a 0 y distinta de la actual.';
      return;
    }
  }

  // One call per line. A row leaves the dialog once its call succeeds, so after a
  // failure partway through, a retry sends only what is left (the server refuses
  // to undo a line that is no longer produced).
  const settled = (row) => {
    dialog.rows = dialog.rows.filter(r => r.id !== row.id);
  };

  dialog.saving = true;
  dialog.error = '';
  try {
    if (dialog.kind === 'undo') {
      for (const row of [...dialog.rows]) {
        if (row.source === 'run') await productionRunStore.undoLine(row.runId, row.lineId);
        else await orderStore.unproduceItem(row.orderId, row.id);
        settled(row);
      }
    } else {
      for (const row of [...dialog.rows]) {
        if (dialog.kind === 'receive') await tick(row);
        else if (dialog.kind === 'remove') await productionRunStore.cancelLine(row.runId, row.lineId);
        else await productionRunStore.updateLine(row.runId, row.lineId, Number(dialog.qty));
        settled(row);
      }
    }
    closeRunDialog(true);
  } catch (error) {
    dialog.error = error?.message || 'No se pudo completar la acción.';
    dialog.saving = false;
  }
}

function closeRunDialog(clearSelection = false) {
  runDialog.value = null;
  if (clearSelection) dataTable.value?.clearSelection();
}

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

    // Rows that ask first wait for the dialog on a tick; on an un-tick they do
    // nothing and stay producido (the tooltip says how). The rest go straight.
    const rows = rowIds.map(id => rowsById.value.get(id)).filter(Boolean);
    if (value === 1) {
      const pending = rows.filter(row => row.status === 0);
      const dialogRows = pending.filter(asksFirst);
      // Left out: rows already produced.
      if (dialogRows.length) openRunDialog('receive', dialogRows, rows.length - pending.length);
      for (const row of pending.filter(row => !asksFirst(row))) await tick(row);
    } else {
      for (const row of rows.filter(row => row.status === 1 && !asksFirst(row))) {
        await orderStore.unproduceItem(row.orderId, row.id);
      }
    }
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
    case 'removeRun':
    case 'editRunQty': {
      const pending = pendingRunRows(rowIds);
      if (pending.length) {
        openRunDialog(actionId === 'removeRun' ? 'remove' : 'edit', pending, rowIds.length - pending.length);
      }
      break;
    }
    case 'undoProduced': {
      const produced = producedRows(rowIds);
      if (produced.length) openRunDialog('undo', produced, rowIds.length - produced.length);
      break;
    }
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
      // Tanda is an order-item field; Vitrina rows have none.
      if (!orderItem || orderItem.source === 'run') return acc;

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

// Runs sent for the same day as the orders being prepared.
const fetchRuns = (range) => productionRunStore.fetchAll({
  filters: {
    dateRange: {
      dateField: 'date',
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
    },
  },
}).catch(error => console.error('Failed to fetch production runs:', error));

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
      <h2 class="text-2xl font-bold text-neutral-800">Individual</h2>
      <PeriodSelector />
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

    <!-- Receive (the tick) and undo for any row; remove and edit quantity for Vitrina lines. -->
    <Dialog :open="!!runDialog" @close="closeRunDialog()" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel v-if="runDialog" class="bg-white rounded-lg p-6 max-w-sm w-full">
          <h3 class="text-lg font-medium text-neutral-800 text-center mb-1">
            {{ DIALOG_TEXT[runDialog.kind].title }}
          </h3>

          <div class="text-sm text-neutral-700 text-center space-y-3 mb-6">
            <ul class="text-lg text-neutral-800 space-y-0.5">
              <li v-for="row in runDialog.rows" :key="row.id">{{ rowLabel(row) }}</li>
            </ul>

            <template v-if="runDialog.kind === 'receive'">
              <p v-if="runDialog.previewError" class="text-neutral-500">{{ runDialog.previewError }}</p>
              <p v-else-if="runDialog.consumption === null" class="text-neutral-500">Calculando lo que consume…</p>
              <p v-else-if="runDialog.consumption.length">
                Descuenta: {{ runDialog.consumption.map(c => `${formatQty(c.qty)} ${c.unit} ${c.name}`).join(' · ') }}
              </p>
              <p v-else-if="!runDialog.gaps.length">No descuenta ingredientes.</p>
              <p v-for="(gap, i) in runDialog.gaps" :key="i" class="text-danger">
                {{ capitalize(gap.name) }}: {{ GAP_TEXT[gap.reason] ?? gap.reason }}
              </p>
            </template>

            <p v-else-if="runDialog.kind === 'remove'">
              Se elimina de las listas de producción. La bodega no cambia.
            </p>

            <p v-else-if="runDialog.kind === 'undo'">{{ undoNote(runDialog) }}</p>

            <template v-else-if="runDialog.kind === 'edit'">
              <label class="block">
                <span class="block mb-1">Nueva cantidad</span>
                <input
                  v-model.number="runDialog.qty"
                  type="number"
                  min="0"
                  step="any"
                  class="w-full border border-neutral-300 rounded-md px-3 py-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                >
              </label>
              <p>Solo cambia lo planeado. La bodega no cambia.</p>
            </template>

            <p v-if="runDialog.ignored" class="text-neutral-500">
              {{ runDialog.ignored }} fila(s) seleccionada(s) no se incluyen.
            </p>
            <p v-if="runDialog.error" class="text-danger">{{ runDialog.error }}</p>
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              class="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 disabled:opacity-50"
              :disabled="runDialog.saving"
              @click="closeRunDialog()"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 disabled:opacity-50"
              :disabled="runDialog.saving"
              @click="confirmRunDialog"
            >
              {{ DIALOG_TEXT[runDialog.kind].confirm }}
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
        :history="false"
        @selection-change="selectedRowIds = $event"
        @toggle-update="handleToggleUpdate"
        @action="handleAction"
        class="production-table bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
// Estado is the last column and only reads "-" or "producido". Without a fixed
// width the table resizes it every time a row toggles.
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

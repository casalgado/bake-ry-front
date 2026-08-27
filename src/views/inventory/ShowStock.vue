<script setup>
import { ref, computed, onMounted } from 'vue';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { PhClockCounterClockwise, PhPlusMinus } from '@phosphor-icons/vue';
import DataTable from '@/components/DataTable/index.vue';
import StockMovementsModal from '@/components/inventory/StockMovementsModal.vue';
import { useStockStore } from '@/stores/stockStore';
import { formatDateDisplay } from '@/utils/dateUtils';

const stockStore = useStockStore();

// This DataTable renders row[column.field] directly — it has no customRender
// hook — so display values are precomputed here.
const tableData = computed(() =>
  stockStore.items.map((stock) => ({
    ...stock,
    typeLabel: stock.itemType === 'ingredient' ? 'Ingrediente' : 'Producto',
    stockDisplay: Number((stock.currentStock || 0).toFixed(3)),
    lastMovement: stock.updatedAt ? formatDateDisplay(stock.updatedAt) : '—',
  })),
);

const selectedItem = ref(null);
const movementsOpen = ref(false);
const adjustOpen = ref(false);
const adjustQty = ref(null);
const adjustReason = ref('');
const adjustError = ref(null);
const saving = ref(false);

const columns = [
  {
    id: 'name',
    label: 'Artículo',
    field: 'name',
    sortable: true,
  },
  {
    id: 'itemType',
    label: 'Tipo',
    field: 'typeLabel',
    sortable: true,
  },
  {
    // Kept numeric so sorting compares numbers, not formatted strings.
    // Negative stock is shown, never blocked: a sale registered before its
    // purchase is real information, and a count corrects it (§12.4).
    id: 'currentStock',
    label: 'Existencias',
    field: 'stockDisplay',
    sortable: true,
  },
  {
    id: 'unit',
    label: 'Unidad',
    field: 'unit',
    sortable: true,
  },
  {
    id: 'updatedAt',
    label: 'Último movimiento',
    field: 'lastMovement',
    sortable: false,
  },
];

const tableActions = [
  {
    id: 'movements',
    label: 'Movimientos',
    icon: PhClockCounterClockwise,
    minSelected: 1,
    maxSelected: 1,
    variant: 'secondary',
  },
  {
    id: 'adjust',
    label: 'Ajustar',
    icon: PhPlusMinus,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
];

const handleAction = ({ actionId, selectedIds }) => {
  const item = stockStore.items.find((stock) => stock.id === selectedIds[0]);
  if (!item) return;

  selectedItem.value = item;

  if (actionId === 'movements') {
    movementsOpen.value = true;
    return;
  }

  adjustQty.value = null;
  adjustReason.value = '';
  adjustError.value = null;
  adjustOpen.value = true;
};

const saveAdjustment = async () => {
  adjustError.value = null;

  if (!Number.isFinite(Number(adjustQty.value)) || Number(adjustQty.value) === 0) {
    adjustError.value = 'Escribe una cantidad (negativa para restar)';
    return;
  }

  if (!adjustReason.value.trim()) {
    adjustError.value = 'Escribe un motivo';
    return;
  }

  saving.value = true;
  try {
    await stockStore.adjust(selectedItem.value.itemKey, {
      qty: Number(adjustQty.value),
      reason: adjustReason.value.trim(),
      warehouseId: selectedItem.value.warehouseId,
    });
    adjustOpen.value = false;
  } catch (error) {
    adjustError.value = error.message || 'No se pudo guardar el ajuste';
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  await stockStore.fetchAll();
});
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <h2 class="mb-4">Inventario</h2>

    <div v-if="stockStore.loading" class="text-neutral-600 text-center py-4">
      Cargando...
    </div>

    <div v-else-if="stockStore.error" class="text-danger text-center py-4">
      {{ stockStore.error }}
    </div>

    <p
      v-else-if="!tableData.length"
      class="text-neutral-600 text-center py-8"
    >
      Todavía no controlas inventario de ningún artículo. Activa el control en un
      producto o en un ingrediente para verlo aquí.
    </p>

    <DataTable
      v-else
      :data="tableData"
      :columns="columns"
      :actions="tableActions"
      @action="handleAction"
      class="bg-white shadow-lg rounded-lg"
    />

    <StockMovementsModal
      v-model:isOpen="movementsOpen"
      :item-key="selectedItem?.itemKey"
      :name="selectedItem?.name"
      :unit="selectedItem?.unit"
    />

    <!-- Manual adjustment: the permanent escape hatch (1B.4) -->
    <Dialog :open="adjustOpen" @close="adjustOpen = false" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="w-full max-w-md rounded-lg bg-white p-4 space-y-4">
          <DialogTitle class="text-lg font-semibold text-neutral-900 capitalize">
            Ajustar {{ selectedItem?.name }}
          </DialogTitle>

          <p class="text-sm text-neutral-600">
            Existencias actuales:
            {{ Number((selectedItem?.currentStock || 0).toFixed(3)) }}
            {{ selectedItem?.unit }}
          </p>

          <div>
            <label class="block text-sm mb-1">Cantidad (negativa para restar)</label>
            <input v-model="adjustQty" type="number" step="any" class="form-input w-full" />
          </div>

          <div>
            <label class="block text-sm mb-1">Motivo</label>
            <input
              v-model="adjustReason"
              type="text"
              class="form-input w-full"
              placeholder="se dañó, sobró de producción…"
            />
          </div>

          <p v-if="adjustError" class="text-sm text-danger">{{ adjustError }}</p>

          <div class="flex justify-end gap-2">
            <button class="utility-btn" @click="adjustOpen = false" :disabled="saving">
              Cancelar
            </button>
            <button class="action-btn" @click="saveAdjustment" :disabled="saving">
              {{ saving ? 'Guardando...' : 'Guardar ajuste' }}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </div>
</template>

<style scoped></style>

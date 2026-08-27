<script setup>
import { ref, computed, watch } from 'vue';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { useStockStore } from '@/stores/stockStore';
import { formatDateDisplay } from '@/utils/dateUtils';

const props = defineProps({
  isOpen: Boolean,
  itemKey: { type: String, default: null },
  name: { type: String, default: '' },
  unit: { type: String, default: '' },
});

const emit = defineEmits(['update:isOpen']);

const stockStore = useStockStore();
const movements = ref([]);
const loading = ref(false);
const error = ref(null);

// Labels the user recognizes — nobody "sells" flour, sales consume it.
const TYPE_LABELS = {
  purchase: 'Comprado',
  sale: 'Consumido en ventas',
  production: 'Producción',
  count: 'Conteos',
  adjustment: 'Ajustes',
  compensation: 'Correcciones',
};

const closeDialog = () => emit('update:isOpen', false);

const fetchMovements = async () => {
  if (!props.itemKey) return;
  loading.value = true;
  error.value = null;
  try {
    movements.value = await stockStore.getMovements(props.itemKey, { limit: 200 });
  } catch (err) {
    error.value = err.message || 'Error al obtener los movimientos';
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, (open) => {
  if (open) fetchMovements();
});

// "¿Cuánto compré, cuánto usé, cuánto perdí?" — the summary users actually
// want (§11.9). Totals per movement type over what was fetched.
const summary = computed(() => {
  const totals = new Map();

  movements.value.forEach((movement) => {
    totals.set(movement.type, (totals.get(movement.type) || 0) + movement.qty);
  });

  return [...totals.entries()].map(([type, qty]) => ({
    type,
    label: TYPE_LABELS[type] || type,
    qty,
  }));
});

const formatQty = (qty) => `${qty > 0 ? '+' : ''}${Number(qty.toFixed(3))}`;

const movementRef = (movement) => {
  const refs = movement.refs || {};
  if (refs.orderId) return `Pedido ${refs.orderId.slice(0, 6)}`;
  if (refs.purchaseId) return 'Compra';
  if (refs.countId) return 'Conteo';
  return movement.reason || '';
};
</script>

<template>
  <Dialog :open="isOpen" @close="closeDialog" class="relative z-50">
    <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="w-full max-w-2xl rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div class="flex items-center justify-between p-4 border-b border-neutral-200">
          <div class="min-w-0">
            <DialogTitle class="text-lg font-semibold text-neutral-900 capitalize">
              {{ name || 'Movimientos' }}
            </DialogTitle>
            <div class="text-xs text-neutral-500">Historial de movimientos</div>
          </div>
          <button @click="closeDialog" class="text-neutral-400 hover:text-neutral-600 px-2">
            &times;
          </button>
        </div>

        <div class="p-4 space-y-4">
          <div v-if="loading" class="text-center text-neutral-500 py-6">Cargando...</div>
          <div v-else-if="error" class="text-center text-danger py-6">{{ error }}</div>

          <template v-else>
            <!-- Summary by type -->
            <div v-if="summary.length" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div
                v-for="row in summary"
                :key="row.type"
                class="border border-neutral-200 rounded-md p-2"
              >
                <div class="text-xs text-neutral-500">{{ row.label }}</div>
                <div
                  class="text-base font-semibold"
                  :class="row.qty < 0 ? 'text-neutral-900' : 'text-green-700'"
                >
                  {{ formatQty(row.qty) }} {{ unit }}
                </div>
              </div>
            </div>

            <p v-else class="text-sm text-neutral-500 text-center py-6">
              Sin movimientos todavía.
            </p>

            <!-- History -->
            <table v-if="movements.length" class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th class="py-2">Fecha</th>
                  <th class="py-2">Tipo</th>
                  <th class="py-2 text-right">Cantidad</th>
                  <th class="py-2">Origen</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="movement in movements"
                  :key="movement.id"
                  class="border-b border-neutral-100"
                >
                  <td class="py-2 whitespace-nowrap">
                    {{ formatDateDisplay(movement.timestamp) }}
                  </td>
                  <td class="py-2">{{ TYPE_LABELS[movement.type] || movement.type }}</td>
                  <td
                    class="py-2 text-right font-medium"
                    :class="movement.qty < 0 ? 'text-red-600' : 'text-green-700'"
                  >
                    {{ formatQty(movement.qty) }}
                  </td>
                  <td class="py-2 text-neutral-500 truncate max-w-[12rem]">
                    {{ movementRef(movement) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>

<style scoped></style>

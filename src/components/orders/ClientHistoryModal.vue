<script setup>
import { ref, computed, watch } from 'vue';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { useOrderStore } from '@/stores/orderStore';
import { formatMoney, itemLabel } from '@/utils/helpers';
import { formatDateDisplay } from '@/utils/dateUtils';

const props = defineProps({
  isOpen: Boolean,
  userId: { type: String, default: null },
  name: { type: String, default: '' },
});

const emit = defineEmits(['update:isOpen']);

const orderStore = useOrderStore();
const orders = ref([]);
const loading = ref(false);
const error = ref(null);
const expandedIds = ref(new Set());

const closeDialog = () => emit('update:isOpen', false);

const toggleExpand = (id) => {
  const ids = expandedIds.value;
  ids.has(id) ? ids.delete(id) : ids.add(id);
};

const fetchHistory = async () => {
  if (!props.userId) return;
  loading.value = true;
  error.value = null;
  expandedIds.value.clear();
  try {
    orders.value = await orderStore.getClientOrders(props.userId);
  } catch (err) {
    error.value = err.message || 'Error al obtener el historial del cliente';
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, (open) => {
  if (open) fetchHistory();
});

const ltv = computed(() => orders.value.reduce((sum, order) => sum + (order.total || 0), 0));
const firstOrderDate = computed(() => orders.value.length ? orders.value[orders.value.length - 1].dueDate : null);
const lastOrderDate = computed(() => orders.value.length ? orders.value[0].dueDate : null);
// Contact details ride along on the orders, so no extra fetch — take the most recent.
const contact = computed(() => {
  const latest = orders.value[0];
  // @pendiente.com is a placeholder address, not a real one.
  const email = latest?.userEmail?.endsWith('@pendiente.com') ? null : latest?.userEmail;
  return [latest?.userPhone, email].filter(Boolean).join(' · ');
});
</script>

<template>
  <Dialog :open="isOpen" @close="closeDialog" class="relative z-50">
    <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="w-full max-w-2xl rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div class="flex items-center justify-between p-4 border-b border-neutral-200">
          <div class="min-w-0">
            <DialogTitle class="text-lg font-semibold text-neutral-900">
              {{ name || 'Historial del Cliente' }}
            </DialogTitle>
            <div v-if="contact" class="text-xs text-neutral-500 truncate">{{ contact }}</div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            class="text-neutral-400 hover:text-neutral-600"
            @click="closeDialog"
          >
            ✕
          </button>
        </div>

        <div class="p-4 space-y-4">
          <div v-if="loading" class="flex items-center justify-center py-8 text-neutral-500">
            Cargando...
          </div>

          <div v-else-if="error" class="bg-red-50 text-red-700 rounded-lg p-4">
            {{ error }}
          </div>

          <template v-else>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div class="bg-neutral-50 rounded-lg p-3">
                <div class="text-xs text-neutral-500">Primer pedido</div>
                <div class="font-semibold">{{ firstOrderDate ? formatDateDisplay(firstOrderDate, { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }}</div>
              </div>
              <div class="bg-neutral-50 rounded-lg p-3">
                <div class="text-xs text-neutral-500">Último pedido</div>
                <div class="font-semibold">{{ lastOrderDate ? formatDateDisplay(lastOrderDate, { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }}</div>
              </div>
              <div class="bg-neutral-50 rounded-lg p-3">
                <div class="text-xs text-neutral-500">Total pedidos</div>
                <div class="font-semibold">{{ orders.length }}</div>
              </div>
              <div class="bg-neutral-50 rounded-lg p-3">
                <div class="text-xs text-neutral-500">LTV</div>
                <div class="font-semibold">{{ formatMoney(ltv) }}</div>
              </div>
            </div>

            <div v-if="orders.length === 0" class="text-sm text-neutral-500 text-center py-8">
              Este cliente no tiene pedidos registrados.
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-neutral-200">
                    <th class="text-left py-2 px-2 font-medium text-neutral-600">Fecha</th>
                    <th class="text-right py-2 px-2 font-medium text-neutral-600">Total</th>
                    <th class="text-right py-2 px-2 font-medium text-neutral-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="order in orders" :key="order.id">
                    <tr
                      class="border-b border-neutral-100 cursor-pointer hover:bg-neutral-50"
                      @click="toggleExpand(order.id)"
                    >
                      <td class="py-2 px-2 whitespace-nowrap">
                        <span class="inline-block w-3 mr-1 text-neutral-400">{{ expandedIds.has(order.id) ? '▾' : '▸' }}</span>
                        {{ formatDateDisplay(order.dueDate, { day: 'numeric', month: 'short', year: 'numeric' }) }}
                      </td>
                      <td class="py-2 px-2 text-right whitespace-nowrap">{{ formatMoney(order.total) }}</td>
                      <td class="py-2 px-2 text-right whitespace-nowrap">{{ order.isPaid ? 'Pagado' : 'Pendiente' }}</td>
                    </tr>
                    <tr v-if="expandedIds.has(order.id)" class="border-b border-neutral-100">
                      <td colspan="3" class="bg-neutral-50 px-2 py-2">
                        <div v-if="!order.orderItems?.length" class="flex text-xs py-0.5">
                          <!-- invisible clone of the caret: guarantees the same indent as the date above -->
                          <span class="inline-block w-3 mr-1 invisible">▸</span>
                          <span class="text-neutral-400">Sin productos</span>
                        </div>
                        <div
                          v-for="item in order.orderItems"
                          :key="item.id"
                          class="flex justify-between text-xs py-0.5"
                        >
                          <span>
                            <span class="inline-block w-3 mr-1 invisible">▸</span>
                            {{ item.quantity }}x {{ itemLabel(item) }}
                          </span>
                          <span class="whitespace-nowrap ml-2">{{ formatMoney(item.subtotal) }}</span>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>

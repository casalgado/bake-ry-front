<script setup>
import { computed } from 'vue';

const props = defineProps({
  history: {
    type: Array,
    required: true,
  },
});

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const methods = {
  cash: 'efectivo',
  bold: 'bold',
  transfer: 'transferencia',
  complimentary: 'regalo',
};

let oldTotal;
let newTotal;

const formatChange = (change, field) => {
  switch (field) {
  case 'isPaid':
    return change.to ? 'Marcado como pagado' : 'Marcado como no pagado';
  case 'fulfillmentType':
    return `Cambio de entrega: ${change.from === 'delivery' ? 'domicilio' : 'recogen'} → ${change.to === 'delivery' ? 'domicilio' : 'recogen'}`;
  case 'paymentMethod':

    return `Método de pago: ${methods[change.from]} → ${methods[change.to]}`;
  case 'orderItems':
    oldTotal = change.from.reduce((sum, item) => sum + item.subtotal, 0);
    newTotal = change.to.reduce((sum, item) => sum + item.subtotal, 0);
    return `Productos actualizados (${oldTotal.toLocaleString('es-CO')} → ${newTotal.toLocaleString('es-CO')})`;
  default:
    return change;
  }
};
</script>

<template>
  <div class="space-y-4">
    <template v-if="history.length > 0">
      <div v-for="entry in history" :key="entry.id" class="p-3 border-b border-neutral-200 last:border-0">
        <div class="flex justify-between items-start mb-2">
          <span class="text-sm text-neutral-600">{{ formatDate(entry.timestamp) }}</span>
          <span class="text-xs text-neutral-500">{{ entry.editor.name }}</span>
        </div>

        <div class="space-y-1">
          <div v-for="(change, field) in entry.changes" :key="field">
            <span v-if="formatChange(change, field)" class="text-sm">
              {{ formatChange(change, field) }}
            </span>
          </div>
        </div>
      </div>
    </template>
    <div v-else>
      <p class="text-sm text-neutral-500">No hay historial de cambios para este pedido.</p>
    </div>
  </div>
</template>

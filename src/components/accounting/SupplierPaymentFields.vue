<script setup>
/* When and how a supplier invoice was paid. The methods are the orders' own
 * keys, so cash and transfer land in the same caja and banco. */
import { useId } from 'vue';
import UiPills from '@/components/ui/UiPills.vue';
import { paymentIconMap } from '@/utils/paymentIcons';

const model = defineModel({ type: Object, required: true }); // { paymentDate: 'YYYY-MM-DD', paymentMethod }
defineProps({
  disabled: { type: Boolean, default: false },
});

const uid = useId();

const methods = [
  { value: 'cash', label: 'Efectivo', icon: paymentIconMap.cash },
  { value: 'transfer', label: 'Transferencia', icon: paymentIconMap.transfer },
];
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-date`" data-required>Fecha de pago</label>
      <input :id="`${uid}-date`" v-model="model.paymentDate" type="date" class="ui-input" required :disabled="disabled">
    </div>
    <UiPills v-model="model.paymentMethod" label="Método" required :options="methods" :disabled="disabled" />
  </div>
</template>

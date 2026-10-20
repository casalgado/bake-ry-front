<script setup>
import { computed, nextTick, ref } from 'vue';
import { PhPlus, PhX } from '@phosphor-icons/vue';
import { formatMoney } from '@/utils/helpers';
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue';
import { getTodayString } from '@/utils/dateUtils';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paymentMethodOptions: {
    type: Array,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  paymentDate: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue']);

const root = ref(null);

const partialPayments = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const addPartialPayment = async () => {
  partialPayments.value = [...partialPayments.value, {
    id: Date.now().toString(), // Simple ID for local tracking
    amount: 0,
    date: getTodayString(),
    method: props.paymentMethodOptions[0]?.value || 'cash',
  }];

  // Straight to the amount of the new one.
  await nextTick();
  const amounts = root.value?.querySelectorAll('[data-amount]');
  amounts?.[amounts.length - 1]?.focus();
};

const removePartialPayment = (index) => {
  partialPayments.value = partialPayments.value.filter((_, i) => i !== index);
};

const updatePayment = (index, field, value) => {
  const updated = [...partialPayments.value];
  updated[index] = { ...updated[index], [field]: value };
  partialPayments.value = updated;
};

const totalPartialPayments = computed(() =>
  partialPayments.value.reduce((sum, payment) => sum + (payment.amount || 0), 0));

// Once the order is marked paid, abonos no longer have a ceiling to exceed.
const isOverpaid = computed(() => !props.paymentDate && totalPartialPayments.value > props.totalAmount);

// Marked paid: the real balance, which may be negative. Otherwise what is still owed.
const remainingBalance = computed(() => (props.paymentDate
  ? props.totalAmount - totalPartialPayments.value
  : Math.max(0, props.totalAmount - totalPartialPayments.value)));
</script>

<template>
  <div ref="root" class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <span class="ui-field-k">Abonos</span>
      <button type="button" class="ui-btn ui-btn-sm" :disabled="disabled" @click="addPartialPayment">
        <PhPlus :size="12" weight="bold" />
        Agregar abono
      </button>
    </div>

    <div
      v-for="(payment, index) in partialPayments"
      :key="payment.id || index"
      class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 items-center"
    >
      <div class="ui-field-unit" data-unit="$">
        <UiMoneyInput
          data-amount
          :model-value="payment.amount || null"
          placeholder="0"
          :aria-label="`Monto del abono ${index + 1}`"
          :disabled="disabled"
          @update:model-value="v => updatePayment(index, 'amount', v ?? 0)"
        />
      </div>
      <input
        type="date"
        class="ui-input"
        :value="payment.date"
        :aria-label="`Fecha del abono ${index + 1}`"
        :disabled="disabled"
        @input="updatePayment(index, 'date', $event.target.value)"
      >
      <select
        class="ui-input col-span-2 sm:col-span-1 row-start-2 sm:row-start-auto"
        :value="payment.method"
        :aria-label="`Método del abono ${index + 1}`"
        :disabled="disabled"
        @change="updatePayment(index, 'method', $event.target.value)"
      >
        <option v-for="method in paymentMethodOptions" :key="method.value" :value="method.value">
          {{ method.label }}
        </option>
      </select>
      <button
        type="button"
        class="ui-btn ui-btn-icon ui-btn-field row-start-1 col-start-3 sm:col-start-auto"
        :aria-label="`Quitar abono ${index + 1}`"
        title="Quitar abono"
        :disabled="disabled"
        @click="removePartialPayment(index)"
      >
        <PhX :size="13" weight="bold" />
      </button>
    </div>

    <div v-if="partialPayments.length" class="flex justify-between text-sm">
      <span class="ui-ink-muted">
        Abonado {{ formatMoney(totalPartialPayments) }} · {{ paymentDate ? 'Saldo' : 'Pendiente' }}
      </span>
      <span class="ui-num">{{ formatMoney(remainingBalance) }}</span>
    </div>
    <span v-if="isOverpaid" class="ui-field-error">Los abonos superan el total del pedido.</span>
  </div>
</template>

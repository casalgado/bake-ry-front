<script setup>
import { ref, computed, nextTick } from 'vue';
import { PhPlus, PhX, PhWarning } from '@phosphor-icons/vue';
import { formatMoney } from '@/utils/helpers';
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

// Local copy of partial payments
const partialPayments = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

// Add a new partial payment
const addPartialPayment = async () => {
  const newPayment = {
    id: Date.now().toString(), // Simple ID for local tracking
    amount: 0,
    date: getTodayString(),
    method: props.paymentMethodOptions[0]?.value || 'cash',
  };

  partialPayments.value = [...partialPayments.value, newPayment];

  // Focus on the new amount input
  await nextTick();
  const inputs = document.querySelectorAll('.partial-payment-amount');
  const lastInput = inputs[inputs.length - 1];
  if (lastInput) {
    lastInput.focus();
  }
};

// Remove a partial payment
const removePartialPayment = (index) => {
  partialPayments.value = partialPayments.value.filter((_, i) => i !== index);
};

// Update a specific payment
const updatePayment = (index, field, value) => {
  const updated = [...partialPayments.value];
  updated[index] = { ...updated[index], [field]: value };
  partialPayments.value = updated;
};

// Calculate total of partial payments
const totalPartialPayments = computed(() => {
  return partialPayments.value.reduce((sum, payment) => sum + (payment.amount || 0), 0);
});

// Check if total exceeds order total
const isOverpaid = computed(() => {
  // If order is fully paid (has payment date), partial payments don't matter for overpayment
  if (props.paymentDate) {
    return false;
  }
  return totalPartialPayments.value > props.totalAmount;
});

// Calculate remaining balance
const remainingBalance = computed(() => {
  // If payment date is set, show actual balance (can be positive or negative)
  if (props.paymentDate) {
    return props.totalAmount - totalPartialPayments.value;
  }
  return Math.max(0, props.totalAmount - totalPartialPayments.value);
});
</script>

<template>
  <div>
    <!-- No payments state - just show add button -->
    <div v-if="partialPayments.length === 0">
      <div class="grid grid-cols-[1fr_auto] gap-2">
       <div class="text-sm text-neutral-600">

          <span class="font-medium">{{ paymentDate ? 'Pago recibido' : 'Pendiente de pago' }}</span>
          <span v-if="isOverpaid" class="text-red-600 ml-2">⚠ Excede el total</span>
        </div>
        <button
          type="button"
          class="utility-btn m-0"
          @click="addPartialPayment"
          :disabled="disabled"
        >
          Agregar Pago Parcial
        </button>
      </div>
    </div>

    <!-- When there are payments -->
    <div v-else>

      <!-- Payments list -->
      <div class="space-y-2 sm:space-y-2">
        <div v-for="(payment, index) in partialPayments" :key="payment.id || index"
             :class="{ 'mb-4 sm:mb-0': index < partialPayments.length - 1 }">
          <!-- Labels only on first row -->
          <div v-if="index === 0">
            <!-- Desktop labels -->
            <div class="hidden sm:grid grid-cols-[1fr_1fr_140px_29px] gap-2 mb-1">
              <label class="text-sm text-neutral-700">Monto</label>
              <label class="text-sm text-neutral-700">Fecha</label>
              <label class="text-sm text-neutral-700">Método</label>
              <div></div>
            </div>
          </div>

          <!-- Input rows -->
          <!-- Mobile layout -->
          <div class="sm:hidden space-y-1">
            <!-- Mobile labels for first row -->
            <div class="grid grid-cols-[1fr_29px] gap-2">
              <label :for="`amount-${index}`" class="text-sm text-neutral-700">Monto {{ index + 1 }}</label>
              <div></div>
            </div>
            <div class="grid grid-cols-[1fr_29px] gap-2">
              <input
                :id="`amount-${index}`"
                type="number"
                :value="payment.amount || ''"
                @input="updatePayment(index, 'amount', parseFloat($event.target.value) || 0)"
                min="0"
                step="1"
                placeholder="0"
                class="w-full partial-payment-amount"
                :disabled="disabled"
              />
              <button
                type="button"
                class="utility-btn m-0"
                @click="removePartialPayment(index)"
                :disabled="disabled"
                title="Eliminar pago"
              >
                <PhX class="" />
              </button>
            </div>
            <!-- Mobile labels for second row -->
            <div class="grid grid-cols-[1fr_1fr] gap-2">
              <label :for="`date-${index}`" class="text-sm text-neutral-700">Fecha</label>
              <label :for="`method-${index}`" class="text-sm text-neutral-700">Método</label>
            </div>
            <div class="grid grid-cols-[1fr_1fr] gap-2">
              <input
                :id="`date-${index}`"
                type="date"
                :value="payment.date"
                @input="updatePayment(index, 'date', $event.target.value)"
                class="w-full"
                :disabled="disabled"
              />
              <select
                :id="`method-${index}`"
                :value="payment.method"
                @change="updatePayment(index, 'method', $event.target.value)"
                class="w-full"
                :disabled="disabled"
              >
                <option
                  v-for="method in paymentMethodOptions"
                  :key="method.value"
                  :value="method.value"
                >
                  {{ method.label }}
                </option>
              </select>
            </div>
          </div>

          <!-- Desktop layout -->
          <div class="hidden sm:grid grid-cols-[1fr_1fr_140px_29px] gap-2">
            <input
              type="number"
              :value="payment.amount || ''"
              @input="updatePayment(index, 'amount', parseFloat($event.target.value) || 0)"
              min="0"
              step="1"
              placeholder="0"
              class="w-full partial-payment-amount"
              :disabled="disabled"
            />

            <input
              type="date"
              :value="payment.date"
              @input="updatePayment(index, 'date', $event.target.value)"
              class="w-full"
              :disabled="disabled"
            />

            <select
              :value="payment.method"
              @change="updatePayment(index, 'method', $event.target.value)"
              class="w-full"
              :disabled="disabled"
            >
              <option
                v-for="method in paymentMethodOptions"
                :key="method.value"
                :value="method.value"
              >
                {{ method.label }}
              </option>
            </select>

            <button
              type="button"
              class="utility-btn m-0"
              @click="removePartialPayment(index)"
              :disabled="disabled"
              title="Eliminar pago"
            >
              <PhX class="" />
            </button>
          </div>
        </div>
      </div>

      <!-- Summary and add button at bottom -->
      <div class="grid grid-cols-[1fr_auto] gap-2 items-center mt-2">
        <div class="text-sm text-neutral-600">
          Abonado: <span class="font-medium" :class="{ 'text-red-600': isOverpaid }">{{ formatMoney(totalPartialPayments) }}</span>
          • {{ paymentDate ? 'Saldo' : 'Pendiente' }}: <span class="font-medium">{{ formatMoney(remainingBalance) }}</span>
          <span v-if="isOverpaid" class="text-red-600 ml-2">⚠ Excede el total</span>
        </div>
        <button
          type="button"
          class="utility-btn m-0"
          @click="addPartialPayment"
          :disabled="disabled"
        >
          Agregar pago parcial
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No additional styles needed - using form's existing classes */
</style>

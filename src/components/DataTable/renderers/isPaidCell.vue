<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat, PhMinus, PhGift, PhCircleHalf } from '@phosphor-icons/vue';
import { computed } from 'vue';
import { formatMoney } from '@/utils/helpers';
const props = defineProps({
  isPaid: {
    type: Boolean,
    default: false,
  },
  isComplimentary: {
    type: Boolean,
    default: false,
  },
  orderStatus: {
    type: Number,
    default: 0,
  },
  paymentDate: {
    type: [String, Date],
    default: null,
  },
  partialPaymentAmount: {
    type: Number,
    default: null,
  },
  partialPaymentDate: {
    type: [String, Date],
    default: null,
  },
});

const displayDate = computed(() => {
  if (props.paymentDate) {
    const date = new Date(props.paymentDate);
    console.log('payment date', date);
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric' });
  }
  if (props.partialPaymentDate) {
    const date = new Date(props.partialPaymentDate);
    console.log('ppd date', date);
    return `${date.toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric' })}`;
  }
  return '';
});

const displayAmount = computed(() => {
  if (!props.isPaid && props.partialPaymentAmount && props.partialPaymentAmount > 0) {
    return formatMoney(props.partialPaymentAmount, { slim: true });
  }
  return '';
});
</script>

<template>
  <!-- <PhOven v-if="orderStatus == 1" class="absolute left-[-5px] top-[-5px]" />
  <PhMoped v-else-if="orderStatus == 2" class="absolute left-[-5px] top-[-5px]" />
  <PhBuilding v-else-if="orderStatus == 3" class="absolute left-[-5px] top-[-5px]" /> -->
  <span class="flex items-center gap-2">
    <PhGift v-if="isComplimentary" size="1.1rem" weight="fill" />
    <PhCheckFat v-else-if="isPaid" size="1.1rem" weight="fill" />
    <PhCircleHalf v-else-if="partialPaymentAmount && partialPaymentAmount > 0" size="1.1rem" weight="duotone" />
    <PhMinus v-else size="1rem" />
    <p v-if="!isComplimentary &&( isPaid || (partialPaymentAmount && partialPaymentAmount>0))" class="text-xs">{{ displayDate }} <span class="text-neutral-500">{{ displayAmount }}</span> </p>
    <!-- <pre>{{ {paymentDate: props.paymentDate, partialPaymentDate: partialPaymentDate} }}</pre> -->
  </span>
</template>

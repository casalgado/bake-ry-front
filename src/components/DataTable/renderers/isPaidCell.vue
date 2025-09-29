<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat, PhMinus, PhGift, PhCircleHalf, PhFile } from '@phosphor-icons/vue';
import { computed } from 'vue';
import { formatMoney } from '@/utils/helpers';
import { Order } from '@/models/Order';
const props = defineProps({
  order: {
    type: Object,
    required: true,
  },
});

const orderInstance = computed(() => new Order(props.order));

const displayDate = computed(() => {
  const order = orderInstance.value;
  if (order.paymentDate) {
    const date = new Date(order.paymentDate);
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric' });
  }
  if (order.partialPaymentDate) {
    const date = new Date(order.partialPaymentDate);
    return `${date.toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric' })}`;
  }
  return '';
});

const displayAmount = computed(() => {
  const order = orderInstance.value;
  if (!order.isPaid && order.partialPaymentAmount && order.partialPaymentAmount > 0) {
    return formatMoney(order.partialPaymentAmount, { slim: true });
  }
  return '';
});
</script>

<template>
  <!-- <PhOven v-if="order.status == 1" class="absolute left-[-5px] top-[-5px]" />
  <PhMoped v-else-if="order.status == 2" class="absolute left-[-5px] top-[-5px]" />
  <PhBuilding v-else-if="order.status == 3" class="absolute left-[-5px] top-[-5px]" /> -->
  <span class="flex items-center gap-2">
    <PhFile v-if="orderInstance.isQuote" size="1.1rem" weight="regular" data-testid="quote-icon" />
    <PhGift v-else-if="orderInstance.isComplimentary" size="1.1rem" weight="fill" data-testid="gift-icon" />
    <PhCheckFat v-else-if="orderInstance.isPaid" size="1.1rem" weight="fill" data-testid="check-icon" />
    <PhCircleHalf v-else-if="orderInstance.partialPaymentAmount && orderInstance.partialPaymentAmount > 0" size="1.1rem" weight="fill" data-testid="partial-icon" />
    <PhMinus v-else size="1rem" data-testid="minus-icon" />
    <p v-if="!orderInstance.isComplimentary && (orderInstance.isPaid || (orderInstance.partialPaymentAmount && orderInstance.partialPaymentAmount > 0))" class="text-xs">{{ displayDate }} <span class="text-neutral-500">{{ displayAmount }}</span> </p>
    <!-- <pre>{{ {paymentDate: orderInstance.paymentDate, partialPaymentDate: orderInstance.partialPaymentDate} }}</pre> -->
  </span>
</template>

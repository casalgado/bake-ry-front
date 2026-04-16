<!-- components/DataTable/renderers/DateCell.vue -->
<script setup>
import { computed } from 'vue';
import { addDays } from '@/utils/dateUtils';

const props = defineProps({
  value: {
    type: [String, Date],
  },
  invoiceGracePeriod: {
    type: Number,
    default: null,
  },
});

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleDateString('es', { month: 'short' });
  return `${day} ${month}`;
};

const gracePeriodEnd = computed(() => {
  if (!props.invoiceGracePeriod || !props.value) return null;
  return addDays(props.value, props.invoiceGracePeriod);
});

const isGracePeriodExpired = computed(() => {
  if (!gracePeriodEnd.value) return false;
  return gracePeriodEnd.value < new Date();
});
</script>

<template>
  <div class="flex flex-col">
    <span class="whitespace-nowrap">{{ formatDate(value) }}</span>
    <span
      v-if="invoiceGracePeriod > 0"
      class="text-xs whitespace-nowrap"
      :class="isGracePeriodExpired ? 'text-red-500' : 'text-neutral-500'"
    >{{ formatDate(gracePeriodEnd) }}</span>
  </div>
</template>

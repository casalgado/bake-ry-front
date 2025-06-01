<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import {
  PhCheckFat,
  PhMinus,
  PhGift,
} from '@phosphor-icons/vue';
import { computed } from 'vue';
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
});

const displayDate = computed(() => {
  if (!props.paymentDate) return '';
  const date = new Date(props.paymentDate);
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric' });
});
</script>

<template>
  <!-- <PhOven v-if="orderStatus == 1" class="absolute left-[-5px] top-[-5px]" />
  <PhMoped v-else-if="orderStatus == 2" class="absolute left-[-5px] top-[-5px]" />
  <PhBuilding v-else-if="orderStatus == 3" class="absolute left-[-5px] top-[-5px]" /> -->
  <span class="flex items-center gap-2">
    <PhGift v-if="isComplimentary" size="1rem" weight="fill" />
    <PhCheckFat v-else-if="isPaid" size="1rem" weight="fill" />
    <PhMinus v-else size="1rem" />
    <p v-if="!isComplimentary && isPaid" class="text-xs">{{ displayDate }}</p>
    </span
  >
</template>

<!-- components/DataTable/renderers/MoneyCell.vue -->
<script setup>
import { formatMoney } from '@/utils/helpers';

defineProps({
  value: Number,
  currency: {
    type: String,
    default: 'COP',
  },
  hide: {
    type: Boolean,
    default: false,
  },
  valueBelow: {
    type: Number,
    default: 0,
  },
  hideBelow: {
    type: Boolean,
    default: false,
  },
});

</script>

<template>
  <div class="flex flex-col">
    <span v-if="!hide">{{ value && value > 0 ? formatMoney(value) : ''}}</span>
    <span class="text-[10px] text-neutral-500" v-if="valueBelow && valueBelow > 0 && !hideBelow">{{ valueBelow && valueBelow > 0 ? formatMoney(valueBelow) : ''}}</span>
  </div>
</template>

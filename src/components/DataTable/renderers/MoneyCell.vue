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
});

</script>

<template>
  <span v-if="!hide">{{ value && value > 0 ? formatMoney(value) : ''}}</span>
</template>

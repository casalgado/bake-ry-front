<!-- components/DataTable/renderers/MoneyCell.vue -->
<script setup>
import { formatMoney } from '@/utils/helpers';

defineProps({
  value: Number,
  currency: {
    type: String,
    default: 'COP',
  },
});

</script>

<template>
  <span>{{ value && value > 0 ? formatMoney(value) : ''}}</span>
</template>

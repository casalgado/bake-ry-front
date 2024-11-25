<!-- components/DataTable/renderers/MoneyCell.vue -->
<script setup>
defineProps({
  value: Number,
  currency: {
    type: String,
    default: 'COP',
  },
});

const formatMoney = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
};
</script>

<template>
  <span>{{ formatMoney(value) }}</span>
</template>

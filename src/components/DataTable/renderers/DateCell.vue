<!-- components/DataTable/renderers/DateCell.vue -->
<script setup>
defineProps({
  value: {
    type: [String, Date],
  },
});

const formatDate = (dateStr) => {

  const date = new Date(dateStr);
  const weekday = date.toLocaleDateString('es', { weekday: 'short' });
  const day = date.getDate().toString().padStart(2, '0');
  return `${weekday} ${day}`;
};
</script>

<template>
  <span>{{ formatDate(value) }}</span>
</template>

<!-- components/DataTable/renderers/DateCell.vue -->
<script setup>
defineProps({
  value: String,
  showTime: Boolean,
});
</script>

<template>
  <span>{{ new Date(value).toLocaleDateString() }}</span>
</template>

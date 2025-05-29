<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
defineProps({
  address: String,
  show: Boolean,
});
</script>

<template>
  <span v-if="show" class="max-w-xs block break-words">{{ address ? address : 'no hay dirección' }}</span>
  <span v-else>
    recogen
  </span>
</template>

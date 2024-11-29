<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat, PhMinus } from '@phosphor-icons/vue';
defineProps({
  paymentMethod: String,
});
</script>

<template>
  <div>{{ paymentMethod }}</div>
</template>

<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat, PhMinus } from '@phosphor-icons/vue';
defineProps({
  fulfillmentType: String,
});
</script>

<template>
  <div>{{ fulfillmentType }}</div>
</template>

<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat, PhMinus } from '@phosphor-icons/vue';
defineProps({
  isPaid: Boolean,
});
</script>

<template>
  <PhCheckFat v-if="isPaid" size="1.3rem" weight="fill"/>
  <PhMinus v-else size="1.3rem" />
</template>

<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat, PhMinus } from '@phosphor-icons/vue';
const props = defineProps({
  isChecked: {
    type: Boolean,
    default: false,
  },
});

</script>

<template>
  <PhCheckFat v-if="isChecked" size="1.3rem" weight="fill"/>
  <PhMinus v-else size="1.3rem" />
</template>

<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { computed } from 'vue';
import { PhCheckFat, PhMinus } from '@phosphor-icons/vue';
const props = defineProps({
  isChecked: {
    type: [Boolean, Number],
    default: false,
    validator: (value) => typeof value === 'boolean' || [0, 1].includes(value),
  },
});

const checked = computed(() => {
  if (typeof props.isChecked === 'number') {
    return props.isChecked === 1;
  }
  return props.isChecked;
});
</script>

<template>
  <PhCheckFat v-if="checked" size="1.3rem" weight="fill"/>
  <PhMinus v-else size="1.3rem" />
</template>

<!-- components/DataTable/renderers/ShowValuesCell.vue -->
<script setup>
import { capitalize } from '@/utils/helpers';

defineProps({
  object: {
    type: Object,
    default: null,
  },
  fields: {
    type: Array,
    required: true,
  },
  layout: {
    type: String,
    default: 'horizontal',
    validator: (value) => ['vertical', 'horizontal'].includes(value),
  },
});
</script>

<template>
  <div v-if="object" :class="[
    layout === 'horizontal' ? 'flex gap-2 items-center' : ''
  ]">
    <div v-for="field in fields" :key="field">
      {{ capitalize(object[field]) }}
    </div>
  </div>
  <div v-else>-</div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  // Array of category objects with label and value
  // The last item will be treated as the grand total
  categories: {
    type: Array,
    required: true,
    validator: (value) => {
      return value.every(item =>
        typeof item === 'object' &&
        'label' in item &&
        'value' in item,
      );
    },
  },
  // Custom formatter for values
  formatValue: {
    type: Function,
    default: (value) => value,
  },
});

</script>

<template>
  <div class="flex flex-wrap items-center  gap-6 bg-neutral-50 px-6 py-3 rounded-lg shadow-sm">
    <!-- Regular categories -->
    <div
      v-for="category in categories"
      :key="category.label"
      class="flex items-center gap-2"
    >
      <span class="text-neutral-700 text-sm">{{ category.label }}:</span>
      <span class="font-bold text-neutral-800 text-sm">{{ formatValue(category.value) }}</span>
    </div>
  </div>
</template>

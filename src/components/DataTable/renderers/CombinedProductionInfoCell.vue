<!-- components/DataTable/renderers/ItemsCell.vue -->
<script setup>
import Combination from '@/models/Combination.js';
import { capitalize } from '@/utils/helpers.js';

const props = defineProps({
  productName: {
    type: String,
    required: true,
  },
  variation: {
    type: Object,
  },
  combination: {
    type: Object,
  },
  totalQuantity: {
    type: Number,
    required: true,
  },
});

// Helper function to get the variation display text
const getVariationDisplay = () => {
  // Prioritize combination over variation (new system)
  if (props.combination) {
    // Ensure we have a Combination instance with the getDisplayName method
    const combination = props.combination instanceof Combination
      ? props.combination
      : new Combination(props.combination);

    const displayName = combination.getDisplayName();
    return displayName || '';
  }

  // Fallback to legacy variation (should be removed after migration is complete and stable)
  if (props.variation && props.variation.name) {
    console.warn('Legacy variation found, consider re-running migration for order item:', {
      variation: props.variation,
      productName: props.productName,
    });
    return props.variation.name;
  }

  return '';
};
</script>

<template>
  <span>{{ totalQuantity }} {{ capitalize(productName) }}{{ getVariationDisplay() ? ' ' + getVariationDisplay() : ' ' }}</span>
</template>

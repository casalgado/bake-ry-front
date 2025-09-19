<!-- components/DataTable/renderers/ItemsCell.vue -->
<script setup>
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
  // Prioritize combination over variation
  if (props.combination && typeof props.combination.getDisplayName === 'function') {
    const displayName = props.combination.getDisplayName();
    return displayName || '';
  }

  // Fallback to legacy variation
  if (props.variation && props.variation.name) {
    return props.variation.name;
  }

  return '';
};
</script>

<template>
  <span>{{ totalQuantity }} {{ productName }}{{ getVariationDisplay() ? ' ' + getVariationDisplay() : ' ' }}</span>
</template>

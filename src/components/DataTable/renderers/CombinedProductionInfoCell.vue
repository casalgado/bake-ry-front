<!-- components/DataTable/renderers/ItemsCell.vue -->
<script setup>
defineProps({
  productName: {
    type: String,
    required: true,
  },
  variation: {
    type: Object,
    required: true,
  },
  totalQuantity: {
    type: Number,
    required: true,
  },
});

</script>

<template>
  <span>{{ totalQuantity }} {{ productName }} {{ variation ? variation.name : '' }} </span>
</template>

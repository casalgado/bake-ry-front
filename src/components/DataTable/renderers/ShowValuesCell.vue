<!-- components/DataTable/renderers/ShowValuesCell.vue -->
<script setup>
defineProps({
  object: {
    type: Object,
    required: true,
  },
  fields: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <div class="space-y-1">
    <div v-for="field in fields" :key="field">
      {{ object[field] }}
    </div>
  </div>
</template>

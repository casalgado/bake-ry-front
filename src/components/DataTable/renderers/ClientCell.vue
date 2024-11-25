<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
defineProps({
  name: String,
  phone: String,
});
</script>

<template>
  <div class="flex flex-col">
    <span class="font-medium">{{ name }}{{ phone ? ` - ${phone}` : '' }}</span>
  </div>
</template>

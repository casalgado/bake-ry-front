<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
defineProps({
  name: String,
  phone: String,
  comment: {
    type: String,
    default: null,
  },
});
</script>

<template>
  <div class="flex flex-col">
    {{ name }} {{ phone ? ` ${phone}` : '' }}
    <span v-if="comment" class="text-xs text-neutral-500">{{ comment }}</span>
  </div>
</template>

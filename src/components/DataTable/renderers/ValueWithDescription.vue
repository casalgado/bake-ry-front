<script setup>
defineProps({
  value: String,
  description: {
    type: String,
    default: null,
  },
});
</script>

<template>
  <div class="flex flex-col">
    <span>{{ value }}</span>
    <span v-if="description" class="text-xs text-neutral-500 whitespace-nowrap">{{ description }}</span>
  </div>
</template>
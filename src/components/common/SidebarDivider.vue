<!-- SidebarDivider.vue -->
<script setup>
defineProps({
  text: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <div class="px-3 pt-1">
    <h3 class="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
      {{ text }}
    </h3>
  </div>
</template>

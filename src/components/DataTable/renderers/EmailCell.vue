<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { computed } from 'vue';

const props = defineProps({
  email: String,
});

const showEmail = computed(() => {
  if (!props.email) return null; // safety
  return props.email.toLowerCase().includes('pendiente')
    ? null // hide if "pendiente" appears
    : props.email;
});
</script>

<template>
  <div class="flex flex-col max-w-48 overflow-hidden">
    <span v-if="showEmail" class="flex items-center gap-2">
      <span class="truncate" :title="showEmail">{{ showEmail }}</span>
    </span>
  </div>
</template>

<!-- components/DataTable/renderers/ClientCell.vue -->
<script setup>
import { PhCheckFat, PhBuildings } from '@phosphor-icons/vue';
import { formatTime } from '@/utils/helpers';

defineProps({
  name: String,
  phone: String,
  legalName: String,
  category: String,
  showIsPaid: {
    type: Boolean,
    default: false,
  },
  comment: {
    type: String,
    default: null,
  },
  dueTime: {
    type: String,
    default: null,
  },
});
</script>

<template>
  <div class="flex flex-col min-w-48">
    <span class="flex items-center gap-2">
      <PhBuildings v-if="category === 'B2B'" class="w-4 h-4" weight="regular" />
      <span>{{ name }}</span>
    </span>
    <span v-if="legalName" class="text-xs text-neutral-500 whitespace-nowrap">{{ legalName }}</span>
  </div>
</template>

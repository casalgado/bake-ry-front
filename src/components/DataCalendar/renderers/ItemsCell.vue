<!-- components/DataTable/renderers/ItemsCell.vue -->
<script setup>
import { abbreviateText, capitalize } from '@/utils/helpers';
defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  maxDisplay: {
    type: Number,
    default: 2,
  },
});

const categoryShortener = (text) => {
  if (text == 'sourdough') return 'Pan';
  if (text == 'tortillas') return 'Tort';
  if (text == 'baguette') return 'Bag';
  return '';
};
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="item in items.slice(0, maxDisplay)"
      :key="item.id"
      class="flex items-center gap-1"
    >
      <span class="">{{ item.quantity }}</span>
      <span class="">{{ categoryShortener(item.collectionName) }} {{ capitalize(item.productName) }} {{ item.combination?.getDisplayName ? item.combination.getDisplayName() : capitalize(item.combination?.name || item.variation?.name) }}</span>

    </div>
    <div
      v-if="items.length > maxDisplay"
      class="text-sm text-neutral-500"
    >
      +{{ items.length - maxDisplay }} more items
    </div>
  </div>
</template>

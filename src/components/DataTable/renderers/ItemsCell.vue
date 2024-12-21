<!-- components/DataTable/renderers/ItemsCell.vue -->
<script setup>
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
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="item in items.slice(0, maxDisplay)"
      :key="item.id"
      class="flex items-center gap-1"
    >
      <span class="text-sm">{{ item.quantity }}</span>
      <span>{{ item.productName }}</span>

    </div>
    <div
      v-if="items.length > maxDisplay"
      class="text-sm text-neutral-500"
    >
      +{{ items.length - maxDisplay }} more items
    </div>
  </div>
</template>

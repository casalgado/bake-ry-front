<script setup>
import { ref, computed } from 'vue';
import { formatMoney, capitalize } from '@/utils/helpers';

const props = defineProps({
  variations: {
    type: Object,
    required: true,
  },
  previewCount: {
    type: Number,
    default: 3,
  },
});

const isExpanded = ref(false);

const combinations = computed(() => props.variations?.combinations || []);
const totalCount = computed(() => combinations.value.length);
const hasMore = computed(() => totalCount.value > props.previewCount);
const remainingCount = computed(() => totalCount.value - props.previewCount);

const visibleCombinations = computed(() => {
  if (isExpanded.value) {
    return combinations.value;
  }
  return combinations.value.slice(0, props.previewCount);
});

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};
</script>

<template>
  <div class="flex flex-col gap-0 leading-tight">
    <template v-if="totalCount === 0">
      <span class="text-neutral-400 text-xs">Sin variaciones</span>
    </template>
    <template v-else>
      <span
        v-for="item in visibleCombinations"
        :key="item.id"
        class="text-xs text-neutral-700"
      >{{ capitalize(item.name) }} {{ formatMoney(item.basePrice) }}</span>
      <button
        v-if="hasMore"
        @click.stop="toggleExpanded"
        class="text-xs text-primary-600 hover:text-primary-800 font-medium text-left m-0 p-0"
      >{{ isExpanded ? 'ver menos' : `+${remainingCount} más` }}</button>
    </template>
  </div>
</template>

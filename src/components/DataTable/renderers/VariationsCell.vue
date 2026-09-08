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
    default: 4,
  },
  formatter: {
    type: Function,
    default: (item) => `${capitalize(item.name)}`,
  },
  fallbackValue: {
    type: String,
    default: null,
  },
  expanded: {
    type: Boolean,
    default: null,
  },
  onToggle: {
    type: Function,
    default: null,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
});

const localExpanded = ref(false);

const isExpanded = computed(() => {
  return props.expanded !== null ? props.expanded : localExpanded.value;
});

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
  if (props.onToggle) {
    props.onToggle();
  } else {
    localExpanded.value = !localExpanded.value;
  }
};
</script>

<template>
  <div class="flex flex-col gap-0 leading-tight">
    <template v-if="totalCount === 0">
      <span v-if="fallbackValue" class="text-xs" :class="isSelected ? 'text-white' : 'text-neutral-700'">{{ fallbackValue }}</span>
      <span v-else class="text-xs" :class="isSelected ? 'text-white/70' : 'text-neutral-400'">Sin variaciones</span>
    </template>
    <template v-else>
      <span
        v-for="item in visibleCombinations"
        :key="item.id"
        class="text-xs"
        :class="isSelected ? 'text-white' : 'text-neutral-700'"
      >{{ formatter(item) }}</span>
      <button
        v-if="hasMore"
        @click.stop="toggleExpanded"
        class="text-xs font-medium text-left m-0 p-0"
        :class="isSelected ? 'text-white underline' : 'text-primary-600 hover:text-primary-800'"
      >{{ isExpanded ? 'menos' : `+${remainingCount} más` }}</button>
    </template>
  </div>
</template>

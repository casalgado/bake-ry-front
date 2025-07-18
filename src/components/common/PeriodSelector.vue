<script setup>
import { usePeriodStore } from '@/stores/periodStore';
import { computed } from 'vue';

const props = defineProps({
  onlyFor: {
    type: Array,
    validator: (value) => {
      return (
        Array.isArray(value) &&
        value.every((item) =>
          ['day', 'week', 'month', 'quarter', 'year'].includes(item),
        )
      );
    },
    default: null,
  },
});

const periodStore = usePeriodStore();

// This controls if the period type buttons are shown at all.
// They are shown if `onlyFor` is null (meaning all types are available)
// OR if `onlyFor` is an array with more than one element (meaning a selection is needed).
const showPeriodTypes = computed(
  () => !props.onlyFor || props.onlyFor.length > 1,
);

// A computed property to determine which period types to display buttons for
const periodTypesToShow = computed(() => {
  if (props.onlyFor && props.onlyFor.length > 0) {
    return props.onlyFor;
  }
  return ['day', 'week', 'month', 'quarter', 'year']; // Show all types if no `onlyFor` is provided
});

if (props.onlyFor && props.onlyFor.length === 1) {
  periodStore.setPeriodType(props.onlyFor[0]);
}
</script>

<template>
  <div
    class="flex flex-col lg:flex-row lg:w-auto w-full mx-1 sm:mx-3 lg:items-center px-1 sm:px-2 bg-neutral-100 rounded-lg"
  >
    <div
      class="flex items-center justify-between gap-1 sm:gap-2 min-w-0"
      :class="{ 'flex-1 justify-center': !showPeriodTypes }"
    >
      <button
        @click="periodStore.previous"
        class="p-1.5 sm:p-2 text-neutral-600 hover:text-primary-600 disabled:opacity-50 disabled:hover:text-neutral-600 transition-colors duration-150 flex-shrink-0"
        :disabled="periodStore.periodType === 'custom'"
      >
        <span class="sr-only">Previous Period</span>
        <svg
          class="w-4 h-4 sm:w-5 sm:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <span class="text-neutral-800 font-medium text-center text-sm sm:text-base min-w-0 flex-1 px-1 truncate">
        {{ periodStore.displayFormat }}
      </span>

      <button
        @click="periodStore.next"
        class="p-1.5 sm:p-2 text-neutral-600 hover:text-primary-600 disabled:opacity-50 disabled:hover:text-neutral-600 transition-colors duration-150 flex-shrink-0"
        :disabled="periodStore.periodType === 'custom'"
      >
        <span class="sr-only">Next Period</span>
        <svg
          class="w-4 h-4 sm:w-5 sm:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>

    <div v-if="showPeriodTypes" class="flex justify-center items-center gap-1 sm:gap-2 mt-2 lg:mt-0 lg:ml-4 flex-wrap">
      <button
        v-for="type in periodTypesToShow"
        :key="type"
        @click="periodStore.setPeriodType(type)"
        class="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors duration-150 whitespace-nowrap"
        :class="[
          periodStore.periodType === type
            ? 'bg-primary text-white'
            : 'bg-white text-neutral-700 hover:bg-neutral-50',
        ]"
      >
        {{
          {
            day: 'Día',
            week: 'Semana',
            month: 'Mes',
            quarter: 'Trimestre',
            year: 'Año',
          }[type]
        }}
      </button>
    </div>
  </div>
</template>

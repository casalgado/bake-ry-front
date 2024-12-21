<script setup>
import { usePeriodStore } from '@/stores/periodStore';
import { computed } from 'vue';

const props = defineProps({
  onlyFor: {
    type: String,
    validator: (value) => ['day', 'week', 'month', 'quarter', 'year'].includes(value),
    default: null,
  },
});

const periodStore = usePeriodStore();

// If onlyFor is provided, set the period type immediately
const showPeriodTypes = computed(() => !props.onlyFor);

// Set period type when onlyFor changes
if (props.onlyFor) {
  periodStore.setPeriodType(props.onlyFor);
}
</script>

<template>
  <div class="flex flex-col lg:flex-row lg:w-auto w-11/12 lg:items-center px-2 bg-neutral-100 rounded-lg">
    <!-- Period Navigation -->
    <div class="flex items-center justify-between gap-2" :class="{ 'flex-1 justify-center': !showPeriodTypes }">
      <button
        @click="periodStore.previous"
        class="p-2 text-neutral-600 hover:text-primary-600 disabled:opacity-50
               disabled:hover:text-neutral-600 transition-colors duration-150"
        :disabled="periodStore.periodType === 'custom'"
      >
        <span class="sr-only">Previous Period</span>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <span class="text-neutral-800 font-medium min-w-[180px] text-center">
        {{ periodStore.displayFormat }}
      </span>

      <button
        @click="periodStore.next"
        class="p-2 text-neutral-600 hover:text-primary-600 disabled:opacity-50
               disabled:hover:text-neutral-600 transition-colors duration-150 mr-4"
        :disabled="periodStore.periodType === 'custom'"
      >
        <span class="sr-only">Next Period</span>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Period Type Buttons - Only shown when onlyFor is not provided -->
    <div v-if="showPeriodTypes" class="flex justify-center items-center  gap-2">
      <button
        v-for="type in ['day', 'week', 'month', 'quarter', 'year']"
        :key="type"
        @click="periodStore.setPeriodType(type)"
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150"
        :class="[
          periodStore.periodType === type
            ? 'bg-primary text-white'
            : 'bg-white text-neutral-700 hover:bg-neutral-50'
        ]"
      >
        {{ {
          day: 'Día',
          week: 'Semana',
          month: 'Mes',
          quarter: 'Trimestre',
          year: 'Año'
        }[type] }}
      </button>
    </div>
  </div>
</template>

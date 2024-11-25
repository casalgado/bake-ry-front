// components/common/PeriodSelector.vue
<script setup>
import { usePeriodStore } from '@/stores/periodStore';

const periodStore = usePeriodStore();

const periodOptions = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
  { value: 'custom', label: 'Personalizado' },
];
</script>

<template>
  <div class="flex items-center gap-4 p-4 bg-neutral-100 rounded-lg">
    <!-- Period Type Selector -->
    <div class="flex-none">
      <select
        v-model="periodStore.periodType"
        class="bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm text-neutral-800
               focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
      >
        <option
          v-for="option in periodOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <!-- Navigation and Current Period Display -->
    <div class="flex items-center gap-2 flex-1 justify-center">
      <button
        @click="periodStore.previous"
        class="p-2 text-neutral-600 hover:text-primary-600 disabled:opacity-50 disabled:hover:text-neutral-600
               transition-colors duration-150"
        :disabled="periodStore.periodType === 'custom'"
      >
        <span class="sr-only">Periodo Anterior</span>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <span class="text-neutral-800 font-medium min-w-[200px] text-center">
        {{ periodStore.displayFormat }}
      </span>

      <button
        @click="periodStore.next"
        class="p-2 text-neutral-600 hover:text-primary-600 disabled:opacity-50 disabled:hover:text-neutral-600
               transition-colors duration-150"
        :disabled="periodStore.periodType === 'custom'"
      >
        <span class="sr-only">Siguiente Periodo</span>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Custom Date Range -->
    <div
      v-if="periodStore.periodType === 'custom'"
      class="flex items-center gap-2 flex-none"
    >
      <input
        type="date"
        v-model="periodStore.customStartDate"
        class="bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm text-neutral-800
               focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
      />
      <span class="text-neutral-600">-</span>
      <input
        type="date"
        v-model="periodStore.customEndDate"
        class="bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm text-neutral-800
               focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
      />
    </div>
  </div>
</template>

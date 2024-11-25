// components/common/PeriodSelector.vue
<script setup>
import { usePeriodStore } from '@/stores/periodStore';

const periodStore = usePeriodStore();
</script>

<template>
  <div class="flex items-center justify-between px-2 bg-neutral-100 rounded-lg">
    <!-- Period Navigation on the left -->
    <div class="flex items-center gap-2">
      <button
        @click="periodStore.previous"
        class="p-2 text-neutral-600 hover:text-primary-600 disabled:opacity-50
               disabled:hover:text-neutral-600 transition-colors duration-150"
        :disabled="periodStore.periodType === 'custom'"
      >
        <span class="sr-only">Periodo Anterior</span>
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
        <span class="sr-only">Siguiente Periodo</span>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Period Type Buttons on the right -->
    <div class="flex items-center gap-2">
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

      <!-- Custom Range Button and Inputs -->
      <div class="relative hidden">
        <button
          @click="periodStore.toggleCustomRange"
          class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150"
          :class="[
            periodStore.periodType === 'custom'
              ? 'bg-primary text-white'
              : 'bg-white text-neutral-700 hover:bg-neutral-50'
          ]"
        >
          Personalizado
        </button>

        <!-- Custom Range Inputs -->
        <div
          v-if="periodStore.showCustomRange"
          class="absolute right-0 top-full mt-2 p-3 bg-white rounded-lg shadow-lg z-10
                 border border-neutral-200 min-w-[300px]"
        >
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <label class="text-sm text-neutral-600">Desde</label>
              <input
                type="date"
                v-model="periodStore.customStartDate"
                class="flex-1 px-2 py-1 border border-neutral-200 rounded-md text-sm
                       focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
            <div class="flex items-center gap-2">
              <label class="text-sm text-neutral-600">Hasta</label>
              <input
                type="date"
                v-model="periodStore.customEndDate"
                class="flex-1 px-2 py-1 border border-neutral-200 rounded-md text-sm
                       focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Optional: Add click-outside directive to close custom range popup when clicking outside */
</style>

<script setup>
import { ref, computed } from 'vue';
import { usePeriodStore } from '@/stores/periodStore';

const emit = defineEmits(['close']);

const periodStore = usePeriodStore();

const currentStep = ref('year'); // 'year' | 'month'
const selectedYear = ref(new Date().getFullYear());

// Generate year options (2025 to current year)
const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear();
  const startYear = 2025;
  const years = [];
  for (let year = startYear; year <= currentYear; year++) {
    years.push(year);
  }
  return years;
});

// Month options in Spanish (3-letter abbreviations)
const monthOptions = computed(() => [
  { name: 'Ene', value: 0 },
  { name: 'Feb', value: 1 },
  { name: 'Mar', value: 2 },
  { name: 'Abr', value: 3 },
  { name: 'May', value: 4 },
  { name: 'Jun', value: 5 },
  { name: 'Jul', value: 6 },
  { name: 'Ago', value: 7 },
  { name: 'Sep', value: 8 },
  { name: 'Oct', value: 9 },
  { name: 'Nov', value: 10 },
  { name: 'Dic', value: 11 },
]);

const handleYearSelect = (year) => {
  selectedYear.value = year;
  currentStep.value = 'month';
};

const handleMonthSelect = (month) => {
  // Set period type to month and create new date with selected year and month
  periodStore.setPeriodType('month');
  const newDate = new Date(selectedYear.value, month, 1);
  periodStore.currentDate = newDate;
  emit('close');
};

const currentOptions = computed(() => {
  return currentStep.value === 'year' ? yearOptions.value : monthOptions.value;
});
</script>

<template>
  <div class="relative w-full aspect-square p-1 mb-0">
    <!-- Year Selection -->
    <div v-if="currentStep === 'year'" class="grid grid-cols-2 grid-rows-4 gap-2 h-full p-2">
      <button
        v-for="year in yearOptions"
        :key="year"
        type="button"
        class="utility-btn-inactive !m-0 flex items-center justify-center text-sm"
        @click="handleYearSelect(year)"
      >
        {{ year }}
      </button>
    </div>

    <!-- Month Grid -->
    <div v-else class="grid grid-cols-3 grid-rows-4 gap-2 h-full p-2">
      <button
        v-for="month in monthOptions"
        :key="month.value"
        type="button"
        class="utility-btn-inactive !m-0 flex items-center justify-center text-sm"
        @click="handleMonthSelect(month.value)"
      >
        {{ month.name }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.flat-card {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

<script setup>
import { ref, computed } from 'vue';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue';
import { usePeriodStore } from '@/stores/periodStore';

const props = defineProps({
  month: { type: Boolean, required: true },
  range: { type: Boolean, required: true },
});

const emit = defineEmits(['close']);

const periodStore = usePeriodStore();

const FIRST_YEAR = 2025;
const LAST_YEAR = new Date().getFullYear();
const MAX_RANGE_DAYS = 366;
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Opens on whatever is on screen: a custom range lands on Rango, anything else on Mes
const mode = ref(props.range && (!props.month || periodStore.periodType === 'custom') ? 'range' : 'month');

const shownYear = ref(Math.min(Math.max(periodStore.currentDate.getFullYear(), FIRST_YEAR), LAST_YEAR));

const isShownMonth = (month) =>
  periodStore.periodType === 'month' &&
  periodStore.currentDate.getFullYear() === shownYear.value &&
  periodStore.currentDate.getMonth() === month;

const selectMonth = (month) => {
  periodStore.setPeriodType('month');
  periodStore.currentDate = new Date(shownYear.value, month, 1);
  emit('close');
};

// Prefilled with the period on screen, so tweaking one end is one edit
const rangeStart = ref(format(periodStore.periodRange.start, 'yyyy-MM-dd'));
const rangeEnd = ref(format(periodStore.periodRange.end, 'yyyy-MM-dd'));

const rangeTooLong = computed(() =>
  rangeStart.value && rangeEnd.value &&
  differenceInCalendarDays(parseISO(rangeEnd.value), parseISO(rangeStart.value)) >= MAX_RANGE_DAYS,
);

const canApplyRange = computed(() =>
  rangeStart.value && rangeEnd.value && rangeStart.value <= rangeEnd.value && !rangeTooLong.value,
);

// parseISO reads 'yyyy-MM-dd' as local midnight; new Date() would read it as UTC and land a day early
const applyRange = () => {
  periodStore.setCustomRange(parseISO(rangeStart.value), parseISO(rangeEnd.value));
  emit('close');
};
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="month && range" class="grid grid-cols-2 gap-2">
      <button type="button" class="ui-btn justify-center" :aria-pressed="mode === 'month'" @click="mode = 'month'">
        Mes
      </button>
      <button type="button" class="ui-btn justify-center" :aria-pressed="mode === 'range'" @click="mode = 'range'">
        Rango
      </button>
    </div>

    <!-- Both panels share one grid cell, so the box always takes the taller one's
         height and switching modes never resizes it. visibility, not v-show:
         display: none would drop the hidden panel out of the sizing. -->
    <div class="grid">
      <div
        v-if="month"
        class="[grid-area:1/1] flex flex-col gap-2"
        :class="{ invisible: mode !== 'month' }"
      >
        <div class="flex items-center justify-between">
          <button
            type="button"
            class="ui-btn ui-btn-icon"
            aria-label="Año anterior"
            :disabled="shownYear <= FIRST_YEAR"
            @click="shownYear--"
          >
            <PhCaretLeft :size="14" weight="bold" />
          </button>
          <span class="ui-card-title">{{ shownYear }}</span>
          <button
            type="button"
            class="ui-btn ui-btn-icon"
            aria-label="Año siguiente"
            :disabled="shownYear >= LAST_YEAR"
            @click="shownYear++"
          >
            <PhCaretRight :size="14" weight="bold" />
          </button>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="(name, i) in MONTHS"
            :key="name"
            type="button"
            class="ui-btn justify-center"
            :aria-current="isShownMonth(i) || undefined"
            @click="selectMonth(i)"
          >
            {{ name }}
          </button>
        </div>
      </div>

      <div
        v-if="range"
        class="[grid-area:1/1] flex flex-col gap-3"
        :class="{ invisible: mode !== 'range' }"
      >
        <div class="ui-field">
          <label for="period-range-start" class="ui-field-k">Desde</label>
          <input id="period-range-start" v-model="rangeStart" type="date" class="ui-input" :max="rangeEnd">
        </div>
        <div class="ui-field">
          <label for="period-range-end" class="ui-field-k">Hasta</label>
          <input
            id="period-range-end"
            v-model="rangeEnd"
            type="date"
            class="ui-input"
            :min="rangeStart"
            :aria-invalid="rangeTooLong || undefined"
            :aria-describedby="rangeTooLong ? 'period-range-error' : undefined"
          >
          <p v-if="rangeTooLong" id="period-range-error" class="ui-field-error">Máximo un año.</p>
        </div>
        <button
          type="button"
          class="ui-btn ui-btn-solid justify-center mt-auto"
          :disabled="!canApplyRange"
          @click="applyRange"
        >
          Aplicar
        </button>
      </div>
    </div>
  </div>
</template>

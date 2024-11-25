// stores/periodStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  format,
  add,
  sub,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addQuarters,
  subQuarters,
} from 'date-fns';
import { es } from 'date-fns/locale';

// Constants
const PERIOD_TYPES = ['day', 'week', 'month', 'quarter', 'year', 'custom'];
const WEEK_OPTIONS = { locale: es, weekStartsOn: 1 };

export const usePeriodStore = defineStore('period', () => {
  // State remains the same
  const periodType = ref('week');
  const currentDate = ref(new Date());
  const customStartDate = ref(null);
  const customEndDate = ref(null);

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  function getQuarterRange(date) {
    const month = date.getMonth();
    const quarterStartMonth = Math.floor(month / 3) * 3;
    const quarterStart = new Date(date.getFullYear(), quarterStartMonth, 1);
    const quarterEnd = new Date(date.getFullYear(), quarterStartMonth + 3, 0);
    return {
      start: startOfDay(quarterStart),
      end: endOfDay(quarterEnd),
    };
  }

  function getPeriodRange(date, type) {
    switch (type) {
    case 'day': {
      return {
        start: startOfDay(date),
        end: endOfDay(date),
      };
    }
    case 'week': {
      return {
        start: startOfWeek(date, WEEK_OPTIONS),
        end: endOfWeek(date, WEEK_OPTIONS),
      };
    }
    case 'month': {
      return {
        start: startOfMonth(date),
        end: endOfMonth(date),
      };
    }
    case 'quarter': {
      return getQuarterRange(date);
    }
    case 'year': {
      return {
        start: startOfYear(date),
        end: endOfYear(date),
      };
    }
    case 'custom': {
      console.log('not implemented yet');
      break;
    }
    default: {
      throw new Error(`Invalid period type: ${type}`);
    }
    }
  }

  // Computed
  const periodRange = computed(() => {
    if (periodType.value === 'custom' && customStartDate.value && customEndDate.value) {
      return {
        start: startOfDay(customStartDate.value),
        end: endOfDay(customEndDate.value),
      };
    }

    return getPeriodRange(currentDate.value, periodType.value);
  });

  const displayFormat = computed(() => {
    const { start, end } = periodRange.value;

    switch (periodType.value) {
    case 'day': {
      return capitalize(format(start, 'EEEE d MMM', { locale: es }));
    }
    case 'week': {
      return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM', { locale: es })}`;
    }
    case 'month': {
      return capitalize(format(start, 'MMMM yyyy', { locale: es }));
    }
    case 'quarter': {
      const quarter = Math.floor(start.getMonth() / 3) + 1;
      return `${quarter}° Trimestre ${start.getFullYear()}`;
    }
    case 'year': {
      return format(start, 'yyyy');
    }
    case 'custom': {
      return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM', { locale: es })}`;
    }
    default: {
      return '';
    }
    }
  });

  // Actions
  function setPeriodType(type) {
    if (!PERIOD_TYPES.includes(type)) {
      throw new Error(`Invalid period type: ${type}`);
    }

    periodType.value = type;
    if (type !== 'custom') {
      customStartDate.value = null;
      customEndDate.value = null;
    }
  }

  function setCustomRange(start, end) {
    if (!start || !end || start > end) {
      throw new Error('Invalid date range');
    }

    customStartDate.value = start;
    customEndDate.value = end;
    periodType.value = 'custom';
  }

  function next() {
    if (periodType.value === 'custom') return;

    if (periodType.value === 'quarter') {
      currentDate.value = addQuarters(currentDate.value, 1);
    } else {
      currentDate.value = add(currentDate.value, {
        [periodType.value + 's']: 1,
      });
    }
  }

  // Modified previous function
  function previous() {
    if (periodType.value === 'custom') return;

    if (periodType.value === 'quarter') {
      currentDate.value = subQuarters(currentDate.value, 1);
    } else {
      currentDate.value = sub(currentDate.value, {
        [periodType.value + 's']: 1,
      });
    }
  }

  return {
    // State
    periodType,
    currentDate,
    customStartDate,
    customEndDate,

    // Computed
    periodRange,
    displayFormat,

    // Actions
    setPeriodType,
    setCustomRange,
    next,
    previous,

  };
});

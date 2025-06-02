<!-- components/DataTable/components/TableBody.vue -->
<script setup>
import { ref, computed } from 'vue';
import CalendarDay from './CalendarDay.vue';
import {
  differenceInDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameWeek,
} from 'date-fns';

const props = defineProps({
  data: {
    type: Array,
    required: true,
  },
  columns: {
    type: Array,
    required: true,
  },
  periodRange: {
    type: Object,
    required: true,
  },
  selectedRows: {
    type: Set,
    required: true,
  },
  toggleLoading: {
    type: Object,
    default: () => ({}),
  },
});

const isEmpty = computed(() => props.data.length === 0);

const parseRange = computed(() => {
  const start = new Date(props.periodRange.start);
  const end = new Date(props.periodRange.end);
  const difference = differenceInDays(end, start);
  return difference > 7 ? 'month' : 'week';
});

const startOfPeriod = computed(() => {
  const start = new Date(props.periodRange.start);
  return parseRange.value === 'week' ? startOfWeek(start, { weekStartsOn: 1 }) : startOfMonth(start);
});

const endOfPeriod = computed(() => {
  const end = new Date(props.periodRange.end);
  return parseRange.value === 'week' ? endOfWeek(end, { weekStartsOn: 1 }) : endOfMonth(end);
});

// Generate all days in the period
const periodDays = computed(() => {
  return eachDayOfInterval({
    start: startOfPeriod.value,
    end: endOfPeriod.value,
  });
});

const weekRows = computed(() => {
  if (parseRange.value === 'week') {
    return [periodDays.value];
  }

  const days = periodDays.value.map(d => new Date(d));

  if (days.length === 0) return [];

  // Extend range to cover full calendar weeks starting on Monday
  const calendarStart = startOfWeek(days[0], { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(days[days.length - 1], { weekStartsOn: 1 });

  // Get all days between calendarStart and calendarEnd
  const fullCalendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group into weeks
  const weeks = [];
  for (let i = 0; i < fullCalendarDays.length; i += 7) {
    const week = fullCalendarDays.slice(i, i + 7).map(day => new Date(day));
    weeks.push(week);
  }

  return weeks;
});

// Create a hashmap of data grouped by date (YYYY-MM-DD format)
// This computed property will only recalculate when props.data changes
const dataByDate = computed(() => {
  const hashmap = new Map();

  // Loop through data only once
  props.data.forEach(item => {
    try {
      const itemDate = new Date(item.dueDate);
      // Skip invalid dates
      if (isNaN(itemDate.getTime())) {
        console.warn('Invalid date found in item:', item);
        return;
      }

      const dateKey = format(itemDate, 'yyyy-MM-dd');

      if (!hashmap.has(dateKey)) {
        hashmap.set(dateKey, []);
      }
      hashmap.get(dateKey).push(item);
    } catch (error) {
      console.warn('Error processing item date:', item, error);
    }
  });

  return hashmap;
});

// Optimized function to get data for a specific day - O(1) lookup
const getDataForDay = (day) => {
  const dayDate = new Date(day);
  const dateKey = format(dayDate, 'yyyy-MM-dd');
  return dataByDate.value.get(dateKey) || [];
};

const emit = defineEmits(['row-select', 'toggle-update']);

// Track hover state for toggle cells
const hoveredCell = ref(null);

const handleRowClick = (event, row) => {
  emit('row-select', { row, shift: event.shiftKey });
};

const handleCellClick = (payload) => {
  const { event, row, column } = payload;
  console.log('Cell clicked:', { event, row, column });
  if (column && column.type === 'toggle') {
    event.stopPropagation();
    emit('toggle-update', { row, column });
  }
};

const handleCellHover = ({ hovering, rowId, columnId }) => {
  hoveredCell.value = hovering ? { rowId, columnId } : null;
};

/**
 * Determines whether a table cell should be highlighted based on hover and selection state
 */
const isCellHighlighted = (row, column) => {
  if (!hoveredCell.value || column.type !== 'toggle') return false;

  if (hoveredCell.value.columnId === column.id) {
    if (props.selectedRows.size > 0) {
      return props.selectedRows.has(row.id);
    }
    return row.id === hoveredCell.value.rowId;
  }

  return false;
};

// Check if a day is outside the actual month (for monthly view)
const isDayOutsideMonth = (day) => {
  if (parseRange.value === 'week') return false;

  const monthStart = new Date(props.periodRange.start);
  const monthEnd = new Date(props.periodRange.end);

  return day < startOfMonth(monthStart) || day > endOfMonth(monthEnd);
};
</script>

<template>
  <tbody>
    <template v-if="!isEmpty">
        <tr
          v-for="(week, weekIndex) in weekRows"
          :key="`week-${weekIndex}`"
          class="border-t border-separate border-spacing-0 border-neutral-400 bg-neutral-100"
        >
          <CalendarDay
            v-for="day in week"
            :key="`week-${weekIndex}-${format(day, 'yyyy-MM-dd')}`"
            :day="day"
            :columns="props.columns"
            :rows="getDataForDay(day)"
            :is-outside-month="isDayOutsideMonth(day)"
            :selected-rows="selectedRows"
            :toggle-loading="toggleLoading"
            @click="handleCellClick"
            @hover-change="handleCellHover"
          />
        </tr>
    </template>

    <!-- Empty state -->
    <tr v-else>
      <td
        :colspan="parseRange === 'week' ? periodDays.length : 7"
        class="px-4 py-8 text-center text-neutral-500"
      >
        No hay datos disponibles para mostrar.
      </td>
    </tr>
  </tbody>
</template>

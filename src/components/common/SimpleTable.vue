<script setup>
import { computed } from 'vue';
import { formatMoney } from '@/utils/helpers';

const props = defineProps({
  data: {
    type: Array,
    required: true,
    default: () => [],
  },
  columns: {
    type: Array,
    required: true,
    default: () => [],
  },
  hasHeaders: {
    type: Boolean,
    default: true,
  },
  showDividers: {
    type: Boolean,
    default: false,
  },
  dividerCondition: {
    type: Function,
    default: null,
  },
  minWidth: {
    type: String,
    default: null,
  },
});

// Built-in formatters
const formatters = {
  money: (value, options = {}) => {
    const currency = options.currency || 'COP';
    return formatMoney(value, currency);
  },

  percentage: (value, options = {}) => {
    const decimals = options.decimals || 1;
    return `${(value || 0).toFixed(decimals)}%`;
  },

  date: (value, options = {}) => {
    if (!value) return 'No Asignada';
    const locale = options.locale || 'es-CO';
    const dateOptions = options.options || {
      day: 'numeric',
      month: 'long',
    };
    return new Date(value).toLocaleDateString(locale, dateOptions);
  },

  capitalize: (value) => {
    if (!value) return '';
    return value.toString().charAt(0).toUpperCase() + value.toString().slice(1);
  },
};

// Format cell value based on column configuration
const formatCellValue = (value, column, row, index) => {
  if (!column.formatter) return value;

  if (typeof column.formatter === 'function') {
    return column.formatter(value, row, index);
  }

  if (typeof column.formatter === 'string' && formatters[column.formatter]) {
    return formatters[column.formatter](value, column.formatterOptions || {});
  }

  return value;
};

// Get cell value from row using column key (supports nested keys like 'user.name')
const getCellValue = (row, columnKey) => {
  return columnKey.split('.').reduce((obj, key) => obj?.[key], row);
};

// Check if divider should be shown after current row
const shouldShowDivider = (index) => {
  if (!props.showDividers || !props.dividerCondition) return false;
  return props.dividerCondition(index);
};

// Compute table styles
const tableStyles = computed(() => {
  const styles = {};
  if (props.minWidth) {
    styles.minWidth = props.minWidth;
  }
  return styles;
});

// Compute visible columns (filter out mobile-hidden on small screens)
const visibleColumns = computed(() => {
  return props.columns.filter(column => !column.hideOnMobile);
});

// Get column classes
const getColumnClass = (column) => {
  const baseClasses = 'text-xs sm:text-sm p-1 sm:p-2 border-r border-neutral-200';
  return column.class ? `${baseClasses} ${column.class}` : baseClasses;
};
</script>

<template>
  <div class="overflow-x-auto -mx-2 sm:mx-0">
    <table
      class="w-full border-collapse border border-neutral-200 bg-white"
      :style="tableStyles"
    >
      <!-- Headers -->
      <thead v-if="hasHeaders">
        <tr class="bg-neutral-100">
          <th
            v-for="column in visibleColumns"
            :key="column.key"
            :class="getColumnClass(column)"
            class="text-left font-semibold"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>

      <!-- Body -->
      <tbody>
        <template v-for="(row, index) in data" :key="index">
          <!-- Data Row -->
          <tr class="border-b border-neutral-200">
            <td
              v-for="column in visibleColumns"
              :key="column.key"
              :class="getColumnClass(column)"
            >
              {{ formatCellValue(getCellValue(row, column.key), column, row, index) }}
            </td>
          </tr>

          <!-- Divider Row -->
          <tr v-if="shouldShowDivider(index)" class="date-divider">
            <td :colspan="visibleColumns.length" class="p-0">
              <div class="bg-neutral-150 h-2 sm:h-3"></div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
* {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

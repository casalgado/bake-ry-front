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

<!-- components/DataTable/components/TableCell.vue -->
<script setup>
import { computed, ref, onUnmounted } from 'vue';
import { PhArrowRight } from '@phosphor-icons/vue';

const props = defineProps({
  column: {
    type: Object,
    required: true,
  },
  rows: {
    type: Array,
    required: true,
  },
  selectedRows: {
    type: Set,
    required: true,
  },
  hovering: {
    type: Boolean,
    required: true,
  },
  toggleLoading: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['click', 'hover-change']);

const handleClick = (event) => {
  if (props.column.type === 'toggle' && !isClickEnabled.value) {
    event.stopPropagation();
    return;
  }
  emit('click', event);
};

// Determine if click is enabled for this cell
// Only toggle cells in selected rows are clickable
const isClickEnabled = computed(() => {
  if (props.column.type !== 'toggle') return false;
  if (props.column.field === 'isPaid' && props.row.isComplimentary) return false;
  if (props.column.options) {
    const currentValue = props.row[props.column.field];
    const currentOption = props.column.options.find(opt => opt.value === currentValue);
    if (currentOption?.lockedValue) return false;
  }
  return !props.selectedRows.size || props.selectedRows.has(props.row.id);
});

// Determine if this cell is in loading state
const isLoading = computed(() => {
  return props.toggleLoading[`${props.row.id}-${props.column.field}`];
});

// Get next toggle value
const getNextToggleValue = computed(() => {
  if (props.column.type !== 'toggle' || !props.column.options) return null;
  const availableOptions = props.column.options.filter(opt => !opt.skipWhenToggled);
  const currentValue = props.row[props.column.field];
  const currentIndex = availableOptions.findIndex(opt => opt.value === currentValue);
  return availableOptions[(currentIndex + 1) % availableOptions.length];
});

const currentOption = computed(() => {
  if (props.column.type !== 'toggle' || !props.column.options) return null;
  return props.column.options.find(opt => opt.value === props.row[props.column.field]);
});

// Get tooltip content
const tooltipContent = computed(() => {
  if (!isClickEnabled.value || props.column.type !== 'toggle') return null;
  const nextValue = getNextToggleValue.value;
  const affectedCount = props.selectedRows.size || 1;
  return {
    prefix: affectedCount > 1 ? `${affectedCount}` : '',
    value: nextValue.displayText,
    icon: nextValue.icon,
  };
});

const showTooltip = ref(false);
let touchTimeout = null;

// Handle mouse events for desktop
const handleMouseEnter = () => {
  // Only handle mouse events if not a touch device
  if (!('ontouchstart' in window)) {
    if (props.column.type === 'toggle' && isClickEnabled.value) {
      emit('hover-change', {
        hovering: true,
        rowId: props.row.id,
        columnId: props.column.id,
      });
    }
    showTooltip.value = true;
  }
};

const handleMouseLeave = () => {
  if (props.column.type === 'toggle' && isClickEnabled.value) {
    emit('hover-change', {
      hovering: false,
      rowId: props.row.id,
      columnId: props.column.id,
    });
  }
  showTooltip.value = false;
};

// Handle touch events for mobile
const handleTouchStart = () => {

  if (props.column.type === 'toggle' && isClickEnabled.value) {
    showTooltip.value = true;

    emit('hover-change', {
      hovering: true,  // Changed to true since this is when interaction starts
      rowId: props.row.id,
      columnId: props.column.id,
    });
  }
};

const handleTouchEnd = () => {

  if (touchTimeout) clearTimeout(touchTimeout);
  touchTimeout = setTimeout(() => {
    showTooltip.value = false;
    // Try emitting immediately without the timeout
    emit('hover-change', {
      hovering: false,
      rowId: props.row.id,
      columnId: props.column.id,
    });
  }, 100);
};

// Clean up timeout on component unmount
onUnmounted(() => {
  if (touchTimeout) {
    clearTimeout(touchTimeout);
  }
});
</script>

<template>
  <td
    class="px-0 pl-1 lg:px-4 text-xs lg:text-sm py-2 relative group select-none"
  >
    <div v-for="row in rows" :key="row.id">
      {{ row.userName }}
    </div>
  </td>
</template>

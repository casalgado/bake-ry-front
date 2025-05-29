<!-- components/DataTable/components/TableCell.vue -->
<script setup>
import { computed, ref, onUnmounted } from 'vue';
import { PhArrowRight } from '@phosphor-icons/vue';

const props = defineProps({
  column: {
    type: Object,
    required: true,
  },
  row: {
    type: Object,
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
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    :class="{
      'border-neutral-400 border-[2px] border-dashed': props.column.type === 'toggle' && isClickEnabled,
      'cursor-not-allowed': props.column.type === 'toggle' && props.selectedRows.size > 0 && !props.selectedRows.has(props.row.id)
    }"
  >
    <div
      class="inline-block px-1 rounded-2xl transition-colors"
      :class="{
        'lg:hover:bg-neutral-800 lg:hover:text-white': isClickEnabled && !isLoading,
        'bg-neutral-800 text-white': (props.column.type === 'toggle' && props.hovering) || isLoading,
        'opacity-50': props.column.type === 'toggle' && props.selectedRows.size > 0 && !props.selectedRows.has(props.row.id),
        '!text-neutral-800': isLoading && props.column.type,
      }"
    >
      <!-- Cell Content -->
      <template v-if="column.type === 'toggle' && currentOption">
        <component
          v-if="column.component"
          :is="column.component"
          v-bind="column.getProps(row)"
        />
        <div v-else class="flex items-center gap-2">
          <component
            v-if="currentOption.icon"
            :is="currentOption.icon"
            class="w-5 h-5"
          />
          <span v-if="currentOption.displayText">{{ currentOption.displayText }}</span>
        </div>
      </template>
      <component
        v-else-if="column.component"
        :is="column.component"
        v-bind="column.getProps(row)"
      />
      <template v-else>
        <template v-if="column.displayText">

          {{ column.displayText[row[column.field]] }}
        </template>
        <template v-else>
          {{ row[column.field] }}
        </template>
      </template>

      <!-- Responsive Tooltip -->
      <div
        v-if="tooltipContent && showTooltip && !isLoading"
        class="pointer-events-none absolute z-50 px-2 py-1 text-xs text-white bg-primary rounded shadow-lg whitespace-nowrap
               left-1/2 -translate-x-1/2 -top-16
               lg:left-full lg:ml-2 lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0 z-99999"
      >
        <div class="flex items-center gap-1">
          {{ tooltipContent.prefix }}
          <PhArrowRight weight="bold" class="w-3 h-3" />
          <div class="flex items-center gap-1">
            <component
              v-if="tooltipContent.icon"
              :is="tooltipContent.icon"
              class="w-3 h-3"
            />
            <span>{{ tooltipContent.value }}</span>
          </div>
        </div>

        <!-- Responsive triangle pointer -->
        <div
          class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full
                 lg:bottom-auto lg:right-full lg:left-auto lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0"
        >
          <div
            class="border-4 border-transparent border-t-primary
                   lg:border-t-transparent lg:border-r-primary"
          ></div>
        </div>
      </div>
    </div>
  </td>
</template>

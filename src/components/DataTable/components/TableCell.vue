<!-- components/DataTable/components/TableCell.vue -->
<script setup>
import { computed, ref } from 'vue';
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
  return !props.selectedRows.size || props.selectedRows.has(props.row.id);
});

// Determine if this cell is in loading state
const isLoading = computed(() => {
  return props.toggleLoading[`${props.row.id}-${props.column.field}`];
});

// Get next toggle value
const getNextToggleValue = computed(() => {
  if (props.column.type !== 'toggle' || !props.column.options) return null;
  const currentValue = props.row[props.column.field];
  const currentIndex = props.column.options.findIndex(opt => opt.value === currentValue);
  return props.column.options[(currentIndex + 1) % props.column.options.length];
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

// Handle hover events
const handleMouseEnter = () => {
  if (props.column.type === 'toggle' && isClickEnabled.value) {
    emit('hover-change', {
      hovering: true,
      rowId: props.row.id,
      columnId: props.column.id,
    });
  }
  showTooltip.value = true;
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

</script>

<template>
  <td
    class="px-4 py-2 relative group select-none"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    :class="{
      'border-neutral-300 border-2 border-dashed': props.column.type === 'toggle',
      'cursor-not-allowed': props.column.type === 'toggle' && props.selectedRows.size > 0 && !props.selectedRows.has(props.row.id)
    }"
  >
    <div
      class="inline-block px-3  rounded-2xl transition-colors"
      :class="{
        'hover:bg-neutral-800 hover:text-white': isClickEnabled && !isLoading,

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
            :is="currentOption.icon"
            class="w-5 h-5"
          />
          <span>{{ currentOption.displayText }}</span>
        </div>
      </template>
      <component
        v-else-if="column.component"
        :is="column.component"
        v-bind="column.getProps(row)"
      />
      <template v-else>
        {{ row[column.field] }}
      </template>
      <!-- Tooltip -->
      <div
        v-if="tooltipContent && showTooltip && !isLoading"
        class="pointer-events-none absolute z-50 px-2 py-1 text-xs text-white bg-primary rounded shadow-lg whitespace-nowrap left-full ml-2 top-1/2 -translate-y-1/2"
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
        <!-- Triangle pointer -->
        <div class="absolute right-full top-1/2 -translate-y-1/2">
          <div class="border-4 border-transparent border-r-primary"></div>
        </div>
      </div>
    </div>
  </td>
</template>

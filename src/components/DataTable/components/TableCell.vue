<!-- components/DataTable/components/TableCell.vue -->
<script setup>
import { h, computed, ref } from 'vue';
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
});

const emit = defineEmits(['click', 'hover-change']);

const handleClick = (event) => {
  if (props.column.type === 'toggle' && !isToggleEnabled.value) {
    event.stopPropagation();
    return;
  }
  emit('click', event);
};

// Determine if toggle is enabled for this cell
const isToggleEnabled = computed(() => {
  if (props.column.type !== 'toggle') return false;
  return !props.selectedRows.size || props.selectedRows.has(props.row.id);
});

// Determine if this cell will be affected by a toggle action
const isAffectedByToggle = computed(() => {
  return props.column.type === 'toggle' && isToggleEnabled.value;
});

// Get next toggle value
const getNextToggleValue = computed(() => {
  if (props.column.type !== 'toggle' || !props.column.options) return null;  // Fixed the condition
  const currentValue = props.row[props.column.field];
  const currentIndex = props.column.options.indexOf(currentValue);
  return props.column.options[(currentIndex + 1) % props.column.options.length];
});

// Get tooltip content
const tooltipContent = computed(() => {
  if (!isToggleEnabled.value || props.column.type !== 'toggle') return null;

  const nextValue = getNextToggleValue.value;
  const affectedCount = props.selectedRows.size || 1;

  return {
    prefix: affectedCount > 1 ? `${affectedCount}` : '',
    value: nextValue,
  };
});

const showTooltip = ref(false);

// Handle hover events
const handleMouseEnter = () => {
  if (props.column.type === 'toggle' && isToggleEnabled.value) {
    emit('hover-change', {
      hovering: true,
      rowId: props.row.id,
      columnId: props.column.id,
    });
  }
  showTooltip.value = true;
};

const handleMouseLeave = () => {
  if (props.column.type === 'toggle' && isToggleEnabled.value) {
    emit('hover-change', {
      hovering: false,
      rowId: props.row.id,
      columnId: props.column.id,
    });
  }
  showTooltip.value = false;
};

const renderCell = () => {
  // For custom rendered cells
  if (props.column.customRender) {
    const rendered = props.column.customRender(props.row);

    if (rendered && rendered.__v_isVNode) {
      return rendered;
    }

    if (rendered && rendered.component) {
      return h(rendered.component, rendered.props || {});
    }

    return rendered;
  }

  return props.row[props.column.field];
};
</script>

<template>
  <td
    class="px-4 py-2 relative group"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    :class="{
      'cursor-not-allowed': props.column.type === 'toggle' && props.selectedRows.size > 0 && !props.selectedRows.has(props.row.id)
    }"
  >
    <div
      class="inline-block px-3 py-1 rounded-2xl transition-colors"
      :class="{
        'hover:bg-neutral-800 hover:text-white': isAffectedByToggle,
        'bg-neutral-800 text-white': props.column.type === 'toggle' && props.hovering,
        'opacity-50': props.column.type === 'toggle' && props.selectedRows.size > 0 && !props.selectedRows.has(props.row.id)
      }"
    >
      <component
        :is="renderCell()"
        v-if="renderCell()?.__v_isVNode"
      />
      <template v-else>
        {{ renderCell() }}
      </template>
      <!-- Tooltip -->
      <div
        v-if="tooltipContent && showTooltip"
        class="absolute z-50 px-2 py-1 text-xs text-white bg-primary rounded shadow-lg whitespace-nowrap -translate-y-full -translate-x-1/2 left-1/2 -top-3"
      >
        <span class="flex items-center gap-1">
          {{ tooltipContent.prefix }}
          <PhArrowRight class="w-3 h-3" />
          {{ tooltipContent.value }}
        </span>

        <!-- Triangle pointer -->
        <div class="absolute left-1/2 top-full -translate-x-1/2 -translate-y-px">
          <div class="border-4 border-transparent border-t-primary"></div>
        </div>
      </div>
    </div>

  </td>
</template>

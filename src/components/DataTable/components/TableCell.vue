<!-- components/DataTable/components/TableCell.vue -->
<script setup>
import { h, computed } from 'vue';

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

// Handle hover events
const handleMouseEnter = () => {
  if (props.column.type === 'toggle' && isToggleEnabled.value) {
    emit('hover-change', {
      hovering: true,
      rowId: props.row.id,
      columnId: props.column.id,
    });
  }
};

const handleMouseLeave = () => {
  if (props.column.type === 'toggle' && isToggleEnabled.value) {
    emit('hover-change', {
      hovering: false,
      rowId: props.row.id,
      columnId: props.column.id,
    });
  }
};

const renderCell = () => {
  // For custom rendered cells
  if (props.column.customRender) {
    const rendered = props.column.customRender(props.row);

    // If renderer returns a VNode or Component
    if (rendered && rendered.__v_isVNode) {
      return rendered;
    }

    // If renderer returns a component definition
    if (rendered && rendered.component) {
      return h(rendered.component, rendered.props || {});
    }

    // For simple value transformations
    return rendered;
  }

  // Default case: just return the field value
  return props.row[props.column.field];
};
</script>

<template>
  <td
    class="px-4 py-2 relative"
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
    </div>
  </td>
</template>

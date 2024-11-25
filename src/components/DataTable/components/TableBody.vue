<!-- components/DataTable/components/TableBody.vue -->
<script setup>
import { ref, computed } from 'vue';
import TableCell from './TableCell.vue';

const props = defineProps({
  data: {
    type: Array,
    required: true,
  },
  columns: {
    type: Array,
    required: true,
  },
  selectedRows: {
    type: Set,
    required: true,
  },
});

const emit = defineEmits(['row-select', 'toggle-update']);

// Track hover state for toggle cells
const hoveredCell = ref(null);

const handleRowClick = (event, row) => {
  emit('row-select', { row, shift: event.shiftKey });
};

const handleCellClick = (event, row, column) => {
  // Only allow toggle if:
  // - No rows are selected, or
  // - This row is part of the selection
  if (column.type === 'toggle' && (!props.selectedRows.size || props.selectedRows.has(row.id))) {
    event.stopPropagation();
    emit('toggle-update', { row, column });
  }
};

const handleCellHover = ({ hovering, rowId, columnId }) => {
  hoveredCell.value = hovering ? { rowId, columnId } : null;
};

const isCellHighlighted = (row, column) => {
  if (!hoveredCell.value || column.type !== 'toggle') return false;

  // If hovering over a toggle cell
  if (hoveredCell.value.columnId === column.id) {
    // If there are selected rows, only highlight selected toggle cells
    if (props.selectedRows.size > 0) {
      return props.selectedRows.has(row.id);
    }
    // If no selection, only highlight the hovered cell
    return row.id === hoveredCell.value.rowId;
  }

  return false;
};

const isEmpty = computed(() => props.data.length === 0);
</script>

<template>
  <tbody>
    <template v-if="!isEmpty">
      <tr
        v-for="row in data"
        :key="row.id"
        @click="(event) => handleRowClick(event, row)"
        :class="[
          'cursor-pointer border-b transition-colors',
          selectedRows.has(row.id)
            ? 'bg-neutral-300 hover:bg-neutral-400'
            : 'hover:bg-neutral-100'
        ]"
      >
        <TableCell
          v-for="column in columns"
          :key="column.id"
          :column="column"
          :row="row"
          :selected-rows="selectedRows"
          @click="(event) => handleCellClick(event, row, column)"
          @hover-change="handleCellHover"
          :class="{
            'bg-neutral-500': isCellHighlighted(row, column)
          }"
        />
      </tr>
    </template>
    <tr v-else>
      <td
        :colspan="columns.length"
        class="px-4 py-8 text-center text-neutral-500"
      >
        No data available
      </td>
    </tr>
  </tbody>
</template>

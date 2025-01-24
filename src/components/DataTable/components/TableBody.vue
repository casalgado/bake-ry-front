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
  toggleLoading: {
    type: Object,
    default: () => ({}),
  },
});

const isEmpty = computed(() => props.data.length === 0);
const emit = defineEmits(['row-select', 'toggle-update']);

// Track hover state for toggle cells
const hoveredCell = ref(null);

const handleRowClick = (event, row) => {
  emit('row-select', { row, shift: event.shiftKey });
};

const handleCellClick = (event, row, column) => {
  // only act if cell is a toggle and is in a selected row
  if (column.type === 'toggle' && (!props.selectedRows.size || props.selectedRows.has(row.id))) {
    event.stopPropagation();
    emit('toggle-update', { row, column });
  }
};

const handleCellHover = ({ hovering, rowId, columnId }) => {
  hoveredCell.value = hovering ? { rowId, columnId } : null;
};

/**
 * Determines whether a table cell should be highlighted based on hover and selection state
 * @param {Object} row - The row data object containing the cell
 * @param {Object} column - The column configuration object
 * @returns {boolean} - Whether the cell should be highlighted
 *
 * Highlighting behavior:
 * 1. For non-toggle columns: never highlighted
 * 2. When no rows are selected: only highlights the specific hovered cell
 * 3. When rows are selected: highlights all toggle cells in selected rows
 *    when hovering over the toggle column
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

</script>

<template>
  <tbody>
    <template v-if="!isEmpty">
      <tr
        v-for="row in data"
        :key="row.id"
        @click="(event) => handleRowClick(event, row)"
        :class="[
          'cursor-pointer border-t-[1px] border-b-[1px] border-neutral-350 transition-colors duration-50',
          selectedRows.has(row.id)
            ? 'bg-neutral hover:bg-neutral-600 text-white'
            : [
              'odd:bg-neutral-100',
              'hover:bg-neutral-200'
            ]
        ]"
      >

        <TableCell
          v-for="column in columns"
          :key="column.id"
          :column="column"
          :row="row"
          :selected-rows="selectedRows"
          :toggle-loading="toggleLoading"
          @click="(event) => handleCellClick(event, row, column)"
          :hovering="isCellHighlighted(row, column)"
          @hover-change="handleCellHover"
        />
      </tr>
    </template>
    <tr v-else>
      <td
        :colspan="columns.length"
        class="px-4 py-8 text-center text-neutral-500"
      >
        No hay datos disponibles para mostrar.
      </td>
    </tr>
  </tbody>
</template>

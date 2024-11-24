// components/DataTable/composables/useTableSort.js
import { ref, computed } from 'vue';

export const useTableSort = () => {
  // Array of sort configs: [{ columnId: 'name', direction: 'asc' }]
  const sortState = ref([]);

  // Add or update sort
  const toggleSort = (columnId, isMulti = false) => {
    const existingSort = sortState.value.find(sort => sort.columnId === columnId);

    // If not holding shift, clear other sorts unless it's the same column
    if (!isMulti) {
      // If it's the same column, just toggle direction
      if (existingSort) {
        if (existingSort.direction === 'asc') {
          sortState.value = [{ columnId, direction: 'desc' }];
        } else {
          sortState.value = [];
        }
      } else {
        // New sort on a different column
        sortState.value = [{ columnId, direction: 'asc' }];
      }
      return;
    }

    // Multi-sort logic (when shift is pressed)
    if (existingSort) {
      if (existingSort.direction === 'asc') {
        existingSort.direction = 'desc';
      } else if (existingSort.direction === 'desc') {
        // Remove this sort
        sortState.value = sortState.value.filter(s => s.columnId !== columnId);
      }
    } else {
      // Add new sort while keeping existing ones
      sortState.value = [...sortState.value, { columnId, direction: 'asc' }];
    }
  };

  // Get sort direction for a column
  const getSortDirection = (columnId) => {
    const sort = sortState.value.find(s => s.columnId === columnId);
    return sort ? sort.direction : null;
  };

  // Get sort index for a column (for multi-sort)
  const getSortIndex = (columnId) => {
    return sortState.value.findIndex(s => s.columnId === columnId);
  };

  // Sort data based on current sort state
  const sortData = (data) => {
    if (!sortState.value.length) return [...data];

    return [...data].sort((a, b) => {
      for (const sort of sortState.value) {
        const aVal = a[sort.columnId];
        const bVal = b[sort.columnId];

        if (aVal === bVal) continue;

        const modifier = sort.direction === 'asc' ? 1 : -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * modifier;
        }

        return String(aVal).localeCompare(String(bVal)) * modifier;
      }
      return 0;
    });
  };

  // Clear all sorts
  const clearSort = () => {
    sortState.value = [];
  };

  return {
    sortState,
    toggleSort,
    getSortDirection,
    getSortIndex,
    sortData,
    clearSort,
  };
};

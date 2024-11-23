// components/DataTable/composables/useTableSort.js
import { ref, computed } from 'vue';

export const useTableSort = () => {
  // Array of sort configs: [{ columnId: 'name', direction: 'asc' }]
  const sortState = ref([]);

  // Add or update sort
  const toggleSort = (columnId, isMulti = false) => {
    const existingSort = sortState.value.find(sort => sort.columnId === columnId);
    const newSortState = isMulti ? [...sortState.value] : [];

    if (!existingSort) {
      // Add new sort
      newSortState.push({ columnId, direction: 'asc' });
    } else {
      if (existingSort.direction === 'asc') {
        // Toggle to descending
        existingSort.direction = 'desc';
      } else {
        // Remove sort if already descending
        const index = sortState.value.indexOf(existingSort);
        newSortState.splice(index, 1);
      }
    }

    sortState.value = newSortState;
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

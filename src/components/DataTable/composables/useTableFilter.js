// composables/useTableFilter.js
import { ref, computed } from 'vue';

export const useTableFilter = (options = {}) => {
  const searchQuery = ref('');
  const activeFilters = ref(new Map()); // Map of field -> Set of active values

  // Set initial active filters for each field
  const initializeFilters = (filters) => {
    filters.forEach(filter => {
      activeFilters.value.set(filter.field, new Set());
    });
  };

  // Toggle a filter value
  const toggleFilter = (field, value) => {
    const fieldFilters = activeFilters.value.get(field);
    if (fieldFilters.has(value)) {
      fieldFilters.delete(value);
    } else {
      fieldFilters.add(value);
    }
  };

  // Clear all filters and search
  const clearAll = () => {
    searchQuery.value = '';
    activeFilters.value.forEach(filters => filters.clear());
  };

  // Check if any filters are active
  const hasActiveFilters = computed(() => {
    return Array.from(activeFilters.value.values()).some(filters => filters.size > 0) ||
           searchQuery.value.length > 0;
  });

  // Filter data based on search and filters
  const filterData = (data, searchableColumns) => {
    return data.filter(item => {
      // First check if item passes all active filters
      const passesFilters = Array.from(activeFilters.value.entries())
        .every(([field, activeValues]) => {
          return activeValues.size === 0 || activeValues.has(item[field]);
        });

      if (!passesFilters) return false;

      // Then check if item matches search query
      if (!searchQuery.value) return true;

      const query = searchQuery.value.toLowerCase();
      return searchableColumns.some(column =>
        String(item[column]).toLowerCase().includes(query),
      );
    });
  };

  return {
    searchQuery,
    activeFilters,
    hasActiveFilters,
    toggleFilter,
    clearAll,
    filterData,
    initializeFilters,
  };
};

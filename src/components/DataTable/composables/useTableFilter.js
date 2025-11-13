// composables/useTableFilter.js
import { ref, computed } from 'vue';

// Helper function to remove accents from vowels only (preserves ñ, ü, etc.)
const removeAccents = (str) => {
  const accentMap = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
    'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
    'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
    'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u',
    'Ä': 'A', 'Ë': 'E', 'Ï': 'I', 'Ö': 'O', 'Ü': 'U',
    'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
    'Â': 'A', 'Ê': 'E', 'Î': 'I', 'Ô': 'O', 'Û': 'U'
  };

  return str.replace(/[áéíóúÁÉÍÓÚàèìòùÀÈÌÒÙäëïöüÄËÏÖÜâêîôûÂÊÎÔÛ]/g, match => accentMap[match]);
};

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
  // composables/useTableFilter.js
  const filterData = (data, searchableColumns) => {
    return data.filter(item => {
    // First check if item passes all active filters
      const passesFilters = Array.from(activeFilters.value.entries())
        .every(([field, activeValues]) => {
          if (activeValues.size === 0) return true;

          return Array.from(activeValues).some(value => {
          // Handle array values (for grouped days)
            if (Array.isArray(value)) {
              return value.includes(item[field].toLowerCase());
            }
            // Handle regular single values
            return item[field].toLowerCase() === value;
          });
        });

      if (!passesFilters) return false;

      // Then check if item matches search query
      if (!searchQuery.value) return true;

      const query = removeAccents(searchQuery.value.toLowerCase());
      return searchableColumns.some(column => {
        const value = removeAccents(String(item[column]).toLowerCase());
        return value.includes(query);
      });
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

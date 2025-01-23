import { ref, computed } from 'vue';

export const useDataTable = (store, options = {}) => {
  // Common refs
  const dataTable = ref(null);
  const toggleLoading = ref({});
  const actionLoading = ref({});
  const selectedItems = ref([]);
  const searchableColumns = ref(options.searchableColumns || []);
  const isLoading = ref(false);

  // Common computed
  const tableData = computed(() => {
    if (options.processData) {
      return options.processData(store.items);
    }
    return store.items;
  });

  // Handle selection changes
  const handleSelectionChange = (selectedIds) => {
    if (selectedIds.length === 1) {
      selectedItems.value = [store.items.find(item => item.id === selectedIds[0])];
    } else if (selectedIds.length > 1) {
      selectedItems.value = store.items.filter(item => selectedIds.includes(item.id));
    } else {
      selectedItems.value = [];
    }

    // Call custom selection handler if provided
    if (options.onSelectionChange) {
      options.onSelectionChange(selectedItems.value);
    }
  };

  // Handle toggle updates
  const handleToggleUpdate = async ({ rowIds, field, value }) => {
    try {
      // Set loading state for all affected rows
      rowIds.forEach(id => {
        toggleLoading.value[`${id}-${field}`] = true;
      });

      // Prepare updates array
      const updates = rowIds.map(id => ({
        id,
        data: { [field]: value },
      }));

      // Single API call
      await store.patchAll(updates);

      // Call custom update handler if provided
      if (options.onToggleUpdate) {
        await options.onToggleUpdate({ rowIds, field, value });
      }
    } catch (error) {
      console.error('Failed to update items:', error);
      throw error;
    } finally {
      // Clear loading state
      rowIds.forEach(id => {
        toggleLoading.value[`${id}-${field}`] = false;
      });
    }
  };

  // Handle table actions
  const handleAction = async ({ actionId, selectedIds }) => {
    actionLoading.value[actionId] = true;

    try {
      if (options.onAction) {
        await options.onAction({
          actionId,
          selectedIds,
          selectedItems: store.items.filter(item => selectedIds.includes(item.id)),
        });
      }
    } catch (error) {
      console.error('Action failed:', error);
      throw error;
    } finally {
      actionLoading.value[actionId] = false;
    }
  };

  // Clear table selection
  const clearSelection = () => {
    if (dataTable.value) {
      dataTable.value.clearSelection();
    }
    selectedItems.value = [];
  };

  return {
    // Refs
    dataTable,
    toggleLoading,
    actionLoading,
    selectedItems,
    searchableColumns,
    isLoading,

    // Computed
    tableData,

    // Methods
    handleSelectionChange,
    handleToggleUpdate,
    handleAction,
    clearSelection,
  };
};

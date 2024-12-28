// composables/useUndoHistory.js
import { ref, computed } from 'vue';

export const useUndoHistory = (options = {}) => {
  const {
    maxHistory = 50, // Maximum number of operations to store
    groupDelay = 1000, // Delay to group similar operations
  } = options;

  const history = ref([]);
  const currentIndex = ref(-1);
  let lastOperationTime = 0;
  let lastOperationType = null;

  // Computed properties for state
  const canUndo = computed(() => currentIndex.value >= 0);
  const canRedo = computed(() => currentIndex.value < history.value.length - 1);

  // Add operation to history
  const addToHistory = (operation) => {
    const now = Date.now();
    const shouldGroup =
      lastOperationType === operation.type &&
      (now - lastOperationTime) < groupDelay;

    // Update tracking variables
    lastOperationTime = now;
    lastOperationType = operation.type;

    if (shouldGroup && currentIndex.value >= 0) {
      // Group with previous operation
      const lastOperation = history.value[currentIndex.value];
      if (!lastOperation.groupedOperations) {
        lastOperation.groupedOperations = [{ ...lastOperation }];
      }
      lastOperation.groupedOperations.push(operation);
    } else {
      // Remove any redo operations
      history.value = history.value.slice(0, currentIndex.value + 1);

      // Add new operation
      history.value.push(operation);
      currentIndex.value++;

      // Limit history size
      if (history.value.length > maxHistory) {
        history.value = history.value.slice(-maxHistory);
        currentIndex.value = Math.min(currentIndex.value, maxHistory - 1);
      }
    }
  };

  // Undo last operation
  const undo = async () => {
    if (!canUndo.value) return null;

    const operation = history.value[currentIndex.value];
    currentIndex.value--;

    return operation;
  };

  // Redo last undone operation
  const redo = async () => {
    if (!canRedo.value) return null;

    currentIndex.value++;
    return history.value[currentIndex.value];
  };

  // Clear history
  const clearHistory = () => {
    history.value = [];
    currentIndex.value = -1;
    lastOperationTime = 0;
    lastOperationType = null;
  };

  // Get current history state
  const getHistory = () => ({
    operations: history.value,
    currentIndex: currentIndex.value,
  });

  return {
    addToHistory,
    undo,
    redo,
    clearHistory,
    getHistory,
    canUndo,
    canRedo,
  };
};

// composables/useUndoHistory.js
import { ref, computed } from 'vue';

export const useUndoHistory = (options = {}) => {
  const { maxHistory = 100 } = options;

  // Array of operations and current position
  const history = ref([]);
  const currentIndex = ref(-1);

  // Computed properties for state
  const canUndo = computed(() => currentIndex.value >= 0);
  const canRedo = computed(() => currentIndex.value < history.value.length - 1);

  // Add operation to history
  const addToHistory = (operation) => {
    // Remove any redo operations
    if (currentIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, currentIndex.value + 1);
    }

    // Add new operation
    history.value.push(operation);
    currentIndex.value++;

    // Limit history size
    if (history.value.length > maxHistory) {
      const overflow = history.value.length - maxHistory;
      history.value = history.value.slice(overflow);
      currentIndex.value = Math.max(currentIndex.value - overflow, -1);
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
  };

  return {
    addToHistory,
    undo,
    redo,
    clearHistory,
    canUndo,
    canRedo,
  };
};

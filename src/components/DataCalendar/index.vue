<!-- components/DataTable/index.vue -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { PhDisc, PhArrowCounterClockwise, PhArrowClockwise, PhX } from '@phosphor-icons/vue';
import CalendarHeader from './components/CalendarHeader.vue';
import CalendarBody from './components/CalendarBody.vue';
import ActionBar from './components/ActionBar.vue';
import FilterBar from './components/FilterBar.vue';
import { useTableSort } from './composables/useTableSort';
import { useTableFilter } from './composables/useTableFilter';
import { useUndoHistory } from './composables/useUndoHistory';

const props = defineProps({
  data: {
    type: Array,
    required: true,
    default: () => [],
  },
  columns: {
    type: Array,
    required: true,
    default: () => [],
    validator: (cols) => cols.every(col => col.id && col.label),
  },
  periodRange: {
    type: Object,
    required: true,
    default: () => {},
  },
  searchableColumns: {
    type: Array,
    default: () => ['name', 'userName', 'deliveryAddress', 'items', 'collectionName', 'productName'],
  },
  filters: {
    type: Array,
    default: () => [],
  },
  visibleFilters: {
    type: Boolean,
    default: false,
  },
  actions: {
    type: Array,
    default: () => [],
  },
  actionLoading: {
    type: Object,
    default: () => ({}),
  },
  toggleLoading: {
    type: Object,
    default: () => ({}),
  },
  dataLoading: {
    type: Boolean,
    default: false,
  },
  wrapperClass: {
    type: String,
    default: '',
  },
});

const emit = defineEmits([
  'selection-change',
  'toggle-update',
  'action',
]);

// Initialize undo history
const { addToHistory, undo, redo, canUndo, canRedo } = useUndoHistory({ maxHistory: 100 });

// Initialize sorting
const { sortState, toggleSort, getSortDirection, getSortIndex, sortData, clearSort } = useTableSort();

// Initialize filtering
const { searchQuery, activeFilters, hasActiveFilters, toggleFilter, clearAll, filterData, initializeFilters } = useTableFilter();

// Initialize filters
initializeFilters(props.filters);

// Selection state
const selectedRows = ref(new Set());
const hasSelection = computed(() => selectedRows.value.size > 0);
const allSelected = computed(() => selectedRows.value.size === props.data.length);

// Apply sorting and filtering
const processedData = computed(() => {
  const filteredData = filterData(props.data, props.searchableColumns);
  return sortData(filteredData);
});

// Manages row selection with shift-click support for range selection
const handleRowSelect = ({ row, shift }) => {
  if (shift && selectedRows.value.size > 0) {
    const lastSelected = [...selectedRows.value].pop();
    const startIdx = props.data.findIndex(r => r.id === lastSelected);
    const endIdx = props.data.findIndex(r => r.id === row.id);

    const [start, end] = [startIdx, endIdx].sort((a, b) => a - b);

    for (let i = start; i <= end; i++) {
      selectedRows.value.add(props.data[i].id);
    }
  } else {
    if (selectedRows.value.has(row.id)) {
      selectedRows.value.delete(row.id);
    } else {
      selectedRows.value.add(row.id);
    }
  }
  emitSelectionChange();
};

// Handles toggling between options in a toggle column
const getNextToggleValue = (currentValue, options) => {
  const availableOptions = options.filter(opt => !opt.skipWhenToggled);
  const currentIndex = availableOptions.findIndex(opt => opt.value === currentValue);
  return availableOptions[(currentIndex + 1) % availableOptions.length].value;
};

const handleToggleUpdate = async ({ row, column }) => {
  try {
    // Determine affected rows
    const rowsToUpdate = selectedRows.value.has(row.id)
      ? props.data.filter(r => selectedRows.value.has(r.id))
      : [row];

    const currentValue = row[column.field];
    const nextValue = getNextToggleValue(currentValue, column.options);

    // Store the complete previous state
    const previousState = rowsToUpdate.map(r => ({
      id: r.id,
      field: column.field,
      value: r[column.field],
    }));

    // Create the history entry before making the change
    addToHistory({
      type: 'toggle',
      description: `Toggle ${column.label} for ${rowsToUpdate.length} row(s)`,
      undo: async () => {
        // Group rows by their previous values while preserving types
        const updatesByValue = previousState.reduce((groups, state) => {
          // Use Map instead of plain object to preserve value types
          if (!groups.has(state.value)) {
            groups.set(state.value, []);
          }
          groups.get(state.value).push(state.id);
          return groups;
        }, new Map());

        // Execute one update per unique previous value
        for (const [value, rowIds] of updatesByValue.entries()) {
          await emit('toggle-update', {
            rowIds,
            field: column.field,
            value,
          });
        }
      },
      redo: async () => {
        // For redo, we can update all rows at once since they're going to the same value
        await emit('toggle-update', {
          rowIds: rowsToUpdate.map(r => r.id),
          field: column.field,
          value: nextValue,
        });
      },
    });

    // Execute the actual update
    await emit('toggle-update', {
      rowIds: rowsToUpdate.map(r => r.id),
      field: column.field,
      value: nextValue,
    });
  } catch (error) {
    console.error('Failed to update:', error);
  }
};

// Undo/Redo handlers with error handling
const handleUndo = async () => {
  try {
    const operation = await undo();
    if (operation) {
      await operation.undo();
    }
  } catch (error) {
    console.error('Failed to undo:', error);
  }
};

const handleRedo = async () => {
  try {
    const operation = await redo();
    if (operation) {
      await operation.redo();
    }
  } catch (error) {
    console.error('Failed to redo:', error);
  }
};

const selectAll = () => {
  if (allSelected.value) {
    selectedRows.value.clear();
  } else {
    processedData.value.forEach(row => selectedRows.value.add(row.id));
  }
  emitSelectionChange();
};

const clearSelection = () => {
  selectedRows.value.clear();
  emitSelectionChange();
};

// Make clearSelection available externally
defineExpose({
  clearSelection,
  addToHistory,
  toggleFilter,
  clearAll,
});

const emitSelectionChange = () => {
  emit('selection-change', [...selectedRows.value]);
};

const handleAction = (actionId) => {
  emit('action', {
    actionId,
    selectedIds: [...selectedRows.value],
  });
};

// Handle sort
const handleSort = (columnId, isMulti) => {
  toggleSort(columnId, isMulti);
};

// Handle keyboard events
const handleKeyDown = (event) => {
  if (event.key === 'Escape' && selectedRows.value.size > 0) {
    clearSelection();
  }

  // Add undo/redo keyboard shortcuts
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      handleRedo();
    } else {
      handleUndo();
    }
  }
};

// Setup keyboard event listeners
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div class="relative rounded-lg border border-neutral-200 mb-10">
    <!-- Selection and Filter controls -->
    <div class="sticky top-0 z-30 bg-neutral-50 px-4 py-0 lg:py-2 flex items-center justify-between border-b">
      <div class="flex items-center gap-4">
        <button @click="selectAll" class="button action-btn">
          {{ allSelected ? 'Ninguna' : 'Todo' }}
        </button>

        <button v-if="hasSelection" @click="clearSelection" class="button utility-btn-active">
          <span class="flex items-center gap-2"><PhX class="w-4 h-4" /> {{ selectedRows.size }} </span>
        </button>

        <template v-if="sortState.length">
          <button @click="clearSort" class="button utility-btn-active">
            <span class="flex items-center gap-2"><PhX class="w-4 h-4" /> Ord </span>
          </button>
        </template>

        <!-- Undo/Redo buttons -->

      </div>
      <div class="flex items-center gap-2 ml-2">
        <FilterBar
          :filters="filters"
          :active-filters="activeFilters"
          :has-active-filters="hasActiveFilters"
          :visible-filters="visibleFilters"
          v-model:search="searchQuery"
          @toggle-filter="toggleFilter"
          @clear-all="clearAll"
        />
        <div class="flex items-center gap-2">
          <button
            @click="handleUndo"
            :disabled="!canUndo"
            class="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:hover:bg-transparent hover:bg-neutral-100"
            title="Deshacer (Ctrl+Z)"
          >
            <PhArrowCounterClockwise class="w-5 h-5" />
          </button>
          <button
            @click="handleRedo"
            :disabled="!canRedo"
            class="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:hover:bg-transparent hover:bg-neutral-100"
            title="Rehacer (Ctrl+Shift+Z)"
          >
            <PhArrowClockwise class="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>

    <!-- Table Container -->

    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left text-neutral-700 table-fixed">
        <CalendarHeader
          :columns="columns"
          :get-sort-direction="getSortDirection"
          :get-sort-index="getSortIndex"
          @sort="handleSort"
        />
        <CalendarBody
          v-if="!dataLoading"
          :data="processedData"
          :columns="columns"
          :period-range="periodRange"
          :selected-rows="selectedRows"
          :toggle-loading="toggleLoading"
          @row-select="handleRowSelect"
          @toggle-update="handleToggleUpdate"
          :class="{ 'opacity-20': dataLoading }"
        />
      </table>
    </div>

    <!-- Loading indicator -->
    <div v-if="dataLoading || Object.values(toggleLoading).some(value => value)"
         class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-delayed-fade-in">
      <PhDisc class="animate-spin text-xl"/>
    </div>

    <!-- Action Bar -->
    <ActionBar
      :selected-count="selectedRows.size"
      :actions="actions"
      :loading="actionLoading"
      @action="handleAction"
      @clear-selection="clearSelection"
    />
  </div>
</template>

<style scoped>
/* Sticky header styles */
:deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 10;
}

/* Table styles */
table {
  border-collapse: collapse;
  border-spacing: 0;
}

/* Animation for loading indicator */
@keyframes delayedFadeIn {
  0%, 99% { opacity: 0; }
  100% { opacity: 1; }
}

.animate-delayed-fade-in {
  animation: delayedFadeIn 1s linear;
}
</style>

<!-- components/DataTable/index.vue -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { PhDisc } from '@phosphor-icons/vue';
import TableHeader from './components/TableHeader.vue';
import TableBody from './components/TableBody.vue';
import ActionBar from './components/ActionBar.vue';
import FilterBar from './components/FilterBar.vue';
import { useTableSort } from './composables/useTableSort';
import { useTableFilter } from './composables/useTableFilter';

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
  searchableColumns: {
    type: Array,
    default: () => ['name', 'userName'],
  },
  filters: {
    type: Array,
    default: () => [],
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
    // Handle range selection
    const lastSelected = [...selectedRows.value].pop();
    const startIdx = props.data.findIndex(r => r.id === lastSelected);
    const endIdx = props.data.findIndex(r => r.id === row.id);

    const [start, end] = [startIdx, endIdx].sort((a, b) => a - b);

    for (let i = start; i <= end; i++) {
      selectedRows.value.add(props.data[i].id);
    }
  } else {
    // Toggle single selection
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
  const currentIndex = options.findIndex(opt => opt.value === currentValue);
  return options[(currentIndex + 1) % options.length].value;
};

// Handles updating the state of toggle columns
const handleToggleUpdate = ({ row, column }) => {
  const rowsToUpdate = selectedRows.value.has(row.id)
    ? props.data.filter(r => selectedRows.value.has(r.id))
    : [row];

  const currentValue = row[column.field];
  const nextValue = getNextToggleValue(currentValue, column.options);

  emit('toggle-update', {
    rowIds: rowsToUpdate.map(r => r.id),
    field: column.field,
    value: nextValue,
  });
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
};

// Setup keyboard event listeners
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>
<!-- components/DataTable/index.vue -->
<template>
  <div class="relative rounded-lg border border-neutral-200">
    <!-- Selection and Filter controls -->
    <div class="sticky top-0 z-30 bg-neutral-50 px-4 py-0 lg:py-2 flex items-center justify-between border-b">
      <div class="flex items-center gap-4">
        <button @click="selectAll" class="button action-btn">
          {{ allSelected ? 'Ninguna' : 'Todo' }}
        </button>

        <button v-if="hasSelection" @click="clearSelection" class="button utility-btn-active">
          Limpiar selección {{ selectedRows.size }}
        </button>

        <template v-if="sortState.length">
          <button @click="clearSort" class="button utility-btn-active">
            limpiar order
          </button>
        </template>
      </div>

      <FilterBar
        :filters="filters"
        :active-filters="activeFilters"
        :has-active-filters="hasActiveFilters"
        v-model:search="searchQuery"
        @toggle-filter="toggleFilter"
        @clear-all="clearAll"
      />
    </div>

    <!-- Table Container -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left text-neutral-700">
        <TableHeader
          :columns="columns"
          :get-sort-direction="getSortDirection"
          :get-sort-index="getSortIndex"
          @sort="handleSort"
        />
        <TableBody
          :data="processedData"
          :columns="columns"
          :selected-rows="selectedRows"
          :toggle-loading="toggleLoading"
          @row-select="handleRowSelect"
          @toggle-update="handleToggleUpdate"
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

:deep(th),
:deep(td) {
  border-bottom: 1px solid #e5e7eb;
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

<!-- components/DataTable/index.vue -->
<script setup>
import { ref, computed } from 'vue';
import TableHeader from './components/TableHeader.vue';
import TableBody from './components/TableBody.vue';
import ActionBar from './components/ActionBar.vue';
import { useTableSort } from './composables/useTableSort';

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
  actions: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Object,
    default: () => ({}),
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
const {
  sortState,
  toggleSort,
  getSortDirection,
  getSortIndex,
  sortData,
  clearSort,
} = useTableSort();

// Selection state
const selectedRows = ref(new Set());

// Computed
const hasSelection = computed(() => selectedRows.value.size > 0);
const allSelected = computed(() => selectedRows.value.size === props.data.length);
const sortedData = computed(() => sortData(props.data));

// Selection handlers
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
    sortedData.value.forEach(row => selectedRows.value.add(row.id));
  }
  emitSelectionChange();
};

const clearSelection = () => {
  selectedRows.value.clear();
  emitSelectionChange();
};

const emitSelectionChange = () => {
  emit('selection-change', [...selectedRows.value]);
};

const handleAction = (actionId) => {
  emit('action', {
    actionId,
    selectedIds: [...selectedRows.value],
  });
};

// Helper to get next value in toggle sequence
const getNextToggleValue = (currentValue, options) => {
  const currentIndex = options.indexOf(currentValue);
  return options[(currentIndex + 1) % options.length];
};

// Handle sort
const handleSort = (columnId, isMulti) => {
  toggleSort(columnId, isMulti);
};
</script>

<template>
  <div :class="['relative overflow-x-auto shadow-md rounded-lg', wrapperClass]">
    <!-- Selection controls -->
    <div
      class="bg-neutral-50 px-4 py-2 flex items-center justify-between border-b"
    >
      <div class="flex items-center gap-4">
        <button
          @click="selectAll"
          class="text-sm font-medium text-neutral-700 hover:text-neutral-900"
        >
          {{ allSelected ? 'Deselect All' : 'Select All' }}
        </button>

        <button
          v-if="hasSelection"
          @click="clearSelection"
          class="text-sm font-medium text-neutral-700 hover:text-neutral-900"
        >
          Clear Selection
        </button>
      </div>

      <!-- Sort info -->
      <div v-if="sortState.length" class="flex items-center gap-2">
        <span class="text-sm text-neutral-600">Sorted by:</span>
        <div class="flex items-center gap-1">
          <span
            v-for="(sort, index) in sortState"
            :key="sort.columnId"
            class="text-sm"
          >
            {{ columns.find(col => col.id === sort.columnId)?.label }}
            ({{ sort.direction }})
            <span v-if="index < sortState.length - 1">,</span>
          </span>
        </div>
        <button
          @click="clearSort"
          class="text-sm text-primary-600 hover:text-primary-700 ml-2"
        >
          Clear sort
        </button>
      </div>
    </div>

    <table class="w-full text-sm text-left text-neutral-700">
      <TableHeader
        :columns="columns"
        :get-sort-direction="getSortDirection"
        :get-sort-index="getSortIndex"
        @sort="handleSort"
      />

      <TableBody
        :data="sortedData"
        :columns="columns"
        :selected-rows="selectedRows"
        @row-select="handleRowSelect"
        @toggle-update="handleToggleUpdate"
      />
    </table>

    <!-- Action Bar -->
    <ActionBar
      :selected-count="selectedRows.size"
      :actions="actions"
      :loading="loading"
      @action="handleAction"
    />
  </div>
</template>

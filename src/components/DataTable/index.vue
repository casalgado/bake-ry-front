<script setup>
import { ref, computed, watch } from 'vue';
import TableHeader from './components/TableHeader.vue';
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
  wrapperClass: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['row-click', 'sort-change']);

// Initialize sorting
const {
  sortState,
  toggleSort,
  getSortDirection,
  getSortIndex,
  sortData,
  clearSort,
} = useTableSort();

// Watch sort changes
watch(sortState, (newSort) => {
  emit('sort-change', newSort);
});

// Computed sorted data
const sortedData = computed(() => {
  return sortData(props.data);
});

const isEmpty = computed(() => props.data.length === 0);

const handleRowClick = (row, index) => {
  emit('row-click', { row, index });
};

const handleSort = (columnId, isMulti) => {
  toggleSort(columnId, isMulti);
};

const getCellValue = (row, column) => {
  return row[column.field];
};
</script>

<template>
  <div :class="['relative overflow-x-auto shadow-md rounded-lg', wrapperClass]">
    <div v-if="sortState.length" class="px-6 py-2 bg-neutral-50 border-b text-sm">
      <span class="text-neutral-600">Sorted by:</span>
      <span
        v-for="(sort, index) in sortState"
        :key="sort.columnId"
        class="ml-2"
      >
        {{ columns.find(col => col.id === sort.columnId)?.label }}
        ({{ sort.direction }}){{ index < sortState.length - 1 ? ',' : '' }}
      </span>
      <button
        @click="clearSort"
        class="ml-4 text-primary-600 hover:text-primary-700 text-sm"
      >
        Clear sort
      </button>
    </div>

    <table class="w-full text-sm text-left text-neutral-700">
      <TableHeader
        :columns="columns"
        :get-sort-direction="getSortDirection"
        :get-sort-index="getSortIndex"
        @sort="handleSort"
      />

      <tbody>
        <template v-if="!isEmpty">
          <tr
            v-for="(row, index) in sortedData"
            :key="index"
            @click="handleRowClick(row, index)"
            class="bg-white border-b hover:bg-neutral-50 cursor-pointer"
          >
            <td
              v-for="column in columns"
              :key="column.id"
              class="px-6 py-4"
            >
              {{ getCellValue(row, column) }}
            </td>
          </tr>
        </template>
        <tr v-else>
          <td
            :colspan="columns.length"
            class="px-6 py-4 text-center text-neutral-500"
          >
            No data available
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

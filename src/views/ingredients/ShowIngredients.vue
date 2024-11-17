<script setup>
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/vue-table';
import { useIngredientStore } from '@/stores/ingredientStore';
import { onMounted, ref, computed } from 'vue';

const ingredientStore = useIngredientStore();
const sorting = ref([]);
const table = ref(null);

// Create a computed property for the data to ensure reactivity
const tableData = computed(() => ingredientStore.items);

const columns = [
  {
    accessorKey: 'name',
    header: 'Name',
    sortingFn: 'text',
  },
  {
    accessorKey: 'category',
    header: 'Category',
    sortingFn: 'text',
  },
  {
    accessorKey: 'unit',
    header: 'Unit',
    sortingFn: 'text',
  },
  {
    accessorKey: 'costPerUnit',
    header: 'Cost per Unit',
    sortingFn: 'basic',
    cell: props => new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(props.getValue()),
  },
  {
    accessorKey: 'storageTemp',
    header: 'Temperature',
    sortingFn: 'text',
  },
  {
    accessorKey: 'usedInRecipes',
    header: 'Used In',
    enableSorting: false,
    cell: props => props.getValue()?.length || 0,
  },
];

const handleSort = (header, event) => {
  if (header.column.getCanSort()) {
    // Pass true as second argument when shift is pressed to enable multi-sort
    header.column.toggleSorting(undefined, event.shiftKey);
  }
};

const clearSort = () => {
  sorting.value = [];
  initTable();
};

const initTable = () => {
  table.value = useVueTable({
    data: tableData.value,
    columns,
    state: {
      sorting: sorting.value,
    },
    onSortingChange: updater => {
      if (typeof updater === 'function') {
        sorting.value = updater(sorting.value);
      } else {
        sorting.value = updater;
      }
      initTable();
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    maxMultiSortColCount: 3,
    isMultiSortEvent: (e) => e.shiftKey,
  });
};

onMounted(async () => {
  await ingredientStore.fetchAll();
  initTable();
});
</script>

<template>
  <div>
    <div v-if="ingredientStore.loading">
      Loading...
    </div>

    <div v-if="ingredientStore.error">
      {{ ingredientStore.error }}
    </div>

    <div v-if="!ingredientStore.loading && tableData.length && table">
      <!-- Sorting information and controls -->
      <div class="mb-4">
        <button
          v-if="sorting.length"
          @click="clearSort"
          class="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
        >
          Clear Sorting
        </button>
        <div v-if="sorting.length" class="text-sm text-gray-500 mt-1">
          <span>Current sort: </span>
          <span v-for="(sort, index) in sorting" :key="sort.id">
            {{ sort.id }}{{ sort.desc ? ' (desc)' : ' (asc)' }}
            {{ index < sorting.length - 1 ? ',' : '' }}
          </span>
        </div>
        <div v-if="!sorting.length" class="text-sm text-gray-500">
          Click column headers to sort. Hold Shift to sort by multiple columns.
        </div>
      </div>

      <!-- Table -->
      <table>
        <thead>
          <tr>
            <th
              v-for="header in table.getHeaderGroups()[0].headers"
              :key="header.id"
              @click="(e) => handleSort(header, e)"
              :style="{
                cursor: header.column.getCanSort() ? 'pointer' : 'default',
                userSelect: 'none'
              }"
            >
              <div class="flex items-center gap-1">
                {{ header.column.columnDef.header }}
                <span
                  v-if="header.column.getCanSort()"
                  title="Hold Shift to sort by multiple columns"
                >
                  {{ !header.column.getIsSorted()
                    ? ' ↕️'
                    : header.column.getIsSorted() === 'desc'
                      ? ' 🔽'
                      : ' 🔼'
                  }}
                </span>
                <span
                  v-if="header.column.getSortIndex() > -1"
                  class="text-xs bg-blue-100 px-1 rounded"
                >
                  {{ header.column.getSortIndex() + 1 }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in table.getRowModel().rows" :key="row.id">
            <td v-for="cell in row.getVisibleCells()" :key="cell.id">
              {{ cell.getValue() }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!ingredientStore.loading && !tableData.length">
      No ingredients found
    </div>
  </div>
</template>

<script setup>
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/vue-table';
import { useIngredientStore } from '@/stores/ingredientStore';
import { onMounted, ref, computed, watch, h } from 'vue';

const ingredientStore = useIngredientStore();
const sorting = ref([]);
const rowSelection = ref({});
const table = ref(null);

// Create a computed property for the data to ensure reactivity
const tableData = computed(() => ingredientStore.items);

const columns = [
  {
    id: 'select',
    header: 'Select',
    cell: ({ row }) => (
      h('input', {
        type: 'checkbox',
        checked: row.getIsSelected(),
        onChange: (e) => {
          row.toggleSelected();
        },
      })
    ),
  },
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
  console.log('header', header);
  if (header.column.getCanSort()) {
    console.log('header', header);
    const newSortingState = header.column.getToggleSortingHandler()(event);
    if (newSortingState !== undefined) {
      sorting.value = newSortingState;
    }
  }
};

const clearSort = () => {
  sorting.value = [];
};

const clearSelection = () => {
  rowSelection.value = {};
};

// Watch for changes in table data and reset table instance
watch(tableData, () => {
  initTable();
}, { deep: true });

// Watch for changes in sorting and selection to reinitialize table
watch([sorting, rowSelection], () => {
  initTable();
}, { deep: true });

const initTable = () => {
  table.value = useVueTable({
    data: tableData.value,
    columns,
    state: {
      sorting: sorting.value,
      rowSelection: rowSelection.value,
    },
    onSortingChange: (updater) => {
      sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater;
    },
    onRowSelectionChange: (updater) => {
      rowSelection.value = typeof updater === 'function' ? updater(rowSelection.value) : updater;
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    maxMultiSortColCount: 3,
    isMultiSortEvent: (e) => e.shiftKey,
    enableRowSelection: true,
    enableMultiRowSelection: true,
    getRowId: (row) => row.id,
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
      <!-- Controls -->
      <div class="mb-4">
        <div>
          <button
            v-if="Object.keys(rowSelection).length"
            @click="clearSelection"
          >
            Clear Selection ({{ table.getSelectedRowModel().rows.length }} selected)
          </button>
          <button v-else>
            Select rows by clicking on the name
          </button>
          <button
            v-if="sorting.length"
            @click="clearSort"
          >
            Clear Sorting
          </button>
        </div>
        <div v-if="sorting.length">
          <span>Current sort: </span>
          <span v-for="(sort, index) in sorting" :key="sort.id">
            {{ sort.id }}{{ sort.desc ? ' (desc)' : ' (asc)' }}
            {{ index < sorting.length - 1 ? ',' : '' }}
          </span>
        </div>
        <div v-if="!sorting.length">
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
                <template v-if="header.column.id === 'select'">
                  <input
                    type="checkbox"
                    :checked="table.getIsAllRowsSelected()"
                    :indeterminate="table.getIsSomeRowsSelected()"
                    @change="table.toggleAllRowsSelected()"
                  />
                </template>
                <template v-else>
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
                </template>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
          >
            <td v-for="cell in row.getVisibleCells()" :key="cell.id">
              <template v-if="cell.column.id === 'select'">
                <input
                  type="checkbox"
                  :checked="row.getIsSelected()"
                  @change="row.toggleSelected()"
                />
              </template>
              <!-- Clickable span for 'name' column -->
              <template v-else-if="cell.column.id === 'name'">
                <span
                  @click="row.toggleSelected()"
                  class="cursor-pointer"
                >
                  {{ cell.getValue() }}
                </span>
              </template>
              <template v-else>
                {{ cell.getValue() }}
              </template>
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

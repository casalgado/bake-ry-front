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

onMounted(async () => {
  await ingredientStore.fetchAll();
  initTable();
});

// Separate function to initialize table
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
      // Re-initialize table with new sorting
      initTable();
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    maxMultiSortColCount: 3,
  });
};
</script>

<template>
  <div>
    <div v-if="ingredientStore.loading">
      Loading...
    </div>

    <div v-if="ingredientStore.error">
      {{ ingredientStore.error }}
    </div>

    <table v-if="!ingredientStore.loading && tableData.length && table">
      <thead>
        <tr>
          <th
            v-for="header in table.getHeaderGroups()[0].headers"
            :key="header.id"
            @click="header.column.getCanSort() && header.column.toggleSorting()"
            :style="{
              cursor: header.column.getCanSort() ? 'pointer' : 'default',
              userSelect: 'none'
            }"
          >
            <div class="flex items-center gap-1">
              {{ header.column.columnDef.header }}
              <span v-if="header.column.getCanSort()">
                {{ !header.column.getIsSorted()
                  ? ' ↕️'
                  : header.column.getIsSorted() === 'desc'
                    ? ' 🔽'
                    : ' 🔼'
                }}
              </span>
              <span v-if="header.column.getSortIndex() > -1">
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

    <div v-if="!ingredientStore.loading && !tableData.length">
      No ingredients found
    </div>

    <pre v-if="sorting.length">
      Current Sort: {{ sorting }}
    </pre>
  </div>
</template>

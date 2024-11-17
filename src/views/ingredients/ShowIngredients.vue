<script setup>
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/vue-table';
import { useIngredientStore } from '@/stores/ingredientStore';
import { onMounted, ref } from 'vue';

// Initialize store
const ingredientStore = useIngredientStore();

// Initialize sorting state
const sorting = ref([]);

// Define columns with sorting configuration
const columns = [
  {
    accessorKey: 'name',
    header: 'Name',
    sortingFn: 'text', // Basic text sorting
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
    sortingFn: 'basic', // Basic numeric sorting
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
    enableSorting: false, // Disable sorting for this column
    cell: props => props.getValue()?.length || 0,
  },
];

// Initialize table with sorting configuration
const table = useVueTable({
  get data() {
    return ingredientStore.items;
  },
  columns,
  state: {
    sorting: sorting.value,
  },
  onSortingChange: updater => {
    sorting.value = updater(sorting.value);
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  // Optional: configure multi-sort behavior
  enableMultiSort: true,
  maxMultiSortColCount: 3, // Max number of columns that can be sorted simultaneously
});

// Fetch data on mount
onMounted(async () => {
  await ingredientStore.fetchAll();
});
</script>

<template>
  <div>
    <!-- Loading state -->
    <div v-if="ingredientStore.loading">
      Loading...
    </div>

    <!-- Error state -->
    <div v-if="ingredientStore.error">
      {{ ingredientStore.error }}
    </div>

    <!-- Table -->
    <table v-if="!ingredientStore.loading && ingredientStore.items.length">
      <thead>
        <tr>
          <th
            v-for="header in table.getHeaderGroups()[0].headers"
            :key="header.id"
            @click="header.column.getCanSort() && header.column.toggleSorting()"
            :style="{
              cursor: header.column.getCanSort() ? 'pointer' : 'default',
              userSelect: 'none' // Prevent text selection when clicking
            }"
          >
            <!-- Header content with sort indicators -->
            <div class="flex items-center gap-1">
              {{ header.column.columnDef.header }}

              <!-- Sort indicator -->
              <span v-if="header.column.getCanSort()">
                {{ !header.column.getIsSorted()
                  ? ' ↕️'
                  : header.column.getIsSorted() === 'desc'
                    ? ' 🔽'
                    : ' 🔼'
                }}
              </span>

              <!-- Multi-sort index indicator -->
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

    <!-- Empty state -->
    <div v-if="!ingredientStore.loading && !ingredientStore.items.length">
      No ingredients found
    </div>

    <!-- Debug: Show current sorting state -->
    <pre v-if="sorting.length">
      Current Sort: {{ sorting }}
    </pre>
  </div>
</template>

<script setup>
import { useVueTable, getCoreRowModel } from '@tanstack/vue-table';
import { useIngredientStore } from '@/stores/ingredientStore';
import { onMounted } from 'vue';

// Initialize store
const ingredientStore = useIngredientStore();

// Define basic columns
const columns = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'category',
    header: 'Category',
  },
  {
    accessorKey: 'unit',
    header: 'Unit',
  },
  {
    accessorKey: 'costPerUnit',
    header: 'Cost per Unit',
    cell: props => new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(props.getValue()),
  },
  {
    accessorKey: 'storageTemp',
    header: 'Temperature',
  },
];

// Initialize table
const table = useVueTable({
  get data() {
    return ingredientStore.items;
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
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
          <th v-for="column in table.getHeaderGroups()[0].headers"
              :key="column.id">
            {{ column.column.columnDef.header }}
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
  </div>
</template>

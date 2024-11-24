<script setup>
import { onMounted, ref, computed } from 'vue';
import { useIngredientStore } from '@/stores/ingredientStore';
import DataTable from '@/components/DataTable/index.vue';

const ingredientStore = useIngredientStore();
const tableData = computed(() => ingredientStore.items);

// Column definitions updated to match our new format
const columns = [
  {
    id: 'name',
    label: 'Name',
    field: 'name',
    sortable: true,
  },
  {
    id: 'categoryName',
    label: 'Category',
    field: 'categoryName',
    sortable: true,
  },
  {
    id: 'unit',
    label: 'Unit',
    field: 'unit',
    sortable: true,
  },
  {
    id: 'costPerUnit',
    label: 'Cost per Unit',
    field: 'costPerUnit',
    sortable: true,
    // We'll implement custom renderers later
    customRender: (value) => new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value),
  },
  {
    id: 'storageTemp',
    label: 'Temperature',
    field: 'storageTemp',
    type: 'toggle',
    options: ['Refrigeracion', 'Ambiente'],
    sortable: true,
  },
  {
    id: 'usedInRecipes',
    label: 'Used In',
    field: 'usedInRecipes',
    sortable: false,
    // We'll implement custom renderers later
    customRender: (value) => value?.length || 0,
  },
];

const handleRowClick = ({ row, index }) => {
  console.log('Row clicked:', row);
  // We'll implement selection logic later
};

onMounted(async () => {
  await ingredientStore.fetchAll();
});
</script>

<template>
  <div class="container p-4">
    <!-- Loading State -->
    <div v-if="ingredientStore.loading" class="text-neutral-600 text-center py-4">
      Loading...
    </div>

    <!-- Error State -->
    <div
      v-if="ingredientStore.error"
      class="text-danger text-center py-4"
    >
      {{ ingredientStore.error }}
    </div>

    <!-- Table -->
    <div v-if="!ingredientStore.loading">
      <DataTable
        :data="tableData"
        :columns="columns"
        @row-click="handleRowClick"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
    <pre>{{ JSON.stringify(tableData, null, 2) }}</pre>
  </div>
</template>

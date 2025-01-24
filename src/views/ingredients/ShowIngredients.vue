<script setup>
import { onMounted, ref, computed } from 'vue';
import { useIngredientStore } from '@/stores/ingredientStore';
import DataTable from '@carsalhaz/vue-data-table';
import { PhPen, PhExport } from '@phosphor-icons/vue';

const ingredientStore = useIngredientStore();
const tableData = computed(() => ingredientStore.items);
const actionLoading = ref({});

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
    customRender: (value) => value?.length || 0,
  },
];

// Table actions
const tableActions = [
  {
    id: 'edit',
    label: 'Edit',
    icon: PhPen,
    minSelected: 1,
    maxSelected: 1,
    variant: 'secondary',
  },
  {
    id: 'PhExport',
    label: 'PhExport Selected',
    icon: PhExport,
    minSelected: 2, // Only for multiple selection
    variant: 'primary',
  },
];

// Handle selection change
const handleSelectionChange = (selectedIds) => {
  console.log('Selection changed:', selectedIds);
};

// Handle toggle update
const handleToggleUpdate = ({ rowIds, field, value }) => {
  console.log('Toggle update:', { rowIds, field, value });
};

// Handle actions
const handleAction = ({ actionId, selectedIds }) => {
  console.log('Action triggered:', actionId, 'for rows:', selectedIds);
};

onMounted(async () => {
  await ingredientStore.fetchAll();
});
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
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
        :actions="tableActions"
        :loading="actionLoading"
        @selection-change="handleSelectionChange"
        @toggle-update="handleToggleUpdate"
        @action="handleAction"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

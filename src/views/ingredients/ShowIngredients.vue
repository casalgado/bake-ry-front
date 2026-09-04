<script setup>
/* Read-only for now. Creating and editing went out with IngredientForm.vue on
 * 2026-09-01 — it could never submit (see the note in that file). The list, the
 * filters and delete all work and are worth keeping; create an ingredient from
 * RecipeBookView.vue's despensa until the form is rebuilt. */

// Vue
import { ref, computed } from 'vue';

// DataTable
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';

// Components
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ToastNotification from '@/components/ToastNotification.vue';

// Stores
import { useIngredientStore } from '@/stores/ingredientStore';

// Icons
import { PhTrash } from '@phosphor-icons/vue';

const ingredientStore = useIngredientStore();

const isConfirmOpen = ref(false);
const ingredientToDelete = ref(null);
const toastRef = ref(null);

// Values the table displays but the model doesn't store.
const processData = (ingredients) =>
  ingredients.map((ingredient) => ({
    ...ingredient,
    typeLabel: ingredient.isResale ? 'Reventa' : 'Producción',
    recipeCount: ingredient.usedInRecipes?.length || 0,
  }));

const {
  dataTable,
  actionLoading,
  searchableColumns,
  isLoading,
  tableData,
  handleSelectionChange,
  handleAction,
  clearSelection,
} = useDataTable(ingredientStore, {
  searchableColumns: ['name', 'categoryName'],
  processData,
  async onAction({ actionId, selectedItems: selected }) {
    if (actionId === 'delete') {
      ingredientToDelete.value = selected[0];
      isConfirmOpen.value = true;
    }
  },
});

const columns = computed(() => [
  {
    id: 'name',
    label: 'Nombre',
    field: 'name',
    sortable: true,
  },
  {
    id: 'categoryName',
    label: 'Categoría',
    field: 'categoryName',
    sortable: true,
  },
  {
    id: 'type',
    label: 'Tipo',
    field: 'typeLabel',
    sortable: true,
  },
  {
    id: 'unit',
    label: 'Unidad',
    field: 'unit',
    sortable: true,
  },
  {
    id: 'costPerUnit',
    label: 'Costo x Unidad',
    field: 'costPerUnit',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.costPerUnit,
    }),
  },
  {
    id: 'storageTemp',
    label: 'Almacenamiento',
    field: 'storageTemp',
    sortable: true,
  },
  {
    id: 'usedInRecipes',
    label: 'En recetas',
    field: 'recipeCount',
    sortable: true,
  },
]);

const uniqueCategories = computed(() => [
  ...new Set(ingredientStore.items.map((item) => item.categoryName).filter(Boolean)),
]);

const tableFilters = computed(() => [
  {
    field: 'categoryName',
    options: uniqueCategories.value.map((category) => ({
      label: category,
      value: category,
    })),
  },
  {
    field: 'storageTemp',
    options: [
      { label: 'ambiente', value: 'Ambiente' },
      { label: 'refrigeración', value: 'Refrigeracion' },
      { label: 'congelación', value: 'Congelacion' },
    ],
  },
]);

const tableActions = [
  {
    id: 'delete',
    label: 'Eliminar',
    icon: PhTrash,
    minSelected: 1,
    maxSelected: 1,
    variant: 'danger',
  },
];

const closeDialog = () => {
  isConfirmOpen.value = false;
  ingredientToDelete.value = null;
  clearSelection();
};

const handleConfirmDelete = async () => {
  try {
    await ingredientStore.remove(ingredientToDelete.value.id);
    toastRef.value?.showSuccess('Ingrediente eliminado');
    closeDialog();
  } catch (error) {
    // The backend refuses to delete an ingredient that recipes still use, and
    // names them — the service's handleError already unwraps that into
    // error.message, so surface it rather than a generic failure.
    console.error('Failed to delete ingredient:', error);
    toastRef.value?.showError(
      'No se pudo eliminar',
      error.message || 'Intenta nuevamente',
    );
    isConfirmOpen.value = false;
    ingredientToDelete.value = null;
  }
};
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex justify-between items-center mb-1">
      <h2 class="text-2xl font-bold mb-0">Ingredientes</h2>
    </div>

    <!-- Error State -->
    <div v-if="ingredientStore.error" class="text-danger text-center py-4">
      {{ ingredientStore.error }}
    </div>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog
      :is-open="isConfirmOpen"
      title="Eliminar Ingrediente"
      message="¿Estás seguro de querer eliminar este ingrediente?"
      confirm-text="Eliminar"
      cancel-text="Cancelar"
      :loading="ingredientStore.loading"
      @confirm="handleConfirmDelete"
      @cancel="closeDialog"
    />

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :data="tableData"
        :columns="columns"
        :searchable-columns="searchableColumns"
        :filters="tableFilters"
        :actions="tableActions"
        :action-loading="actionLoading"
        :data-loading="ingredientStore.loading || isLoading"
        @selection-change="handleSelectionChange"
        @action="handleAction"
        :wrapper-class="`bg-white shadow-lg rounded-lg`"
      />
    </div>

    <ToastNotification ref="toastRef" />
  </div>
</template>

<style scoped lang="scss">
* {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

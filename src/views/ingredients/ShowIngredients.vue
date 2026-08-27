<script setup>
// Vue & Router
import { ref, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useRouter } from 'vue-router';

// DataTable
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';

// Components
import IngredientForm from '@/components/forms/IngredientForm.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ToastNotification from '@/components/ToastNotification.vue';

// Stores
import { useIngredientStore } from '@/stores/ingredientStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

// Icons
import { PhPen, PhTrash } from '@phosphor-icons/vue';

const router = useRouter();
const ingredientStore = useIngredientStore();
const settingsStore = useBakerySettingsStore();

const isFormOpen = ref(false);
const isConfirmOpen = ref(false);
const ingredientToDelete = ref(null);
const toastRef = ref(null);

// Values the table displays but the model doesn't store.
const processData = (ingredients) =>
  ingredients.map((ingredient) => ({
    ...ingredient,
    typeLabel: ingredient.type === 'resale' ? 'Reventa' : 'Fabricado',
    recipeCount: ingredient.usedInRecipes?.length || 0,
  }));

const {
  dataTable,
  actionLoading,
  selectedItems,
  searchableColumns,
  isLoading,
  tableData,
  handleSelectionChange,
  handleAction,
  clearSelection,
} = useDataTable(ingredientStore, {
  searchableColumns: ['name', 'categoryName'],
  processData,
  async onBeforeFetch() {
    // The form's category list comes from bakery settings.
    if (!settingsStore.items.length) await settingsStore.fetchById('default');
  },
  async onAction({ actionId, selectedItems: selected }) {
    const ingredient = selected[0];

    switch (actionId) {
    case 'edit':
      isFormOpen.value = true;
      break;
    case 'delete':
      ingredientToDelete.value = ingredient;
      isConfirmOpen.value = true;
      break;
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
    id: 'edit',
    label: 'Editar',
    icon: PhPen,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
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
  isFormOpen.value = false;
  isConfirmOpen.value = false;
  ingredientToDelete.value = null;
  clearSelection();
};

const handleSubmit = async (formData) => {
  try {
    await ingredientStore.update(selectedItems.value[0].id, formData);
    toastRef.value?.showSuccess('Ingrediente actualizado correctamente');
    closeDialog();
  } catch (error) {
    console.error('Failed to update ingredient:', error);
    toastRef.value?.showError(
      'Error al actualizar el ingrediente',
      error.message || 'Intenta nuevamente',
    );
  }
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

const navigateToCreate = () => {
  router.push('/dashboard/ingredients/create');
};
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex justify-between items-center mb-1">
      <h2 class="text-2xl font-bold mb-0">Ingredientes</h2>
      <button class="action-btn" @click="navigateToCreate">
        Crear Ingrediente
      </button>
    </div>

    <!-- Error State -->
    <div v-if="ingredientStore.error" class="text-danger text-center py-4">
      {{ ingredientStore.error }}
    </div>

    <!-- Edit Form Dialog -->
    <Dialog :open="isFormOpen" @close="closeDialog" class="relative z-50 form-container">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <h3 class="text-xl font-bold mb-4">Editar Ingrediente</h3>
          <IngredientForm
            v-if="isFormOpen && selectedItems[0]"
            :key="selectedItems[0].id"
            :initial-data="selectedItems[0]"
            :loading="ingredientStore.loading"
            class="w-full"
            @submit="handleSubmit"
            @cancel="closeDialog"
          />
        </DialogPanel>
      </div>
    </Dialog>

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

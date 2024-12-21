<script setup>
import { ref, onMounted } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import DataTable from '@/components/DataTable/index.vue';
import { PhPen, PhTrash } from '@phosphor-icons/vue';
import ProductCollectionForm from '@/components/forms/ProductCollectionForm.vue';

const productCollectionStore = useProductCollectionStore();
const isFormOpen = ref(false);
const selectedCollection = ref(null);
const actionLoading = ref({});
const dataTable = ref(null);

onMounted(async () => {
  await productCollectionStore.fetchAll();
});

const columns = [
  {
    id: 'name',
    label: 'Nombre',
    field: 'name',
    sortable: true,
  },
  {
    id: 'description',
    label: 'Descripción',
    field: 'description',
    sortable: true,
  },
];

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

const handleAction = async ({ actionId, selectedIds }) => {
  actionLoading.value[actionId] = true;

  try {
    if (actionId === 'edit') {
      selectedCollection.value = productCollectionStore.items.find(
        collection => collection.id === selectedIds[0],
      );
      isFormOpen.value = true;
    } else if (actionId === 'delete') {
      if (window.confirm('¿Estás seguro de querer eliminar esta colección?')) {
        selectedCollection.value = productCollectionStore.items.find(
          collection => collection.id === selectedIds[0],
        );
        await productCollectionStore.remove(selectedCollection.value.id);
        dataTable.value?.clearSelection();
      }
    }
  } catch (error) {
    console.error('Action failed:', error);
  } finally {
    actionLoading.value[actionId] = false;
  }
};

const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedCollection.value = productCollectionStore.items.find(
      collection => collection.id === selectedIds[0],
    );
  } else {
    selectedCollection.value = null;
  }
};

const handleSubmit = async (formData) => {
  try {
    if (selectedCollection.value) {
      await productCollectionStore.update(selectedCollection.value.id, formData);
    }
    isFormOpen.value = false;
    selectedCollection.value = null;
  } catch (error) {
    console.error('Failed to update collection:', error);
  }
};

const handleCancel = () => {
  isFormOpen.value = false;
  selectedCollection.value = null;
};
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <h2 class="text-2xl font-bold mb-4 text-neutral-800">Colecciones</h2>

    <!-- Loading State -->
    <div
      v-if="productCollectionStore.loading"
      class="text-neutral-600 text-center py-4"
    >
      Cargando colecciones...
    </div>

    <!-- Error State -->
    <div
      v-if="productCollectionStore.error"
      class="text-danger text-center py-4"
    >
      {{ productCollectionStore.error }}
    </div>

    <!-- Edit Form Dialog -->
    <Dialog
      :open="isFormOpen"
      @close="handleCancel"
      class="relative z-50"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <!-- Full-screen container -->
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h3 class="text-xl font-bold mb-4 text-neutral-800">Edit Collection</h3>
          <ProductCollectionForm
            v-if="selectedCollection"
            :key="selectedCollection.id"
            :initial-data="selectedCollection"
            :loading="productCollectionStore.loading"
            class="w-full"
            @submit="handleSubmit"
            @cancel="handleCancel"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Table -->
    <div v-if="!productCollectionStore.loading">
      <DataTable
        ref="dataTable"
        :data="productCollectionStore.items"
        :columns="columns"
        :actions="tableActions"
        :action-loading="actionLoading"
        @selection-change="handleSelectionChange"
        @action="handleAction"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
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

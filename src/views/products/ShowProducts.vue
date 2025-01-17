<script setup>
import { ref, onMounted, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useProductStore } from '@/stores/productStore';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useRouter } from 'vue-router';
import ProductForm from '@/components/forms/ProductForm.vue';
import DataTable from '@/components/DataTable/index.vue';
import VariationsCell from '@/components/DataTable/renderers/VariationsCell.vue';
import CheckboxCell from '@/components/DataTable/renderers/CheckboxCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import { PhPen, PhTrash } from '@phosphor-icons/vue';

const router = useRouter();
const productStore = useProductStore();
const productCollectionStore = useProductCollectionStore();
const isFormOpen = ref(false);
const selectedProduct = ref(null);
const searchQuery = ref('');
const selectedCollection = ref('');
const actionLoading = ref({});
const dataTable = ref(null);

onMounted(async () => {
  await productStore.fetchAll();
  await productCollectionStore.fetchAll();
});

const tableData = computed(() => {
  return productStore.items.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.value.toLowerCase());

    const matchesCollection =
      !selectedCollection.value || product.collectionId === selectedCollection.value;

    return matchesSearch && matchesCollection;
  });
});

const columns = [
  {
    id: 'collectionName',
    label: 'Collection',
    field: 'collectionName',
    sortable: true,
  },
  {
    id: 'name',
    label: 'Name',
    field: 'name',
    sortable: true,
  },
  {
    id: 'variations',
    label: 'Variaciones',
    field: 'variations',
    sortable: false,
    component: VariationsCell,
    getProps: (row) => ({
      variations: row.variations,
    }),
  },
  {
    id: 'basePrice',
    label: 'Precio Base',
    field: 'basePrice',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.basePrice,
      hide: row.variations.length > 0,
    }),
  },
  {
    id: 'taxPercentage',
    label: 'Impuesto (%)',
    field: 'taxPercentage',
    sortable: true,
    // Format the tax percentage with one decimal place and add % symbol
    format: (value) => `${(value || 0).toFixed(1)}%`,
  },
  {
    id: 'isActive',
    label: 'Activo',
    field: 'isActive',
    sortable: true,
    component: CheckboxCell,
    getProps: (row) => ({
      isChecked: row.isActive,
    }),
  },
];

const uniqueCollections = computed(() => {
  return [...new Set(productStore.items.map(item => item.collectionName))];
});

const tableFilters = computed(() => [
  {
    field: 'collectionName',
    options: uniqueCollections.value.map((collection) => ({
      label: collection,
      value: collection,
    })),
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

const handleAction = async ({ actionId, selectedIds }) => {
  actionLoading.value[actionId] = true;

  try {
    if (actionId === 'edit') {
      selectedProduct.value = productStore.items.find(product => product.id === selectedIds[0]);
      isFormOpen.value = true;
    } else if (actionId === 'delete') {
      if (window.confirm('¿Estás seguro de querer eliminar este producto?')) {
        selectedProduct.value = productStore.items.find(product => product.id === selectedIds[0]);
        await productStore.remove(selectedProduct.value.id);
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
    selectedProduct.value = productStore.items.find(product => product.id === selectedIds[0]);
  } else {
    selectedProduct.value = null;
  }
};

const handleSubmit = async (formData) => {
  try {
    if (selectedProduct.value) {
      await productStore.update(selectedProduct.value.id, formData);
    }
    isFormOpen.value = false;
    selectedProduct.value = null;
  } catch (error) {
    console.error('Failed to update product:', error);
  }
};

const handleCancel = () => {
  isFormOpen.value = false;
  selectedProduct.value = null;
};

const navigateToCreate = () => {
  router.push('/dashboard/products/create');
};
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex justify-between items-center mb-1">
      <h2 class="text-2xl font-bold mb-0">Productos</h2>
      <button
        label="Crear Producto"
        class="action-btn"
        @click="navigateToCreate"
      >
        Crear Producto
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="productStore.loading" class="text-neutral-600 text-center py-4">
      Cargando productos...
    </div>

    <!-- Error State -->
    <div v-if="productStore.error" class="text-red-500 text-center py-4">
      {{ productStore.error }}
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
          <h3 class="text-xl font-bold mb-4">Edit Product</h3>
          <ProductForm
            v-if="selectedProduct"
            :key="selectedProduct.id"
            :initial-data="selectedProduct"
            :loading="productStore.loading"
            class="w-full"
            @submit="handleSubmit"
            @cancel="handleCancel"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Table -->
    <div v-if="!productStore.loading">
      <DataTable
        ref="dataTable"
        :data="tableData"
        :columns="columns"
        :filters="tableFilters"
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

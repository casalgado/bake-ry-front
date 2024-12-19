<script setup>
import { ref, onMounted, computed } from 'vue';
import { useProductStore } from '@/stores/productStore';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useRouter } from 'vue-router';
import ProductForm from '@/components/forms/ProductForm.vue';
import DataTable from '@/components/DataTable/index.vue';
import VariationsCell from '@/components/DataTable/renderers/VariationsCell.vue';
import CheckboxCell from '@/components/DataTable/renderers/CheckboxCell.vue';
import { PhPen } from '@phosphor-icons/vue';

const router = useRouter();
const productStore = useProductStore();
const productCollectionStore = useProductCollectionStore();
const showForm = ref(false);
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
];

const handleAction = async ({ actionId, selectedIds }) => {
  actionLoading.value[actionId] = true;

  try {
    if (actionId === 'edit') {
      selectedProduct.value = productStore.items.find(product => product.id === selectedIds[0]);
      showForm.value = true;
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
    showForm.value = false;
    selectedProduct.value = null;
  } catch (error) {
    console.error('Failed to update product:', error);
  }
};

const handleCancel = () => {
  showForm.value = false;
  selectedProduct.value = null;
};

const navigateToCreate = () => {
  router.push('/dashboard/products/create');
};
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <h2 class="text-2xl font-bold mb-4">Productos</h2>

    <!-- Loading State -->
    <div v-if="productStore.loading" class="text-neutral-600 text-center py-4">
      Cargando productos...
    </div>

    <!-- Error State -->
    <div v-if="productStore.error" class="text-red-500 text-center py-4">
      {{ productStore.error }}
    </div>

    <!-- Edit Form Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 ">
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h3 class="text-xl font-bold mb-4">Edit Product</h3>
        <ProductForm
          :key="selectedProduct.id"
          :initial-data="selectedProduct"
          :loading="productStore.loading"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>

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
.dialog-overlay {
  @apply bg-black bg-opacity-50;
}

.dialog-content {
  @apply bg-white rounded-lg shadow-xl transform transition-all;

  &:focus {
    @apply outline-none;
  }
}

* {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

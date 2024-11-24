<script setup>
import { ref, onMounted, computed } from 'vue';
import { useProductStore } from '@/stores/productStore';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useRouter } from 'vue-router';
import ProductForm from '@/components/forms/ProductForm.vue';
import DataTable from '@/components/DataTable/index.vue';

const router = useRouter();
const productStore = useProductStore();
const productCollectionStore = useProductCollectionStore();
const showForm = ref(false);
const selectedProduct = ref(null);
const searchQuery = ref('');
const selectedCollection = ref('');

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

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
};

const columns = [
  {
    id: 'name',
    label: 'Name',
    field: 'name',
    sortable: true,
  },
  {
    id: 'collectionName',
    label: 'Collection',
    field: 'collectionName',
    sortable: true,
  },
  {
    id: 'variations',
    label: 'Variaciones',
    field: 'variations',
    sortable: false,
    customRender: (variations) => {
      if (!variations || variations.length === 0) return '-';
      return variations.map(v => `${v.name} (${v.value}g)`).join(', ');
    },
  },
  {
    id: 'basePrice',
    label: 'Precio Base',
    field: 'basePrice',
    sortable: false,
  },
  {
    id: 'recipes',
    label: 'Receta',
    field: 'recipeId',
    sortable: false,
  },
  {
    id: 'isActive',
    label: 'Status',
    field: 'isActive',
    sortable: true,
    customRender: (value) => value ? 'Active' : 'Inactive',
  },
];

const handleRowClick = ({ row }) => {
  selectedProduct.value = row;
  showForm.value = true;
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
  <div class="container p-4">
    <h2 class="text-2xl font-bold mb-4">Product Management</h2>

    <!-- Search and Filter Controls -->
    <div class="flex gap-4 mb-4">
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Search products..."
        class="px-4 py-2 border rounded"
      />

      <select
        v-model="selectedCollection"
        class="px-4 py-2 border rounded"
      >
        <option value="">All collections</option>
        <option
          v-for="collection in productCollectionStore.items"
          :key="collection.id"
          :value="collection.id"
        >
          {{ collection.name }}
        </option>
      </select>

      <button
        @click="navigateToCreate"
        class="px-4 py-2 action-btn"
      >
        New Product
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="productStore.loading" class="text-neutral-600 text-center py-4">
      Loading products...
    </div>

    <!-- Error State -->
    <div v-if="productStore.error" class="text-red-500 text-center py-4">
      {{ productStore.error }}
    </div>

    <!-- Edit Form Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
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
        :data="tableData"
        :columns="columns"
        @row-click="handleRowClick"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

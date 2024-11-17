<script setup>
import { ref, onMounted, computed } from 'vue';
import { useProductStore } from '@/stores/productStore';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useRouter } from 'vue-router';
import ProductForm from '@/components/forms/ProductForm.vue';

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

const filteredProducts = computed(() => {
  return productStore.items.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      product.description
        ?.toLowerCase()
        .includes(searchQuery.value.toLowerCase());

    const matchesCollection =
      !selectedCollection.value || product.collectionId === selectedCollection.value;

    return matchesSearch && matchesCollection;
  });
});

const hasVariations = (product) => {
  return product.variations && product.variations.length > 0;
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const handleEdit = (product) => {
  selectedProduct.value = product;
  showForm.value = true;
};

const handleDelete = async (productId) => {
  if (confirm('Are you sure you want to delete this product?')) {
    try {
      await productStore.remove(productId);
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
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
  <div>
    <h2>Product Management</h2>

    <!-- Search and Filter Controls -->
    <div>
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Search products..."
      />

      <select v-model="selectedCollection">
        <option value="">All collections</option>
        <option
          v-for="collection in productCollectionStore.items"
          :key="collection.id"
          :value="collection.id"
        >
          {{ collection.name }}
        </option>
      </select>

      <button @click="navigateToCreate">New Product</button>
    </div>

    <!-- Loading State -->
    <div v-if="productStore.loading">Loading products...</div>

    <!-- Error State -->
    <div v-if="productStore.error">
      {{ productStore.error }}
    </div>

    <!-- Edit Form Modal -->
    <div v-if="showForm">
      <div>
        <h3>Edit Product</h3>
        <ProductForm
          :key="selectedProduct.id"
          :initial-data="selectedProduct"
          :loading="productStore.loading"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>

    <!-- Products Table -->
    <div v-if="!productStore.loading && filteredProducts.length > 0">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Recipe</th>
            <th>Base Price</th>
            <th>Multiplier</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in filteredProducts" :key="product.id">
            <!-- Name Column -->
            <td>
              <div>{{ product.name }}</div>
              <div v-if="product.description">
                {{ product.description }}
              </div>
            </td>

            <!-- Recipe Column -->
            <td>{{ product.recipeId }}</td>

            <!-- Price Column -->
            <td>
              <div v-if="!hasVariations(product)">
                {{ formatCurrency(product.basePrice) }}
              </div>
              <div v-else>
                <div v-for="(variation, index) in product.variations" :key="index">
                  {{ variation.name }}: {{ formatCurrency(variation.basePrice) }}
                </div>
              </div>
            </td>

            <!-- Multiplier Column -->
            <td>
              <div v-if="!hasVariations(product)">
                {{ product.recipeMultiplier }}x
              </div>
              <div v-else>
                <div v-for="(variation, index) in product.variations" :key="index">
                  {{ variation.name }}: {{ variation.recipeMultiplier }}x
                </div>
              </div>
            </td>

            <!-- Status Column -->
            <td>{{ product.isActive ? "Active" : "Inactive" }}</td>

            <!-- Actions Column -->
            <td>
              <button @click="handleEdit(product)">Edit</button>
              <button @click="handleDelete(product.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No Results State -->
    <div v-else-if="!productStore.loading && filteredProducts.length === 0">
      No products found.
    </div>
  </div>
</template>

<style scoped lang="scss">
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

th,
td {
  padding: 0.5rem;
  text-align: left;
  border: 1px solid #ddd;
}

button + button {
  margin-left: 0.5rem;
}
</style>

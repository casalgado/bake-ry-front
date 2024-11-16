<script setup>
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useRouter } from 'vue-router';
import ProductCollectionForm from '@/components/forms/ProductCollectionForm.vue';

const router = useRouter();
const productCollectionStore = useProductCollectionStore();

const handleSubmit = async (formData) => {
  try {
    await productCollectionStore.create(formData);
  } catch (error) {
    console.error('Failed to create product collection:', error);
  }
};

const handleCancel = () => {
  router.push('/dashboard/product-collections');
};
</script>

<template>
  <div class="form-container">
    <h2>Create Product Collection</h2>
    <ProductCollectionForm
      :loading="productCollectionStore.loading"
      @submit="handleSubmit"
      @cancel="handleCancel"
    />
    <div v-if="productCollectionStore.error">
      {{ productCollectionStore.error }}
    </div>
  </div>
</template>

<script setup>
import { useProductStore } from '@/stores/productStore';
import ProductForm from '@/components/forms/ProductForm.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const productStore = useProductStore();

const handleSubmit = async (formData) => {
  try {
    await productStore.create(formData);
    router.push('/dashboard/products');
  } catch (error) {
    console.error('Failed to create product:', error);
  }
};

const handleCancel = () => {
  router.push('/products');
};
</script>

<template>
  <div>
    <h2>Create New Product</h2>
    <ProductForm
      :loading="productStore.loading"
      @submit="handleSubmit"
      @cancel="handleCancel"
    />
    <div v-if="productStore.error" class="error">
      {{ productStore.error }}
    </div>
  </div>
</template>

<script setup>
import { useProductStore } from '@/stores/productStore';
import ProductForm from '@/components/forms/ProductForm.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const productStore = useProductStore();

const handleSubmit = async (formData) => {
  try {
    console.log('Creating product:', formData);
    await productStore.create(formData);
    window.alert('Producto creado correctamente');
  } catch (error) {
    console.error('Failed to create product:', error);
  }
};

const handleCancel = () => {
  router.push('/products');
};
</script>

<template>
  <div class="form-container">
    <h1>Crear Producto</h1>
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

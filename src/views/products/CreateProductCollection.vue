<script setup>
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useRouter } from 'vue-router';
import ProductCollectionForm from '@/components/forms/ProductCollectionForm.vue';

const router = useRouter();
const productCollectionStore = useProductCollectionStore();

const handleSubmit = async (formData) => {
  console.log('formData', formData);
  try {
    await productCollectionStore.create(formData);
  } catch (error) {
    console.error('Failed to create product collection:', error);
  }
  router.push('/dashboard/product-collections');
};

const handleCancel = () => {
  router.push('/dashboard/product-collections');
};
</script>

<template>
    <ProductCollectionForm
      :loading="productCollectionStore.loading"
      @submit="handleSubmit"
      @cancel="handleCancel"
    />
    <div v-if="productCollectionStore.error">
      {{ productCollectionStore.error }}
    </div>

</template>

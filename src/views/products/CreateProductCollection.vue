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
  router.push('/dashboard/product-collections');
};

const handleCancel = () => {
  router.push('/dashboard/product-collections');
};
</script>

<template>
  <!-- Width lives on the host, not the form. See CreateClient.vue. -->
  <div class="p-4 lg:p-6 w-full max-w-[48rem]">
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

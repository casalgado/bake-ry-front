<script setup>
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useRouter } from 'vue-router';
import ProductCollectionForm from '@/components/forms/ProductCollectionForm.vue';

const router = useRouter();
const productCollectionStore = useProductCollectionStore();

// A new category goes last in the catalog, not first.
const handleSubmit = async (formData) => {
  try {
    if (!productCollectionStore.items.length) await productCollectionStore.fetchAll();
    const last = Math.max(-1, ...productCollectionStore.items.map((c) => c.displayOrder ?? 0));
    await productCollectionStore.create({ ...formData, displayOrder: last + 1 });
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
  <!-- The form declares no width — the host does. See .ui-formhost. -->
  <div class="ui-formhost p-4 lg:p-6">
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

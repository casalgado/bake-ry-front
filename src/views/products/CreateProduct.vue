<script setup>
import { ref } from 'vue';
import { useProductStore } from '@/stores/productStore';
import ProductForm from '@/components/forms/ProductForm.vue';
import ToastNotification from '@/components/ToastNotification.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const productStore = useProductStore();
const toastRef = ref(null);
const isRedirecting = ref(false);

const handleSubmit = async (formData) => {
  try {
    console.log('Creating product:', formData);
    await productStore.create(formData);

    // Show success toast
    toastRef.value?.showSuccess('Producto creado correctamente');

    // Start fadeout effect
    isRedirecting.value = true;

    // Wait a moment for the toast to be visible before redirecting
    setTimeout(() => {
      router.push('/dashboard/products');
    }, 1200);
  } catch (error) {
    console.error('Failed to create product:', error);
    // Show error toast
    toastRef.value?.showError('Error al crear producto', error.message || 'Intenta nuevamente');
  }
};

const handleCancel = () => {
  router.push('/dashboard/products');
};
</script>

<template>
  <!-- The form declares no width — the host does. See .ui-formhost. The root
       carries it; the toast below sits outside the fading container. -->
  <div class="ui-formhost">
    <div class="form-fade p-4 lg:p-6" :class="{ 'fade-out': isRedirecting }">
      <ProductForm
        :loading="productStore.loading"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
      <div v-if="productStore.error" class="error">
        {{ productStore.error }}
      </div>
    </div>

    <!-- Toast Notification - Outside fading container -->
    <ToastNotification ref="toastRef" />
  </div>
</template>

<style scoped>
.form-fade {
  transition: opacity 1s ease-out;
}

.form-fade.fade-out {
  opacity: 0;
}
</style>

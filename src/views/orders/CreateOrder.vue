<script setup>
import { useOrderStore } from '@/stores/orderStore';
import OrderForm from '@/components/forms/OrderForm.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const orderStore = useOrderStore();

const handleSubmit = async (formData) => {
  try {
    await orderStore.create(formData);
    // router.push('/dashboard/orders');
  } catch (error) {
    console.error('Failed to create order:', error);
  }
};

const handleCancel = () => {
  router.push('/orders');
};
</script>

<template>
  <OrderForm
    :title="'Crear Pedido'"
    :loading="orderStore.loading"
    @submit="handleSubmit"
    @cancel="handleCancel"
  />
  <div v-if="orderStore.error">
    {{ orderStore.error }}
  </div>

</template>

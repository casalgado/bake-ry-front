<script setup>
import { ref } from 'vue';
import { useOrderStore } from '@/stores/orderStore';
import OrderForm from '@/components/forms/OrderForm.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const orderStore = useOrderStore();
const orderForm = ref(null); // Reference to the OrderForm component

const handleSubmit = async (formData) => {
  try {
    await orderStore.create(formData);

    // Reset the form by triggering a key change
    if (orderForm.value) {
      orderForm.value.resetForm();
    }

    // Scroll to top after successful creation (same as OrderForm pattern)
    const form = document.querySelector('form');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth' });
    }

  } catch (error) {
    console.error('Failed to create order:', error);
  }
};

const handleCancel = () => {
  router.push('/dashboard/orders');
};
</script>

<template>
  <!-- The form declares no width — the host does. See .ui-formhost. -->
  <div class="ui-formhost p-4 lg:p-6" style="--ui-form-w: 72rem">
    <OrderForm
      ref="orderForm"
      title="Nuevo pedido"
      :loading="orderStore.loading"
      @submit="handleSubmit"
      @cancel="handleCancel"
    />
    <div v-if="orderStore.error" class="ui-field-error mt-2">
      {{ orderStore.error }}
    </div>
  </div>

</template>

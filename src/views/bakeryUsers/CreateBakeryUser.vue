<script setup>
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import BakeryUserForm from '@/components/forms/BakeryUserForm.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const bakeryUserStore = useBakeryUserStore();

const handleSubmit = async (formData) => {
  try {
    console.log(formData);
    await bakeryUserStore.create(formData);
    router.push('/dashboard/users');
  } catch (error) {
    console.error('Error al crear usuario:', error);
  }
};

const handleCancel = () => {
  router.push('/dashboard/users');
};
</script>

<template>

  <BakeryUserForm
    title="Crear nuevo usuario"
    :loading="bakeryUserStore.loading"
    @submit="handleSubmit"
    @cancel="handleCancel"
  />
  <div v-if="bakeryUserStore.error">
    {{ bakeryUserStore.error }}
  </div>

</template>

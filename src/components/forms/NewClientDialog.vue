<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import { parseSpanishName } from '@/utils/helpers';

const props = defineProps({
  isOpen: Boolean,
});

const emit = defineEmits(['update:isOpen', 'clientCreated']);

const userStore = useBakeryUserStore();
const loading = ref(false);
const error = ref('');

const formData = ref({
  name: '',
  email: '',
  phone: '',
  address: '',
});

const handleSubmit = async (e) => {
  e.preventDefault();
  loading.value = true;
  error.value = '';

  try {
    formData.value.role = 'bakery_customer';
    const submitData = {
      ...formData.value,
      ...parseSpanishName(formData.value.name, formData.value.category),
    };
    console.log('submitData', submitData);
    // const newClient = await userStore.create(submitData);
    // emit('clientCreated', newClient);
    // emit('update:isOpen', false);
    // formData.value = { name: '', email: '', phone: '', address: '' };
  } catch (err) {
    error.value = err.message || 'Error creating client';
  } finally {
    loading.value = false;
  }
};

const closeDialog = () => {
  emit('update:isOpen', false);
  formData.value = { name: '', email: '', phone: '', address: '' };
  error.value = '';
};

const handleKeydown = (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    handleSubmit(e);
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Dialog
    :open="isOpen"
    @close="closeDialog"
    class="relative z-50 form-container"
  >
    <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="w-full max-w-md rounded-lg bg-white">
        <div class="flex items-center justify-between p-4 border-b border-neutral-200">
          <DialogTitle class="text-lg font-semibold text-neutral-900">
            Nuevo Cliente
          </DialogTitle>

        </div>

        <form @submit="handleSubmit" class="base-card border-none rounded-none">
          <div v-if="error" class="p-3 text-sm text-danger bg-danger/10 rounded-md">
            {{ error }}
          </div>

          <div>
            <label class="">
              Nombre
            </label>
            <input
              type="text"
              required
              v-model="formData.name"
              class=""
            />

            <label class="">
              Email
            </label>
            <input
              type="email"
              required
              v-model="formData.email"
              class=""
            />

            <label class="">
              Teléfono
            </label>
            <input
              type="tel"
              required
              v-model="formData.phone"
              class=""
            />

            <label class="">
              Dirección
            </label>
            <textarea
              required
              v-model="formData.address"
              rows="2"
              class=""
            ></textarea>
          </div>

          <div class="flex justify-end gap-2 mt-4">
            <button
              type="submit"
              :disabled="loading"
              class="action-btn"
            >
              {{ loading ? 'Creando...' : 'Crear Cliente' }}
            </button>
            <button
              type="button"
              @click="closeDialog"
              class="utility-btn"
            >
              Cancelar
            </button>

          </div>
        </form>
      </DialogPanel>
    </div>
  </Dialog>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import { parseSpanishName } from '@/utils/helpers';
import RadioButtonGroup from '@/components/forms/RadioButtonGroup.vue';

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
  category: 'B2C', // Default to B2C
});

// Options for client type
const clientTypeOptions = [
  { value: 'B2C', label: 'B2C' },
  { value: 'B2B', label: 'B2B' },
];

const selectedClientType = ref('B2C');

const handleClientTypeChange = (value) => {
  formData.value.category = value;
};

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
    const newClient = await userStore.create(submitData);
    emit('clientCreated', newClient);
    emit('update:isOpen', false);
    resetForm();
  } catch (err) {
    error.value = err.message || 'Error creando cliente';
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  formData.value = {
    name: '',
    email: '',
    phone: '',
    address: '',
    category: 'B2C',
  };
  selectedClientType.value = 'B2C';
  error.value = '';
};

const closeDialog = () => {
  emit('update:isOpen', false);
  resetForm();
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
          <div v-if="error" class="p-3 mb-4 text-sm text-danger bg-danger/10 rounded-md">
            {{ error }}
          </div>

          <div class="space-y-4">
            <!-- Client Type Selection -->
            <RadioButtonGroup
              v-model="selectedClientType"
              :options="clientTypeOptions"
              name="client-type"
              label="Tipo de Cliente"
              class="w-full"
              @update:modelValue="handleClientTypeChange"
            />

            <div>
              <label class="">
                {{ selectedClientType === 'B2B' ? 'Nombre de Empresa' : 'Nombre' }}
              </label>
              <input
                type="text"
                required
                v-model="formData.name"
                class=""
              />
            </div>

            <div>
              <label class="">
                Email
              </label>
              <input
                type="email"
                v-model="formData.email"
                class=""
              />
            </div>

            <div>
              <label class="">
                Teléfono
              </label>
              <input
                type="tel"
                v-model="formData.phone"
                class=""
              />
            </div>

            <div>
              <label class="">
                Dirección
              </label>
              <textarea
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
          </div>
        </form>
      </DialogPanel>
    </div>
  </Dialog>
</template>

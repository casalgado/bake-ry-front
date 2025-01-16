<script setup>
import { ref, computed } from 'vue';
import { cleanString } from '@/utils/helpers';
import { useRouter } from 'vue-router';

const router = useRouter();

const props = defineProps({
  title: {
    type: String,
    default: 'Crear Colección',
  },
  initialData: {
    type: Object,
    default: () => null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

// Form state
const formData = ref(
  props.initialData
    ? { ...props.initialData }
    : {
      name: '',
      description: '',
      isActive: true,
      displayOrder: 0,
    },
);

const errors = ref({});

// Computed properties for button text
const submitButtonText = computed(() => {
  return props.initialData ? 'Actualizar Colección' : 'Crear Colección';
});

const loadingText = computed(() => {
  return props.initialData ? 'Actualizando...' : 'Creando...';
});

// Validation
const validate = () => {
  errors.value = {};

  if (!formData.value.name) {
    errors.value.name = 'Nombre es requerido';
  }
  if (formData.value.name.length < 3) {
    errors.value.name = 'Nombre debe tener al menos 3 caracteres';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) return;
  formData.value.name = cleanString(formData.value.name);
  emit('submit', formData.value);

};

const resetForm = () => {
  formData.value = {
    name: '',
    description: '',
    isActive: true,
    displayOrder: 0,
  };
  errors.value = {};
};
</script>

<template>
  <div class="form-container">

    <form @submit.prevent="handleSubmit">
      <!-- Basic Information -->
      <div class="base-card">

        <!-- Name -->
        <div class="mb-4">
          <label
            for="name"
            class="block text-sm font-medium text-neutral-700 mb-1"
          >
            Nombre
          </label>
          <input
            id="name"
            type="text"
            v-model="formData.name"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
            :class="{ 'border-danger': errors.name }"
            required
          />
          <span
            v-if="errors.name"
            class="text-sm text-danger mt-1"
          >
            {{ errors.name }}
          </span>
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label
            for="description"
            class="block text-sm font-medium text-neutral-700 mb-1"
          >
            Descripción
          </label>
          <textarea
            id="description"
            v-model="formData.description"
            rows="3"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <!-- Display Order
        <div class="mb-4">
          <label
            for="displayOrder"
            class="block text-sm font-medium text-neutral-700 mb-1"
          >
            Display Order
          </label>
          <input
            id="displayOrder"
            type="number"
            v-model="formData.displayOrder"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
            min="0"
          />
        </div> -->

        <!-- Is Active -->
        <!-- <div class="mb-4">
          <label class="flex items-center">
            <input
              type="checkbox"
              v-model="formData.isActive"
              class="form-checkbox h-4 w-4 text-primary border-neutral-300 rounded"
            />
            <span class="ml-2 text-sm text-neutral-700">Active</span>
          </label>
        </div> -->
      </div>

      <!-- Form Actions -->
      <div class="base-card flex gap-2 justify-end">
        <button
          type="button"
          @click="$emit('cancel')"
          :disabled="loading"
          class="px-4 py-2 bg-neutral-200 text-neutral-800 rounded-md hover:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="loading"
          class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          {{ loading ? loadingText : submitButtonText }}
        </button>
      </div>
    </form>
  </div>
</template>

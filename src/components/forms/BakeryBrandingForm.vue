<script setup>
import { ref, computed, watch } from 'vue';
import ImageUpload from './ImageUpload.vue';
import { PhStorefront, PhImage } from '@phosphor-icons/vue';
import { useAuthenticationStore } from '@/stores/authentication';

const authStore = useAuthenticationStore();

const props = defineProps({
  title: {
    type: String,
    default: 'Identidad del Negocio',
  },
  initialData: {
    type: Object,
    default: () => ({
      logos: {
        original: '',
        '200x200': '',
        '400x400': '',
        '800x800': '',
      },
      // Future expansion for other branding elements
      primaryColor: '',
      secondaryColor: '',
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit']);

// Form state
const formData = ref({ ...props.initialData });

// Computed properties
const hasChanges = computed(() => {
  const initial = props.initialData;
  const current = formData.value;

  // Compare logos object
  const logoChanged = JSON.stringify(initial.logos || {}) !== JSON.stringify(current.logos || {});

  // Future: Compare other branding elements
  const primaryColorChanged = (initial.primaryColor || '') !== (current.primaryColor || '');
  const secondaryColorChanged = (initial.secondaryColor || '') !== (current.secondaryColor || '');

  return logoChanged || primaryColorChanged || secondaryColorChanged;
});

const submitButtonText = computed(() => {
  return 'Guardar Cambios';
});

const loadingText = computed(() => {
  return 'Guardando...';
});

// Methods
const handleSubmit = () => {
  console.log('Submitting form with data:', formData.value);
  emit('submit', formData.value);
};

const handleCancel = () => {
  // Reset form to initial state
  formData.value = {
    logos: props.initialData.logos || {
      original: '',
      '200x200': '',
      '400x400': '',
      '800x800': '',
    },
    primaryColor: props.initialData.primaryColor || '',
    secondaryColor: props.initialData.secondaryColor || '',
  };
};

const handleLogoUploadSuccess = (result) => {
  console.log('Logo uploaded successfully:', result);

  // Update the logos object with all available URLs
  formData.value.logos = {
    original: result.originalUrl,
    '200x200': result.resizedUrls['200x200'] || '',
    '400x400': result.resizedUrls['400x400'] || '',
    '800x800': result.resizedUrls['800x800'] || '',
  };

  console.log('Updated logos object:', formData.value.logos);
};

const handleLogoUploadError = (error) => {
  console.error('Logo upload failed:', error);
};

// Generate the upload path for the logo
const getLogoUploadPath = computed(() => {
  const bakeryId = authStore.getBakeryId || 'default';
  return `bakeries/${bakeryId}/branding/logos/`;
});

// Watch for initialData changes and update form
watch(() => props.initialData, (newData) => {
  if (newData) {
    formData.value = {
      logos: newData.logos || {
        original: '',
        '200x200': '',
        '400x400': '',
        '800x800': '',
      },
      primaryColor: newData.primaryColor || '',
      secondaryColor: newData.secondaryColor || '',
    };
  }
}, { deep: true, immediate: true });
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>

    <form @submit.prevent="handleSubmit" class="base-card">
      <!-- Logo Section -->
      <div class="mb-8">
        <h3 class="text-lg font-semibold text-neutral-900 mb-2 flex items-center gap-2">
          <PhStorefront :size="20" />
          Logo del Negocio
        </h3>
        <p class="text-sm text-neutral-600 mb-4">
          Sube el logo de tu negocio. Se mostrará en tus documentos y página web.
        </p>

        <div class="max-w-md">
          <ImageUpload
            v-model="formData.logos.original"
            :upload-path="getLogoUploadPath"
            label="Logo"
            help-text="Arrastra tu logo aquí o haz clic para seleccionar"
            :disabled="loading"
            @upload-success="handleLogoUploadSuccess"
            @upload-error="handleLogoUploadError"
          />
        </div>

        <!-- Logo Preview Sizes -->
        <div v-if="formData.logos.original" class="mt-6">
          <h4 class="text-sm font-medium text-neutral-700 mb-3">Versiones Disponibles</h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="text-center">
              <div class="border border-neutral-200 rounded-lg p-2 bg-white">
                <img
                  v-if="formData.logos.original"
                  :src="formData.logos.original"
                  alt="Original"
                  class="w-16 h-16 object-contain mx-auto"
                />
                <div v-else class="w-16 h-16 bg-neutral-100 rounded mx-auto"></div>
              </div>
              <p class="text-xs text-neutral-600 mt-1">Original</p>
            </div>
            <div class="text-center">
              <div class="border border-neutral-200 rounded-lg p-2 bg-white">
                <img
                  v-if="formData.logos['800x800']"
                  :src="formData.logos['800x800']"
                  alt="800x800"
                  class="w-16 h-16 object-contain mx-auto"
                />
                <div v-else class="w-16 h-16 bg-neutral-100 rounded mx-auto flex items-center justify-center">
                  <span class="text-xs text-neutral-400">800px</span>
                </div>
              </div>
              <p class="text-xs text-neutral-600 mt-1">Grande</p>
            </div>
            <div class="text-center">
              <div class="border border-neutral-200 rounded-lg p-2 bg-white">
                <img
                  v-if="formData.logos['400x400']"
                  :src="formData.logos['400x400']"
                  alt="400x400"
                  class="w-16 h-16 object-contain mx-auto"
                />
                <div v-else class="w-16 h-16 bg-neutral-100 rounded mx-auto flex items-center justify-center">
                  <span class="text-xs text-neutral-400">400px</span>
                </div>
              </div>
              <p class="text-xs text-neutral-600 mt-1">Mediano</p>
            </div>
            <div class="text-center">
              <div class="border border-neutral-200 rounded-lg p-2 bg-white">
                <img
                  v-if="formData.logos['200x200']"
                  :src="formData.logos['200x200']"
                  alt="200x200"
                  class="w-16 h-16 object-contain mx-auto"
                />
                <div v-else class="w-16 h-16 bg-neutral-100 rounded mx-auto flex items-center justify-center">
                  <span class="text-xs text-neutral-400">200px</span>
                </div>
              </div>
              <p class="text-xs text-neutral-600 mt-1">Pequeño</p>
            </div>
          </div>
        </div>

        <div class="mt-4 p-3 bg-blue-50 rounded-lg">
          <p class="text-xs text-blue-700">
            <strong>Recomendaciones:</strong>
            • Usa una imagen cuadrada o con fondo transparente
            • Resolución mínima recomendada: 512x512 píxeles
            • El logo se redimensionará automáticamente para diferentes usos
          </p>
        </div>
      </div>

      <!-- Future: Color Scheme Section -->
      <div class="mb-8 hidden">
        <h3 class="text-lg font-semibold text-neutral-900 mb-2">
          Esquema de Colores
        </h3>
        <p class="text-sm text-neutral-600 mb-4">
          Personaliza los colores de tu marca (próximamente)
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="primary-color" class="block text-sm font-medium text-neutral-700 mb-2">
              Color Principal
            </label>
            <div class="flex items-center gap-2">
              <input
                id="primary-color"
                type="color"
                v-model="formData.primaryColor"
                :disabled="true"
                class="h-10 w-20"
              />
              <input
                type="text"
                v-model="formData.primaryColor"
                :disabled="true"
                placeholder="#000000"
                class="flex-1"
              />
            </div>
          </div>

          <div>
            <label for="secondary-color" class="block text-sm font-medium text-neutral-700 mb-2">
              Color Secundario
            </label>
            <div class="flex items-center gap-2">
              <input
                id="secondary-color"
                type="color"
                v-model="formData.secondaryColor"
                :disabled="true"
                class="h-10 w-20"
              />
              <input
                type="text"
                v-model="formData.secondaryColor"
                :disabled="true"
                placeholder="#FFFFFF"
                class="flex-1"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Form Buttons -->
      <div class="flex gap-2 justify-end">
        <button type="submit" :disabled="loading || !hasChanges" class="action-btn">
          {{ loading ? loadingText : submitButtonText }}
        </button>
        <button
          type="button"
          @click="handleCancel"
          :disabled="loading || !hasChanges"
          :class="hasChanges ? 'danger-btn' : 'disabled-btn'"
        >
          Cancelar
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped lang="scss">
* {
  &::-webkit-scrollbar {
    display: none;
  }

  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

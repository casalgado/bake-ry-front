<script setup>
import { ref, computed, watch } from 'vue';
import ImageUpload from './ImageUpload.vue';
import { PhStorefront, PhImage } from '@phosphor-icons/vue';
import { useAuthenticationStore } from '@/stores/authentication';

const authStore = useAuthenticationStore();

const props = defineProps({
  title: {
    type: String,
    default: 'Identidad',
  },
  initialData: {
    type: Object,
    default: () => ({
      logos: {
        original: '',
        small: '',
        medium: '',
        large: '',
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

const emit = defineEmits(['submit', 'validation-error']);

// Form state - deep clone to avoid mutation
const formData = ref(JSON.parse(JSON.stringify(props.initialData)));

// Computed properties
const hasChanges = computed(() => {
  const initial = props.initialData;
  const current = formData.value;

  // Compare logos object - normalize empty values for comparison
  const normalizeLogos = (logos) => ({
    original: logos?.original || '',
    small: logos?.small || '',
    medium: logos?.medium || '',
    large: logos?.large || '',
  });

  const initialLogos = normalizeLogos(initial.logos);
  const currentLogos = normalizeLogos(current.logos);
  const logoChanged = JSON.stringify(initialLogos) !== JSON.stringify(currentLogos);

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
  emit('submit', formData.value);
};

const handleCancel = () => {
  // Reset form to initial state - deep clone to avoid reference issues
  formData.value = JSON.parse(JSON.stringify(props.initialData));
};

const handleLogoUploadSuccess = (result) => {
  // Update the logos object with all available URLs - use spread to ensure reactivity
  formData.value = {
    ...formData.value,
    logos: {
      original: result.originalUrl,
      small: result.resizedUrls.small || '',
      medium: result.resizedUrls.medium || '',
      large: result.resizedUrls.large || '',
    },
  };
};

const handleLogoUploadError = (error) => {
  console.error('Logo upload error:', error);
};

const handleLogoValidationError = (error) => {
  console.error('Logo validation error:', error);
  // Emit the validation error to the parent component
  emit('validation-error', error);
};

// Generate the upload path for the logo
const getLogoUploadPath = computed(() => {
  const bakeryId = authStore.getBakeryId || 'default';
  return `bakeries/${bakeryId}/branding/logos/`;
});

// Watch for initialData changes and update form
watch(() => props.initialData, (newData) => {
  if (newData) {
    formData.value = JSON.parse(JSON.stringify({
      logos: newData.logos || {
        original: '',
        small: '',
        medium: '',
        large: '',
      },
      primaryColor: newData.primaryColor || '',
      secondaryColor: newData.secondaryColor || '',
    }));
  }
}, { deep: true });
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}{{ hasChanges }}</h2>

    <form @submit.prevent="handleSubmit" class="base-card">
      <!-- Logo Section -->
      <div class="mb-8">
        <h3 class="text-lg font-semibold text-neutral-900 mb-2 flex items-center gap-2">

          Logo
        </h3>

        <div class="">
          <ImageUpload
            v-model="formData.logos.original"
            :upload-path="getLogoUploadPath"
            label="Sube el logo de tu negocio."
            help-text="Arrastra tu logo aquí o haz clic para seleccionar"
            :disabled="loading"
            @upload-success="handleLogoUploadSuccess"
            @upload-error="handleLogoUploadError"
            @validation-error="handleLogoValidationError"
          />
        </div>

        <!-- Logo Preview Sizes -->
        <div v-if="formData.logos.original" class="mt-6 hidden">
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
                  v-if="formData.logos.large"
                  :src="formData.logos.large"
                  alt="Large logo"
                  class="w-16 h-16 object-contain mx-auto"
                />
                <div v-else class="w-16 h-16 bg-neutral-100 rounded mx-auto flex items-center justify-center">
                  <span class="text-xs text-neutral-400">Grande</span>
                </div>
              </div>
              <p class="text-xs text-neutral-600 mt-1">Grande (800px)</p>
            </div>
            <div class="text-center">
              <div class="border border-neutral-200 rounded-lg p-2 bg-white">
                <img
                  v-if="formData.logos.medium"
                  :src="formData.logos.medium"
                  alt="Medium logo"
                  class="w-16 h-16 object-contain mx-auto"
                />
                <div v-else class="w-16 h-16 bg-neutral-100 rounded mx-auto flex items-center justify-center">
                  <span class="text-xs text-neutral-400">Mediano</span>
                </div>
              </div>
              <p class="text-xs text-neutral-600 mt-1">Mediano (400px)</p>
            </div>
            <div class="text-center">
              <div class="border border-neutral-200 rounded-lg p-2 bg-white">
                <img
                  v-if="formData.logos.small"
                  :src="formData.logos.small"
                  alt="Small logo"
                  class="w-16 h-16 object-contain mx-auto"
                />
                <div v-else class="w-16 h-16 bg-neutral-100 rounded mx-auto flex items-center justify-center">
                  <span class="text-xs text-neutral-400">Pequeño</span>
                </div>
              </div>
              <p class="text-xs text-neutral-600 mt-1">Pequeño (200px)</p>
            </div>
          </div>
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
                :value="formData.primaryColor || '#000000'"
                :disabled="true"
                class="h-10 w-20"
              />
              <input
                type="text"
                :value="formData.primaryColor || ''"
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
                :value="formData.secondaryColor || '#FFFFFF'"
                :disabled="true"
                class="h-10 w-20"
              />
              <input
                type="text"
                :value="formData.secondaryColor || ''"
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

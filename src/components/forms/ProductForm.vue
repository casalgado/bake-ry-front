<script setup>
import { ref, computed, onMounted } from 'vue';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import YesNoToggle from '@/components/forms/YesNoToggle.vue';
import VariationsManager from '@/components/forms/VariationsManager.vue';
import { cleanString } from '@/utils/helpers';

const collectionStore = useProductCollectionStore();

const props = defineProps({
  title: {
    type: String,
    default: 'Crear Producto',
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

// Form state with new structure
const formData = ref(
  props.initialData
    ? {
      ...props.initialData,
      variations: props.initialData.variations || { dimensions: [], combinations: [] },
    }
    : {
      name: '',
      description: '',
      collectionId: '',
      collectionName: '',
      taxPercentage: 0,
      isActive: true,
      basePrice: 0,
      costPrice: 0,
      hasVariations: false,
      variations: {
        dimensions: [],
        combinations: [],
      },
      customAttributes: {},
    },
);

const errors = ref({});

// Confirm dialog state
const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: null,
});

// Get available categories
const availableCategories = computed(() => {
  return collectionStore.items || [];
});

// Get selected category
const selectedCategory = computed(() => {
  if (!formData.value.collectionId) return null;
  return availableCategories.value.find(cat => cat.id === formData.value.collectionId);
});

// Check if product has variations
const hasVariations = computed(() => {
  return formData.value.hasVariations ||
         (formData.value.variations && formData.value.variations.combinations &&
          formData.value.variations.combinations.length > 0);
});

// Handle category selection
const handleCategoryChange = () => {
  if (!formData.value.collectionId) {
    formData.value.collectionName = '';
    return;
  }

  const category = selectedCategory.value;
  if (category) {
    formData.value.collectionName = category.name;
  }
};

// Handle variation updates from VariationsManager component
const handleVariationUpdate = (variationData) => {
  formData.value.variations = variationData;

  // Keep hasVariations true if dimensions exist (even without combinations)
  // This allows users to continue configuring dimensions
  formData.value.hasVariations =
    (variationData.dimensions && variationData.dimensions.length > 0) ||
    (variationData.combinations && variationData.combinations.length > 0);

  // Clear base price and cost price if variations exist
  if (formData.value.hasVariations) {
    formData.value.basePrice = 0;
    formData.value.costPrice = 0;
  }
};

// Toggle variations
const toggleVariations = (newValue, oldValue) => {
  if (!newValue && formData.value.variations.combinations.length > 0) {
    // Show confirmation dialog when disabling variations with existing data
    confirmDialog.value = {
      isOpen: true,
      title: 'Eliminar variaciones',
      message: '¿Estás seguro de que deseas eliminar todas las variaciones? Esta acción no se puede deshacer.',
      onConfirm: () => {
        formData.value.variations = { dimensions: [], combinations: [] };
        formData.value.hasVariations = false;
        confirmDialog.value.isOpen = false;
      },
      onCancel: () => {
        formData.value.hasVariations = true;
        confirmDialog.value.isOpen = false;
      },
    };
  } else if (!newValue) {
    formData.value.variations = { dimensions: [], combinations: [] };
    formData.value.hasVariations = false;
  }
};

// Computed properties for button text
const submitButtonText = computed(() => {
  return props.initialData ? 'Actualizar Producto' : 'Crear Producto';
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
  if (!formData.value.collectionId) {
    errors.value.collectionId = 'Categoría es requerida';
  }

  // Validate base price and cost price if no variations exist
  if (!hasVariations.value) {
    if (!formData.value.basePrice || formData.value.basePrice <= 0) {
      errors.value.basePrice = 'Precio base es requerido para productos sin variaciones';
    }
    if (formData.value.costPrice < 0) {
      errors.value.costPrice = 'Precio de costo no puede ser negativo';
    }
  }

  // Validate variations if they exist
  if (hasVariations.value && formData.value.variations.combinations.length === 0) {
    errors.value.variations = 'Debe configurar al menos una variación con precio';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) return;

  formData.value.name = cleanString(formData.value.name);
  formData.value.description = cleanString(formData.value.description);
  console.log('Submitting form data:', formData.value);
  emit('submit', formData.value);
};

const resetForm = () => {
  formData.value = {
    name: '',
    description: '',
    collectionId: '',
    collectionName: '',
    taxPercentage: 0,
    isActive: true,
    basePrice: 0,
    costPrice: 0,
    hasVariations: false,
    variations: {
      dimensions: [],
      combinations: [],
    },
    customAttributes: {},
  };
  errors.value = {};
};

// Load data on mount
onMounted(async () => {
  console.log('ProductForm mounted');
  if (!collectionStore.isLoaded) {
    try {
      await collectionStore.fetchAll();
    } catch (error) {
      console.error('Failed to load product collections:', error);
    }
  }

  console.log('props.initialData:', props.initialData);

  // Check if initial data has variations
  if (props.initialData && props.initialData.variations) {
    formData.value.hasVariations =
      props.initialData.variations.combinations &&
      props.initialData.variations.combinations.length > 0;
  }
});
</script>

<template>
  <div class="">
    <h2>{{ title }}</h2>

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
            class="w-full px-3 py-2 border border-neutral-300 rounded-md"
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
            class="w-full px-3 py-2 border border-neutral-300 rounded-md"
          />
        </div>

        <!-- Category and Tax Percentage Row -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <!-- Category Selection -->
          <div>
            <label
              for="collection"
              class="block text-sm font-medium text-neutral-700 mb-1"
            >
              Categoría
            </label>
            <select
              id="collection"
              v-model="formData.collectionId"
              @change="handleCategoryChange"
              class="w-full px-3 py-2 border border-neutral-300 rounded-md"
              :class="{ 'border-danger': errors.collectionId }"
              required
            >
              <option value="">Selecciona una categoría</option>
              <option
                v-for="category in availableCategories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </option>
            </select>
            <span
              v-if="errors.collectionId"
              class="text-sm text-danger mt-1 block"
            >
              {{ errors.collectionId }}
            </span>
          </div>

          <!-- Tax Percentage -->
          <div>
            <label
              for="taxPercentage"
              class="block text-sm font-medium text-neutral-700 mb-1"
            >
              Porcentaje de Impuesto
            </label>
            <div class="input-with-unit" data-unit="%">
              <input
                id="taxPercentage"
                type="number"
                v-model="formData.taxPercentage"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
          </div>
        </div>

        <!-- Variations and Active Status Row -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <!-- Has Variations Toggle -->
          <div>
            <YesNoToggle
              v-model="formData.hasVariations"
              @update:modelValue="toggleVariations"
              label="¿Este producto tiene variaciones?"
            />
          </div>

          <!-- Active Status -->
          <div>
            <YesNoToggle
              v-model="formData.isActive"
              label="Producto activo"
            />
          </div>
        </div>
      </div>

      <!-- Variations Manager -->
      <div v-if="hasVariations">
        <VariationsManager
          :initial-variations="formData.variations"
          :category-templates="selectedCategory?.variationTemplates"
          :product-name="formData.name"
          :collection-id="formData.collectionId"
          @update="handleVariationUpdate"
        />

        <span
          v-if="errors.variations"
          class="text-sm text-danger mt-1 block"
        >
          {{ errors.variations }}
        </span>
      </div>

      <!-- Pricing Configuration for products without variations -->
      <div v-else class="base-card">
        <h4 class="text-lg font-medium text-neutral-800 mb-4">Configuración de Precios</h4>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Base Price -->
          <div>
            <label
              for="basePrice"
              class="block text-sm font-medium text-neutral-700 mb-1"
            >
              Precio de Venta
            </label>
            <div class="input-with-unit" data-unit="$">
              <input
                id="basePrice"
                type="number"
                v-model="formData.basePrice"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md"
                :class="{ 'border-danger': errors.basePrice }"
                min="0"
                step="50"
                placeholder="0"
              />
            </div>
            <span
              v-if="errors.basePrice"
              class="text-sm text-danger mt-1 block"
            >
              {{ errors.basePrice }}
            </span>
          </div>

          <!-- Cost Price -->
          <div>
            <label
              for="costPrice"
              class="block text-sm font-medium text-neutral-700 mb-1"
            >
              Precio de Costo
            </label>
            <div class="input-with-unit" data-unit="$">
              <input
                id="costPrice"
                type="number"
                v-model="formData.costPrice"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md"
                :class="{ 'border-danger': errors.costPrice }"
                min="0"
                step="50"
                placeholder="0"
              />
            </div>
            <span
              v-if="errors.costPrice"
              class="text-sm text-danger mt-1 block"
            >
              {{ errors.costPrice }}
            </span>
          </div>
        </div>

        <!-- Profit Margin Display -->
        <div v-if="formData.basePrice > 0 && formData.costPrice > 0" class="mt-4 p-4 bg-neutral-50 rounded-lg">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-neutral-600">Margen de ganancia:</span>
              <span class="ml-2 font-medium text-neutral-900">
                ${{ (formData.basePrice - formData.costPrice).toLocaleString('es-CO') }}
              </span>
            </div>
            <div>
              <span class="text-neutral-600">Porcentaje de ganancia:</span>
              <span class="ml-2 font-medium" :class="{
                'text-success': ((formData.basePrice - formData.costPrice) / formData.costPrice * 100) >= 30,
                'text-warning': ((formData.basePrice - formData.costPrice) / formData.costPrice * 100) >= 15 && ((formData.basePrice - formData.costPrice) / formData.costPrice * 100) < 30,
                'text-danger': ((formData.basePrice - formData.costPrice) / formData.costPrice * 100) < 15
              }">
                {{ ((formData.basePrice - formData.costPrice) / formData.costPrice * 100).toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>

        <p class="text-xs text-neutral-500 mt-4">
          Define los precios de venta y costo para productos sin variaciones. El margen de ganancia se calcula automáticamente.
        </p>
      </div>

      <!-- Form Actions -->
      <div class="base-card">
        <div class="flex gap-2 justify-end">
          <button type="submit" :disabled="loading" class="action-btn">
            {{ loading ? loadingText : submitButtonText }}
          </button>
          <button
            type="button"
            @click="$emit('cancel')"
            :disabled="loading"
            class="danger-btn"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      :is-open="confirmDialog.isOpen"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      confirm-text="Confirmar"
      cancel-text="Cancelar"
      @confirm="confirmDialog.onConfirm"
      @cancel="confirmDialog.onCancel"
    />
  </div>
</template>

<style scoped>
/* Remove browser default outlines from all form elements */
select {
  outline: none !important;
}

select:focus {
  outline: none !important;
}
</style>

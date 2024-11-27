<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import RecipeSelector from './RecipeSelector.vue';
import ProductVariationEditor from './ProductVariationEditor.vue';
import YesNoToggle from './YesNoToggle.vue';

const emit = defineEmits(['submit', 'cancel']);

const props = defineProps({
  initialData: {
    type: Object,
    default: () => null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const collectionStore = useProductCollectionStore();
const bakerySettingsStore = useBakerySettingsStore();

// Base structure for a variation
const createBaseVariation = (name = '', isWholeGrain = false) => ({
  name: isWholeGrain ? `${name} integral` : name,
  value: 0,
  basePrice: 0,
  isWholeGrain,
  recipe: {
    recipeSource: 'base',
    recipeId: null,
    ingredients: [],
  },
});

const formData = ref({
  name: '',
  collection: '',
  description: '',
  hasVariations: false,
  hasWholeGrain: false,
  variationType: '',
  variations: [],
  basePrice: 0,
  recipe: {
    recipeSource: null,
    recipeId: null,
    ingredients: [],
  },
});

// Get suggested variations from bakery settings
const suggestedVariations = computed(() => {
  if (!bakerySettingsStore.items.length) return {};
  return bakerySettingsStore.items[0].suggestedProductVariations;
});

// Separate functions for variation type handling
const getVariationsForType = (type) => {
  if (!type || !suggestedVariations.value[type]) return [];

  return suggestedVariations.value[type].defaults.map(variation =>
    createBaseVariation(variation.name),
  );
};

const handleVariationTypeChange = (type) => {
  formData.value.variationType = type;

  // Reset variations array
  formData.value.variations = [];

  // Handle different variation types
  if (type === 'CUSTOM') {
    addVariation();
    return;
  }

  // Get base variations for selected type
  const baseVariations = getVariationsForType(type);
  formData.value.variations = baseVariations;

  // Apply whole grain variations if needed
  if (formData.value.hasWholeGrain) {
    applyWholeGrainVariations();
  }
};

// Separate function for whole grain handling
const applyWholeGrainVariations = () => {
  const currentVariations = [...formData.value.variations];

  // Create whole grain versions only for non-whole grain variations
  const wholeGrainVariations = currentVariations
    .filter(v => !v.isWholeGrain)
    .map(v => createBaseVariation(v.name, true));

  formData.value.variations = [...currentVariations, ...wholeGrainVariations];
};

// Simplified variation management
const addVariation = () => {
  const newVariations = [createBaseVariation()];

  if (formData.value.hasWholeGrain) {
    newVariations.push(createBaseVariation('', true));
  }

  formData.value.variations.push(...newVariations);
};

const removeVariation = (index) => {
  // If whole grain is enabled, remove pairs of variations
  if (formData.value.hasWholeGrain && index % 2 === 0) {
    formData.value.variations.splice(index, 2);
  } else {
    formData.value.variations.splice(index, 1);
  }
};

const updateVariation = (index, updatedVariation) => {
  // Update the variation
  formData.value.variations[index] = updatedVariation;

  // If whole grain is enabled, update the corresponding whole grain variation
  if (formData.value.hasWholeGrain && !updatedVariation.isWholeGrain) {
    const wholeGrainIndex = index + 1;
    if (formData.value.variations[wholeGrainIndex]?.isWholeGrain) {
      formData.value.variations[wholeGrainIndex] = {
        ...updatedVariation,
        name: `${updatedVariation.name} integral`,
        isWholeGrain: true,
      };
    }
  }
};

// Watch for whole grain changes
watch(() => formData.value.hasWholeGrain, (newValue) => {
  if (!formData.value.variationType) return;

  if (newValue) {
    applyWholeGrainVariations();
  } else {
    // Remove whole grain variations
    formData.value.variations = formData.value.variations.filter(v => !v.isWholeGrain);
  }
});

// Reset form
const resetForm = () => {
  formData.value = {
    name: '',
    collection: '',
    description: '',
    hasVariations: false,
    hasWholeGrain: false,
    variationType: '',
    variations: [],
    basePrice: 0,
    recipe: {
      recipeSource: null,
      recipeId: null,
      ingredients: [],
    },
  };
};

// Handle form submission
const handleSubmit = () => {
  console.log('Form submission data:', formData.value);
  emit('submit', formData.value);
};

// Initialize form with initial data if provided
const initializeForm = () => {
  if (props.initialData) {
    formData.value = { ...props.initialData };
  }
};

onMounted(async () => {
  if (collectionStore.items.length === 0) {
    await collectionStore.fetchAll();
  }
  if (bakerySettingsStore.items.length === 0) {
    await bakerySettingsStore.fetchById('default');
  }
  initializeForm();
});
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information -->
    <div class="base-card">
      <h4>Información Básica</h4>

      <div>
        <label for="productName">Nombre del Producto</label>
        <input
          id="productName"
          type="text"
          v-model="formData.name"
          required
        />
      </div>

      <div>
        <label for="description">Descripción</label>
        <textarea
          id="description"
          v-model="formData.description"
          rows="3"
        />
      </div>

      <div>
        <label for="collection">Colección</label>
        <select
          id="collection"
          v-model="formData.collection"
        >
          <option value="">Seleccionar colección</option>
          <option
            v-for="collection in collectionStore.items"
            :key="collection.id"
            :value="collection.id"
          >
            {{ collection.name }}
          </option>
        </select>
      </div>

      <div>
        <YesNoToggle
          v-model="formData.hasVariations"
          label="¿Tiene variaciones?"
        />
      </div>
    </div>

    <!-- Variations Section -->
    <div v-if="formData.hasVariations" class="base-card" >
      <h4>Variaciones del Producto</h4>

      <!-- Variation Type Selection -->
      <div>
        <label for="variationType">Tipo de Variación</label>
        <select
          id="variationType"
          v-model="formData.variationType"
          @change="handleVariationTypeChange(formData.variationType)"
        >
          <option value="">Seleccionar tipo</option>
          <option value="WEIGHT">Peso (g)</option>
          <option value="QUANTITY">Cantidad</option>
          <option value="CUSTOM">Personalizado</option>
        </select>
      </div>

      <!-- Whole Grain Toggle -->
      <div v-if="formData.variationType">

        <YesNoToggle
          v-model="formData.hasWholeGrain"
          label="¿Incluir versión integral?"
        />
      </div>

      <!-- Variations List -->
      <div v-if="formData.variationType" class="grid grid-cols-1 gap-4 ">

        <div v-for="(variation, index) in formData.variations" :key="index">
          <ProductVariationEditor
            :variation="variation"
            :variation-type="formData.variationType"
            :index="index"
            :disabled="loading"
            @update:variation="updateVariation(index, $event)"
            @remove="removeVariation(index)"
            @recipe-update="(newData) => handleVariationRecipeUpdate(index, newData)"
          />
        </div>

        <button type="button" @click="addVariation" :disabled="loading" class="utility-btn !m-0 !mb-4 w-1/4">
          Agregar Variación
        </button>
      </div>

    </div>

    <!-- Non-variation product details -->
    <div v-if="!formData.hasVariations" class="base-card">
      <h4>Detalles</h4>

      <div>
        <label for="basePrice">Precio Base</label>
        <input
          id="basePrice"
          type="number"
          v-model="formData.basePrice"
          min="0"
          step="100"
        />
      </div>

    </div>

    <!-- Form Actions -->
    <div class="base-card flex gap-2">

      <button class="action-btn" type="submit" :disabled="loading">
        {{ loading ? 'Guardando...' : 'Guardar Producto' }}
      </button>
      <button class="action-btn" type="button" @click="resetForm" :disabled="loading">
        Resetear
      </button>
    </div>
  </form>
</template>

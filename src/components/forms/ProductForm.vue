<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import RecipeSelector from './RecipeSelector.vue';
import TemplateVariation from '@/components/TemplateVariation.vue';
import YesNoToggle from './YesNoToggle.vue';
import { cleanString, getVariationTypeLabel } from '@/utils/helpers';

const emit = defineEmits(['submit', 'cancel']);

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

const isEditMode = ref(false);
const collectionStore = useProductCollectionStore();
const bakerySettingsStore = useBakerySettingsStore();

// Base structure for a variation
const createBaseVariation = (templateVariation = {}, isWholeGrain = false) => ({
  name: isWholeGrain
    ? `${templateVariation.name || ''} integral`
    : templateVariation.name || '',
  value: templateVariation.value || 0,
  basePrice: templateVariation.basePrice || 0,
  isWholeGrain,
  recipe: {
    recipeSource: 'base',
    recipeId: null,
    ingredients: [],
  },
});

// Define the fixed variation
const getFixedVariation = () => ({
  id: 'otra-variation-fixed',
  name: 'otra',
  value: 1000,
  basePrice: 10000,
  isWholeGrain: false,
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
  taxPercentage: 0,
  recipe: {
    recipeSource: null,
    recipeId: null,
    ingredients: [],
  },
});

// New template for adding variations
const newVariation = ref({
  name: '',
  value: 0,
  basePrice: 0,
  unit: 'g',
  type: 'WEIGHT',
  isWholeGrain: false,
  recipe: {
    recipeSource: 'base',
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

  return suggestedVariations.value[type].defaults.map((variation) =>
    createBaseVariation(variation),
  );
};

const selectedVariationType = ref(formData.value.variationType);

// Get selected collection for variation type options
const selectedCollection = computed(() => {
  if (!formData.value.collection) return null;
  return collectionStore.items.find(c => c.id === formData.value.collection);
});

const handleVariationTypeChange = () => {
  if (isEditMode.value) return;

  if (
    formData.value.variations.length &&
    !window.confirm(
      '¿Está seguro que desea continuar? Se perderán algunas variaciones.',
    )
  ) {
    // Revert the selection to the current variation type
    selectedVariationType.value = formData.value.variationType;
    return;
  }

  // Update the form data with the new variation type
  formData.value.variationType = selectedVariationType.value;
  formData.value.variations = [];

  if (selectedVariationType.value === 'CUSTOM') {
    addVariation();
    return;
  }

  // Check if user selected the category's variation type
  if (selectedVariationType.value === 'CATEGORY' && selectedCollection.value) {
    loadVariationsFromCollection(selectedCollection.value);
    return;
  }

  const baseVariations = getVariationsForType(selectedVariationType.value);
  formData.value.variations = baseVariations;

  if (formData.value.hasWholeGrain) {
    applyWholeGrainVariations();
  }
};

// Separate function for whole grain handling
const applyWholeGrainVariations = () => {
  if (isEditMode.value) return;

  const newVariations = formData.value.variations.flatMap((variation) => [
    variation,
    createBaseVariation(variation, true),
  ]);
  formData.value.variations = newVariations;
};

// Update existing variation
const updateVariation = (index, payload) => {
  formData.value.variations[index][payload.field] = payload.value;

  // Auto-update whole grain name if regular variation name changes
  if (!isEditMode.value && formData.value.hasWholeGrain && payload.field === 'name' && !formData.value.variations[index].isWholeGrain) {
    const nextIndex = index + 1;
    if (formData.value.variations[nextIndex]?.isWholeGrain) {
      formData.value.variations[nextIndex].name = `${payload.value} integral`;
    }
  }

  // Trigger proportional pricing if basePrice is updated (with debounce)
  if (payload.field === 'basePrice' && payload.value > 0) {
    // Clear existing timeout
    if (proportionalPricingTimeout) {
      clearTimeout(proportionalPricingTimeout);
    }

    // Set new timeout to trigger after user stops typing
    proportionalPricingTimeout = setTimeout(() => {
      calculateProportionalPrices(index, payload.value);
    }, 800); // Wait 800ms after user stops typing
  }
};

// Update new variation template
const updateNewVariation = (payload) => {
  newVariation.value[payload.field] = payload.value;
};

// Add new variation using template
const addNewVariation = () => {
  if (!newVariation.value.name || !newVariation.value.value) {
    return;
  }

  // Create a deep copy to avoid reference issues
  const baseVariation = {
    name: newVariation.value.name,
    value: newVariation.value.value,
    basePrice: newVariation.value.basePrice,
    unit: newVariation.value.unit,
    type: newVariation.value.type,
    isWholeGrain: false,
    recipe: {
      recipeSource: 'base',
      recipeId: null,
      ingredients: [],
    },
  };

  formData.value.variations.push(baseVariation);

  // If whole grain is enabled, add integral version
  if (formData.value.hasWholeGrain) {
    const wholeGrainVariation = createBaseVariation(baseVariation, true);
    formData.value.variations.push(wholeGrainVariation);
  }

  resetNewVariation();
};

// Remove variation
const removeVariation = (index) => {
  formData.value.variations.splice(index, 1);
};

// Reset new variation template
const resetNewVariation = () => {
  newVariation.value = {
    name: '',
    value: 0,
    basePrice: 0,
    unit: formData.value.variationType === 'WEIGHT' ? 'g' : '',
    type: formData.value.variationType || 'WEIGHT',
    isWholeGrain: false,
    recipe: {
      recipeSource: 'base',
      recipeId: null,
      ingredients: [],
    },
  };
};

// Legacy addVariation function for compatibility
const addVariation = () => {
  if (isEditMode.value) {
    formData.value.variations.push(createBaseVariation());
    formData.value.variations.push(createBaseVariation({}, true));
    return;
  }

  const baseVariation = createBaseVariation();
  const newVariations = formData.value.hasWholeGrain
    ? [baseVariation, createBaseVariation(baseVariation, true)]
    : [baseVariation];
  formData.value.variations.push(...newVariations);
};

// Watch for collection selection to load templates
watch(
  () => formData.value.collection,
  (collectionId) => {
    if (!collectionId || isEditMode.value) return;

    const collection = collectionStore.items.find(c => c.id === collectionId);
    if (collection?.variationTemplates?.length > 0) {
      // Auto-enable variations
      formData.value.hasVariations = true;

      // Set variation type to CATEGORY to show category templates
      formData.value.variationType = 'CATEGORY';
      selectedVariationType.value = 'CATEGORY';

      // Set whole grain option from collection
      formData.value.hasWholeGrain = collection.hasWholeGrainVariations || false;

      // Load variations from collection templates
      loadVariationsFromCollection(collection);

      // Update new variation template
      newVariation.value.type = collection.defaultVariationType || 'WEIGHT';
      newVariation.value.unit = collection.defaultVariationType === 'WEIGHT' ?
        (collection.defaultUnit || 'g') : '';
    }
  },
);

// Function to load variations from collection templates
const loadVariationsFromCollection = (collection) => {
  if (!collection.variationTemplates?.length) return;

  const loadedVariations = collection.variationTemplates.map(template => ({
    name: template.name,
    value: template.value,
    basePrice: template.basePrice || 0,
    unit: template.unit,
    type: template.type,
    isWholeGrain: template.isWholeGrain,
    recipe: {
      recipeSource: 'base',
      recipeId: null,
      ingredients: [],
    },
  }));

  formData.value.variations = loadedVariations;
};

// Debounce timeout for proportional pricing
let proportionalPricingTimeout = null;

// Function to calculate proportional prices
const calculateProportionalPrices = (referenceIndex, referencePrice) => {
  if (!referencePrice || !formData.value.variations.length) return;

  const referenceVariation = formData.value.variations[referenceIndex];
  if (!referenceVariation || !referenceVariation.value) return;

  // Check if all OTHER variation prices are zero (excluding the reference one)
  const otherVariations = formData.value.variations.filter((_, index) => index !== referenceIndex);
  const allOtherPricesZero = otherVariations.every(variation => variation.basePrice === 0);
  if (!allOtherPricesZero) return;

  const referenceValue = referenceVariation.value;
  const pricePerUnit = referencePrice / referenceValue;

  // Calculate proportional prices for all OTHER variations
  formData.value.variations.forEach((variation, index) => {
    if (index !== referenceIndex && variation.value > 0) {
      const proportionalPrice = variation.value * pricePerUnit;
      // Round to nearest 100
      variation.basePrice = Math.round(proportionalPrice / 100) * 100;
    }
  });
};

// Removed base price watcher - now triggered from variation updates

// Watch for variation type changes to update new variation template
watch(
  () => formData.value.variationType,
  (newType) => {
    if (newType) {
      newVariation.value.type = newType;
      newVariation.value.unit = newType === 'WEIGHT' ? 'g' : '';
    }
  },
);

// Watch for whole grain changes - only in create mode
watch(
  () => formData.value.hasWholeGrain,
  (newValue, oldValue) => {
    if (isEditMode.value || !formData.value.variationType) return;

    if (
      !newValue &&
      oldValue &&
      formData.value.variations.some((v) => v.isWholeGrain)
    ) {
      if (
        !window.confirm(
          '¿Está seguro que desea continuar? Se perderán algunas variaciones.',
        )
      ) {
        formData.value.hasWholeGrain = true;
        return;
      }
    }

    if (newValue) {
      applyWholeGrainVariations();
    } else {
      formData.value.variations = formData.value.variations.filter(
        (v) => !v.isWholeGrain,
      );
    }
  },
);

const handleSubmit = () => {
  let finalVariations = [...formData.value.variations, getFixedVariation()];
  if (!formData.value.hasVariations) finalVariations = [];
  formData.value.name = cleanString(formData.value.name);
  formData.value.collectionId = formData.value.collection;
  formData.value.currentPrice = formData.value.basePrice;
  formData.value.collectionName = collectionStore.items.find(
    (c) => c.id === formData.value.collection,
  )?.name;
  emit('submit', { ...formData.value, variations: finalVariations });
};

const resetForm = () => {
  formData.value = {
    name: '',
    collection: '',
    collectionId: '',
    collectionName: '',
    description: '',
    hasVariations: false,
    hasWholeGrain: false,
    variationType: '',
    variations: [],
    basePrice: 0,
    taxPercentage: 0, // Reset tax percentage
    recipe: {
      recipeSource: null,
      recipeId: null,
      ingredients: [],
    },
  };
};

// Computed property for submit button text
const submitButtonText = computed(() => {
  return props.initialData ? 'Actualizar Producto' : 'Crear Producto';
});

// Computed property for loading text
const loadingText = computed(() => {
  return props.initialData ? 'Actualizando...' : 'Creando...';
});

const initializeForm = () => {
  if (props.initialData) {
    isEditMode.value = true;
    // Filter out the 'otra' variation
    const rawVariations = props.initialData.variations?.filter(v => v.name !== 'otra') || [];

    // Organize variations in pairs
    const organizedVariations = [];
    const regularVariations = rawVariations.filter(v => !v.isWholeGrain);

    regularVariations.forEach(regVar => {
      // Add regular variation
      organizedVariations.push(regVar);
      // Find and add matching whole grain variation if exists
      const wholeGrainMatch = rawVariations.find(v =>
        v.isWholeGrain &&
        v.name.includes(regVar.name),
      );
      if (wholeGrainMatch) {
        organizedVariations.push(wholeGrainMatch);
      }
    });

    // Add any remaining whole grain variations that didn't have matches
    const remainingWholeGrain = rawVariations.filter(v =>
      v.isWholeGrain &&
      !organizedVariations.includes(v),
    );
    organizedVariations.push(...remainingWholeGrain);

    formData.value = {
      name: props.initialData.name || '',
      collection: props.initialData.collectionId || '',
      description: props.initialData.description || '',
      hasVariations: organizedVariations.length > 0,
      variations: organizedVariations,
      basePrice: props.initialData.basePrice || 0,
      taxPercentage: props.initialData.taxPercentage || 0,
      recipe: props.initialData.recipe || {
        recipeSource: null,
        recipeId: null,
        ingredients: [],
      },
    };
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
  <div class="form-container">
    <h2>{{ title }}</h2>
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

        <!-- <div>
          <label for="description">Descripción</label>
          <textarea
            id="description"
            v-model="formData.description"
            rows="3"
          />
        </div> -->

        <div>
          <label for="collection">Colección</label>
          <select
            id="collection"
            v-model="formData.collection"
            required
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

        <!-- Add tax percentage input -->
        <div>
          <label for="taxPercentage">Porcentaje de Impuesto (%)</label>
          <input
            id="taxPercentage"
            type="number"
            v-model="formData.taxPercentage"
            min="0"
            max="100"
            step="0.5"
          />
        </div>

        <div>
          <YesNoToggle
            v-model="formData.hasVariations"
            label="¿Tiene variaciones?"
          />
        </div>
      </div>

      <!-- Variations Section -->
      <div v-if="formData.hasVariations" class="base-card">
        <h4>Variaciones del Producto</h4>

        <!-- Variation Type Selection - only show in create mode -->
        <template v-if="!isEditMode">
          <div>
            <label for="variationType">Tipo de Variación</label>
            <select
              id="variationType"
              v-model="selectedVariationType"
              @change="handleVariationTypeChange"
            >
              <option value="">Seleccionar tipo</option>
              <option
                v-if="selectedCollection?.variationTemplates?.length > 0"
                value="CATEGORY"
              >
                {{ selectedCollection.name }} ({{ getVariationTypeLabel(selectedCollection.defaultVariationType) }})
              </option>
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
        </template>

        <!-- Variations List - Always Editable -->
        <div class="space-y-3">
          <!-- Existing Variations -->
          <TemplateVariation
            v-for="(variation, index) in formData.variations"
            :key="`variation-${index}-${variation.id || ''}-${variation.name}-${variation.isWholeGrain ? 'whole' : 'regular'}`"
            :template="variation"
            :is-new="false"
            :default-variation-type="isEditMode ? 'CUSTOM' : formData.variationType"
            :base-price="true"
            :disabled="loading"
            @remove="removeVariation(index)"
            @update="(payload) => updateVariation(index, payload)"
          />

          <!-- Add New Variation Form -->
          <TemplateVariation
            v-if="formData.variationType || isEditMode"
            :template="newVariation"
            :is-new="true"
            :default-variation-type="isEditMode ? 'CUSTOM' : formData.variationType"
            :base-price="true"
            :disabled="loading"
            @add="addNewVariation"
            @update="(payload) => updateNewVariation(payload)"
          />
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
            step="50"
          />
        </div>
      </div>

      <!-- Form Actions -->
      <div class="base-card flex gap-2">
        <button class="action-btn" type="submit" :disabled="loading">
          {{ loading ? loadingText : submitButtonText}}
        </button>
        <button
          class="action-btn"
          type="button"
          @click="resetForm"
          :disabled="loading"
        >
          Resetear
        </button>
      </div>
    </form>
  </div>
</template>

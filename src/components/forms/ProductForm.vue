<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import RecipeSelector from './RecipeSelector.vue';
import ProductVariationEditor from './ProductVariationEditor.vue';
import YesNoToggle from './YesNoToggle.vue';

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
  name: 'otra',
  value: 1000,
  basePrice: 1000,
  isWholeGrain: false,
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

  return suggestedVariations.value[type].defaults.map((variation) =>
    createBaseVariation(variation),
  );
};

const selectedVariationType = ref(formData.value.variationType);

const handleVariationTypeChange = () => {
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

  const baseVariations = getVariationsForType(selectedVariationType.value);
  formData.value.variations = baseVariations;

  if (formData.value.hasWholeGrain) {
    applyWholeGrainVariations();
  }
};

// Separate function for whole grain handling
const applyWholeGrainVariations = () => {
  const newVariations = formData.value.variations.flatMap((variation) => [
    variation,
    createBaseVariation(variation, true),
  ]);
  formData.value.variations = newVariations;
};

// Simplified variation management
const addVariation = () => {
  const baseVariation = createBaseVariation();
  const newVariations = formData.value.hasWholeGrain
    ? [baseVariation, createBaseVariation(baseVariation, true)]
    : [baseVariation];
  formData.value.variations.push(...newVariations);
};

const removeVariation = (index) => {
  formData.value.variations.splice(index, 1);
};

const updateVariation = (index, updatedVariation) => {
  formData.value.variations[index] = updatedVariation;

  if (formData.value.hasWholeGrain && !updatedVariation.isWholeGrain) {
    const nextIndex = index + 1;
    if (formData.value.variations[nextIndex]?.isWholeGrain) {
      formData.value.variations[nextIndex] = {
        ...formData.value.variations[nextIndex],
        name: `${updatedVariation.name} integral`,
      };
    }
  }
};

// Watch for whole grain changes
watch(
  () => formData.value.hasWholeGrain,
  (newValue, oldValue) => {
    if (!formData.value.variationType) return;

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

// Append the fixed variation and submit
const handleSubmit = () => {
  const finalVariations = [...formData.value.variations, getFixedVariation()];
  console.log('Form submission data:', {
    ...formData.value,
    variations: finalVariations,
  });
  // emit('submit', {...formData.value, variations: finalVariations });
};

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

        <!-- Variation Type Selection -->
        <div>
          <label for="variationType">Tipo de Variación</label>
          <select
            id="variationType"
            v-model="selectedVariationType"
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
        <div v-if="formData.variationType" class="grid grid-cols-1 gap-2">
          <div v-for="(variation, index) in formData.variations" :key="index">
            <ProductVariationEditor
              :variation="variation"
              :variation-type="formData.variationType"
              :index="index"
              :disabled="loading"
              :is-fixed="variation.isFixed"
              @update:variation="updateVariation(index, $event)"
              @remove="removeVariation(index)"

            />
          </div>

          <button
            type="button"
            @click="addVariation"
            :disabled="loading"
            class="utility-btn !m-0 !mb-4 w-1/4"
          >
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
          {{ loading ? "Guardando..." : "Guardar Producto" }}
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

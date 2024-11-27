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
const createBaseVariation = (templateVariation = {}, isWholeGrain = false) => ({
  name: isWholeGrain ? `${templateVariation.name || ''} integral` : templateVariation.name || '',
  value: templateVariation.value || 0,
  basePrice: templateVariation.basePrice || 0,
  isWholeGrain,
  isFixed: templateVariation.isFixed || false,
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

// Helper to ensure fixed variations are at the end
const sortVariationsWithFixed = (variations) => {
  const fixed = variations.filter(v => v.isFixed);
  const regular = variations.filter(v => !v.isFixed);
  return [...regular, ...fixed];
};

// Utility function for confirmation
const confirmChange = (message = '¿Está seguro que desea continuar? Se perderán algunas variaciones.') => {
  return window.confirm(message);
};

// Separate functions for variation type handling
const getVariationsForType = (type) => {
  if (!type || !suggestedVariations.value[type]) return [];

  return suggestedVariations.value[type].defaults.map(variation =>
    createBaseVariation({
      ...variation,
      isFixed: variation.name.toLowerCase() === 'otra', // Mark 'otra' as fixed
    }),
  );
};

const handleVariationTypeChange = (type) => {

  if (formData.value.variations.length) {
    console.log('type', type);
    if (!confirmChange()) {
      return;

    }
  }

  console.log('im here');

  formData.value.variationType = type;
  formData.value.variations = [];

  if (type === 'CUSTOM') {
    addVariation();
    return;
  }

  const baseVariations = getVariationsForType(type);
  formData.value.variations = sortVariationsWithFixed(baseVariations);

  if (formData.value.hasWholeGrain) {
    applyWholeGrainVariations();
  }
};

// Separate function for whole grain handling
const applyWholeGrainVariations = () => {
  const newVariations = [];

  formData.value.variations.forEach(variation => {
    if (!variation.isFixed) {
      newVariations.push(variation);
      newVariations.push(createBaseVariation(variation, true));
    } else {
      newVariations.push(variation);
    }
  });

  formData.value.variations = sortVariationsWithFixed(newVariations);
};

// Simplified variation management
const addVariation = () => {
  const baseVariation = createBaseVariation();

  if (formData.value.hasWholeGrain) {
    const wholeGrainVariation = createBaseVariation(baseVariation, true);
    formData.value.variations = sortVariationsWithFixed([
      ...formData.value.variations.filter(v => !v.isFixed),
      baseVariation,
      wholeGrainVariation,
      ...formData.value.variations.filter(v => v.isFixed),
    ]);
  } else {
    formData.value.variations = sortVariationsWithFixed([
      ...formData.value.variations.filter(v => !v.isFixed),
      baseVariation,
      ...formData.value.variations.filter(v => v.isFixed),
    ]);
  }
};

const removeVariation = (index) => {
  if (formData.value.variations[index].isFixed) return;
  formData.value.variations.splice(index, 1);
};

const updateVariation = (index, updatedVariation) => {
  if (formData.value.variations[index].isFixed) return;

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
watch(() => formData.value.hasWholeGrain, (newValue, oldValue) => {
  if (!formData.value.variationType) return;

  // Only ask for confirmation when turning off whole grain and variations exist
  if (!newValue && oldValue && formData.value.variations.some(v => v.isWholeGrain)) {
    if (!confirmChange()) {
      // Revert the change if user cancels
      formData.value.hasWholeGrain = true;
      return;
    }
  }

  if (newValue) {
    applyWholeGrainVariations();
  } else {
    formData.value.variations = sortVariationsWithFixed(
      formData.value.variations.filter(v => !v.isWholeGrain || v.isFixed),
    );
  }
});

const handleSubmit = () => {
  console.log('Form submission data:', formData.value);
  // emit('submit', formData.value);
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
            :is-fixed="variation.isFixed"
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

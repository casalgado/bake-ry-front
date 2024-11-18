<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import RecipeSelector from './RecipeSelector.vue';
import ProductVariationEditor from './ProductVariationEditor.vue';

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

const formData = ref({
  name: '',
  collection: '',
  description: '',
  hasVariations: false,
  hasWholeGrain: false,
  variationType: '', // 'WEIGHT', 'QUANTITY', or 'CUSTOM'
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

// Handle variation type change
const handleVariationTypeChange = (type) => {
  formData.value.variationType = type;
  formData.value.variations = [];

  if (type === 'CUSTOM') {
    addVariation();
    return;
  }

  if (type && suggestedVariations.value[type]) {
    const baseVariations = suggestedVariations.value[type].defaults.map(v => ({
      ...v,
      recipe: {
        recipeSource: 'base',
        recipeId: null,
        ingredients: [],
      },
    }));

    if (formData.value.hasWholeGrain) {
      const wholeGrainVariations = baseVariations.map(v => ({
        ...v,
        name: `${v.name} integral`,
        isWholeGrain: true,
        recipe: {
          recipeSource: 'base',
          recipeId: null,
          ingredients: [],
        },
      }));
      formData.value.variations = [...baseVariations, ...wholeGrainVariations];
    } else {
      formData.value.variations = baseVariations;
    }
  }
};

// Watch for whole grain changes
watch(() => formData.value.hasWholeGrain, (newValue) => {
  if (formData.value.variationType && formData.value.variationType !== 'CUSTOM') {
    handleVariationTypeChange(formData.value.variationType);
  }
});

// Add new variation
const addVariation = () => {
  const newVariation = {
    name: '',
    value: 0,
    basePrice: 0,
    recipe: {
      recipeSource: 'base',
      recipeId: null,
      ingredients: [],
    },
  };

  if (formData.value.hasWholeGrain) {
    formData.value.variations.push(
      { ...newVariation, isWholeGrain: false },
      { ...newVariation, name: 'integral', isWholeGrain: true },
    );
  } else {
    formData.value.variations.push(newVariation);
  }
};

// Remove variation
const removeVariation = (index) => {
  if (formData.value.hasWholeGrain && formData.value.variationType !== 'CUSTOM') {
    // If it's a regular variation, remove both regular and whole grain version
    const isWholeGrain = formData.value.variations[index].isWholeGrain;
    const baseIndex = isWholeGrain ?
      index - formData.value.variations.filter(v => !v.isWholeGrain).length :
      index;

    // Remove both versions
    formData.value.variations = formData.value.variations.filter((v, i) => {
      if (isWholeGrain) {
        return i !== index && i !== baseIndex;
      }
      return i !== index && i !== (baseIndex + formData.value.variations.filter(v => !v.isWholeGrain).length);
    });
  } else {
    formData.value.variations.splice(index, 1);
  }
};

// Update variation
const updateVariation = (index, updatedVariation) => {
  formData.value.variations[index] = updatedVariation;
};

// Update variation recipe
const handleVariationRecipeUpdate = (index, newRecipeData) => {
  formData.value.variations[index].recipe = newRecipeData;
};

// Handle main recipe update
const handleRecipeUpdate = (newRecipeData) => {
  formData.value.recipe = newRecipeData;
};

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
      <h2>Información Básica</h2>

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
        <label for="hasVariations">¿Tiene variaciones?</label>
        <input
          id="hasVariations"
          type="checkbox"
          v-model="formData.hasVariations"
        />
      </div>
    </div>

    <!-- Variations Section -->
    <div v-if="formData.hasVariations" class="base-card" >
      <h2>Variaciones del Producto</h2>

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
        <label for="hasWholeGrain">¿Incluir versión integral?</label>
        <input
          id="hasWholeGrain"
          type="checkbox"
          v-model="formData.hasWholeGrain"
        />
      </div>

      <!-- Variations List -->
      <div v-if="formData.variationType" class="grid grid-cols-4 gap-4">

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

        <button type="button" @click="addVariation" :disabled="loading">
          Agregar Variación
        </button>
      </div>
    </div>

    <!-- Non-variation product details -->
    <div v-if="!formData.hasVariations" class="base-card">
      <h2>Detalles del Producto</h2>

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

      <!-- Recipe Selection -->
      <RecipeSelector
        :recipe-data="formData.recipe"
        @update="handleRecipeUpdate"
        :disabled="loading"
      />
    </div>

    <!-- Form Actions -->
    <div class="base-card">
      <button type="button" @click="emit('cancel')" :disabled="loading">
        Cancelar
      </button>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Guardando...' : 'Guardar Producto' }}
      </button>
      <button type="button" @click="resetForm" :disabled="loading">
        Resetear
      </button>
    </div>
  </form>
</template>

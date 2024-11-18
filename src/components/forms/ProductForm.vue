<script setup>
import { ref, computed, onMounted } from 'vue';
import { useProductCollectionStore } from '@/stores/productCollectionStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import RecipeSelector from './RecipeSelector.vue';

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
  variationType: '', // 'WEIGHT', 'QUANTITY', or 'CUSTOM'
  variations: [],
  basePrice: 0,
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

// Handle variation type change
const handleVariationTypeChange = (type) => {
  formData.value.variationType = type;
  formData.value.variations = [];

  if (type === 'CUSTOM') {
    addVariation(); // Add one empty variation for custom type
    return;
  }

  if (type && suggestedVariations.value[type]) {
    // Initialize variations with defaults but add a recipe object for each
    formData.value.variations = suggestedVariations.value[type].defaults.map(v => ({
      ...v,
      recipe: {
        recipeSource: 'base',
        recipeId: null,
        ingredients: [],
      },
    }));
  }
};

// Add new variation
const addVariation = () => {
  formData.value.variations.push({
    name: '',
    value: 0,
    basePrice: 0,
    recipe: {
      recipeSource: 'base',
      recipeId: null,
      ingredients: [],
    },
  });
};

// Remove variation
const removeVariation = (index) => {
  formData.value.variations.splice(index, 1);
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
    variationType: '',
    variations: [],
    basePrice: 0,
    recipe: {
      recipeSource: 'base',
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
    await bakerySettingsStore.fetchAll();
  }
  initializeForm();
});
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information -->
    <div>
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
    <div v-if="formData.hasVariations">
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

      <!-- Variations List -->
      <div v-if="formData.variationType">
        <div v-for="(variation, index) in formData.variations" :key="index">
          <div>
            <h3>Variación {{ index + 1 }}</h3>

            <div>
              <label>Nombre</label>
              <input type="text" v-model="variation.name" />
            </div>

            <div>
              <label>
                {{ formData.variationType === 'WEIGHT'
                  ? 'Peso (g)'
                  : formData.variationType === 'QUANTITY'
                    ? 'Cantidad'
                    : 'Valor'
                }}
              </label>
              <input
                type="number"
                v-model="variation.value"
                :step="formData.variationType === 'WEIGHT' ? '50' : '1'"
              />
            </div>

            <div>
              <label>Precio Base</label>
              <input
                type="number"
                v-model="variation.basePrice"
                step="100"
              />
            </div>

            <!-- Recipe Selector for each variation -->
            <RecipeSelector
              :recipe-data="variation.recipe"
              @update="(newData) => handleVariationRecipeUpdate(index, newData)"
              :disabled="false"
            />

            <button type="button" @click="() => removeVariation(index)">
              Eliminar Variación
            </button>
          </div>
        </div>

        <button type="button" @click="addVariation">
          Agregar Variación
        </button>
      </div>
    </div>

    <!-- Non-variation product details -->
    <div v-if="!formData.hasVariations">
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
        :disabled="false"
      />
    </div>

    <!-- Form Actions -->
    <div>
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

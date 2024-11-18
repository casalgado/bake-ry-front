<script setup>
import { ref, onMounted } from 'vue';
import { useRecipeStore } from '@/stores/recipeStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import IngredientModal from './IngredientModal.vue';

const props = defineProps({
  recipeData: {
    type: Object,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update']);

const recipeStore = useRecipeStore();
const ingredientStore = useIngredientStore();

// Add isExpanded state
const isExpanded = ref(false);
const showIngredientModal = ref(false);

onMounted(async () => {
  if (recipeStore.items.length === 0) await recipeStore.fetchAll();
  if (ingredientStore.items.length === 0) await ingredientStore.fetchAll();
});

const emitUpdate = (updates) => {
  emit('update', {
    ...props.recipeData,
    ...updates,
  });
};

const handleRecipeSelect = async (newRecipeId) => {
  if (newRecipeId) {
    try {
      const recipe = await recipeStore.getById(newRecipeId);
      emitUpdate({
        recipeId: newRecipeId,
        ingredients: recipe ? [...recipe.ingredients] : [],
      });

    } catch (error) {
      console.error('Error fetching recipe:', error);
      emitUpdate({
        recipeId: newRecipeId,
        ingredients: [],
      });
    }
  } else {
    emitUpdate({
      recipeId: null,
      ingredients: [],
    });
  }
};

const handleRecipeSourceChange = (source) => {
  if (props.recipeData.ingredients.length > 0 && !window.confirm('¿Estás seguro de querer cambiar origen y comenzar de nuevo?')) return;
  emitUpdate({
    recipeSource: source,
    recipeId: null,
    ingredients: [],
  });
};

const handleIngredientAdd = (ingredientData) => {
  emitUpdate({
    ingredients: [...props.recipeData.ingredients, ingredientData],
  });
};

const updateIngredientQuantity = (index, newQuantity) => {
  const updatedIngredients = [...props.recipeData.ingredients];
  updatedIngredients[index] = {
    ...updatedIngredients[index],
    quantity: Number(newQuantity),
  };
  emitUpdate({ ingredients: updatedIngredients });
};

const removeIngredient = (index) => {
  emitUpdate({
    ingredients: props.recipeData.ingredients.filter((_, i) => i !== index),
  });
};
</script>

<template>
  <!-- Show compact view when recipe is selected and not expanded -->
  <div v-if="props.recipeData.recipeId && !isExpanded">

    <div>
      <span>{{ recipeStore.items.find(r => r.id === props.recipeData.recipeId)?.ingredients.map(i =>`${i.name} (${i.quantity} ${i.unit})`).join(', ') }}</span>
      <button
        type="button"
        @click="isExpanded = true"
        :disabled="disabled"
      >
        Modificar Receta
      </button>
    </div>
  </div>

  <!-- Show initial button when no recipe selected and not expanded -->
  <div v-else-if="!isExpanded">

    <button
      type="button"
      @click="isExpanded = true"
      :disabled="disabled"
    >
      Elegir Receta
    </button>
  </div>

  <!-- Show full component when expanded -->
  <div v-else class="flat-card">
    <h3>Selección de Receta</h3>
    <div>
      <button
        type="button"
        @click="handleRecipeSourceChange('base')"
        :class="{ active: props.recipeData.recipeSource === 'base' }"
        :disabled="disabled"
      >
        Comenzar con Receta Base
      </button>
      <button
        type="button"
        @click="handleRecipeSourceChange('existing')"
        :class="{ active: props.recipeData.recipeSource === 'existing' }"
        :disabled="disabled"
      >
        Usar Receta Existente
      </button>
      <button
        type="button"
        @click="handleRecipeSourceChange('new')"
        :class="{ active: props.recipeData.recipeSource === 'new' }"
        :disabled="disabled"
      >
        Crear Nueva Receta
      </button>
    </div>

    <!-- Base Recipe Selection -->
    <div v-if="props.recipeData.recipeSource === 'base'">
      <p>
        Selecciona una receta base para comenzar. Podrás personalizarla después.
      </p>
      <select
        :value="props.recipeData.recipeId"
        @change="handleRecipeSelect($event.target.value)"
        :disabled="disabled"
      >
        <option value="">Seleccionar receta base</option>
        <option
          v-for="recipe in recipeStore.items.filter((r) => r.isBase)"
          :key="recipe.id"
          :value="recipe.id"
        >
          {{ recipe.name }}
        </option>
      </select>
    </div>

    <!-- Existing Recipe Selection -->
    <div v-if="props.recipeData.recipeSource === 'existing'">
      <p>
        Selecciona una de tus recetas existentes. Podrás modificarla si lo
        necesitas.
      </p>
      <select
        :value="props.recipeData.recipeId"
        @change="handleRecipeSelect($event.target.value)"
        :disabled="disabled"
      >
        <option value="">Seleccionar receta existente</option>
        <option
          v-for="recipe in recipeStore.items.filter((r) => !r.isBase)"
          :key="recipe.id"
          :value="recipe.id"
        >
          {{ recipe.name }}
        </option>
      </select>
    </div>

    <!-- New Recipe Creation -->
    <div v-if="props.recipeData.recipeSource === 'new'">
      <p>Crea una nueva receta desde cero para este producto.</p>
    </div>

    <!-- Ingredients Section -->
    <div
      v-if="
        props.recipeData.recipeSource === 'new' || props.recipeData.recipeId
      "
    >
      <h4>Ingredientes de la Receta</h4>

      <!-- Current Ingredients List -->
      <div v-if="props.recipeData.ingredients.length > 0">
        <div
          v-for="(ingredient, index) in props.recipeData.ingredients"
          :key="index"
          class="flex items-center gap-4 justify-between"
        >
          <span>{{ ingredient.name }}</span>
          <input
            type="number"
            :value="ingredient.quantity"
            @input="updateIngredientQuantity(index, $event.target.value)"
            :disabled="disabled"
            class="basis-1/3"
          />
          <span>{{ ingredient.unit }}</span>
          <button
            type="button"
            @click="removeIngredient(index)"
            :disabled="disabled"
          >
            Eliminar
          </button>
        </div>
      </div>

      <button
        type="button"
        @click="showIngredientModal = true"
        :disabled="disabled"
      >
        Agregar Ingrediente
      </button>
    </div>

    <!-- Cancel button to collapse the component -->
    <button
      type="button"
      @click="isExpanded = false"
      :disabled="disabled"
    >
      Guardar Receta
    </button>

    <!-- Ingredient Modal Component -->
    <IngredientModal
      :show="showIngredientModal"
      @close="showIngredientModal = false"
      @add="handleIngredientAdd"
    />
  </div>
</template>

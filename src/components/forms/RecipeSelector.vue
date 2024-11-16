<script setup>
import { ref, watch } from "vue";
import { useRecipeStore } from "@/stores/recipeStore";
import { useIngredientStore } from "@/stores/ingredientStore";
import IngredientModal from "./IngredientModal.vue";

const props = defineProps({
  initialRecipe: {
    type: Object,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:recipeData"]);

const recipeStore = useRecipeStore();
const ingredientStore = useIngredientStore();

// Recipe selection state
const recipeSource = ref("base"); // 'base', 'existing', 'new'
const selectedRecipe = ref(null);
const recipeIngredients = ref([]);
const showIngredientModal = ref(false);

// Initialize with initial recipe if provided
watch(
  () => props.initialRecipe,
  (newValue) => {
    if (newValue) {
      recipeSource.value = newValue.recipeSource;
      selectedRecipe.value = newValue.recipeId;
      recipeIngredients.value = [...newValue.ingredients];
    }
  },
  { immediate: true }
);

// Watch for recipe selection changes
watch(selectedRecipe, async (newValue) => {
  if (newValue) {
    const recipe = recipeStore.items.find((r) => r.id === newValue);
    if (recipe) {
      recipeIngredients.value = [...recipe.ingredients];
    }
  } else {
    recipeIngredients.value = [];
  }
});

// Watch for changes to emit updates
watch(
  [recipeSource, selectedRecipe, recipeIngredients],
  () => {
    emit("update:recipeData", {
      recipeSource: recipeSource.value,
      recipeId: selectedRecipe.value,
      ingredients: recipeIngredients.value,
    });
  },
  { deep: true }
);

const handleRecipeSourceChange = (source) => {
  recipeSource.value = source;
  selectedRecipe.value = null;
};

const handleIngredientAdd = (ingredientData) => {
  recipeIngredients.value.push({
    ...ingredientData,
    quantity: ingredientData.quantity,
  });
};

const updateIngredientQuantity = (index, newQuantity) => {
  recipeIngredients.value[index].quantity = newQuantity;
};

const removeIngredient = (index) => {
  recipeIngredients.value.splice(index, 1);
};

const reset = () => {
  recipeSource.value = "base";
  selectedRecipe.value = null;
  recipeIngredients.value = [];
};
</script>

<template>
  <div class="recipe-selector" :class="{ disabled }">
    <h3>Selección de Receta</h3>

    <div class="recipe-source-buttons">
      <button
        type="button"
        @click="handleRecipeSourceChange('base')"
        :class="{ active: recipeSource === 'base' }"
        :disabled="disabled"
      >
        Comenzar con Receta Base
      </button>
      <button
        type="button"
        @click="handleRecipeSourceChange('existing')"
        :class="{ active: recipeSource === 'existing' }"
        :disabled="disabled"
      >
        Usar Receta Existente
      </button>
      <button
        type="button"
        @click="handleRecipeSourceChange('new')"
        :class="{ active: recipeSource === 'new' }"
        :disabled="disabled"
      >
        Crear Nueva Receta
      </button>
    </div>

    <!-- Base Recipe Selection -->
    <div v-if="recipeSource === 'base'">
      <p>
        Selecciona una receta base para comenzar. Podrás personalizarla después.
      </p>
      <select v-model="selectedRecipe" :disabled="disabled">
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
    <div v-if="recipeSource === 'existing'">
      <p>
        Selecciona una de tus recetas existentes. Podrás modificarla si lo
        necesitas.
      </p>
      <select v-model="selectedRecipe" :disabled="disabled">
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
    <div v-if="recipeSource === 'new'">
      <p>Crea una nueva receta desde cero para este producto.</p>
    </div>

    <!-- Ingredients Section -->
    <div v-if="recipeSource === 'new' || selectedRecipe">
      <h4>Ingredientes de la Receta</h4>

      <!-- Current Ingredients List -->
      <div v-if="recipeIngredients.length > 0" class="ingredients-list">
        <div
          v-for="(ingredient, index) in recipeIngredients"
          :key="index"
          class="ingredient-item"
        >
          <span>{{ ingredient.name }}</span>
          <input
            type="number"
            :value="ingredient.quantity"
            @input="updateIngredientQuantity(index, $event.target.value)"
            :disabled="disabled"
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

    <!-- Ingredient Modal Component -->
    <IngredientModal
      :show="showIngredientModal"
      @close="showIngredientModal = false"
      @add="handleIngredientAdd"
    />
  </div>
</template>

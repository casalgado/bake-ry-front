<script setup>
import { ref, onMounted, watch } from "vue";
import { useRecipeStore } from "@/stores/recipeStore";
import { useProductCollectionStore } from "@/stores/productCollectionStore";
import { useIngredientStore } from "@/stores/ingredientStore";
import IngredientModal from "./IngredientModal.vue";

const recipeStore = useRecipeStore();
const collectionStore = useProductCollectionStore();
const ingredientStore = useIngredientStore();

// Form state
const productName = ref("");
const selectedCollection = ref("");
const hasVariations = ref(false);
const basePrice = ref(0);

// Recipe selection state
const recipeSource = ref("base"); // 'base', 'existing', 'new'
const selectedRecipe = ref(null);

// Ingredient management
const recipeIngredients = ref([]);
const showIngredientModal = ref(false);

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

const resetForm = () => {
  productName.value = "";
  selectedCollection.value = "";
  hasVariations.value = false;
  basePrice.value = 0;
  recipeSource.value = "base";
  selectedRecipe.value = null;
  recipeIngredients.value = [];
};

onMounted(async () => {
  if (collectionStore.items.length === 0) {
    await collectionStore.fetchAll();
  }

  if (recipeStore.items.length === 0) {
    await recipeStore.fetchAll();
  }

  if (ingredientStore.items.length === 0) {
    await ingredientStore.fetchAll();
  }

  resetForm();
});

const handleRecipeSourceChange = (source) => {
  recipeSource.value = source;
  selectedRecipe.value = null;
};

const handleIngredientAdd = (ingredientData) => {
  // Simply add the ingredient data as received from the modal
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

const handleSubmit = () => {
  // Prepare the form data without any ingredient creation logic
  const formData = {
    name: productName.value,
    collection: selectedCollection.value,
    hasVariations: hasVariations.value,
    basePrice: basePrice.value,
    recipeSource: recipeSource.value,
    selectedRecipe: selectedRecipe.value,
    ingredients: recipeIngredients.value,
  };

  console.log("Form submission data:", formData);
  // Emit the form data to parent or handle submission
  // emit('submit', formData);
};
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information -->
    <div>
      <h2>Información Básica</h2>

      <div>
        <label for="productName">Nombre del Producto</label>
        <input id="productName" type="text" v-model="productName" required />
      </div>

      <div>
        <label for="collection">Colección</label>
        <select id="collection" v-model="selectedCollection">
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
        <input id="hasVariations" type="checkbox" v-model="hasVariations" />
      </div>
    </div>

    <!-- Non-variation product details -->
    <div v-if="!hasVariations">
      <h2>Detalles del Producto</h2>

      <div>
        <label for="basePrice">Precio Base</label>
        <input
          id="basePrice"
          type="number"
          v-model="basePrice"
          min="0"
          step="1"
        />
      </div>

      <!-- Recipe Selection -->
      <div>
        <h3>Selección de Receta</h3>

        <div>
          <button
            type="button"
            @click="handleRecipeSourceChange('base')"
            :class="{ active: recipeSource === 'base' }"
          >
            Comenzar con Receta Base
          </button>
          <button
            type="button"
            @click="handleRecipeSourceChange('existing')"
            :class="{ active: recipeSource === 'existing' }"
          >
            Usar Receta Existente
          </button>
          <button
            type="button"
            @click="handleRecipeSourceChange('new')"
            :class="{ active: recipeSource === 'new' }"
          >
            Crear Nueva Receta
          </button>
        </div>

        <!-- Base Recipe Selection -->
        <div v-if="recipeSource === 'base'">
          <p>
            Selecciona una receta base para comenzar. Podrás personalizarla
            después.
          </p>
          <select v-model="selectedRecipe">
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
          <select v-model="selectedRecipe">
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

        <!-- Ingredients Section (shown for all recipe types when appropriate) -->
        <div v-if="recipeSource === 'new' || selectedRecipe">
          <h4>Ingredientes de la Receta</h4>

          <!-- Current Ingredients List -->
          <div v-if="recipeIngredients.length > 0">
            <div v-for="(ingredient, index) in recipeIngredients" :key="index">
              <span>{{ ingredient.name }}</span>
              <input
                type="number"
                :value="ingredient.quantity"
                @input="updateIngredientQuantity(index, $event.target.value)"
              />
              <span>{{ ingredient.unit }}</span>
              <button type="button" @click="removeIngredient(index)">
                Eliminar
              </button>
            </div>
          </div>

          <button type="button" @click="showIngredientModal = true">
            Agregar Ingrediente
          </button>
        </div>
      </div>
    </div>

    <!-- Variation section placeholder -->
    <div v-else>
      <p>Sección de variaciones (próximamente)</p>
    </div>

    <!-- Ingredient Modal Component -->
    <IngredientModal
      :show="showIngredientModal"
      @close="showIngredientModal = false"
      @add="handleIngredientAdd"
    />

    <!-- Form Actions -->
    <div>
      <button type="submit">Guardar Producto</button>
      <button type="button" @click="resetForm">Resetear</button>
    </div>
  </form>
</template>

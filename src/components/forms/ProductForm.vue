<script setup>
import { ref, onMounted, watch } from "vue";
import { useRecipeStore } from "@/stores/recipeStore";
import { useProductCollectionStore } from "@/stores/productCollectionStore";
import { useIngredientStore } from "@/stores/ingredientStore";

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
const selectedIngredient = ref(null);
const newIngredientQuantity = ref(0);

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

// Ingredient management functions
const addIngredient = () => {
  if (selectedIngredient.value && newIngredientQuantity.value > 0) {
    const ingredient = ingredientStore.items.find(
      (i) => i.id === selectedIngredient.value
    );

    recipeIngredients.value.push({
      ingredientId: ingredient.id,
      name: ingredient.name,
      quantity: newIngredientQuantity.value,
      unit: ingredient.unit,
    });

    // Reset modal state
    selectedIngredient.value = null;
    newIngredientQuantity.value = 0;
    showIngredientModal.value = false;
  }
};

const updateIngredientQuantity = (index, newQuantity) => {
  recipeIngredients.value[index].quantity = newQuantity;
};

const removeIngredient = (index) => {
  recipeIngredients.value.splice(index, 1);
};
</script>

<template>
  <form>
    <!-- Basic Information -->
    <div>
      <h2>Información Básica</h2>

      <div>
        <label for="productName">Nombre del Producto</label>
        <input id="productName" type="text" v-model="productName" />
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
          step="100"
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

          <!-- Ingredients Section after base recipe selection -->
          <div v-if="selectedRecipe">
            <h4>Ingredientes de la Receta</h4>

            <!-- Current Ingredients List -->
            <div v-if="recipeIngredients.length > 0">
              <div
                v-for="(ingredient, index) in recipeIngredients"
                :key="ingredient.ingredientId"
              >
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

          <!-- Ingredients Section after existing recipe selection -->
          <div v-if="selectedRecipe">
            <h4>Ingredientes de la Receta</h4>

            <!-- Current Ingredients List -->
            <div v-if="recipeIngredients.length > 0">
              <div
                v-for="(ingredient, index) in recipeIngredients"
                :key="ingredient.ingredientId"
              >
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

        <!-- New Recipe Creation -->
        <div v-if="recipeSource === 'new'">
          <p>Crea una nueva receta desde cero para este producto.</p>

          <!-- New Recipe Ingredients Section -->
          <div>
            <h4>Ingredientes de la Receta</h4>

            <!-- Current Ingredients List -->
            <div v-if="recipeIngredients.length > 0">
              <div
                v-for="(ingredient, index) in recipeIngredients"
                :key="ingredient.ingredientId"
              >
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
    </div>

    <!-- Variation section placeholder -->
    <div v-else>
      <p>Sección de variaciones (próximamente)</p>
    </div>

    <!-- Ingredient Modal -->
    <div v-if="showIngredientModal" class="modal">
      <div class="modal-content">
        <h3>Agregar Ingrediente</h3>

        <div>
          <label for="ingredient-select">Seleccionar Ingrediente</label>
          <select id="ingredient-select" v-model="selectedIngredient">
            <option value="">Seleccionar ingrediente</option>
            <option
              v-for="ingredient in ingredientStore.items"
              :key="ingredient.id"
              :value="ingredient.id"
            >
              {{ ingredient.name }} ({{ ingredient.unit }})
            </option>
          </select>
        </div>

        <div>
          <label for="ingredient-quantity">Cantidad</label>
          <input
            id="ingredient-quantity"
            type="number"
            v-model="newIngredientQuantity"
            min="0"
          />
        </div>

        <div>
          <button type="button" @click="showIngredientModal = false">
            Cancelar
          </button>
          <button
            type="button"
            @click="addIngredient"
            :disabled="!selectedIngredient || newIngredientQuantity <= 0"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>

    <div>
      <button type="submit">Guardar Producto</button>
    </div>
  </form>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRecipeStore } from "@/stores/recipeStore";
import { useProductCollectionStore } from "@/stores/productCollectionStore";

const recipeStore = useRecipeStore();
const collectionStore = useProductCollectionStore();

// Form state
const productName = ref("");
const selectedCollection = ref("");
const hasVariations = ref(false);
const basePrice = ref(0);

// Recipe selection state
const recipeSource = ref("base"); // 'base', 'existing', 'new'
const selectedRecipe = ref(null);

const resetForm = () => {
  productName.value = "";
  selectedCollection.value = "";
  hasVariations.value = false;
  basePrice.value = 0;
  recipeSource.value = "base";
  selectedRecipe.value = null;
};

onMounted(async () => {
  // Fetch collections if not already loaded
  if (collectionStore.items.length === 0) {
    await collectionStore.fetchAll();
  }

  // Fetch recipes if not already loaded
  if (recipeStore.items.length === 0) {
    await recipeStore.fetchAll();
  }

  resetForm();
});

const handleRecipeSourceChange = (source) => {
  recipeSource.value = source;
  selectedRecipe.value = null;
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
          <button type="button">Comenzar a Crear Receta</button>
        </div>
      </div>
    </div>

    <!-- Variation section placeholder -->
    <div v-else>
      <!-- We'll implement this next -->
      <p>Sección de variaciones (próximamente)</p>
    </div>

    <div>
      <button type="submit">Guardar Producto</button>
    </div>
  </form>
</template>

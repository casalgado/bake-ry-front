<script setup>
import { ref, onMounted } from "vue";
import { useProductCollectionStore } from "@/stores/productCollectionStore";
import RecipeSelector from "./RecipeSelector.vue";

const collectionStore = useProductCollectionStore();

// Single form state object
const formData = ref({
  name: "",
  collection: "",
  hasVariations: false,
  basePrice: 0,
  recipe: {
    recipeSource: "base",
    recipeId: null,
    ingredients: [],
  },
});

onMounted(async () => {
  if (collectionStore.items.length === 0) {
    await collectionStore.fetchAll();
  }
});

const resetForm = () => {
  formData.value = {
    name: "",
    collection: "",
    hasVariations: false,
    basePrice: 0,
    recipe: {
      recipeSource: "base",
      recipeId: null,
      ingredients: [],
    },
  };
};

const handleSubmit = () => {
  console.log("Form submission data:", formData.value);
  // emit('submit', formData.value);
};

const handleRecipeUpdate = (newRecipeData) => {
  formData.value.recipe = newRecipeData;
};
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information -->
    <div>
      <h2>Información Básica</h2>

      <div>
        <label for="productName">Nombre del Producto</label>
        <input id="productName" type="text" v-model="formData.name" required />
      </div>

      <div>
        <label for="collection">Colección</label>
        <select id="collection" v-model="formData.collection">
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
          step="1"
        />
      </div>

      <!-- Recipe Selection -->
      <RecipeSelector
        :recipe-data="formData.recipe"
        @update:recipe-data="handleRecipeUpdate"
        :disabled="false"
      />
    </div>

    <!-- Form Actions -->
    <div>
      <button type="submit">Guardar Producto</button>
      <button type="button" @click="resetForm">Resetear</button>
    </div>
  </form>
</template>

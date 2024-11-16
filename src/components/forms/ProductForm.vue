<script setup>
import { ref, onMounted } from "vue";
import { useProductCollectionStore } from "@/stores/productCollectionStore";
import RecipeSelector from "./RecipeSelector.vue";

const collectionStore = useProductCollectionStore();

// Form state
const productName = ref("");
const selectedCollection = ref("");
const hasVariations = ref(false);
const basePrice = ref(0);
const recipeData = ref(null);

onMounted(async () => {
  if (collectionStore.items.length === 0) {
    await collectionStore.fetchAll();
  }
  resetForm();
});

const resetForm = () => {
  productName.value = "";
  selectedCollection.value = "";
  hasVariations.value = false;
  basePrice.value = 0;
  recipeData.value = null;
};

const handleSubmit = () => {
  const formData = {
    name: productName.value,
    collection: selectedCollection.value,
    hasVariations: hasVariations.value,
    basePrice: basePrice.value,
    recipe: recipeData.value,
  };

  console.log("Form submission data:", formData);
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
      <RecipeSelector v-model:recipeData="recipeData" :disabled="false" />
    </div>

    <!-- Variation section placeholder -->
    <div v-else>
      <p>Sección de variaciones (próximamente)</p>
    </div>

    <!-- Form Actions -->
    <div>
      <button type="submit">Guardar Producto</button>
      <button type="button" @click="resetForm">Resetear</button>
    </div>
  </form>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// Will be moved to a store/service later
const fetchCollections = async () => {
  // Simulated API call
  return [];
};

// Form state
const productName = ref('');
const selectedCollection = ref('');
const hasVariations = ref(false);
const collections = ref([]);

// Collection loading
const loadCollections = async () => {
  try {
    collections.value = await fetchCollections();
  } catch (error) {
    console.error('Error cargando colecciones:', error);
  }
};

// Load collections on mount
onMounted(() => {
  loadCollections();
});

// Will emit when form needs to proceed to next step
const emit = defineEmits(['proceed']);

const handleProceed = () => {
  emit('proceed', {
    name: productName.value,
    collectionId: selectedCollection.value,
    hasVariations: hasVariations.value,
  });
};
</script>

<template>
  <form @submit.prevent="handleProceed">
    <div>
      <label for="productName">Nombre del Producto</label>
      <input
        id="productName"
        type="text"
        v-model="productName"
      />
    </div>

    <div>
      <label for="collection">Colección</label>
      <select
        id="collection"
        v-model="selectedCollection"
      >
        <option value="">Seleccionar colección</option>
        <option
          v-for="collection in collections"
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
        v-model="hasVariations"
      />
    </div>

    <div>
      <button type="submit">
        Continuar
      </button>
    </div>
  </form>
</template>

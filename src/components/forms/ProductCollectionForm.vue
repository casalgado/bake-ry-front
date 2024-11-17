<script setup>
import { ref, onMounted } from 'vue';

// Will be moved to a store/service later
const fetchCollections = async () => {
  // Simulated API call
  return [];
};

// Form state
const productName = ref('');
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
const emit = defineEmits(['submit']);

const handleSubmit = () => {
  emit('submit', {
    name: productName.value,
  });
};
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div>
      <label for="productName">Nombre de la Colección</label>
      <input
        id="productName"
        type="text"
        v-model="productName"
      />
    </div>

    <div>
      <button type="submit">
        Crear
      </button>
    </div>
  </form>
</template>

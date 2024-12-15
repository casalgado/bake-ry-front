<script setup>
import { ref, onMounted } from 'vue';

// Will be moved to a store/service later
const fetchCollections = async () => {
  // Simulated API call
  return [];
};

// Form state
const formData = ref({
  name: '',
  description: '',
});
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
  console.log(formData.value);
  emit('submit', formData.value);
};
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div>
      <label for="name">Nombre de la Colección</label>
      <input
        id="name"
        type="text"
        v-model="formData.name"
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
      <button type="submit" class="action-btn">
        Crear
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useIngredientStore } from '@/stores/ingredientStore';
import { useRouter } from 'vue-router';
import IngredientForm from '@/components/ingredients/IngredientForm.vue';

const router = useRouter();
const ingredientStore = useIngredientStore();

const showForm = ref(false);
const selectedIngredient = ref(null);
const searchQuery = ref('');
const selectedCategory = ref('');
const selectedTemperature = ref('');

// Category options in Spanish (matching IngredientForm)
const categoryOptions = [
  'Harinas y Almidones',
  'Líquidos Base',
  'Sazonadores Básicos',
  'Fermentos',
  'Lácteos y Proteínas',
  'Semillas y Granos',
  'Frutas y Vegetales',
  'Especias y Aromáticos',
  'Chocolates y Cocoa',
];

onMounted(async () => {
  await ingredientStore.fetchAll();
});

const filteredIngredients = computed(() => {
  return ingredientStore.items.filter((ingredient) => {
    const matchesSearch =
      ingredient.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      ingredient.description
        ?.toLowerCase()
        .includes(searchQuery.value.toLowerCase());

    const matchesCategory =
      !selectedCategory.value || ingredient.category === selectedCategory.value;

    const matchesTemperature =
      !selectedTemperature.value ||
      ingredient.storageTemp === selectedTemperature.value;

    return matchesSearch && matchesCategory && matchesTemperature;
  });
});

const handleEdit = (ingredient) => {
  selectedIngredient.value = ingredient;
  showForm.value = true;
};

const handleDelete = async (ingredientId) => {
  if (confirm('¿Está seguro que desea eliminar este ingrediente?')) {
    try {
      await ingredientStore.remove(ingredientId);
    } catch (error) {
      console.error('Failed to delete ingredient:', error);
    }
  }
};

const handleSubmit = async (formData) => {
  try {
    if (selectedIngredient.value) {
      await ingredientStore.update(selectedIngredient.value.id, formData);
    }
    showForm.value = false;
    selectedIngredient.value = null;
  } catch (error) {
    console.error('Failed to update ingredient:', error);
  }
};

const handleCancel = () => {
  showForm.value = false;
  selectedIngredient.value = null;
};

const navigateToCreate = () => {
  router.push('/dashboard/ingredients/create');
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
};
</script>

<template>
  <div>
    <h2>Gestión de Ingredientes</h2>

    <!-- Search and Filter Controls -->
    <div>
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Buscar ingredientes..."
      />

      <select v-model="selectedCategory">
        <option value="">Todas las categorías</option>
        <option
          v-for="category in categoryOptions"
          :key="category"
          :value="category"
        >
          {{ category }}
        </option>
      </select>

      <!-- Add this new select element -->
      <select v-model="selectedTemperature">
        <option value="">Todas las temperaturas</option>
        <option value="Ambiente">Ambiente</option>
        <option value="Refrigeracion">Refrigeración</option>
        <option value="Congelacion">Congelación</option>
      </select>

      <button @click="navigateToCreate">Nuevo Ingrediente</button>
    </div>

    <!-- Loading State -->
    <div v-if="ingredientStore.loading">Cargando ingredientes...</div>

    <!-- Error State -->
    <div v-if="ingredientStore.error">
      {{ ingredientStore.error }}
    </div>

    <!-- Edit Form Modal -->
    <div v-if="showForm">
      <div>
        <h3>Editar Ingrediente</h3>
        <IngredientForm
          :key="selectedIngredient.id"
          :initial-data="selectedIngredient"
          :loading="ingredientStore.loading"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>

    <!-- Ingredients Table -->
    <div v-if="!ingredientStore.loading && filteredIngredients.length > 0">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Unidad</th>
            <th>Costo por Unidad</th>
            <th>Temperatura</th>
            <th>Proveedores</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ingredient in filteredIngredients" :key="ingredient.id">
            <td>
              <div>{{ ingredient.name }}</div>
              <div v-if="ingredient.description">
                {{ ingredient.description }}
              </div>
            </td>
            <td>{{ ingredient.category }}</td>
            <td>{{ ingredient.unit }}</td>
            <td>{{ formatCurrency(ingredient.costPerUnit) }}</td>
            <td>{{ ingredient.storageTemp }}</td>
            <td>
              <div
                v-for="(supplier, index) in ingredient.suppliers"
                :key="index"
              >
                {{ supplier.name }}
              </div>
            </td>
            <td>
              <button @click="handleEdit(ingredient)">Editar</button>
              <button @click="handleDelete(ingredient.id)">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No Results State -->
    <div
      v-else-if="!ingredientStore.loading && filteredIngredients.length === 0"
    >
      No se encontraron ingredientes.
    </div>
  </div>
</template>

<style scoped lang="scss">
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

th,
td {
  padding: 0.5rem;
  text-align: left;
  border: 1px solid #ddd;
}

button + button {
  margin-left: 0.5rem;
}
</style>

<script setup>
import { ref, defineProps, defineEmits, onMounted } from 'vue';
import { useIngredientStore } from '@/stores/ingredientStore';

const ingredientStore = useIngredientStore();

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      productIds: [],
      name: 'sparrow',
      description: 'sparrow',
      category: 'Bread',
      ingredients: [],
      isActive: true,
      notes: 'sparrow',
    }),
  },
});

const emit = defineEmits(['submit', 'cancel']);

// Form data
const formData = ref({ ...props.initialData });

// Category options
const categoryOptions = [
  'Bread',
  'Cake',
  'Pastry',
  'Cookie',
  'Muffin',
  'Other',
];

// Ingredient form handling
const selectedIngredient = ref('');
const ingredientQuantity = ref(5);

const addIngredient = () => {
  if (!selectedIngredient.value || ingredientQuantity.value <= 0) return;

  const ingredient = ingredientStore.items.find(
    (i) => i.id === selectedIngredient.value,
  );

  if (!ingredient) return;

  formData.value.ingredients.push({
    allergens: ingredient.allergens,
    ingredientId: ingredient.id,
    name: ingredient.name,
    quantity: ingredientQuantity.value,
    baseQuantity: ingredient.baseQuantity,
    unit: ingredient.unit,
    costPerUnit: ingredient.costPerUnit,
    notes: '',
  });

  // Reset selection
  selectedIngredient.value = '';
  ingredientQuantity.value = 5;
};

const removeIngredient = (index) => {
  formData.value.ingredients.splice(index, 1);
};

// Form submission
const handleSubmit = () => {
  const submitData = {
    ...formData.value,
  };
  console.log('submitData', submitData);
  emit('submit', submitData);
};

// Reset form
const resetForm = () => {
  formData.value = { ...props.initialData };
};

onMounted(async () => {
  // Fetch ingredients if not already loaded
  if (ingredientStore.items.length === 0) {
    await ingredientStore.fetchAll();
  }
  resetForm();
});
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information Section -->
    <div>
      <h2>Basic Information</h2>

      <div>
        <label for="name">Recipe Name *</label>
        <input id="name" v-model="formData.name" type="text" required />
      </div>

      <div>
        <label for="description">Description</label>
        <textarea
          id="description"
          v-model="formData.description"
          rows="3"
        ></textarea>
      </div>

      <div>
        <label for="category">Category *</label>
        <select id="category" v-model="formData.category" required>
          <option value="">Select a category</option>
          <option
            v-for="category in categoryOptions"
            :key="category"
            :value="category"
          >
            {{ category }}
          </option>
        </select>
      </div>
    </div>

    <!-- Ingredients Section -->
    <div>
      <h2>Ingredients</h2>

      <!-- Ingredient List -->
      <div v-if="formData.ingredients.length > 0">
        <div v-for="(ingredient, index) in formData.ingredients" :key="index">
          <span
          >{{ ingredient.name }} - {{ ingredient.quantity }}
            {{ ingredient.unit }}</span
          >
          <button type="button" @click="removeIngredient(index)">Remove</button>
        </div>
      </div>

      <!-- Add New Ingredient Form -->
      <div>
        <h3>Add Ingredient</h3>
        <div>
          <label for="ingredientSelect">Select Ingredient</label>
          <select id="ingredientSelect" v-model="selectedIngredient">
            <option value="">Choose an ingredient</option>
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
          <label for="ingredientQuantity">Quantity</label>
          <input
            id="ingredientQuantity"
            v-model.number="ingredientQuantity"
            type="number"
            min="0"
          />
        </div>

        <button
          type="button"
          @click="addIngredient"
          :disabled="!selectedIngredient || ingredientQuantity <= 0"
        >
          Add Ingredient
        </button>
      </div>
    </div>

    <!-- Status Section -->
    <div>
      <h2>Status</h2>

      <div>
        <label for="isActive">
          <input id="isActive" v-model="formData.isActive" type="checkbox" />
          Recipe is active
        </label>
      </div>
    </div>

    <!-- Notes Section -->
    <div>
      <h2>Notes</h2>

      <div>
        <label for="notes">General Notes and Tips</label>
        <textarea id="notes" v-model="formData.notes" rows="4"></textarea>
      </div>
    </div>

    <!-- Form Actions -->
    <div>
      <button type="submit">Save Recipe</button>
      <button type="button" @click="resetForm">Reset</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

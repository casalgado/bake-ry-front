<script setup>
import { ref, onMounted } from 'vue';
import { useRecipeStore } from '@/stores/recipeStore';
import { useIngredientStore } from '@/stores/ingredientStore';
import IngredientModal from './IngredientModal.vue';

const props = defineProps({
  recipeData: {
    type: Object,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update']);

const recipeStore = useRecipeStore();
const ingredientStore = useIngredientStore();

const showRecipeModal = ref(false);
const showIngredientModal = ref(false);

onMounted(async () => {
  if (recipeStore.items.length === 0) await recipeStore.fetchAll();
  if (ingredientStore.items.length === 0) await ingredientStore.fetchAll();
});

const emitUpdate = (updates) => {
  emit('update', {
    ...props.recipeData,
    ...updates,
  });
};

const handleRecipeSelect = async (newRecipeId) => {
  if (newRecipeId) {
    try {
      const recipe = await recipeStore.getById(newRecipeId);
      emitUpdate({
        recipeId: newRecipeId,
        ingredients: recipe ? [...recipe.ingredients] : [],
      });

    } catch (error) {
      console.error('Error fetching recipe:', error);
      emitUpdate({
        recipeId: newRecipeId,
        ingredients: [],
      });
    }
  } else {
    emitUpdate({
      recipeId: null,
      ingredients: [],
    });
  }
};

const handleRecipeSourceChange = (source) => {
  if (props.recipeData.ingredients.length > 0 && !window.confirm('¿Estás seguro de querer cambiar origen y comenzar de nuevo?')) return;
  emitUpdate({
    recipeSource: source,
    recipeId: null,
    ingredients: [],
  });
};

const handleIngredientAdd = (ingredientData) => {
  emitUpdate({
    ingredients: [...props.recipeData.ingredients, ingredientData],
  });
};

const updateIngredientQuantity = (index, newQuantity) => {
  const updatedIngredients = [...props.recipeData.ingredients];
  updatedIngredients[index] = {
    ...updatedIngredients[index],
    quantity: Number(newQuantity),
  };
  emitUpdate({ ingredients: updatedIngredients });
};

const removeIngredient = (index) => {
  emitUpdate({
    ingredients: props.recipeData.ingredients.filter((_, i) => i !== index),
  });
};
</script>

<template>
  <!-- Show compact view when recipe is selected and not expanded -->
  <div v-if="props.recipeData.recipeId && !showRecipeModal">

    <div>
      <span>{{ recipeStore.items.find(r => r.id === props.recipeData.recipeId)?.ingredients.map(i =>`${i.name} (${i.quantity} ${i.unit})`).join(', ') }}</span>
      <button
        type="button"
        @click="showRecipeModal = true"
        :disabled="disabled"
      >
        Modificar Receta
      </button>
    </div>
  </div>

  <!-- Show initial button when no recipe selected and not expanded -->
  <div v-else-if="!showRecipeModal">

    <button
      type="button"
      @click="showRecipeModal = true"
      :disabled="disabled"
      class="utility-btn"
    >
      Elegir Receta
    </button>
  </div>

  <!-- Recipe Modal -->
  <Teleport to="#app">
    <div v-if="showRecipeModal" class="form-container max-w-full  max-h-full modal-overlay">
      <div class="modal-content flat-card max-h-dvh overflow-y-auto" style="overscroll-behavior: none;">
        <h4>Selección de Receta</h4>

        <!-- Recipe Source Selection -->
        <div>
          <button
            type="button"
            @click="handleRecipeSourceChange('base')"
            :class="{ active: recipeData.recipeSource === 'base' }"
            :disabled="disabled"
            class="utility-btn"
          >
            Comenzar con Receta Base
          </button>
          <button
            type="button"
            @click="handleRecipeSourceChange('existing')"
            :class="{ active: recipeData.recipeSource === 'existing' }"
            :disabled="disabled"
            class="utility-btn"
          >
            Usar Receta Existente
          </button>
          <button
            type="button"
            @click="handleRecipeSourceChange('new')"
            :class="{ active: recipeData.recipeSource === 'new' }"
            :disabled="disabled"
            class="utility-btn"
          >
            Crear Nueva Receta
          </button>
        </div>

        <!-- Base Recipe Selection -->
        <div v-if="recipeData.recipeSource === 'base'">
          <p>
            Selecciona una receta base para comenzar. Podrás personalizarla después.
          </p>
          <select
            :value="recipeData.recipeId"
            @change="handleRecipeSelect($event.target.value)"
            :disabled="disabled"
          >
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
        <div v-if="recipeData.recipeSource === 'existing'">
          <p>
            Selecciona una de tus recetas existentes. Podrás modificarla si lo
            necesitas.
          </p>
          <select
            :value="recipeData.recipeId"
            @change="handleRecipeSelect($event.target.value)"
            :disabled="disabled"
          >
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
        <div v-if="recipeData.recipeSource === 'new'">
          <p>Crea una nueva receta desde cero para este producto.</p>
        </div>

        <!-- Ingredients Section -->
        <div
          v-if="recipeData.recipeSource === 'new' || recipeData.recipeId"
        >
          <h3>Ingredientes de la Receta</h3>

          <!-- Current Ingredients List -->
          <div v-if="recipeData.ingredients.length > 0">
            <div
              v-for="(ingredient, index) in recipeData.ingredients"
              :key="index"
              class="flex items-center justify-between"
            >
              <span>{{ ingredient.name }}</span>
              <input
                type="number"
                :value="ingredient.quantity"
                @input="updateIngredientQuantity(index, $event.target.value)"
                :disabled="disabled"
                class="basis-1/3"
              />
              <span>{{ ingredient.unit }}</span>
              <button
                type="button"
                @click="removeIngredient(index)"
                :disabled="disabled"
              >
                Eliminar
              </button>
            </div>
          </div>

          <button
            type="button"
            @click="showIngredientModal = true"
            :disabled="disabled"
            class="utility-btn"
          >
            Agregar Ingrediente
          </button>
        </div>

        <!-- Modal Actions -->
        <div>
          <button
            type="button"
            @click="showRecipeModal = false"
            class="action-btn"
          >
            Cancelar
          </button>
          <button
            type="button"
            @click="showRecipeModal = false"
            :disabled="!recipeData.recipeId"
            class="action-btn"
          >
            Guardar Receta
          </button>
        </div>

      </div>
      <!-- Ingredient Modal -->
      <IngredientModal
        class="flat-card"
        :show="showIngredientModal"
        @close="showIngredientModal = false"
        @add="handleIngredientAdd"
      />

    </div>
  </Teleport>

</template>

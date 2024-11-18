<script setup>
// IngredientModal.vue
import { ref } from 'vue';
import { useIngredientStore } from '@/stores/ingredientStore';

const ingredientStore = useIngredientStore();

defineProps({
  show: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['close', 'add']);

// Modal state
const mode = ref('select'); // 'select' or 'create'
const selectedIngredient = ref(null);
const quantity = ref(0);

// New ingredient state
const newIngredient = ref({
  name: '',
  unit: '',
});

const resetForm = () => {
  mode.value = 'select';
  selectedIngredient.value = null;
  quantity.value = 0;
  newIngredient.value = {
    name: '',
    unit: '',
  };
};

const handleAdd = () => {
  if (
    mode.value === 'select' &&
    selectedIngredient.value &&
    quantity.value > 0
  ) {
    // Get the selected ingredient data
    const ingredient = ingredientStore.items.find(
      (i) => i.id === selectedIngredient.value,
    );

    emit('add', {
      type: 'existing',
      ingredientId: selectedIngredient.value,
      name: ingredient.name,
      unit: ingredient.unit,
      quantity: quantity.value,
    });
  } else if (
    mode.value === 'create' &&
    newIngredient.value.name &&
    newIngredient.value.unit &&
    quantity.value > 0
  ) {
    emit('add', {
      type: 'new',
      name: newIngredient.value.name,
      unit: newIngredient.value.unit,
      quantity: quantity.value,
    });
  }

  resetForm();
  emit('close');
};

const handleClose = () => {
  resetForm();
  emit('close');
};
</script>

<template>
  <div v-if="show" class="modal">
    <div class="modal-content flat-card min-h-[300px]">
      <h3>Agregar Ingrediente</h3>

      <!-- Mode Selection -->
      <div class="grid grid-cols-2 gap-x-3">
        <button
          type="button"
          @click="mode = 'select'"
          :class="[
            'utility-btn',
            mode === 'select' ||  mode === ''  ? 'utility-btn-active' : 'utility-btn-inactive'
          ]"
        >
          Seleccionar Existente
        </button>
        <button
          type="button"
          @click="mode = 'create'"
          :class="[
            'utility-btn',
            mode === 'create' ||  mode === ''  ? 'utility-btn-active' : 'utility-btn-inactive'
          ]"
        >
          Crear Nuevo
        </button>
      </div>

      <!-- Select Existing Ingredient -->
      <div v-if="mode === 'select'">
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
            v-model="quantity"
            min="0"
          />
        </div>
      </div>

      <!-- Create New Ingredient -->
      <div v-else>
        <div>
          <label for="new-ingredient-name">Nombre</label>
          <input
            id="new-ingredient-name"
            type="text"
            v-model="newIngredient.name"
          />
        </div>

        <div>
          <label for="new-ingredient-unit">Unidad</label>
          <select id="new-ingredient-unit" v-model="newIngredient.unit">
            <option value="">Seleccionar unidad</option>
            <option value="g">Gramos (g)</option>
            <option value="kg">Kilogramos (kg)</option>
            <option value="ml">Mililitros (ml)</option>
            <option value="l">Litros (l)</option>
            <option value="units">Unidades</option>
          </select>
        </div>

        <div>
          <label for="new-ingredient-quantity">Cantidad</label>
          <input
            id="new-ingredient-quantity"
            type="number"
            v-model="quantity"
            min="0"
          />
        </div>
      </div>

      <!-- Modal Actions -->
      <div>
        <button type="button" @click="handleClose">Cancelar</button>
        <button
          type="button"
          @click="handleAdd"
          :disabled="
            (mode === 'select' && (!selectedIngredient || quantity <= 0)) ||
              (mode === 'create' &&
                (!newIngredient.name || !newIngredient.unit || quantity <= 0))
          "
        >
          Agregar
        </button>
      </div>
    </div>
  </div>
</template>

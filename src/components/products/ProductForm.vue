<script setup>
import { ref, defineProps, defineEmits, computed, watch } from 'vue';
import { useRecipeStore } from '@/stores/recipeStore';

const recipeStore = useRecipeStore();

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      description: '',
      category: '',
      type: '',
      recipeId: '',
      variations: [],
      hasVariations: false,
      basePrice: 0,
      recipeMultiplier: 1,
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

const formData = ref({ ...props.initialData });

// Watch hasVariations changes to update form structure
watch(
  () => formData.value.hasVariations,
  (newValue) => {
    if (newValue) {
      // Remove basePrice and recipeMultiplier from main product
      delete formData.value.basePrice;
      delete formData.value.recipeMultiplier;
    } else {
      // Add basePrice and recipeMultiplier to main product
      formData.value.basePrice = formData.value.basePrice || 0;
      formData.value.recipeMultiplier = formData.value.recipeMultiplier || 1;
      // Remove these fields from variations
      formData.value.variations = formData.value.variations.map(
        ({ basePrice, recipeMultiplier, ...rest }) => rest,
      );
    }
  },
);

const categoryOptions = [
  'Panaderia de Masa Madre',
  'Panaderia Tradicional',
  'Untables',
  'Tortas',
  'Pasteleria',
  'Galletas',
];

const typeOptions = ['Fabricado', 'Reventa'];

const newVariation = ref({
  name: '',
  size: '',
  weight: '',
  basePrice: 0,
  recipeMultiplier: 1,
});

const editingVariation = ref(null);
const editingIndex = ref(-1);
const isEditing = computed(() => editingIndex.value !== -1);

const errors = ref({});

const validate = () => {
  errors.value = {};

  if (!formData.value.name) errors.value.name = 'El nombre es requerido';
  if (!formData.value.category)
    errors.value.category = 'La categoría es requerida';
  if (!formData.value.type) errors.value.type = 'El tipo es requerido';
  if (!formData.value.recipeId)
    errors.value.recipeId = 'La receta es requerida';

  if (!formData.value.hasVariations) {
    if (formData.value.basePrice <= 0)
      errors.value.basePrice = 'El precio base debe ser mayor que 0';
  } else if (formData.value.variations.length === 0) {
    errors.value.variations = 'Debe agregar al menos una variación';
  }

  return Object.keys(errors.value).length === 0;
};

const startEditingVariation = (variation, index) => {
  editingVariation.value = { ...variation };
  editingIndex.value = index;
};

const cancelEditingVariation = () => {
  editingVariation.value = null;
  editingIndex.value = -1;
};

const saveVariationEdit = () => {
  if (!editingVariation.value || editingIndex.value === -1) return;

  formData.value.variations[editingIndex.value] = { ...editingVariation.value };
  cancelEditingVariation();
};

const addVariation = () => {
  if (!newVariation.value.name || !newVariation.value.basePrice) return;

  formData.value.variations.push({
    ...newVariation.value,
    id: `var_${Date.now()}`,
  });

  newVariation.value = {
    name: '',
    size: '',
    weight: '',
    basePrice: 0,
    recipeMultiplier: 1,
  };
};

const removeVariation = (index) => {
  formData.value.variations.splice(index, 1);
};

const handleSubmit = () => {
  if (!validate()) return;

  emit('submit', {
    ...formData.value,
    updatedAt: new Date(),
    createdAt: formData.value.createdAt || new Date(),
  });
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
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information -->
    <div>
      <h3>Información Básica</h3>

      <div>
        <label>
          Nombre
          <input v-model="formData.name" type="text" required />
          <span v-if="errors.name">{{ errors.name }}</span>
        </label>
      </div>

      <div>
        <label>
          Descripción
          <textarea v-model="formData.description" rows="3"></textarea>
        </label>
      </div>

      <div>
        <label>
          Categoría
          <select v-model="formData.category" required>
            <option value="">Seleccionar categoría</option>
            <option
              v-for="category in categoryOptions"
              :key="category"
              :value="category"
            >
              {{ category }}
            </option>
          </select>
          <span v-if="errors.category">{{ errors.category }}</span>
        </label>
      </div>

      <div>
        <label>
          Tipo *
          <select v-model="formData.type" required>
            <option value="">Seleccionar tipo</option>
            <option v-for="type in typeOptions" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
          <span v-if="errors.type">{{ errors.type }}</span>
        </label>
      </div>

      <div>
        <label>
          Receta *
          <select v-model="formData.recipeId" required>
            <option value="">Seleccionar receta</option>
            <option
              v-for="recipe in recipeStore.items"
              :key="recipe.id"
              :value="recipe.id"
            >
              {{ recipe.name }}
            </option>
          </select>
          <span v-if="errors.recipeId">{{ errors.recipeId }}</span>
        </label>
      </div>

      <div>
        <label>
          <input type="checkbox" v-model="formData.hasVariations" />
          Tiene variaciones
        </label>
      </div>

      <!-- Show these fields only if product doesn't have variations -->
      <template v-if="!formData.hasVariations">
        <div>
          <label>
            Precio Base *
            <input
              v-model.number="formData.basePrice"
              type="number"
              min="0"
              required
            />
            <span v-if="errors.basePrice">{{ errors.basePrice }}</span>
          </label>
        </div>

        <div>
          <label>
            Multiplicador de Receta
            <input
              v-model.number="formData.recipeMultiplier"
              type="number"
              min="0.1"
              step="0.1"
            />
          </label>
        </div>
      </template>
    </div>

    <!-- Variations Section - Only show if hasVariations is true -->
    <div v-if="formData.hasVariations">
      <h3>Variaciones</h3>
      <span v-if="errors.variations">{{ errors.variations }}</span>

      <!-- Existing Variations -->
      <div v-if="formData.variations.length > 0">
        <div
          v-for="(variation, index) in formData.variations"
          :key="variation.id"
        >
          <!-- View Mode -->
          <div v-if="editingIndex !== index">
            <div>
              <h4>Nombre: {{ variation.name }}</h4>
              <p>Tamaño: {{ variation.size }}</p>
              <p>Peso: {{ variation.weight }}</p>
              <p>Precio Base: {{ formatCurrency(variation.basePrice) }}</p>
              <p>Multiplicador de Receta: {{ variation.recipeMultiplier }}</p>
            </div>
            <div>
              <button
                type="button"
                @click="startEditingVariation(variation, index)"
              >
                Editar
              </button>
              <button type="button" @click="removeVariation(index)">
                Eliminar
              </button>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else>
            <div>
              <label>
                Nombre
                <input v-model="editingVariation.name" type="text" required />
              </label>

              <label>
                Tamaño
                <input v-model="editingVariation.size" type="text" />
              </label>

              <label>
                Peso
                <input v-model="editingVariation.weight" type="text" />
              </label>

              <label>
                Precio Base
                <input
                  v-model.number="editingVariation.basePrice"
                  type="number"
                  min="0"
                  required
                />
              </label>

              <label>
                Multiplicador de Receta
                <input
                  v-model.number="editingVariation.recipeMultiplier"
                  type="number"
                  min="0.1"
                  step="0.1"
                />
              </label>
            </div>
            <div>
              <button type="button" @click="saveVariationEdit">Guardar</button>
              <button type="button" @click="cancelEditingVariation">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add New Variation -->
      <div v-if="!isEditing">
        <h4>Agregar Nueva Variación</h4>

        <div>
          <label>
            Nombre
            <input v-model="newVariation.name" type="text" />
          </label>

          <label>
            Tamaño
            <input v-model="newVariation.size" type="text" />
          </label>

          <label>
            Peso
            <input v-model="newVariation.weight" type="text" />
          </label>

          <label>
            Precio Base
            <input
              v-model.number="newVariation.basePrice"
              type="number"
              min="0"
            />
          </label>

          <label>
            Multiplicador de Receta
            <input
              v-model.number="newVariation.recipeMultiplier"
              type="number"
              min="0.1"
              step="0.1"
            />
          </label>
        </div>

        <button
          type="button"
          @click="addVariation"
          :disabled="!newVariation.name || !newVariation.basePrice"
        >
          Agregar Variación
        </button>
      </div>
    </div>

    <!-- Form Actions -->
    <div>
      <button type="button" @click="$emit('cancel')" :disabled="loading">
        Cancelar
      </button>
      <button type="submit" :disabled="loading">
        {{ loading ? "Guardando..." : "Guardar Producto" }}
      </button>
    </div>
  </form>
</template>

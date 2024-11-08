<script setup>
import { ref } from 'vue';

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      description: '',
      displayType: null,
      suggestedVariations: [],
      isActive: true,
    }),
  },
});

const emit = defineEmits(['submit', 'cancel']);

const formData = ref({
  name: props.initialData.name,
  description: props.initialData.description,
  displayType: props.initialData.displayType,
  suggestedVariations: [...props.initialData.suggestedVariations],
  isActive: props.initialData.isActive,
});

const hasVariations = ref(!!props.initialData.displayType);

const displayTypes = [
  { id: 'weight', label: 'Weight (grams)', unit: 'g' },
  { id: 'quantity', label: 'Quantity (units)', prefix: 'x' },
];

const newVariation = ref({
  name: '',
  value: '',
  recipeMultiplier: '',
});

const draggedItem = ref(null);
const errors = ref({});

const formatValue = (value, type) => {
  if (!value) return '';
  return type === 'weight' ? `${value}g` : `x${value}`;
};

const addVariation = () => {
  const value = Number(newVariation.value.value);
  const multiplier = Number(newVariation.value.recipeMultiplier);

  // Basic validation
  if (!newVariation.value.name || !value || !multiplier) {
    errors.value.variation = 'All fields are required';
    return;
  }

  if (formData.value.displayType === 'weight' && value <= 0) {
    errors.value.variation = 'Weight must be positive';
    return;
  }

  if (formData.value.displayType === 'quantity' && (!Number.isInteger(value) || value <= 0)) {
    errors.value.variation = 'Quantity must be positive integer';
    return;
  }

  if (multiplier <= 0) {
    errors.value.variation = 'Recipe multiplier must be positive';
    return;
  }

  formData.value.suggestedVariations.push({
    name: newVariation.value.name,
    value,
    recipeMultiplier: multiplier,
  });

  newVariation.value = {
    name: '',
    value: '',
    recipeMultiplier: '',
  };
  errors.value.variation = null;
};

const removeVariation = (index) => {
  formData.value.suggestedVariations.splice(index, 1);
};

const handleDragStart = (e, index) => {
  draggedItem.value = index;
  e.dataTransfer.effectAllowed = 'move';
  // Required for Firefox
  e.dataTransfer.setData('text/plain', index.toString());
};

const handleDragOver = (e, index) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};

const handleDrop = (e, index) => {
  e.preventDefault();

  if (draggedItem.value === null) return;

  const items = [...formData.value.suggestedVariations];
  const item = items[draggedItem.value];

  // Remove from old position
  items.splice(draggedItem.value, 1);
  // Add to new position
  items.splice(index, 0, item);

  formData.value.suggestedVariations = items;
  draggedItem.value = null;
};

const updateHasVariations = (value) => {
  hasVariations.value = value;
  if (!value) {
    formData.value.displayType = null;
    formData.value.suggestedVariations = [];
  }
};

const validate = () => {
  errors.value = {};

  if (!formData.value.name) {
    errors.value.name = 'Name is required';
  }

  if (hasVariations.value && !formData.value.displayType) {
    errors.value.displayType = 'Display type is required for variations';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) return;
  emit('submit', formData.value);
};
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information -->
    <div>
      <label>
        Name
        <input
          type="text"
          v-model="formData.name"
          placeholder="Category name"
        />
      </label>
      <div v-if="errors.name">{{ errors.name }}</div>
    </div>

    <div>
      <label>
        Description
        <textarea
          v-model="formData.description"
          placeholder="Category description"
        />
      </label>
    </div>

    <!-- Variations Toggle -->
    <div>
      <label>
        <input
          type="checkbox"
          :checked="hasVariations"
          @change="updateHasVariations($event.target.checked)"
        />
        This product has variations
      </label>
    </div>

    <!-- Variation Settings -->
    <div v-if="hasVariations">
      <div>
        <label>
          Variation Type
          <select v-model="formData.displayType">
            <option value="">Select type</option>
            <option
              v-for="type in displayTypes"
              :key="type.id"
              :value="type.id"
            >
              {{ type.label }}
            </option>
          </select>
        </label>
        <div v-if="errors.displayType">{{ errors.displayType }}</div>
      </div>

      <!-- Add Variation Form -->
      <div v-if="formData.displayType">
        <h4>Add Variation</h4>
        <div>
          <input
            v-model="newVariation.name"
            placeholder="Variation name"
          />
          <input
            type="number"
            v-model="newVariation.value"
            :placeholder="formData.displayType === 'weight' ? 'Weight in grams' : 'Quantity'"
            :step="formData.displayType === 'weight' ? '0.1' : '1'"
          />
          <input
            type="number"
            v-model="newVariation.recipeMultiplier"
            placeholder="Recipe multiplier"
            step="0.1"
          />
          <button type="button" @click="addVariation">Add</button>
        </div>
        <div v-if="errors.variation">{{ errors.variation }}</div>
      </div>

      <!-- Variations List -->
      <div v-if="formData.suggestedVariations.length > 0">
        <h4>Variations</h4>
        <div>
          <div
            v-for="(variation, index) in formData.suggestedVariations"
            :key="index"
            draggable="true"
            @dragstart="handleDragStart($event, index)"
            @dragover="handleDragOver($event, index)"
            @drop="handleDrop($event, index)"
          >
            <span>☰</span>
            <span>
              {{ variation.name }}
              ({{ formatValue(variation.value, formData.displayType) }})
              - {{ variation.recipeMultiplier }}x recipe
            </span>
            <button type="button" @click="removeVariation(index)">
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>

    <div>
      <label>
        <input
          type="checkbox"
          v-model="formData.isActive"
        />
        Active
      </label>
    </div>

    <div>
      <button type="button" @click="$emit('cancel')">Cancel</button>
      <button type="submit">Save Category</button>
    </div>
  </form>
</template>

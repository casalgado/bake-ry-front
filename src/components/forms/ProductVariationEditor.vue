<script setup>
import { defineProps, defineEmits } from 'vue';
import RecipeSelector from './RecipeSelector.vue';

const props = defineProps({
  variation: {
    type: Object,
    required: true,
  },
  variationType: {
    type: String,
    required: true,
    validator: (value) => ['WEIGHT', 'QUANTITY', 'CUSTOM'].includes(value),
  },
  index: {
    type: Number,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:variation', 'remove', 'recipe-update']);

const updateField = (field, value) => {
  const updatedVariation = {
    ...props.variation,
    [field]: value,
  };
  emit('update:variation', updatedVariation);
};

const handleRecipeUpdate = (newRecipeData) => {
  emit('recipe-update', newRecipeData);
};

const getValueLabel = () => {
  switch (props.variationType) {
  case 'WEIGHT':
    return 'Peso (g)';
  case 'QUANTITY':
    return 'Cantidad';
  default:
    return 'Valor';
  }
};

const getValueStep = () => props.variationType === 'WEIGHT' ? '50' : '1';
</script>

<template>
  <div class="flat-card flex gap-4" :class="props.variation.isWholeGrain ? 'bg-neutral-200' : ''">

    <div>
      <label>Nombre</label>
      <input
        type="text"
        :value="variation.name"
        @input="updateField('name', $event.target.value)"
        :disabled="disabled"
      />
    </div>

    <div>
      <label>{{ getValueLabel() }}</label>
      <input
        type="number"
        :value="variation.value"
        @input="updateField('value', Number($event.target.value))"
        :step="getValueStep()"
        :disabled="disabled"
      />
    </div>

    <div>
      <label>Precio Base</label>
      <input
        type="number"
        :value="variation.basePrice"
        @input="updateField('basePrice', Number($event.target.value))"
        step="100"
        :disabled="disabled"
      />
    </div>

    <RecipeSelector
      :recipe-data="variation.recipe"
      @update="handleRecipeUpdate"
      :disabled="disabled"
    />

    <button
      type="button"
      @click="emit('remove')"
      :disabled="disabled"
      class="danger-btn"
    >
      Eliminar Variación
    </button>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue';
import RecipeSelector from './RecipeSelector.vue';
import { PhMinusCircle } from '@phosphor-icons/vue';
import { formatVariationValue, getVariationTypeLabel } from '@/utils/helpers';

const props = defineProps({
  variation: {
    type: Object,
    required: true,
  },
  variationType: {
    type: String,
    required: true,
    validator: (value) => ['WEIGHT', 'QUANTITY', 'SIZE', 'CUSTOM'].includes(value),
  },
  index: {
    type: Number,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  showRemove: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['update:variation', 'remove', 'recipe-update']);

const updateField = (field, value) => {
  const updatedVariation = {
    ...props.variation,
    [field]: value,
  };
  // Don't set currentPrice anymore - that's only for orders
  emit('update:variation', updatedVariation);
};

const handleRecipeUpdate = (newRecipeData) => {
  emit('recipe-update', newRecipeData);
};

// Computed properties for better UX
const valueLabel = computed(() => {
  switch (props.variationType) {
  case 'WEIGHT':
    return 'Peso (g)';
  case 'QUANTITY':
    return 'Cantidad';
  case 'SIZE':
    return 'Valor del Tamaño';
  default:
    return 'Valor';
  }
});

const valueStep = computed(() => {
  switch (props.variationType) {
  case 'WEIGHT':
    return '50';
  case 'QUANTITY':
    return '1';
  case 'SIZE':
    return '1';
  default:
    return '1';
  }
});

const unitLabel = computed(() => {
  const unit = props.variation.unit || '';
  switch (props.variationType) {
  case 'WEIGHT':
    return unit || 'g';
  case 'QUANTITY':
    return 'unidades';
  case 'SIZE':
    return 'orden';
  default:
    return unit;
  }
});

// Display formatted value
const displayValue = computed(() => {
  if (!props.variation.value && props.variation.value !== 0) return '';
  return formatVariationValue(props.variation.value, props.variationType, props.variation.unit);
});

// Validation
const isValid = computed(() => {
  return props.variation.name &&
         (props.variation.value || props.variation.value === 0) &&
         props.variation.basePrice >= 0;
});
</script>

<template>
  <div
    class="flat-card py-3 pb-3 mb-2 border-l-4"
    :class="[
      props.variation.isWholeGrain ? 'bg-amber-50 border-l-amber-400' : 'bg-white border-l-neutral-300',
      { 'border-l-danger': !isValid }
    ]"
  >
    <!-- Header with type and validation -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
          {{ getVariationTypeLabel(variationType) }}
        </span>
        <span v-if="variation.isWholeGrain" class="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded">
          Integral
        </span>
        <span v-if="displayValue" class="text-xs text-neutral-500">
          {{ displayValue }}
        </span>
      </div>
      <button
        v-if="showRemove"
        type="button"
        @click="emit('remove')"
        :disabled="disabled"
        class="hover:danger-btn aspect-square rounded-full text-danger hover:text-white p-1 transition-colors"
      >
        <PhMinusCircle size="20px" />
      </button>
    </div>

    <!-- Form fields -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Name -->
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-1">
          Nombre
        </label>
        <input
          type="text"
          :value="variation.name"
          @input="updateField('name', $event.target.value)"
          :disabled="disabled"
          placeholder="ej: pequeño, mediano, grande"
          class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary text-sm"
          :class="{ 'border-danger': !variation.name }"
        />
      </div>

      <!-- Value -->
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-1">
          {{ valueLabel }}
        </label>
        <div class="relative">
          <input
            type="number"
            :value="variation.value"
            @input="updateField('value', Number($event.target.value))"
            :step="valueStep"
            :disabled="disabled"
            min="0"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary text-sm pr-12"
            :class="{ 'border-danger': !variation.value && variation.value !== 0 }"
          />
          <span class="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-neutral-500">
            {{ unitLabel }}
          </span>
        </div>
      </div>

      <!-- Base Price -->
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-1">
          Precio Base
        </label>
        <div class="relative">
          <input
            type="number"
            :value="variation.basePrice"
            @input="updateField('basePrice', Number($event.target.value))"
            step="1"
            :disabled="disabled"
            min="0"
            class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary text-sm pr-8"
            :class="{ 'border-danger': variation.basePrice < 0 }"
          />
          <span class="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-neutral-500">
            $
          </span>
        </div>
      </div>
    </div>

    <!-- Additional fields for whole grain toggle -->
    <div v-if="variationType !== 'SIZE'" class="mt-3 pt-3 border-t border-neutral-200">
      <label class="flex items-center">
        <input
          type="checkbox"
          :checked="variation.isWholeGrain"
          @change="updateField('isWholeGrain', $event.target.checked)"
          :disabled="disabled"
          class="form-checkbox h-4 w-4 text-primary border-neutral-300 rounded"
        />
        <span class="ml-2 text-sm text-neutral-700">Versión integral</span>
      </label>
    </div>

    <!-- Validation message -->
    <div v-if="!isValid" class="mt-2 text-sm text-danger">
      <span v-if="!variation.name">Nombre es requerido. </span>
      <span v-if="!variation.value && variation.value !== 0">Valor es requerido. </span>
      <span v-if="variation.basePrice < 0">Precio debe ser mayor o igual a 0.</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  icon: {
    type: [Object, Function],
    required: false,
    default: null,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);

const colorValue = computed({
  get: () => props.modelValue || '#000000',
  set: (value) => emit('update:modelValue', value),
});

const cardClasses = computed(() => [
  'relative p-4 border-2 rounded-lg transition-all duration-200',
  'hover:shadow-md hover:border-neutral-300',
  {
    'border-neutral-200 bg-white': !props.disabled,
    'border-neutral-100 bg-neutral-50 cursor-not-allowed opacity-60': props.disabled,
  },
]);

const colorPreviewClasses = computed(() => [
  'w-12 h-12 rounded-full shadow-md transition-all duration-200 cursor-pointer hover:shadow-lg',
  {
    'opacity-60': props.disabled,
  },
]);
</script>

<template>
  <div :class="cardClasses">
    <div class="flex items-start justify-between gap-4">
      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3 mb-2">
          <component
            v-if="icon"
            :is="icon"
            class="w-6 h-6 text-neutral-600 flex-shrink-0"
          />
          <h3 class="font-medium text-neutral-900 mb-0">{{ title }}</h3>
        </div>
        <p
          v-if="description"
          class="text-sm text-neutral-600 mt-1"
        >
          {{ description }}
        </p>

        <!-- Hex Input -->
        <input
          type="text"
          v-model="colorValue"
          :disabled="disabled"
          class="w-full px-3 py-2 text-sm font-mono border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary mt-3"
          maxlength="7"
        />
      </div>

      <!-- Color Preview Square -->
      <label :for="`color-${title}`" class="cursor-pointer flex-shrink-0">
        <div
          :class="colorPreviewClasses"
          :style="{ backgroundColor: colorValue }"
        >
          <input
            :id="`color-${title}`"
            type="color"
            v-model="colorValue"
            :disabled="disabled"
            class="opacity-0 w-full h-full cursor-pointer"
          />
        </div>
      </label>
    </div>
  </div>
</template>

<style scoped>
/* Hide the default color picker appearance but keep it functional */
input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}
input[type="color"]::-webkit-color-swatch {
  border: none;
}
</style>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  icon: {
    type: [Object, Function],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: null,
  },
  badge: {
    type: String,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);

const isActive = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const cardClasses = computed(() => [
  'relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200',
  'hover:shadow-md',
  {
    'border-primary bg-primary-100': isActive.value && !props.disabled,
    'border-neutral-200 bg-white': !isActive.value && !props.disabled,
    'border-neutral-100 bg-neutral-50 cursor-not-allowed opacity-60': props.disabled,
  },
]);

const toggleClasses = computed(() => [
  'absolute top-4 right-4 w-12 h-6 rounded-full transition-colors duration-200',
  {
    'bg-primary': isActive.value && !props.disabled,
    'bg-neutral-300': !isActive.value && !props.disabled,
    'bg-neutral-200': props.disabled,
  },
]);

const toggleKnobClasses = computed(() => [
  'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
  {
    'transform translate-x-6': isActive.value,
    'transform translate-x-0.5': !isActive.value,
  },
]);

const handleClick = () => {
  if (!props.disabled) {
    isActive.value = !isActive.value;
  }
};
</script>

<template>
  <div
    :class="cardClasses"
    @click="handleClick"
  >
    <!-- Toggle Switch -->
    <div :class="toggleClasses">
      <div :class="toggleKnobClasses"></div>
    </div>

    <!-- Content -->
    <div class="pr-16">
      <div class="flex items-center gap-3 mb-2">
        <component
          :is="icon"
          class="w-6 h-6 text-neutral-600 flex-shrink-0"
        />
        <h3 class="font-medium text-neutral-900 mb-0">{{ title }}</h3>
        <span
          v-if="badge"
          class="px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-600 rounded"
        >
          {{ badge }}
        </span>
      </div>

      <p
        v-if="description"
        class="text-sm text-neutral-600 mt-1"
      >
        {{ description }}
      </p>
    </div>

    <!-- Active Indicator -->
    <div
      v-if="isActive && !disabled"
      class="absolute bottom-2 right-2 w-2 h-2 bg-primary rounded-full"
    ></div>
  </div>
</template>

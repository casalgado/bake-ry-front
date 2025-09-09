<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
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
  options: {
    type: Array,
    required: true,
    // Example: [{ value: 'dueDate', label: 'Due Date' }, { value: 'paymentDate', label: 'Payment Date' }]
  },
  name: {
    type: String,
    required: true, // Required for radio button grouping
  },
});

const emit = defineEmits(['update:modelValue']);

const selectedValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const cardClasses = computed(() => [
  'relative p-4 border-2 rounded-lg transition-all duration-200',
  {
    'border-neutral-200 bg-white': !props.disabled,
    'border-neutral-100 bg-neutral-50 cursor-not-allowed opacity-60': props.disabled,
  },
]);

const handleRadioChange = (value) => {
  if (!props.disabled) {
    selectedValue.value = value;
  }
};
</script>

<template>
  <div :class="cardClasses">
    <!-- Content -->
    <div class="pr-4">
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
        class="text-sm text-neutral-600 mt-1 mb-4"
      >
        {{ description }}
      </p>

      <!-- Radio Button Options -->
      <div class="grid grid-cols-2 gap-2 mt-3 w-full">
        <div
          v-for="option in options"
          :key="option.value"
          class="relative"
        >
          <input
            type="radio"
            :id="`${name}-${option.value}`"
            :value="option.value"
            :name="name"
            :disabled="disabled"
            :checked="selectedValue === option.value"
            class="sr-only peer"
            @change="handleRadioChange(option.value)"
          />
          <label
            :for="`${name}-${option.value}`"
            class="w-full utility-btn-inactive cursor-pointer py-2 px-3 rounded-md text-center block peer-checked:action-btn peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
          >
            {{ option.label }}
          </label>
        </div>
      </div>
    </div>

  </div>
</template>

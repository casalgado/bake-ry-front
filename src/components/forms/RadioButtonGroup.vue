<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: [String, Number],
    required: true,
  },
  options: {
    type: Array,
    required: true,
    validator: (value) => {
      return value.every(option => 'value' in option && 'label' in option);
    },
  },
  name: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  layout: {
    type: String,
    default: 'horizontal',
    validator: (value) => ['horizontal', 'vertical'].includes(value),
  },
  hasCustomOption: {
    type: Boolean,
    default: false,
  },
  customOptionValue: {
    type: [String, Number],
    default: 'custom',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'custom-option-selected', 'option-selected']);

const groupId = computed(() => `radio-group-${props.name}`);

const handleKeydown = (event) => {
  const num = parseInt(event.key);
  if (!isNaN(num) && num > 0 && num <= props.options.length) {
    const selectedOption = props.options[num - 1];
    emit('update:modelValue', selectedOption.value);
    emit('option-selected', selectedOption.value);

    if (props.hasCustomOption && selectedOption.value === props.customOptionValue) {
      emit('custom-option-selected');
    }

    // Focus the selected radio input
    document.querySelector(`input[value="${selectedOption.value}"][name="${props.name}"]`)?.focus();
    event.preventDefault();
  }
};

const updateValue = (value) => {
  emit('update:modelValue', value);
  emit('option-selected', value);

  if (props.hasCustomOption && value === props.customOptionValue) {
    emit('custom-option-selected');
  }
};

const containerClasses = computed(() => ({
  'flex gap-1': props.layout === 'horizontal',
  'flex flex-col gap-1': props.layout === 'vertical',
}));
</script>

<template>
  <div
    :id="groupId"
    role="radiogroup"
    :aria-labelledby="`${groupId}-label`"
    @keydown="handleKeydown"
  >
    <label :id="`${groupId}-label`" >{{ label }}</label>
    <div :class="containerClasses">
      <div
        v-for="(option, index) in options"
        :key="option.value"
        class="relative"
      >
        <input
          type="radio"
          :id="`${groupId}-${option.value}`"
          :value="option.value"
          :name="name"
          :disabled="disabled"
          :checked="modelValue === option.value"
          class="sr-only peer"
          @change="updateValue(option.value)"
        />
        <label
          :for="`${groupId}-${option.value}`"
          class="utility-btn-inactive cursor-pointer py-1 px-2 rounded-md peer-checked:utility-btn-active peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
        >
          <!-- Use default slot if provided, otherwise use option label -->
          <slot name="option-label" :option="option" :index="index">
            {{ option.label }}
          </slot>
        </label>
      </div>
    </div>

    <!-- Custom input slot -->
    <div v-if="hasCustomOption && modelValue === customOptionValue" class="mt-2">
      <slot name="custom-input" />
    </div>
  </div>
</template>

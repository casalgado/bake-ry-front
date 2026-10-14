<script setup>
import UiPills from '@/components/ui/UiPills.vue';

/* A two-option UiPills with boolean values, so a yes/no question looks like every
 * other single choice. null = neither picked. */
defineProps({
  modelValue: { type: Boolean, default: null },
  label: { type: String, required: true },
});
defineEmits(['update:modelValue']);

const OPTIONS = [
  { value: true, label: 'Sí' },
  { value: false, label: 'No' },
];
</script>

<template>
  <UiPills
    :model-value="modelValue"
    :options="OPTIONS"
    :label="label"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

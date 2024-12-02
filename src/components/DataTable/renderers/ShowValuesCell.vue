<!-- components/DataTable/renderers/ObjectRenderer.vue -->
<script setup>
defineProps({
  value: {
    type: Object,
    required: true,
  },
  fields: {
    type: Array,
    required: true,
    validator: (fields) => fields.every(field =>
      typeof field === 'string' ||
      (typeof field === 'object' && field.key && field.label),
    ),
  },
  layout: {
    type: String,
    default: 'vertical',
    validator: (value) => ['vertical', 'horizontal'].includes(value),
  },
});

const getFieldValue = (field) => {
  const key = typeof field === 'string' ? field : field.key;
  const path = key.split('.');
  return path.reduce((obj, key) => obj?.[key], value);
};

const getFieldLabel = (field) => {
  if (typeof field === 'string') return field;
  return field.label;
};
</script>

<template>
  <div :class="[
    'space-y-1',
    layout === 'horizontal' ? 'flex gap-2 items-center' : ''
  ]">
    <div
      v-for="field in fields"
      :key="typeof field === 'string' ? field : field.key"
      :class="[
        layout === 'horizontal' ? 'flex gap-1 items-center' : ''
      ]"
    >
      <span class="font-medium text-neutral-700">{{ getFieldLabel(field) }}:</span>
      <span class="text-neutral-600">{{ getFieldValue(field) }}</span>
    </div>
  </div>
</template>

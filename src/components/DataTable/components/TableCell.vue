<!-- components/DataTable/components/TableCell.vue -->
<script setup>
import { h } from 'vue';

const props = defineProps({
  column: {
    type: Object,
    required: true,
  },
  row: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['click']);

const handleClick = (event) => {
  emit('click', event);
};

const renderCell = () => {
  // For toggle cells

  // For custom rendered cells
  if (props.column.customRender) {
    const rendered = props.column.customRender(props.row);

    // If renderer returns a VNode or Component
    if (rendered && rendered.__v_isVNode) {
      return rendered;
    }

    // If renderer returns a component definition
    if (rendered && rendered.component) {
      return h(rendered.component, rendered.props || {});
    }

    // For simple value transformations
    return rendered;
  }

  // Default case: just return the field value
  return props.row[props.column.field];
};
</script>

<template>
  <td
    class="px-4 py-2"
    @click="handleClick"
  >
    <component
      :is="renderCell()"
      v-if="renderCell()?.__v_isVNode"
    />
    <template v-else>
      {{ renderCell() }}
    </template>
  </td>
</template>

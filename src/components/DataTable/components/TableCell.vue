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

const renderCell = () => {
  if (!props.column.customRender) {
    return props.row[props.column.field];
  }

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
};
</script>

<template>
  <td class="px-4 py-2">
    <component
      :is="renderCell()"
      v-if="renderCell()?.__v_isVNode"
    />
    <template v-else>
      {{ renderCell() }}
    </template>
  </td>
</template>

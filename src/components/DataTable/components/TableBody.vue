<!-- components/DataTable/components/TableBody.vue -->
<script setup>
import { computed } from 'vue';
import TableCell from './TableCell.vue';

const props = defineProps({
  data: {
    type: Array,
    required: true,
  },
  columns: {
    type: Array,
    required: true,
  },
  selectedRows: {
    type: Set,
    required: true,
  },
});

const emit = defineEmits(['row-select', 'toggle-update']);

const handleRowClick = (event, row) => {
  emit('row-select', { row, shift: event.shiftKey });
};

const handleCellClick = (event, row, column) => {
  if (column.type === 'toggle') {
    event.stopPropagation();
    emit('toggle-update', { row, column });
  }
};

const isEmpty = computed(() => props.data.length === 0);
</script>

<template>
  <tbody>
    <template v-if="!isEmpty">
      <tr
        v-for="row in data"
        :key="row.id"
        @click="(event) => handleRowClick(event, row)"
        :class="[
          'cursor-pointer border-b transition-colors',
          selectedRows.has(row.id)
            ? 'bg-primary-100 hover:bg-primary-200'
            : 'hover:bg-neutral-50'
        ]"
      >
        <TableCell
          v-for="column in columns"
          :key="column.id"
          :column="column"
          :row="row"
          @click="(event) => handleCellClick(event, row, column)"
        />
      </tr>
    </template>
    <tr v-else>
      <td
        :colspan="columns.length"
        class="px-4 py-8 text-center text-neutral-500"
      >
        No data available
      </td>
    </tr>
  </tbody>
</template>

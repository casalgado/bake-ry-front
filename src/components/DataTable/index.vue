<script setup>
import { computed } from 'vue';

const props = defineProps({
  // Data to be displayed in the table
  data: {
    type: Array,
    required: true,
    default: () => [],
  },
  // Column configurations
  columns: {
    type: Array,
    required: true,
    default: () => [],
    validator: (cols) => cols.every(col => col.id && col.label),
  },
  // Optional class for the table wrapper
  wrapperClass: {
    type: String,
    default: '',
  },
});

// Will be used later for sorting and selection
const emit = defineEmits(['row-click']);

// Basic computed for empty state
const isEmpty = computed(() => props.data.length === 0);

// Handler for row clicks - will be expanded later for selection
const handleRowClick = (row, index) => {
  emit('row-click', { row, index });
};

// Get cell value - will be enhanced later for custom renderers
const getCellValue = (row, column) => {
  return row[column.field];
};
</script>

<template>
  <div :class="['relative overflow-x-auto shadow-md rounded-lg', wrapperClass]">
    <!-- Table wrapper -->
    <table class="w-full text-sm text-left text-neutral-700">
      <!-- Table Header -->
      <thead class="text-xs uppercase bg-neutral-100">
        <tr>
          <th
            v-for="column in columns"
            :key="column.id"
            :class="[
              'px-6 py-4 font-medium whitespace-nowrap',
              column.width || 'auto'
            ]"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>

      <!-- Table Body -->
      <tbody>
        <template v-if="!isEmpty">
          <tr
            v-for="(row, index) in data"
            :key="index"
            @click="handleRowClick(row, index)"
            class="bg-white border-b hover:bg-neutral-50 cursor-pointer"
          >
            <td
              v-for="column in columns"
              :key="column.id"
              class="px-6 py-4"
            >
              {{ getCellValue(row, column) }}
            </td>
          </tr>
        </template>
        <tr v-else>
          <td
            :colspan="columns.length"
            class="px-6 py-4 text-center text-neutral-500"
          >
            No data available
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

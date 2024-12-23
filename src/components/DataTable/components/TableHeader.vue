<!-- components/DataTable/components/TableHeader.vue -->
<script setup>
import { computed } from 'vue';
import { PhCaretUp, PhCaretDown } from '@phosphor-icons/vue';

const props = defineProps({
  columns: {
    type: Array,
    required: true,
  },
  getSortDirection: {
    type: Function,
    required: true,
  },
  getSortIndex: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(['sort']);

const handleSort = (column, event) => {
  if (!column.sortable) return;
  emit('sort', column.id, event.shiftKey);
};

const getSortIcon = (column) => {
  if (!column.sortable) return null;
  const direction = props.getSortDirection(column.id);
  if (!direction) return null;
  return direction === 'asc' ? PhCaretUp : PhCaretDown;
};
</script>
<!-- components/DataTable/components/TableHeader.vue -->
<template>
  <thead class="text-xs uppercase bg-neutral-200">
    <tr>
      <th
        v-for="column in columns"
        :key="column.id"
        class="pl-3 lg:px-4 py-2 lg:py-4 font-medium whitespace-nowrap"
        :class="[
          column.sortable ? 'cursor-pointer select-none' : '',
        ]"
        @click="handleSort(column, $event)"
      >
        <div class="flex items-center gap-1">
          {{ column.label }}

          <template v-if="column.sortable">
            <component
              :is="getSortIcon(column)"
              v-if="getSortDirection(column.id)"
              class="w-4 h-4"
            />

            <span
              v-if="getSortIndex(column.id) > -1"
              class="text-xs bg-primary-100 text-primary-600 px-1 rounded"
            >
              {{ getSortIndex(column.id) + 1 }}
            </span>
          </template>
        </div>
      </th>
    </tr>
  </thead>
</template>

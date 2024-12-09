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

<template>
  <thead class="text-xs uppercase bg-neutral-200">
    <tr>
      <th
        v-for="column in columns"
        :key="column.id"
        :class="[
          'px-6 py-4 font-medium whitespace-nowrap',
          column.width || 'auto',
          column.sortable ? 'cursor-pointer select-none' : '',
        ]"
        @click="handleSort(column, $event)"
      >
        <div class="flex items-center gap-1">
          {{ column.label }}

          <template v-if="column.sortable">
            <!-- Sort indicator -->
            <component
              :is="getSortIcon(column)"
              v-if="getSortDirection(column.id)"
              class="w-4 h-4 absolute left-0 top-[-15px]"
            />

            <!-- Sort index for multi-sort -->
            <span
              v-if="getSortIndex(column.id) > -1"
              class="text-xs bg-primary-100 text-primary-600 px-1 rounded absolute left-4 top-[-15px]"
            >
              {{ getSortIndex(column.id) + 1 }}
            </span>
          </template>
        </div>
      </th>
    </tr>
  </thead>
</template>

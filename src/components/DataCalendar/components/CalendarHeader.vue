<!-- components/DataTable/components/TableHeader.vue -->
<script setup>
import { computed } from 'vue';
import { PhCaretUp, PhCaretDown } from '@phosphor-icons/vue';
import { abbreviateText } from '@/utils/helpers';

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

const days = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
</script>
<!-- components/DataTable/components/TableHeader.vue -->
<template>
  <thead class="text-xs uppercase bg-neutral-200">
    <tr>
      <th
        v-for="day in days"
        :key="day"
        class="pl-3 lg:px-4 py-2 lg:py-4 font-medium whitespace-nowrap"

      >
        <div class="flex items-center gap-1">
          {{ day }}
        </div>
      </th>
    </tr>
  </thead>
</template>

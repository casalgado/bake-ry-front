<!-- components/DataTable/components/CalendarDay.vue -->
<script setup>
import { computed, ref, onUnmounted } from 'vue';
import { PhArrowRight } from '@phosphor-icons/vue';

const props = defineProps({
  columns: {
    type: Array,
    required: true,
  },
  rows: {
    type: Array,
    required: true,
  },
  selectedRows: {
    type: Set,
    required: true,
  },
  day: {
    type: Date,
    required: true,
  },
  hovering: {
    type: Boolean,
  },
  toggleLoading: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['click', 'hover-change']);

const showAllRows = ref(false);

// Determine if this cell is in loading state
const isLoading = computed(() => {
  return props.toggleLoading[`${props.row.id}-${props.column.field}`];
});

// Get next toggle value
const getNextToggleValue = computed(() => {
  if (props.column.type !== 'toggle' || !props.column.options) return null;
  const availableOptions = props.column.options.filter(
    (opt) => !opt.skipWhenToggled,
  );
  const currentValue = props.row[props.column.field];
  const currentIndex = availableOptions.findIndex(
    (opt) => opt.value === currentValue,
  );
  return availableOptions[(currentIndex + 1) % availableOptions.length];
});

const currentOption = computed(() => {
  if (props.column.type !== 'toggle' || !props.column.options) return null;
  return props.column.options.find(
    (opt) => opt.value === props.row[props.column.field],
  );
});

// Get tooltip content
const tooltipContent = computed(() => {
  if (!isClickEnabled.value || props.column.type !== 'toggle') return null;
  const nextValue = getNextToggleValue.value;
  const affectedCount = props.selectedRows.size || 1;
  return {
    prefix: affectedCount > 1 ? `${affectedCount}` : '',
    value: nextValue.displayText,
    icon: nextValue.icon,
  };
});

const showTooltip = ref(false);

// old methods above

const handleRowClick = (event, row) => {
  event.stopPropagation();
  emit('click', { event, row, column: props.columns[0] });
};

const DEFAULT_ROW_COUNT = 4;

const rowsToDisplay = computed(() => {
  if (showAllRows.value) {
    return props.rows;
  }
  return props.rows.slice(0, DEFAULT_ROW_COUNT);
});

const remainingRowsCount = computed(
  () => props.rows.length - DEFAULT_ROW_COUNT,
);

const toggleShowAllRows = () => {
  showAllRows.value = !showAllRows.value;
};
</script>

<template>
  <td
    class="px-1 text-xs lg:text-sm py-2 relative group select-none border border-neutral-400 align-top"
  >
    <div class="min-h-20 w-full">
      <p class="w-full text-center">
        {{ day.toLocaleString("es-CO", { day: "numeric" }) }}
      </p>

      <div
        v-for="row in rowsToDisplay"
        :key="row.id"
        class="bg-primary-700 mb-1 text-xs w-full rounded-lg cursor-pointer"
        @click="handleRowClick($event, row)"
      >
        <p
          class="text-center text-gray-200 text-nowrap w-11/12 overflow-hidden m-auto"
          :class="{
            'line-through bg-white w-full rounded-t-lg border border-primary-700 border-b-0 text-primary-700': row.status !== 0,
            'border border-transparent border-b-0': row.status === 0,
          }"
        >
          {{ row.userName }}
        </p>

        <p
          v-for="(oi, index) in row.orderItems"
          :key="oi.id"
          class="text-center bg-white w-full border border-primary-700"
          :class="{
            'rounded-b-lg border-b': index === row.orderItems.length - 1,
            'border-b-0': index !== row.orderItems.length - 1,
          }"
        >
          {{ `${oi.quantity} ${oi.productName}` }} <br />{{
            `${oi.variation ? oi.variation.name : ""}`
          }}
        </p>
      </div>

      <div
        v-if="remainingRowsCount > 0"
        @click="toggleShowAllRows"
        class="text-center text-gray-200 bg-primary-900 rounded-xl mt-1 cursor-pointer hover:bg-primary-800 text-xs"
      >
        <span v-if="!showAllRows">... {{ remainingRowsCount }} más</span>
        <span v-else>ver menos</span>
      </div>
    </div>
  </td>
</template>

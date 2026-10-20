<!-- components/DataTable/components/ActionBar.vue -->
<script setup>
import { ref, computed } from 'vue';
import { PhX } from '@phosphor-icons/vue';

const props = defineProps({
  selectedCount: {
    type: Number,
    required: true,
  },
  actions: {
    type: Array,
    required: true,
    validator: (acts) => acts.every(a => a.id && a.label),
  },
  loading: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['action', 'clear-selection']);

// For confirmation dialog
const confirmAction = ref(null);

const availableActions = computed(() => {

  return props.actions.filter(action => {
    if (action.minSelected && props.selectedCount < action.minSelected) return false;
    if (action.maxSelected && props.selectedCount > action.maxSelected) return false;
    if (action.hideIf) return false;
    return true;
  });
});

const handleAction = (action) => {
  if (action.requireConfirm) {
    confirmAction.value = action;
  } else {
    emit('action', action.id);
  }
};

// The row owns every wheel gesture over it: a vertical wheel scrolls it sideways
// (the scrollbar is hidden), and a horizontal swipe is consumed even at the edges,
// where the browser would otherwise turn it into back/forward.
const scrollSideways = (e) => {
  const el = e.currentTarget;
  const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
  if (!horizontal && el.scrollWidth <= el.clientWidth) return;
  e.preventDefault();
  el.scrollLeft += horizontal ? e.deltaX : e.deltaY;
};

const handleConfirm = () => {
  emit('action', confirmAction.value.id);
  confirmAction.value = null;
};

const handleCancel = () => {
  confirmAction.value = null;
};
</script>

<template>
  <!-- On lg the left 40rem stays clear for the sidebar (216px) and the fixed
       TotalsSummary beside it; past that the actions scroll sideways.
       ponytail: fixed reserve, measure TotalsSummary if its content grows. -->
  <div
    v-if="selectedCount > 0"
    class="fixed bottom-10 lg:bottom-5 right-0 md:right-8 bg-white border-t rounded-lg shadow-lg z-40 max-w-full lg:max-w-[calc(100vw-40rem)]"
  >
    <div class="px-4 flex items-center gap-2 justify-between">
      <button
        @click="emit('clear-selection')"
        class="button utility-btn-active shrink-0"
      >
        <span class="flex items-center gap-2"><PhX class="w-4 h-4" /> {{ selectedCount }} </span>

      </button>

      <div
        class="flex items-center gap-2 overflow-x-auto overscroll-x-contain min-w-0"
        style="scrollbar-width: none"
        @wheel="scrollSideways"
      >
        <button
          v-for="action in availableActions"
          :key="action.id"
          @click="handleAction(action)"
          :disabled="loading[action.id]"
          :class="[
            'shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2',
            loading[action.id] && 'opacity-75 cursor-not-allowed',
            action.variant === 'danger'
              ? 'bg-danger text-white hover:bg-danger/90'
              : action.variant === 'secondary'
                ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                : 'bg-primary-600 text-white hover:bg-primary-700'
          ]"
        >
          <component
            :is="action.icon"
            :class="[
              'w-4 h-4',
              { 'animate-spin': loading[action.id] }
            ]"
            :weight="action.iconWeight || 'regular'"
          />
          {{ action.label }}
        </button>
      </div>
    </div>

    <!-- Simple Confirmation Dialog -->
    <div
      v-if="confirmAction"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-medium text-neutral-900 mb-2">
          {{ confirmAction.confirmTitle || 'Confirm Action' }}
        </h3>
        <p class="text-neutral-600 mb-4">
          {{ confirmAction.confirmMessage || 'Are you sure you want to proceed?' }}
        </p>
        <div class="flex justify-end gap-2">
          <button
            @click="handleCancel"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          >
            Cancel
          </button>
          <button
            @click="handleConfirm"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium',
              confirmAction.variant === 'danger'
                ? 'bg-danger text-white hover:bg-danger/90'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            ]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

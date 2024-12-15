<!-- components/DataTable/components/FilterBar.vue -->
<script setup>
import { ref, watch } from 'vue';
import { PhMagnifyingGlass, PhX } from '@phosphor-icons/vue';
import { onClickOutside } from '@vueuse/core';
import { nextTick } from 'vue';

const props = defineProps({
  filters: {
    type: Array,
    default: () => [],
  },
  hasActiveFilters: {
    type: Boolean,
    default: false,
  },
  activeFilters: {
    type: Map,
    required: true,
  },
});

const emit = defineEmits(['update:search', 'toggle-filter', 'clear-all']);

const showSearch = ref(false);
const searchInput = ref(null);

watch(showSearch, (newValue) => {
  if (newValue && searchInput.value) {
    nextTick(() => {
      searchInput.value.focus();
    });
  }
});

const handleSearchInput = (event) => {
  emit('update:search', event.target.value);
};

const toggleSearch = () => {
  showSearch.value = !showSearch.value;
  if (!showSearch.value) {
    if (searchInput.value) {
      searchInput.value.value = '';
    }
    emit('update:search', '');
  }
};

const searchContainer = ref(null);
onClickOutside(searchContainer, () => {
  if (showSearch.value && !searchInput.value?.value) {
    showSearch.value = false;
  }
});
</script>

<template>
  <div class="flex items-center gap-4">
    <!-- Search section with inline input -->
    <div ref="searchContainer" class="flex items-center">
      <button
        @click="toggleSearch"
        class="p-2 hover:bg-neutral-100 rounded-lg"
        :class="{ 'bg-neutral-100': showSearch }"
      >
        <PhMagnifyingGlass class="w-5 h-5" />
      </button>

      <div v-if="showSearch" class="ml-2 overflow-hidden">
        <input
          ref="searchInput"
          @input="handleSearchInput"
          type="text"
          class="w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-none"
        >
      </div>

    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2 flex-grow justify-end">
      <template v-for="filter in filters" :key="filter.field">
        <div class="flex items-center gap-1">
          <template v-for="option in filter.options" :key="option.value">
            <button
              @click="$emit('toggle-filter', filter.field, option.value)"
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              :class="[
                activeFilters.get(filter.field)?.has(option.value)
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              ]"
            >
              {{ option.label }}
            </button>
          </template>
        </div>
      </template>

      <!-- Clear filters (always visible) -->
      <button
        @click="$emit('clear-all')"
        class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        :class="[
          hasActiveFilters
            ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
            : 'text-neutral-400 cursor-not-allowed'
        ]"
        :disabled="!hasActiveFilters"
      >
        <PhX class="w-4 h-4" />

      </button>
    </div>
  </div>
</template>

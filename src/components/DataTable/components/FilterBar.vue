<!-- components/DataTable/components/FilterBar.vue -->
<script setup>
import { ref } from 'vue';
import { PhMagnifyingGlass, PhX } from '@phosphor-icons/vue';

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
const searchInput = ref('');

const handleSearchInput = (event) => {
  emit('update:search', event.target.value);
};

const toggleSearch = () => {
  showSearch.value = !showSearch.value;
  if (!showSearch.value) {
    searchInput.value = '';
    emit('update:search', '');
  }
};
</script>

<template>
  <div class="flex items-center gap-4">
    <!-- Search -->
    <div class="relative">
      <button
        @click="toggleSearch"
        class="p-2 hover:bg-neutral-100 rounded-lg"
        :class="{ 'bg-neutral-100': showSearch }"
      >
        <PhMagnifyingGlass class="w-5 h-5" />
      </button>

      <div
        v-if="showSearch"
        class="absolute right-0 top-full mt-2 w-64 bg-white border rounded-lg shadow-lg p-2"
      >
        <input
          v-model="searchInput"
          @input="handleSearchInput"
          type="text"
          class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Search..."
          autofocus
        >
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2">
      <div
        v-for="filter in filters"
        :key="filter.field"
        class="flex items-center gap-1"
      >
        <button
          v-for="option in filter.options"
          :key="option.value"
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
      </div>
    </div>

    <!-- Clear filters -->
    <button
      v-if="hasActiveFilters"
      @click="$emit('clear-all')"
      class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
    >
      <PhX class="w-4 h-4" />
      Clear all
    </button>
  </div>
</template>

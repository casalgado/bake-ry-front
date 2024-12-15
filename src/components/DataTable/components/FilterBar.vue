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

// Watch for showSearch changes to focus input
watch(showSearch, (newValue) => {
  if (newValue && searchInput.value) {
    // Use nextTick to ensure DOM is updated
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

// Close search when clicking outside
const searchContainer = ref(null);
onClickOutside(searchContainer, () => {
  if (showSearch.value && !searchInput.value?.value) {
    showSearch.value = false;
  }
});
</script>

<template>
  <div class="flex items-center gap-4">
    <!-- Search -->
    <div ref="searchContainer" class="relative">
      <button
        @click="toggleSearch"
        class="p-2 hover:bg-neutral-100 rounded-lg"
        :class="{ 'bg-neutral-100': showSearch }"
      >
        <PhMagnifyingGlass class="w-5 h-5" />
      </button>

      <transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="showSearch"
          class="absolute right-0 top-full mt-2 w-64 bg-white border rounded-lg shadow-lg p-2 z-50"
        >
          <input
            ref="searchInput"
            @input="handleSearchInput"
            type="text"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Search..."
          >
        </div>
      </transition>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2">
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

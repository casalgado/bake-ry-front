<!-- components/DataTable/components/FilterBar.vue -->
<script setup>
import { ref, watch, computed } from 'vue';
import {
  PhMagnifyingGlass,
  PhX,
  PhFunnel,
  PhCheck,
} from '@phosphor-icons/vue';
import { Menu, MenuButton, MenuItems } from '@headlessui/vue';
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
  search: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:search', 'toggle-filter', 'clear-all']);

const showSearch = ref(false);
const searchInput = ref(null);

// Calculate total active filters
const activeFilterCount = computed(() => {
  return Array.from(props.activeFilters.values())
    .reduce((count, filterSet) => count + filterSet.size, 0);
});

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

const clearAll = () => {
  if (searchInput.value) {
    searchInput.value.value = '';
  }
  showSearch.value = false;
  emit('update:search', '');
  emit('clear-all');
};

const isOptionSelected = (field, value) => {
  return props.activeFilters.get(field)?.has(value) || false;
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
    <!-- Search section -->
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
          :value="search"
          @input="handleSearchInput"
          type="text"
          class="w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-none"

        >
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2 flex-grow justify-end">
      <!-- Desktop view -->
      <div class="hidden md:flex items-center gap-2">
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

      <!-- Mobile dropdown -->
      <div class="md:hidden">
        <Menu as="div" class="relative inline-block text-left" v-slot="{ open }">
          <MenuButton
            class="inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100"
            :class="{ 'bg-neutral-100': open }"
          >
            <PhFunnel class="w-5 h-5" />
            <span
              v-if="activeFilterCount"
              class="bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full text-xs"
            >
              {{ activeFilterCount }}
            </span>
          </MenuButton>

          <transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <MenuItems
              class="absolute right-0 mt-2 w-72 origin-top-right bg-white rounded-lg shadow-lg border divide-y divide-neutral-100 focus:outline-none z-50"
            >
              <div v-for="filter in filters" :key="filter.field" class="p-4">
                <div class="space-y-1">
                  <div
                    v-for="option in filter.options"
                    :key="option.value"
                    @click.stop="$emit('toggle-filter', filter.field, option.value)"
                    class="flex items-center gap-2 text-sm cursor-pointer p-2 hover:bg-neutral-50 rounded"
                  >
                    <div
                      class="w-4 h-4 border rounded flex items-center justify-center"
                      :class="[
                        isOptionSelected(filter.field, option.value)
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-neutral-300'
                      ]"
                    >
                      <PhCheck
                        v-if="isOptionSelected(filter.field, option.value)"
                        class="w-3 h-3 text-white"
                      />
                    </div>
                    {{ option.label }}
                  </div>
                </div>
              </div>

              <div v-if="hasActiveFilters" class="p-4">
                <button
                  @click="clearAll"
                  class="w-full px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-lg"
                >
                  Clear all filters
                </button>
              </div>
            </MenuItems>
          </transition>
        </Menu>
      </div>

      <!-- Clear filters button -->
      <button
        @click="clearAll"
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

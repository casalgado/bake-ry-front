<script setup>
import { ref, computed, watch } from 'vue';
import { PhMagnifyingGlass, PhX } from '@phosphor-icons/vue';

const props = defineProps({
  products: {
    type: Array,
    required: true,
    default: () => [],
  },
});

const emit = defineEmits(['select']);

const query = ref('');
const searchInput = ref(null);

// Normalize text to ignore accents except ñ (copied from UserCombox)
const normalizeText = (text) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u0302\u0304-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase();
};

// Create search text for a product and its variants
const createSearchText = (product, combination, variation) => {
  const parts = [product.name];

  if (combination) {
    parts.push(combination.name);
    if (combination.selection) {
      parts.push(...combination.selection);
    }
    // Include accountingCode from combination
    if (combination.accountingCode) parts.push(combination.accountingCode);
  }

  if (variation) {
    parts.push(variation.name);
    // Include accountingCode from variation (for legacy)
    if (variation.accountingCode) parts.push(variation.accountingCode);
  }

  // Include description and accountingCode from product level
  if (product.description) parts.push(product.description);
  if (product.accountingCode) parts.push(product.accountingCode);

  return normalizeText(parts.join(' '));
};

// Flatten all products into searchable items
const searchableItems = computed(() => {
  const items = [];

  props.products.forEach(product => {
    if (product.isActive === false) return;

    if (product.variations?.combinations?.length > 0) {
      // Product with combinations - create item for each combination
      product.variations.combinations.forEach(combination => {
        items.push({
          type: 'combination',
          product,
          combination,
          variation: null,
          searchText: createSearchText(product, combination),
          displayText: `${product.name} (${combination.name})`,
        });
      });
    } else if (product.variations?.length > 0 && Array.isArray(product.variations)) {
      // Legacy variations - create item for each variation
      product.variations.forEach(variation => {
        items.push({
          type: 'variation',
          product,
          combination: null,
          variation,
          searchText: createSearchText(product, null, variation),
          displayText: `${product.name} (${variation.name})`,
        });
      });
    } else {
      // Simple product - create single item
      items.push({
        type: 'simple',
        product,
        combination: null,
        variation: null,
        searchText: createSearchText(product),
        displayText: product.name,
      });
    }
  });

  return items;
});

// Filter searchable items based on query with multi-term search
const filteredItems = computed(() => {
  if (query.value.length < 2) return [];

  const normalizedQuery = normalizeText(query.value);
  const searchTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 0);

  // If no valid terms after splitting, return empty
  if (searchTerms.length === 0) return [];

  return searchableItems.value.filter(item => {
    // Every search term must be found in the searchText
    return searchTerms.every(term => item.searchText.includes(term));
  }).slice(0, 20); // Limit for performance
});

// Auto-selection logic - select when exactly 1 result
const handleAutoSelect = (item) => {
  // Emit same signature as ProductWizard
  const selection = {
    category: item.product.collectionName,
    product: item.product,
    quantity: 1,
  };

  if (item.combination) {
    selection.combination = item.combination;
  } else if (item.variation) {
    selection.variation = item.variation;
  } else {
    selection.variation = null;
  }

  emit('select', selection);

  // Reset for next selection
  query.value = '';
};

// Manual selection from dropdown
const handleManualSelect = (item) => {
  handleAutoSelect(item);
};

// Watch for auto-selection when exactly 1 result
watch(
  filteredItems,
  (items) => {
    if (items.length === 1 && query.value.length >= 2) {
      handleAutoSelect(items[0]);
    }
  },
  { immediate: true },
);

// Clear search
const clearSearch = () => {
  query.value = '';
  searchInput.value?.focus();
};

// Keyboard handling
const handleKeydown = (event) => {
  if (event.key === 'Enter' && filteredItems.value.length === 1) {
    event.preventDefault();
    handleAutoSelect(filteredItems.value[0]);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    clearSearch();
  }
};

// Focus search input when component mounts
const focus = () => {
  searchInput.value?.focus();
};

defineExpose({ focus });
</script>

<template>
  <div
    class="relative w-full flat-card p-1 mb-0"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <div class="w-full aspect-square flex flex-col">
      <!-- Search Input -->
      <div class="relative mb-3">
        <div class="relative">
          <PhMagnifyingGlass class="absolute left-2 top-1/2 transform -translate-y-1/2 text-neutral-600 w-4 h-4" />
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            placeholder=""
            class="w-full pl-8 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            autocomplete="off"
          />
          <button
            v-if="query"
            @click="clearSearch"
            class="absolute right-2 top-1/2 transform -translate-y-1/2 text-neutral-600 hover:text-neutral-700 p-0 m-0"
          >
            <PhX class="w-4 h-4" />
          </button>
        </div>

        <!-- Search Results Dropdown -->
        <div
          v-if="filteredItems.length > 1"
          class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          <div
            v-for="item in filteredItems"
            :key="`${item.product.id}-${item.type}-${item.combination?.id || item.variation?.id || 'simple'}`"
            class="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            @click="handleManualSelect(item)"
          >
            <div class="text-xs font-medium">{{ item.displayText }}</div>
            <div class="text-xs text-neutral-600">{{ item.product.collectionName }}</div>
            <div v-if="item.product.basePrice || item.combination?.basePrice || item.variation?.basePrice" class="text-xs text-neutral-700">
              ${{ (item.combination?.basePrice || item.variation?.basePrice || item.product.basePrice).toLocaleString() }}
            </div>
          </div>
        </div>

        <!-- No results message -->
        <div
          v-if="filteredItems.length === 0 && query.length >= 2"
          class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 text-center text-sm"
        >
          No se encontraron productos
        </div>
      </div>

      <!-- Status Messages -->
      <div class="flex-1 flex items-center justify-center">

        <div v-if="filteredItems.length === 1" class="text-center text-primary-600 text-sm">
          ✓ Producto encontrado y agregado
        </div>

        <div v-else-if="filteredItems.length > 1" class="text-center text-neutral-700 text-sm">
          {{ filteredItems.length }} productos encontrados
        </div>
      </div>
    </div>

    <!-- Search Statistics -->
    <div class="m-2 mt-0 py-1 px-2 text-[10px] flex items-center h-[32px] justify-center">
      <span class="text-neutral-600">
        <template v-if="query.length >= 2">
          Encontrado {{ filteredItems.length }} {{ filteredItems.length === 1 ? 'producto' : 'productos' }} en {{ new Set(filteredItems.map(item => item.product.collectionName)).size }} {{ new Set(filteredItems.map(item => item.product.collectionName)).size === 1 ? 'categoría' : 'categorías' }}
        </template>
        <template v-else>
          {{ props.products.length }} {{ props.products.length === 1 ? 'producto' : 'productos' }} en {{ new Set(props.products.map(p => p.collectionName)).size }} {{ new Set(props.products.map(p => p.collectionName)).size === 1 ? 'categoría' : 'categorías' }}
        </template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.flat-card {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

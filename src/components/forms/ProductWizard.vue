<script setup>
// ProductWizard.vue
import { ref, computed } from 'vue';
import { abbreviateText } from '@/utils/helpers';
import { PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue';

const props = defineProps({
  products: {
    type: Array,
    required: true,
    default: () => [],
  },
});

const emit = defineEmits(['select']);

const keyMap = {
  'q': 1, 'w': 2, 'e': 3,
  'a': 4, 's': 5, 'd': 6,
  'z': 7, 'x': 8, 'c': 9,
};

const reverseKeyMap = Object.fromEntries(
  Object.entries(keyMap).map(([key, value]) => [value, key.toUpperCase()]),
);

const getKeyForNumber = (num) => reverseKeyMap[num] || num;

const emulateNumpadPosition = (index) => {
  const keyMapping = {
    1: 7, 2: 8, 3: 9,
    4: 4, 5: 5, 6: 6,
    7: 1, 8: 2, 9: 3,
  };
  return keyMapping[index] || null;
};

const getKeyIndex = (key) => {
  if (/^[1-9]$/.test(key)) {
    return emulateNumpadPosition(parseInt(key)) - 1;
  }
  return keyMap[key.toLowerCase()] ? keyMap[key.toLowerCase()] - 1 : null;
};

const currentStep = ref('category');
const selectedCategory = ref(null);
const selectedProduct = ref(null);
const selectedVariation = ref(null);
const selectedQuantity = ref(null);
const highlightedIndex = ref(null);
const customQuantityMode = ref(false);
const customQuantity = ref('');
const currentPage = ref(0);

// Multi-dimensional support
const currentDimensionIndex = ref(0);
const dimensionSelections = ref([]);

// Get unique categories
const categories = computed(() =>
  [...new Set(props.products.map(p => p.collectionName))],
);

// Get products for selected category
const categoryProducts = computed(() =>
  props.products.filter(p =>
    p.collectionName === selectedCategory.value &&
    p.isActive !== false,
  ),
);

// Get current dimension for multi-dimensional products
const currentDimension = computed(() => {
  const product = props.products.find(p => p.id === selectedProduct.value?.id);

  // Check for legacy variations and warn
  if (product?.variations && Array.isArray(product.variations)) {
    console.error('Legacy variations detected on product:', product.name, 'All products should use VariationGroups');
    return null;
  }

  return product?.variations?.dimensions[currentDimensionIndex.value];
});

// Current options to display based on step
const currentOptions = computed(() => {
  switch (currentStep.value) {
  case 'category':
    return categories.value;
  case 'product':
    return categoryProducts.value;
  case 'dimension':
    return currentDimension.value?.options || [];
  case 'quantity':
    return Array.from({ length: 16 }, (_, i) => ({
      name: `${i + 1}`,
      value: i + 1,
    }));
  default:
    return [];
  }
});

const paginatedOptions = computed(() => {
  const options = currentOptions.value;
  const ITEMS_PER_PAGE = 8; // Show 8 items + 1 navigation button
  const start = currentPage.value * ITEMS_PER_PAGE;
  const items = options.slice(start, start + ITEMS_PER_PAGE);

  // Add next/prev button if there are more pages
  const hasMorePages = options.length > start + ITEMS_PER_PAGE;
  const hasPreviousPages = currentPage.value > 0;

  if (hasMorePages) {
    items.push({ isNavigationNext: true });
  }
  if (hasPreviousPages && items.length < 9) {
    items.push({ isNavigationPrev: true });
  }

  return items;
});

const totalPages = computed(() => {
  return Math.ceil(currentOptions.value.length / 8);
});

// Breadcrumb computed properties
const productName = computed(() => {
  if (!selectedProduct.value) return '';
  return selectedProduct.value.name || '';
});

const displayedQuantity = computed(() => {
  if (currentStep.value !== 'quantity') return '';
  if (customQuantityMode.value && customQuantity.value) {
    return customQuantity.value;
  }
  return selectedQuantity.value || '#';
});

// Get display text for current dimension selection
const currentDimensionText = computed(() => {
  if (currentStep.value !== 'dimension') return '';
  const selection = dimensionSelections.value[currentDimensionIndex.value];
  return selection || '#';
});

// Check if selected product has variation groups
const hasVariationGroups = computed(() => {
  return selectedProduct.value?.variations?.dimensions?.length > 0;
});

const resetPage = () => {
  currentPage.value = 0;
};

const handleSelection = (index) => {
  const selected = paginatedOptions.value[index];
  if (!selected) return;

  // Handle navigation buttons
  if (selected.isNavigationNext) {
    currentPage.value++;
    return;
  }
  if (selected.isNavigationPrev) {
    currentPage.value--;
    return;
  }

  switch (currentStep.value) {
  case 'category':
    selectedCategory.value = selected;
    currentStep.value = 'product';
    resetPage();
    break;

  case 'product':
    selectedProduct.value = selected;

    // Check for legacy variations
    if (selected.variations && Array.isArray(selected.variations)) {
      console.error('Legacy variations detected on product:', selected.name, 'All products should use VariationGroups');
      // Gracefully handle by skipping to quantity
      currentStep.value = 'quantity';
    } else if (selected.variations?.dimensions?.length > 0) {
      // Modern VariationGroups system
      currentStep.value = 'dimension';
      currentDimensionIndex.value = 0;
      dimensionSelections.value = [];
    } else {
      // No variations
      currentStep.value = 'quantity';
    }
    resetPage();
    break;

  case 'dimension': {
    // Multi-dimensional handling
    dimensionSelections.value[currentDimensionIndex.value] = selected.name;

    const selectedProd = props.products.find(p => p.id === selectedProduct.value?.id);
    const totalDimensions = selectedProd?.variations?.dimensions?.length || 0;

    if (currentDimensionIndex.value < totalDimensions - 1) {
      // Move to next dimension
      currentDimensionIndex.value++;
      resetPage();
    } else {
      // All dimensions selected, move to quantity
      currentStep.value = 'quantity';
      resetPage();
    }
    break;
  }

  case 'quantity': {
    selectedQuantity.value = selected.value;

    // Build the final selection object
    const currentProduct = props.products.find(p => p.id === selectedProduct.value?.id);

    if (dimensionSelections.value.length > 0) {
      // Find matching combination from product's VariationGroups
      const combination = findMatchingCombination(currentProduct, dimensionSelections.value);

      if (combination) {
        emit('select', {
          category: selectedCategory.value,
          product: selectedProduct.value,
          combination: combination,
          quantity: selected.value,
        });
      } else {
        console.error('No matching combination found for selections:', dimensionSelections.value, 'on product:', currentProduct.name);
        // This should not happen since all combinations are pre-configured
        return;
      }
    } else {
      // No variations - emit without combination
      emit('select', {
        category: selectedCategory.value,
        product: selectedProduct.value,
        variation: null,
        quantity: selected.value,
      });
    }

    resetSelection();
    break;
  }
  }
};

// Helper function to find matching combination in product's VariationGroups
const findMatchingCombination = (product, selections) => {
  if (!product?.variations?.combinations) return null;

  return product.variations.combinations.find(combo => {
    if (!combo.selection || combo.selection.length !== selections.length) return false;

    // Normalize both selections and combination for case-insensitive comparison
    const normalizeString = (str) => str.toLowerCase().trim();
    const normalizedSelections = selections.map(normalizeString);
    const normalizedComboSelection = combo.selection.map(normalizeString);

    return normalizedSelections.every(sel => normalizedComboSelection.includes(sel));
  });
};

const handleBreadcrumbClick = (step) => {
  switch (step) {
  case 'category':
    currentStep.value = 'category';
    selectedCategory.value = null;
    selectedProduct.value = null;
    selectedVariation.value = null;
    selectedQuantity.value = null;
    dimensionSelections.value = [];
    currentDimensionIndex.value = 0;
    resetPage();
    break;
  case 'product':
    currentStep.value = 'product';
    selectedProduct.value = null;
    selectedVariation.value = null;
    selectedQuantity.value = null;
    dimensionSelections.value = [];
    currentDimensionIndex.value = 0;
    resetPage();
    break;
  case 'dimension':
    // Go back to specific dimension
    currentStep.value = 'dimension';
    selectedQuantity.value = null;
    resetPage();
    break;
  case 'quantity':
    currentStep.value = 'quantity';
    selectedQuantity.value = null;
    break;
  }
};

const resetSelection = () => {
  currentStep.value = 'category';
  selectedCategory.value = null;
  selectedProduct.value = null;
  selectedVariation.value = null;
  selectedQuantity.value = null;
  highlightedIndex.value = null;
  customQuantity.value = '';
  customQuantityMode.value = false;
  dimensionSelections.value = [];
  currentDimensionIndex.value = 0;
  resetPage();
};

const handleBackKey = () => {
  switch (currentStep.value) {
  case 'product':
    selectedCategory.value = null;
    currentStep.value = 'category';
    break;
  case 'variation':
    selectedProduct.value = null;
    currentStep.value = 'product';
    break;
  case 'dimension':
    if (currentDimensionIndex.value > 0) {
      // Go back to previous dimension
      currentDimensionIndex.value--;
      dimensionSelections.value.pop();
    } else {
      // Go back to product selection
      selectedProduct.value = null;
      dimensionSelections.value = [];
      currentStep.value = 'product';
    }
    break;
  case 'quantity':
    if (dimensionSelections.value.length > 0) {
      // Go back to last dimension
      const foundProduct = props.products.find(p => p.id === selectedProduct.value?.id);
      currentDimensionIndex.value = foundProduct.variations.dimensions.length - 1;
      currentStep.value = 'dimension';
    } else {
      selectedProduct.value = null;
      currentStep.value = 'product';
    }
    break;
  }
  highlightedIndex.value = null;
  resetPage();
};

const handleKeydown = (event) => {
  // Toggle custom quantity mode with Shift
  if (event.key === 'Shift' && currentStep.value === 'quantity') {
    event.preventDefault();
    customQuantityMode.value = !customQuantityMode.value;
    if (!customQuantityMode.value) {
      customQuantity.value = '';
    }
    return;
  }

  // If in custom quantity mode
  if (customQuantityMode.value && currentStep.value === 'quantity') {
    // Handle number inputs
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      customQuantity.value += event.key;
      return;
    }

    // Handle backspace
    if (event.key === 'Backspace' && customQuantity.value) {
      event.preventDefault();
      customQuantity.value = customQuantity.value.slice(0, -1);
      return;
    }

    // Handle Enter to confirm
    if (event.key === 'Enter' && customQuantity.value) {
      event.preventDefault();
      const quantity = parseInt(customQuantity.value, 10);
      if (quantity > 0) {
        const targetProduct = props.products.find(p => p.id === selectedProduct.value?.id);

        if (dimensionSelections.value.length > 0) {
          const combination = findMatchingCombination(targetProduct, dimensionSelections.value);

          if (combination) {
            emit('select', {
              category: selectedCategory.value,
              product: selectedProduct.value,
              combination: combination,
              quantity: quantity,
            });
          } else {
            console.error('No matching combination found for selections:', dimensionSelections.value);
            return;
          }
        } else {
          emit('select', {
            category: selectedCategory.value,
            product: selectedProduct.value,
            variation: null,
            quantity: quantity,
          });
        }
        resetSelection();
      }
      return;
    }

    // Handle Escape to exit custom mode
    if (event.key === 'Escape') {
      event.preventDefault();
      customQuantityMode.value = false;
      customQuantity.value = '';
      return;
    }
  }

  // Regular numpad behavior (when not in custom mode)
  if (!customQuantityMode.value) {
    const index = getKeyIndex(event.key);
    if (index !== null) {
      event.preventDefault();
      highlightedIndex.value = index;
    } else if (event.key === '0' || event.key === ' ') {
      event.preventDefault();
      highlightedIndex.value = null;
    }
  }
};

const handleKeyup = (event) => {
  // Only handle key up for regular numpad mode
  if (!customQuantityMode.value) {
    const index = getKeyIndex(event.key);
    if (index !== null) {
      event.preventDefault();
      if (highlightedIndex.value === index) {
        handleSelection(index);
      }
      highlightedIndex.value = null;
    } else if (event.key === '0' || event.key === ' ') {
      event.preventDefault();
      handleBackKey();
    }
  }
};

const handleOptionClick = (index) => {
  handleSelection(index);
};

const getOptionDisplay = (option, index) => {
  if (!option) return '';

  if (option.isNavigationNext) return 'Más >';
  if (option.isNavigationPrev) return '< Atrás';

  switch (currentStep.value) {
  case 'category':
    return option;
  case 'product':
  case 'dimension':
    return option.name;
  case 'quantity':
    return `${option.value}`;
  default:
    return '';
  }
};
</script>
<template>
  <div
    class="relative w-full aspect-square flat-card mb-0 p-1"
    tabindex="0"
    @keydown="handleKeydown"
    @keyup="handleKeyup"
  >
    <!-- Pagination indicator -->
    <div v-if="totalPages > 1" class="absolute top-1 right-2 text-xs text-neutral-500">
      {{ currentPage + 1 }}/{{ totalPages }}
    </div>

    <!-- Grid with numpad layout -->
    <div class="grid grid-cols-3 grid-rows-3 gap-2 h-full p-0">
      <button
        v-for="i in 9"
        type="button"
        :key="i"
        class="utility-btn-inactive !m-0 !overflow-hidden lg:text-wrap text-nowrap"
        :class="{
          'invisible': !paginatedOptions[i-1],
          'utility-btn-active': highlightedIndex === i-1,
          'bg-neutral-300 hover:bg-neutral-350': currentStep === 'dimension' && paginatedOptions[i-1]?.isWholeGrain,
          'bg-neutral-300 hover:bg-neutral-350': paginatedOptions[i-1]?.isNavigationNext || paginatedOptions[i-1]?.isNavigationPrev

        }"
        tabindex="-1"
        @click="handleOptionClick(i-1)"
      >
        <span
          v-if="currentStep !== 'quantity'"
          class="button-number"
        >
          {{ getKeyForNumber(i) }}
        </span>
        <span class="leading-none text-xs">
          {{ paginatedOptions[i-1]?.isWholeGrain
              ? abbreviateText(getOptionDisplay(paginatedOptions[i-1], i-1), {firstWordLength: 3, lastWordLength: 2, separator: ' '})
              : getOptionDisplay(paginatedOptions[i-1], i-1) }}
        </span>
      </button>
    </div>

    <!-- Breadcrumb -->
    <div class="m-2 mt-0 py-1 px-2 text-[10px] flex items-center min-h-[24px] whitespace-nowrap">
      <button
        class="hover:text-neutral-700 transition-colors shrink-0 px-0 mx-0 mr-1"
        :class="{ 'cursor-pointer': currentStep !== 'category' }"
        @click="handleBreadcrumbClick('category')"
        :disabled="currentStep === 'category'"
      >
        {{ abbreviateText(selectedCategory) || '>' }}
      </button>

      <span v-if="selectedCategory" class="mx-1 shrink-0 px-0 mx-0 mr-1">&gt;</span>

      <button
        v-if="selectedCategory"
        class="hover:text-neutral-700 transition-colors shrink-0 px-0 mx-0 mr-1"
        :class="{ 'cursor-pointer': currentStep !== 'product' }"
        @click="handleBreadcrumbClick('product')"
        :disabled="currentStep === 'product'"
      >
        {{ abbreviateText(productName) || '#' }}
      </button>

      <!-- Show dimensions for multi-dimensional products -->
      <template v-if="hasVariationGroups && selectedProduct">
        <span
          v-for="(dim, idx) in selectedProduct.variations?.dimensions"
          :key="dim.id"
        >
          <span v-if="idx <= currentDimensionIndex" class="mx-1 shrink-0 px-0 mx-0 mr-1">&gt;</span>
          <button
            v-if="idx <= currentDimensionIndex"
            class="hover:text-neutral-700 transition-colors shrink-0 px-0 mx-0 mr-1"
            :class="{ 'cursor-pointer': currentStep !== 'dimension' || idx < currentDimensionIndex }"
            @click="() => { currentDimensionIndex = idx; handleBreadcrumbClick('dimension'); }"
            :disabled="currentStep === 'dimension' && idx === currentDimensionIndex"
          >
            {{ abbreviateText(dimensionSelections[idx]) || '#' }}
          </button>
        </span>
      </template>

      <span v-if="currentStep === 'quantity'" class="mx-1 shrink-0 px-0 mx-0 mr-1">&gt;</span>

      <button
        v-if="currentStep === 'quantity'"
        class="hover:text-neutral-700 transition-colors shrink-0 px-0 mx-0 mr-1"
        :class="{
          'cursor-pointer': currentStep !== 'quantity',
          'animate-pulse': customQuantityMode
        }"
        @click="handleBreadcrumbClick('quantity')"
        :disabled="currentStep === 'quantity'"
      >
        {{ displayedQuantity }}
      </button>

      <!-- Optional: Add an indicator when shift is pressed -->
      <span
        v-if="currentStep === 'quantity' && customQuantityMode"
        class="text-[8px] text-primary-600 ml-1"
      >
        ...
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.button-number {
  @apply absolute top-0 left-1 text-xs opacity-60 lowercase;
}

.flat-card {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>

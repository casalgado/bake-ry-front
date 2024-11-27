<script setup>
import { ref, computed } from 'vue';

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
    1: 7,
    2: 8,
    3: 9,
    4: 4,
    5: 5,
    6: 6,
    7: 1,
    8: 2,
    9: 3,
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

// Get variations for selected product
const productVariations = computed(() => {
  const product = props.products.find(p => p.id === selectedProduct.value?.id);
  return product?.variations || [];
});

// Current options to display based on step
const currentOptions = computed(() => {
  switch (currentStep.value) {
  case 'category':
    return categories.value;
  case 'product':
    return categoryProducts.value;
  case 'variation':
    return productVariations.value;
  case 'quantity':
    return Array.from({ length: 9 }, (_, i) => ({
      name: `${i + 1}`,
      value: i + 1,
    }));
  default:
    return [];
  }
});

// Breadcrumb computed properties
const productName = computed(() => {
  if (!selectedProduct.value) return '';
  return selectedProduct.value.name || '';
});

const handleSelection = (index) => {
  const selected = currentOptions.value[index];
  if (!selected) return;

  switch (currentStep.value) {
  case 'category':
    selectedCategory.value = selected;
    currentStep.value = 'product';
    break;

  case 'product':
    selectedProduct.value = selected;
    if (selected.variations?.length > 0) {
      currentStep.value = 'variation';
    } else {
      currentStep.value = 'quantity';
    }
    break;

  case 'variation':
    selectedVariation.value = selected;
    currentStep.value = 'quantity';
    break;

  case 'quantity':
    selectedQuantity.value = selected.value;
    console.log({
      category: selectedCategory.value,
      product: selectedProduct.value,
      variation: selectedVariation.value,
      quantity: selected.value,
    });
    emit('select', {
      category: selectedCategory.value,
      product: selectedProduct.value,
      variation: selectedVariation.value,
      quantity: selected.value,
    });
    resetSelection();
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
  case 'quantity':
    if (selectedVariation.value) {
      selectedVariation.value = null;
      currentStep.value = 'variation';
    } else {
      selectedProduct.value = null;
      currentStep.value = 'product';
    }
    break;
  }
  highlightedIndex.value = null;
};

const handleKeydown = (event) => {
  const index = getKeyIndex(event.key);

  if (index !== null) {
    event.preventDefault();
    highlightedIndex.value = index;
  } else if (event.key === '0' || event.key === ' ') {
    event.preventDefault();
    highlightedIndex.value = null;
  }
};

const handleKeyup = (event) => {
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
};

const handleOptionClick = (index) => {
  handleSelection(index);
};

const getOptionDisplay = (option, index) => {
  if (!option) return '';

  switch (currentStep.value) {
  case 'category':
    return option;
  case 'product':
  case 'variation':
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
    class="relative w-full aspect-square flat-card mb-0"
    tabindex="0"
    @keydown="handleKeydown"
    @keyup="handleKeyup"
  >
    <!-- Grid with numpad layout -->
    <div class="grid grid-cols-3 grid-rows-3 gap-2 h-full p-1">
      <button
        v-for="i in 9"
        :key="i"
        class="utility-btn-inactive !m-0 !overflow-hidden lg:text-wrap text-nowrap"
        :class="{
          'invisible': !currentOptions[i-1],
          'utility-btn-active': highlightedIndex === i-1
        }"
        tabindex="-1"
        @click="handleOptionClick(i-1)"
      >
        <span v-if="currentStep !== 'quantity'" class="button-number">{{ getKeyForNumber(i) }}</span>
        <span>{{ getOptionDisplay(currentOptions[i-1], i-1) }}</span>
      </button>
    </div>

    <!-- Breadcrumb -->
    <div class="flat-card m-2 mt-0 py-0 text-xs flex items-center justify-center gap-1">
      <span>{{ selectedCategory || 'colecciones' }}</span>
      <span v-if="selectedCategory"> > </span>
      <span v-if="selectedCategory">{{ productName || 'productos' }}</span>
      <span v-if="selectedProduct && productVariations.length > 0"> > </span>
      <span v-if="selectedProduct && productVariations.length > 0">
        {{ selectedVariation?.name || 'variaciones' }}
      </span>
      <span v-if="currentStep === 'quantity'"> > </span>
      <span v-if="currentStep === 'quantity'">{{ selectedQuantity || '#' }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.button-number {
  @apply absolute top-1 left-1 text-xs opacity-60 lowercase;
}
</style>

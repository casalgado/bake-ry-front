<script setup>
import { ref, computed, onMounted } from 'vue';
import {
  PhGift,
  PhTrash,
  PhCaretDown,
  PhCaretUp,
} from '@phosphor-icons/vue';

const discount = ref(null);
const showAdvancedFields = ref(false);

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits([
  'update:quantity',
  'update:price',
  'update:discount',
  'update:costPrice',
  'update:taxPercentage',
  'update:referencePrice',
  'toggle-complimentary',
  'remove',
]);

const isPriceModified = computed(() => {
  return props.item.basePrice > 0 && props.item.currentPrice !== props.item.basePrice;
});

// Determine if this is a variable price product (basePrice = 0)
const isVariablePrice = computed(() => {
  return props.item.basePrice === 0;
});

// Get the reference price for discount calculations
const effectiveReferencePrice = computed(() => {
  if (isVariablePrice.value) {
    return props.item.referencePrice || props.item.currentPrice;
  }
  return props.item.basePrice;
});

const costValidationError = computed(() => {
  if (props.item.costPrice < 0) return 'Costo debe ser >= 0';
  if (props.item.costPrice > props.item.currentPrice) return 'Costo mayor que precio';
  return null;
});

const handleQuantityChange = (delta) => {
  const newQuantity = props.item.quantity + delta;
  if (newQuantity >= 1) {
    emit('update:quantity', props.index, newQuantity);
  }
};

const handleQuantityInput = (event) => {
  const newValue = parseInt(event.target.value) || 1;
  if (newValue >= 1) {
    emit('update:quantity', props.index, newValue);
  }
};

const handlePriceChange = (event) => {
  const newPrice = Number(event.target.value);

  if (isVariablePrice.value) {
    // Variable price product: direct price change updates referencePrice and clears discount
    emit('update:referencePrice', props.index, newPrice);
    emit('update:discount', props.index, { type: null, value: 0 });
    discount.value = 0;
  } else {
    // Normal product: recalculate discount percentage from basePrice
    discount.value = Math.round(
      ((props.item.basePrice - newPrice) / props.item.basePrice) * 100,
    );
    emit('update:discount', props.index, { type: 'percentage', value: discount.value });
  }
  emit('update:price', props.index, newPrice);
};

const handleDiscountChange = (event) => {
  discount.value = Math.min(100, Math.max(0, Number(event.target.value)));
  const refPrice = effectiveReferencePrice.value;
  const newPrice = refPrice * (1 - discount.value / 100);
  emit('update:price', props.index, Math.round(newPrice));
  emit('update:discount', props.index, { type: 'percentage', value: discount.value });
};

const handleToggleComplimentary = () => {
  emit('toggle-complimentary', props.index);
};

const handleRemove = () => {
  emit('remove', props.index);
};

const handleCostPriceChange = (event) => {
  emit('update:costPrice', props.index, Number(event.target.value));
};

const handleTaxPercentageChange = (event) => {
  emit('update:taxPercentage', props.index, Math.max(0, Math.min(100, Number(event.target.value))));
};

const toggleAdvancedFields = () => {
  showAdvancedFields.value = !showAdvancedFields.value;
};

onMounted(() => {
  // Initialize discount from stored values or calculate from prices
  if (props.item.discountType === 'percentage' && props.item.discountValue > 0) {
    discount.value = props.item.discountValue;
  } else {
    const refPrice = effectiveReferencePrice.value;
    if (refPrice > 0) {
      discount.value = Math.round(
        ((refPrice - props.item.currentPrice) / refPrice) * 100,
      );
    } else {
      discount.value = 0;
    }
  }
});
</script>

<template>
  <div
    class="flex flex-row items-center justify-between py-1.5 mb-3 border-neutral-300 last:border-b-0"
  >
    <div class="flex-grow">
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs text-neutral-700 text-pill">
          {{ item.collectionName }}
        </div>
        <div class="text-pill text-neutral-700 text-xs">
          {{ item.productName }}
          <span v-if="item.combination" class="text-xs"
            >- {{ item.combination.getDisplayName ? item.combination.getDisplayName() : item.combination.name }}</span
          >
          <span v-else-if="item.variation" class="text-xs"
            >- {{ item.variation.name }}</span
          >
        </div>
      </div>

      <!-- Controls row -->
      <div class="grid grid-cols-[5fr_5fr_8fr_6fr] gap-2 mt-0.5 items-center">
        <div class="flex items-center gap-1">
          <button
            type="button"
            @click="handleQuantityChange(-1)"
            class="px-0 md:px-1.5 py-0.5 text-xs bg-gray-400 hover:bg-gray-500 hover:bg-gray-200 rounded"
            :disabled="item.quantity <= 1"
          >
            -
          </button>
          <input
            type="number"
            :value="item.quantity"
            @input="handleQuantityInput"
            class="w-8 text-sm text-center bg-transparent outline-none p-0 border-none"
            min="1"
            step="1"
          />
          <button
            type="button"
            @click="handleQuantityChange(1)"
            class="px-0 md:px-1.5 py-0.5 text-xs bg-gray-400 hover:bg-gray-500 hover:bg-gray-200 rounded"
          >
            +
          </button>
        </div>

        <div class="flex items-center gap-1">
          <div class="input-with-unit compact" data-unit="%">
            <input
              type="number"
              @input="handleDiscountChange"
              @focus="$event.target.select()"
              :value="discount"
              class="w-full px-1 py-0.5 text-right border rounded text-xs text-neutral-500"
              :disabled="item.isComplimentary"
              max="100"
            />
                   <span class="absolute absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-700">Dcto</span>
          </div>
        </div>

        <div>
          <div class="input-with-unit compact" data-unit="$">
            <input
              type="number"
              :value="item.currentPrice"
              @input="handlePriceChange"
              @focus="$event.target.select()"
              class="w-full px-1 py-0.5 text-right border rounded text-sm"
              :class="{
                'price-modified': isPriceModified,
                'opacity-20': item.isComplimentary,
              }"
              step="1"
              :disabled="item.isComplimentary"
            />
                   <span v-if="showAdvancedFields" class="absolute absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-700">Venta</span>
          </div>
        </div>

        <div class="flex items-center gap-2 justify-end">
          <button
            type="button"
            @click="toggleAdvancedFields"
            class="px-0 md:px-2 py-0.5 text-xs rounded"
            title="Más opciones"
          >
            <PhCaretUp v-if="showAdvancedFields" class="w-4 h-4" weight="bold" />
            <PhCaretDown v-else class="w-4 h-4" weight="bold" />
          </button>
          <button
            type="button"
            @click="handleToggleComplimentary"
            class="px-0 md:px-2 py-0.5 text-xs rounded"
            :class="{
              'bg-gray-200': item.isComplimentary,
              'bg-gray-100': !item.isComplimentary,
            }"
          >
            <PhGift v-if="!item.isComplimentary" class="w-4 h-4" weight="light" />
            <PhGift v-else class="w-4 h-4" weight="fill" />
          </button>
          <button
            type="button"
            @click="handleRemove"
            class="px-0 md:px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 rounded"
          >
            <PhTrash class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Advanced fields row (Cost & Tax) -->
      <div v-if="showAdvancedFields" class="grid grid-cols-[5fr_5fr_8fr_6fr] gap-2 mt-1 pb-2 border-b border-neutral-200 items-center">
        <div></div>
        <div class="flex items-center gap-1">
          <div class="input-with-unit compact flex-1" data-unit="%">
            <input
              type="number"
              :value="item.taxPercentage || 0"
              @input="handleTaxPercentageChange"
              @focus="$event.target.select()"
              class="w-full px-1 py-0.5 text-right border rounded text-xs"
              :disabled="item.isComplimentary"
              min="0"
              max="100"
              step="0.5"
            />
                   <span class="absolute absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-700">IVA</span>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <div class="input-with-unit compact flex-1" data-unit="$">
            <input
              type="number"
              :value="item.costPrice || 0"
              @input="handleCostPriceChange"
              @focus="$event.target.select()"
              class="w-full px-1 py-0.5 text-right border rounded text-xs"
              :class="{ 'border-amber-300 bg-amber-50': costValidationError }"
              :disabled="item.isComplimentary"
              min="0"
              step="1"
            />
           <span class="absolute absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-700">Costo</span>

          </div>
        </div>

        <div>
          <span v-if="costValidationError" class="text-xs text-amber-600 italic">
            {{ costValidationError }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.price-modified {
  @apply bg-yellow-50 border-yellow-300;
}

input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}
</style>

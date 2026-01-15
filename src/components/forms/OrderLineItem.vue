<script setup>
import { ref, computed, onMounted } from 'vue';
import {
  PhGift,
  PhTrash,
  PhGearSix,
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
  'toggle-complimentary',
  'remove',
]);

const isPriceModified = computed(() => {
  return props.item.currentPrice !== props.item.basePrice;
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
  discount.value = Math.round(
    ((props.item.basePrice - newPrice) / props.item.basePrice) * 100,
  );
  emit('update:price', props.index, newPrice);
};

const handleDiscountChange = (event) => {
  discount.value = Math.min(100, Math.max(0, Number(event.target.value)));
  const newPrice = props.item.basePrice * (1 - discount.value / 100);
  emit('update:price', props.index, Math.round(newPrice));
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
  discount.value = Math.round(
    ((props.item.basePrice - props.item.currentPrice) / props.item.basePrice) * 100,
  );
  console.log('mounted discount', discount.value);
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

      <div class="flex items-center gap-2 mt-0.5">
        <div class="flex items-center gap-1 max-w-24">
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
          <div class="flex items-center">
            <div class="input-with-unit compact" data-unit="%">
              <input
                type="number"
                @input="handleDiscountChange"
                @focus="$event.target.select()"
                :value="discount"
                class="w-14 px-1 py-0.5 text-right border rounded text-xs max-w-14 min-w-14 text-neutral-500"
                :disabled="item.isComplimentary"
                max="100"
              />
            </div>
          </div>
          <div class="flex items-center">
            <div class="input-with-unit compact" data-unit="$">
              <input
                type="number"
                :value="item.currentPrice"
                @input="handlePriceChange"
                @focus="$event.target.select()"
                class="w-20 px-0 md:px-1 py-0.5 text-right border rounded text-sm min-w-16"
                :class="{
                  'price-modified': isPriceModified,
                  'opacity-20': item.isComplimentary,
              }"
              step="1"
              :disabled="item.isComplimentary"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="toggleAdvancedFields"
          class="px-0 md:px-2 py-0.5 text-xs rounded"
          :class="{ 'bg-blue-100': showAdvancedFields, 'bg-gray-100': !showAdvancedFields }"
          title="Ajustes avanzados"
        >
          <PhGearSix class="w-4 h-4" :weight="showAdvancedFields ? 'fill' : 'light'" />
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

      <!-- Advanced fields row (Cost & Tax) -->
      <div v-if="showAdvancedFields" class="flex items-center gap-3 mt-1 pb-2 border-b border-neutral-200">
        <div class="flex items-center gap-1">
          <span class="text-xs text-neutral-500">Costo:</span>
          <div class="input-with-unit compact" data-unit="$">
            <input
              type="number"
              :value="item.costPrice || 0"
              @input="handleCostPriceChange"
              @focus="$event.target.select()"
              class="w-16 px-1 py-0.5 text-right border rounded text-xs"
              :class="{ 'border-amber-300 bg-amber-50': costValidationError }"
              :disabled="item.isComplimentary"
              min="0"
              step="1"
            />
          </div>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-xs text-neutral-500">IVA:</span>
          <div class="input-with-unit compact" data-unit="%">
            <input
              type="number"
              :value="item.taxPercentage || 0"
              @input="handleTaxPercentageChange"
              @focus="$event.target.select()"
              class="w-14 px-1 py-0.5 text-right border rounded text-xs"
              :disabled="item.isComplimentary"
              min="0"
              max="100"
              step="0.5"
            />
          </div>
        </div>
        <span v-if="costValidationError" class="text-xs text-amber-600 italic">
          {{ costValidationError }}
        </span>
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

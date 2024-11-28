<script setup>
import { computed } from 'vue';

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
  'toggle-complimentary',
  'remove',
]);

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(price);
};

const isPriceModified = computed(() => {
  return props.item.currentPrice !== props.item.basePrice;
});

const handleQuantityChange = (delta) => {
  const newQuantity = props.item.quantity + delta;
  if (newQuantity >= 1) {
    emit('update:quantity', props.index, newQuantity);
  }
};

const handlePriceChange = (event) => {
  emit('update:price', props.index, Number(event.target.value));  // Added Number conversion
};

const handleToggleComplimentary = () => {
  emit('toggle-complimentary', props.index);
};

const handleRemove = () => {
  emit('remove', props.index);
};
</script>

<template>
  <div class="flex items-center justify-between py-1.5 border-b border-gray-200 last:border-b-0">
    <!-- Left Content -->
    <div class="flex-grow">
      <div class="flex items-center gap-2">
        <div class="text-pill text-xs">{{ item.collectionName }}</div>
        <div class="font-medium">
          {{ item.productName }}
          <span v-if="item.variation" class="text-sm">- {{ item.variation.name }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 mt-0.5">
        <div class="text-xs text-gray-600">
          base: {{ formatPrice(item.basePrice) }}
        </div>
        <input
          type="number"
          :value="item.currentPrice"
          @input="handlePriceChange"
          class="w-20 px-1 py-0.5 text-right border rounded text-sm"
          :class="{ 'price-modified': isPriceModified }"
          step="1000"
        />
        <div class="flex items-center gap-1">
          <button
            type="button"
            @click="handleQuantityChange(-1)"
            class="px-1.5 py-0.5 text-xs bg-gray-100 rounded"
            :disabled="item.quantity <= 1"
          >-</button>
          <span class="text-sm min-w-[1.5rem] text-center">{{ item.quantity }}</span>
          <button
            type="button"
            @click="handleQuantityChange(1)"
            class="px-1.5 py-0.5 text-xs bg-gray-100 rounded"
          >+</button>
        </div>
      </div>
    </div>

    <!-- Right Actions -->
    <div class="flex gap-1 items-center ml-2">
      <button
        type="button"
        @click="handleToggleComplimentary"
        class="px-2 py-0.5 text-xs rounded"
        :class="{
          'bg-gray-200': item.isComplimentary,
          'bg-gray-100': !item.isComplimentary
        }"
      >
        {{ item.isComplimentary ? 'Cortesía' : 'Cobrar' }}
      </button>
      <button
        type="button"
        @click="handleRemove"
        class="px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 rounded"
      >
        Eliminar
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.price-modified {
  @apply bg-yellow-50 border-yellow-300;
}
</style>

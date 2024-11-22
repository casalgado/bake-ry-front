<script setup>
import { ref } from 'vue';
import ProductWizard from './ProductWizard.vue';

const props = defineProps({
  modelValue: {
    type: Array,
    required: true,
    default: () => [],
  },
  products: {
    type: Array,
    required: true,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue']);

const errors = ref({});
void errors.value;

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(price);
};

const handleWizardSelect = (selection) => {
  const product = props.products.find(p => p.id === selection.product.id);
  if (!product) return;

  const newItem = {
    // Product Info
    productId: product.id,
    productName: product.name,
    collectionId: product.collectionId,
    collectionName: product.collectionName,

    // Quantity and Price
    quantity: selection.quantity,
    unitPrice: selection.unitPrice,

    // Variation Info (if exists)
    variation: selection.variation ? {
      id: selection.variation.id,
      name: selection.variation.name,
      value: selection.variation.value,
      recipeId: selection.variation.recipeId,
    } : null,

    // Recipe ID (from variation or product)
    recipeId: selection.recipeId,

    // Status
    isComplimentary: false,
  };

  emit('update:modelValue', [...props.modelValue, newItem]);
};

const removeItem = (index) => {
  const newItems = [...props.modelValue];
  newItems.splice(index, 1);
  emit('update:modelValue', newItems);
};

const toggleItemComplimentary = (index) => {
  const newItems = [...props.modelValue];
  newItems[index].isComplimentary = !newItems[index].isComplimentary;
  emit('update:modelValue', newItems);
};

const updateItemQuantity = (index, newQuantity) => {
  if (newQuantity < 1) return;

  const newItems = [...props.modelValue];
  newItems[index].quantity = newQuantity;
  emit('update:modelValue', newItems);
};
</script>

<template>
  <div class="base-card grid grid-cols-3 gap-x-3">
    <ProductWizard
      @select="handleWizardSelect"
      :products="products"
    />

    <div class="flat-card col-span-2 mb-0">
      <div v-if="modelValue.length === 0" class="text-gray-500 p-4">
        No hay productos seleccionados
      </div>

      <div
        v-else
        class="flex flex-col h-full"
      >
        <!-- Order Items List -->
        <div class="flex-grow overflow-y-auto">
          <div
            v-for="(item, index) in modelValue"
            :key="`${item.productId}-${index}`"
            class="flex justify-between items-center p-2 border-b border-gray-200 last:border-b-0"
          >
            <div class="flex-grow">
              <div class="text-pill">
                {{ item.collectionName }}
              </div>
              <div class="text-sm font-medium">
                {{ item.productName }}
                {{ item.variation ? `- ${item.variation.name}` : '' }}
              </div>
              <div class="text-sm text-gray-600">
                {{ formatPrice(item.unitPrice) }} x
                <button
                  @click="updateItemQuantity(index, item.quantity - 1)"
                  class="px-2 py-1 text-xs bg-gray-100 rounded"
                  :disabled="item.quantity <= 1"
                >-</button>
                {{ item.quantity }}
                <button
                  @click="updateItemQuantity(index, item.quantity + 1)"
                  class="px-2 py-1 text-xs bg-gray-100 rounded"
                >+</button>
              </div>
              <div class="text-xs text-gray-500" v-if="item.recipeId">
                Recipe ID: {{ item.recipeId }}
              </div>
            </div>

            <div class="flex gap-2 items-center">
              <button
                type="button"
                @click="toggleItemComplimentary(index)"
                class="px-2 py-1 text-sm rounded"
                :class="{
                  'bg-gray-200': item.isComplimentary,
                  'bg-gray-100': !item.isComplimentary
                }"
              >
                {{ item.isComplimentary ? 'Cortesía' : 'Cobrar' }}
              </button>
              <button
                type="button"
                @click="removeItem(index)"
                class="px-2 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

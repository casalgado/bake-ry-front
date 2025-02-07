<script setup>
import ProductWizard from './ProductWizard.vue';
import OrderLineItem from './OrderLineItem.vue';

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

const handleWizardSelect = (selection) => {
  const product = props.products.find(p => p.id === selection.product.id);
  if (!product) return;

  const prices = selection.variation ?
    {
      basePrice: selection.variation.basePrice,
      currentPrice: selection.variation.currentPrice,
    } :
    {
      basePrice: product.basePrice,
      currentPrice: product.currentPrice || product.basePrice,
    };

  const newItem = {
    productId: product.id,
    productName: product.name,
    collectionId: product.collectionId,
    collectionName: product.collectionName,
    taxPercentage: product.taxPercentage,
    quantity: selection.quantity,
    basePrice: prices.basePrice,
    currentPrice: prices.currentPrice,
    variation: selection.variation ? {
      id: selection.variation.id,
      name: selection.variation.name,
      value: selection.variation.value,
      recipeId: selection.variation.recipeId,
      isWholeGrain: selection.variation.isWholeGrain,
    } : null,
    recipeId: selection.variation?.recipeId || product.recipeId,
    isComplimentary: false,
  };

  emit('update:modelValue', [...props.modelValue, newItem]);
};

const updateItemQuantity = (index, newQuantity) => {
  if (newQuantity < 1) return;
  const newItems = [...props.modelValue];
  newItems[index].quantity = newQuantity;
  emit('update:modelValue', newItems);
};

const updateItemPrice = (index, newPrice) => {
  const newItems = [...props.modelValue];
  newItems[index].currentPrice = newPrice;
  if (newItems[index].variation) {
    newItems[index].variation.currentPrice = newPrice;
  }
  emit('update:modelValue', newItems);
};

const toggleItemComplimentary = (index) => {
  const newItems = [...props.modelValue];
  newItems[index].isComplimentary = !newItems[index].isComplimentary;
  emit('update:modelValue', newItems);
};

const removeItem = (index) => {
  const newItems = [...props.modelValue];
  newItems.splice(index, 1);
  emit('update:modelValue', newItems);
};
</script>

<template>
  <div class="base-card grid grid-cols-3 gap-x-3 gap-y-2 md:gap-y-0">
    <label class="col-span-3">Productos</label>

    <ProductWizard
      @select="handleWizardSelect"
      :products="products"
      class="col-span-3 md:col-span-1"
    />

    <div class="flat-card col-span-3 md:pt-0 md:col-span-2 mb-0 text-sm">
      <div v-if="modelValue.length === 0" class="p-4">
        No hay productos seleccionados
      </div>

      <div v-else class="flex flex-col h-full">
        <div class="flex-grow overflow-y-auto">
          <OrderLineItem
            v-for="(item, index) in modelValue"
            :key="`${item.productId}-${index}`"
            :item="item"
            :index="index"
            @update:quantity="updateItemQuantity"
            @update:price="updateItemPrice"
            @toggle-complimentary="toggleItemComplimentary"
            @remove="removeItem"
          />
        </div>
      </div>
    </div>
  </div>
</template>

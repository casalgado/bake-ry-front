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

  console.log('selection', selection);

  // Handle combination if present (new multi-dimensional system)
  if (selection.combination) {
    const basePrice = selection.combination.basePrice || 0;
    const newItem = {
      productId: product.id,
      productName: product.name,
      productDescription: product.description || '',
      collectionId: product.collectionId,
      collectionName: product.collectionName,
      taxPercentage: product.taxPercentage,
      quantity: selection.quantity,
      basePrice: basePrice,
      costPrice: selection.combination.costPrice || 0,
      currentPrice: basePrice,
      // Discount tracking fields
      referencePrice: basePrice > 0 ? basePrice : basePrice,
      discountType: null,
      discountValue: 0,
      // Convert combination to plain object to avoid reference issues
      combination: {
        id: selection.combination.id,
        selection: [...(selection.combination.selection || [])],
        name: selection.combination.name,
        basePrice: basePrice,
        costPrice: selection.combination.costPrice || 0,
        currentPrice: basePrice,
        isWholeGrain: selection.combination.isWholeGrain || false,
        isActive: selection.combination.isActive !== undefined ? selection.combination.isActive : true,
        accountingCode: selection.combination.accountingCode || '',
        getDisplayName: () => selection.combination.name || selection.combination.selection?.join(' + '),
      },
      // Keep variation for backward compatibility if it exists
      variation: selection.variation || null,
      recipeId: selection.combination.recipeId || product.recipeId,
      isComplimentary: false,
    };

    emit('update:modelValue', [...props.modelValue, newItem]);
    return;
  }

  // Fallback to legacy variation handling
  const prices = selection.variation ?
    {
      basePrice: selection.variation.basePrice,
      currentPrice: selection.variation.basePrice,
    } :
    {
      basePrice: product.basePrice,
      currentPrice: product.basePrice,
    };

  const newItem = {
    productId: product.id,
    productName: product.name,
    productDescription: product.description || '',
    collectionId: product.collectionId,
    collectionName: product.collectionName,
    taxPercentage: product.taxPercentage,
    quantity: selection.quantity,
    basePrice: prices.basePrice,
    costPrice: selection.variation?.costPrice || product.costPrice || 0,
    currentPrice: prices.basePrice,
    // Discount tracking fields
    referencePrice: prices.basePrice > 0 ? prices.basePrice : prices.basePrice,
    discountType: null,
    discountValue: 0,
    variation: selection.variation ? {
      id: selection.variation.id,
      name: selection.variation.name,
      value: selection.variation.value,
      unit: selection.variation.unit || '',
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

const updateItemCostPrice = (index, newCostPrice) => {
  const newItems = [...props.modelValue];
  newItems[index].costPrice = newCostPrice;
  if (newItems[index].combination) {
    newItems[index].combination.costPrice = newCostPrice;
  }
  emit('update:modelValue', newItems);
};

const updateItemTaxPercentage = (index, newTaxPercentage) => {
  const newItems = [...props.modelValue];
  newItems[index].taxPercentage = newTaxPercentage;
  emit('update:modelValue', newItems);
};

const updateItemReferencePrice = (index, newReferencePrice) => {
  const newItems = [...props.modelValue];
  newItems[index].referencePrice = newReferencePrice;
  emit('update:modelValue', newItems);
};

const updateItemDiscount = (index, discount) => {
  const newItems = [...props.modelValue];
  newItems[index].discountType = discount.type;
  newItems[index].discountValue = discount.value;
  emit('update:modelValue', newItems);
};
</script>

<template>
  <div class="mb-4 grid grid-cols-3 gap-x-3 gap-y-2 md:gap-y-0">

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
            @update:costPrice="updateItemCostPrice"
            @update:taxPercentage="updateItemTaxPercentage"
            @update:referencePrice="updateItemReferencePrice"
            @update:discount="updateItemDiscount"
            @toggle-complimentary="toggleItemComplimentary"
            @remove="removeItem"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import ProductWizard from './ProductWizard.vue';
import ProductSearch from './ProductSearch.vue';
import OrderLineItem from './OrderLineItem.vue';
import { watch } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useStockStore } from '@/stores/stockStore';
import { useWarehouses } from '@/composables/useWarehouses';

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
  selectionMode: {
    type: String,
    required: true,
    default: 'wizard', // 'wizard' | 'search'
  },
  // The lines of the order as saved, when editing one. The server already holds
  // them against the stock, so they are given back before the draft is counted.
  savedLines: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue']);

const settingsStore = useBakerySettingsStore();
const stockStore = useStockStore();
const { defaultWarehouseId } = useWarehouses();

// ponytail: loads every stock row; pass ?itemKeys= if the catalog grows large.
watch(() => settingsStore.isInventoryEnabled, (enabled) => {
  if (enabled) stockStore.fetchAll().catch(() => {});
}, { immediate: true });

const inventoryModeOf = (item) => (settingsStore.isInventoryEnabled
  ? props.products.find((p) => p.id === item.productId)?.inventoryMode ?? 'none'
  : 'none');

const warehouseOf = (item) => item.sourceWarehouseId || defaultWarehouseId.value;
const combinationOf = (item) => item.combination?.id || null;

// Units that `lines` take from the same stock row as `item`, leaving out the line
// at skipIndex. -1 skips none: used for a line that is not in the list yet.
const takenBy = (lines, item, skipIndex = -1) => lines.reduce((sum, line, i) => (
  i !== skipIndex
  && line.productId === item.productId
  && combinationOf(line) === combinationOf(item)
  && warehouseOf(line) === warehouseOf(item)
  && (inventoryModeOf(line) === 'unit' || line.fulfillmentSource === 'stock')
    ? sum + line.quantity
    : sum), 0);

// Disponible at the bodega the line takes from. The server's figure already holds
// the saved order's own lines (open: committed; shipped: deducted), so they come
// back, and the rest of the draft goes out. A product never stocked has none.
// ponytail: an open order past the 10-day window is not held server-side, so
// giving its lines back overshoots by its own quantity.
const availableFor = (item, index = -1) => (stockStore.items.find((s) =>
  s.productId === item.productId
  && (s.combinationId || null) === combinationOf(item)
  && s.warehouseId === warehouseOf(item),
)?.available ?? 0) + takenBy(props.savedLines, item) - takenBy(props.modelValue, item, index);

// Resale always takes from stock; a recipe product does when disponible covers it.
const defaultSource = (item) => {
  const mode = inventoryModeOf(item);
  if (mode === 'unit') return 'stock';
  if (mode === 'recipe' && availableFor(item) >= item.quantity) return 'stock';
  return 'produce';
};

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
    newItem.fulfillmentSource = defaultSource(newItem);

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
  newItem.fulfillmentSource = defaultSource(newItem);

  emit('update:modelValue', [...props.modelValue, newItem]);
};

const updateItemQuantity = (index, newQuantity) => {
  if (newQuantity < 1) return;
  const newItems = props.modelValue.map((item, i) =>
    i !== index ? item : { ...item, quantity: newQuantity },
  );
  emit('update:modelValue', newItems);
};

const updateItem = (index, delta) => {
  const newItems = props.modelValue.map((item, i) => {
    if (i !== index) return item;
    const updated = { ...item, ...delta };
    if ('currentPrice' in delta && item.variation) {
      updated.variation = { ...item.variation, currentPrice: delta.currentPrice };
    }
    return updated;
  });
  emit('update:modelValue', newItems);
};

const toggleItemComplimentary = (index) => {
  const newItems = props.modelValue.map((item, i) =>
    i !== index ? item : { ...item, isComplimentary: !item.isComplimentary },
  );
  emit('update:modelValue', newItems);
};

const removeItem = (index) => {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index));
};

const updateItemCostPrice = (index, newCostPrice) => {
  const newItems = props.modelValue.map((item, i) => {
    if (i !== index) return item;
    const updated = { ...item, costPrice: newCostPrice };
    if (item.combination) {
      updated.combination = { ...item.combination, costPrice: newCostPrice };
    }
    return updated;
  });
  emit('update:modelValue', newItems);
};

const updateItemTaxPercentage = (index, newTaxPercentage) => {
  const newItems = props.modelValue.map((item, i) =>
    i !== index ? item : { ...item, taxPercentage: newTaxPercentage },
  );
  emit('update:modelValue', newItems);
};
</script>

<template>
  <div class="mb-4 grid grid-cols-3 gap-x-3 gap-y-2 md:gap-y-0">

    <!-- Product Wizard Mode -->
    <ProductWizard
      v-if="selectionMode === 'wizard'"
      @select="handleWizardSelect"
      :products="products"
      class="col-span-3 md:col-span-1"
    />

    <!-- Product Search Mode -->
    <ProductSearch
      v-if="selectionMode === 'search'"
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
            :inventory-mode="inventoryModeOf(item)"
            :available="availableFor(item, index)"
            @update:quantity="updateItemQuantity"
            @update:item="updateItem"
            @update:costPrice="updateItemCostPrice"
            @update:taxPercentage="updateItemTaxPercentage"
            @toggle-complimentary="toggleItemComplimentary"
            @remove="removeItem"
          />
        </div>
      </div>
    </div>
  </div>
</template>

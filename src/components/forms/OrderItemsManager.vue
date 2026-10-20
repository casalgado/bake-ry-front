<script setup>
import OrderLineItem from './OrderLineItem.vue';
import { ref, computed, watch, onUnmounted } from 'vue';
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

// Live while the form is open: an order saved here or elsewhere changes disponible.
// Listening starts before the first load, so a change in between refetches.
// ponytail: loads every stock row; pass ?itemKeys= if the catalog grows large.
const stockLoaded = ref(false);
let stopWatching = null;
watch(() => settingsStore.isInventoryEnabled, (enabled) => {
  stopWatching?.();
  stopWatching = null;
  if (!enabled) return;
  stockLoaded.value = false;
  stopWatching = stockStore.watchAvailability();
  stockStore.fetchAll().catch(() => {}).finally(() => { stockLoaded.value = true; });
}, { immediate: true });
onUnmounted(() => stopWatching?.());

// A line's default source depends on the settings, the products and, with
// inventory on, the stock; decided before they are here it would be wrong and
// never revisited.
const defaultsReady = computed(() => settingsStore.items.length > 0
  && props.products.length > 0
  && (!settingsStore.isInventoryEnabled || stockLoaded.value));

const inventoryModeOf = (item) => (settingsStore.isInventoryEnabled
  ? props.products.find((p) => p.id === item.productId)?.inventoryMode ?? 'none'
  : 'none');

const warehouseOf = (item) => item.sourceWarehouseId || defaultWarehouseId.value;
const combinationOf = (item) => item.combination?.id || null;

// Units that `lines` take from the same stock row as `item`.
const takenBy = (lines, item) => lines.reduce((sum, line) => (
  line.productId === item.productId
  && combinationOf(line) === combinationOf(item)
  && warehouseOf(line) === warehouseOf(item)
  && (inventoryModeOf(line) === 'unit' || line.fulfillmentSource === 'stock')
    ? sum + line.quantity
    : sum), 0);

// Disponible before this draft, at the bodega the line takes from: one figure per
// product, so editing a quantity never moves it. The server's figure already holds
// the saved order's own lines (open: committed; shipped: deducted), so they come
// back. A product never stocked has none.
const availableFor = (item) => (stockStore.items.find((s) =>
  s.productId === item.productId
  && (s.combinationId || null) === combinationOf(item)
  && s.warehouseId === warehouseOf(item),
)?.available ?? 0) + takenBy(props.savedLines, item);

// Units the draft's stock lines of this product ask for beyond what is free.
const shortByFor = (item) => Math.max(0, takenBy(props.modelValue, item) - availableFor(item));

// Resale always takes from stock; a recipe product does when what `lines` (the
// draft) have not already taken covers it.
const defaultSource = (item, lines = props.modelValue) => {
  const mode = inventoryModeOf(item);
  if (mode === 'unit') return 'stock';
  if (mode === 'recipe' && availableFor(item) - takenBy(lines, item) >= item.quantity) return 'stock';
  return 'produce';
};

// A line that arrives without a source (a repeated order, a duplicate) gets the
// default a freshly added one would, once the defaults can be decided. One at a
// time, so two lines of a product share what is free instead of each claiming
// all of it.
watch([() => props.modelValue, defaultsReady], ([lines, ready]) => {
  if (!ready || !lines.some((line) => line.fulfillmentSource === undefined)) return;

  const decided = lines.filter((line) => line.fulfillmentSource !== undefined);
  emit('update:modelValue', lines.map((line) => {
    if (line.fulfillmentSource !== undefined) return line;
    const withSource = { ...line, fulfillmentSource: defaultSource(line, decided) };
    decided.push(withSource);
    return withSource;
  }));
}, { immediate: true });

// The catalog lives in the form's other pane; it hands its pick here, where the
// stock defaults are decided.
const add = (selection) => {
  const product = props.products.find(p => p.id === selection.product.id);
  if (!product) return;

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
      taxType: product.taxType,
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
    taxType: product.taxType,
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

defineExpose({ add });
</script>

<template>
  <div v-if="modelValue.length === 0" class="ui-empty">
    <b>Todavía no hay productos</b>
    Elígelos en el catálogo o repite un pedido anterior.
  </div>

  <!-- Separate cards with a gap, not shared hairlines: each line is something
       you put there, and its open editor stays inside it. -->
  <div v-else class="flex flex-col gap-1.5">
    <OrderLineItem
      v-for="(item, index) in modelValue"
      :key="`${item.productId}-${index}`"
      :item="item"
      :index="index"
      :inventory-mode="inventoryModeOf(item)"
      :available="availableFor(item)"
      :short-by="shortByFor(item)"
      @update:quantity="updateItemQuantity"
      @update:item="updateItem"
      @update:costPrice="updateItemCostPrice"
      @update:taxPercentage="updateItemTaxPercentage"
      @toggle-complimentary="toggleItemComplimentary"
      @remove="removeItem"
    />
  </div>
</template>

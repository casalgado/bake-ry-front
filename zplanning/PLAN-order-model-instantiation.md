# Order Model Instantiation Refactor Plan

## Summary

Refactor Vue components to use `Order` and `OrderItem` class instances instead of plain objects. This eliminates ~150 lines of duplicated calculation logic across components, ensures consistency between form previews and invoices, and centralizes all pricing/tax logic in the model.

## Goal

Remove duplicated business logic from Vue components by delegating calculations to the `Order` and `OrderItem` models. Components should create model instances, use their methods/properties, and serialize to plain objects only when emitting or saving.

---

## Background Context

### Current Problem

The `Order.js` model has comprehensive calculation logic:
- `OrderItem.calculateTaxAmount()` - tax calculation based on taxMode
- `OrderItem.calculatePreTaxPrice()` - pre-tax price extraction
- `OrderItem.calculateSubtotal()` - line item total
- `Order.calculatePricing()` - full order totals with discounts
- `Order.calculateOrderDiscountAmount()` - percentage/fixed discount logic

But Vue components duplicate this logic:
- `OrderForm.vue` lines 454-532: `calculateItemTax()`, `calculateItemPreTaxPrice()`, `subtotal`, `preTaxSubtotal`, `totalTaxAmount`, `orderDiscountAmount`, `total` computed properties
- `OrderInvoice.vue` lines 172-194: `totals` computed property duplicates Order's pricing
- `OrderItemsManager.vue` lines 20-106: manually constructs items without derived values

### Files Involved

| File | Current State | Target State |
|------|---------------|--------------|
| `src/models/Order.js` | Has all logic | Minor additions for reactivity support |
| `src/components/forms/OrderForm.vue` | Duplicates calculations | Delegates to Order instance |
| `src/components/forms/OrderItemsManager.vue` | Creates plain objects | Uses `new OrderItem()` |
| `src/components/orders/OrderInvoice.vue` | Duplicates totals | Uses Order instances |
| `src/views/orders/ExportOrders.vue` | Mixed usage | Consistent Order usage |

---

## Implementation Steps

### Phase 1: Enhance Order Model for Reactivity Support

**File:** `src/models/Order.js`

#### Step 1.1: Add recalculate method to Order class

Add a method that allows recalculating pricing without creating a new instance. This helps with Vue reactivity.

**Location:** After `calculatePricing()` method (around line 362)

**Add:**
```javascript
// Recalculate all derived values - call this after modifying properties
recalculate() {
  // Recalculate each item's derived values
  this.orderItems.forEach(item => {
    if (item instanceof OrderItem) {
      item.taxAmount = item.calculateTaxAmount();
      item.preTaxPrice = item.calculatePreTaxPrice();
      item.subtotal = item.calculateSubtotal();
    }
  });
  // Recalculate order totals
  this.calculatePricing();
}
```

#### Step 1.2: Add static factory method for creating from plain object

**Location:** After `fromFirestore()` method (around line 498)

**Add:**
```javascript
// Create Order instance from plain object (useful for Vue components)
static fromPlainObject(data) {
  return new Order({
    ...data,
    orderItems: data.orderItems?.map(item =>
      item instanceof OrderItem ? item : new OrderItem(item)
    ) || [],
  });
}
```

#### Step 1.3: Add method to update order items and recalculate

**Location:** After `recalculate()` method

**Add:**
```javascript
// Update order items and recalculate - returns this for chaining
setOrderItems(items) {
  this.orderItems = items.map(item =>
    item instanceof OrderItem ? item : new OrderItem({ ...item, taxMode: this.taxMode })
  );
  this.calculatePricing();
  return this;
}

// Add a single item and recalculate
addOrderItem(itemData) {
  const item = itemData instanceof OrderItem
    ? itemData
    : new OrderItem({ ...itemData, taxMode: this.taxMode });
  this.orderItems.push(item);
  this.calculatePricing();
  return item;
}

// Remove item by index and recalculate
removeOrderItem(index) {
  this.orderItems.splice(index, 1);
  this.calculatePricing();
}

// Update item at index and recalculate
updateOrderItem(index, updates) {
  const item = this.orderItems[index];
  if (item) {
    Object.assign(item, updates);
    item.taxAmount = item.calculateTaxAmount();
    item.preTaxPrice = item.calculatePreTaxPrice();
    item.subtotal = item.calculateSubtotal();
    this.calculatePricing();
  }
}
```

---

### Phase 2: Refactor OrderItemsManager.vue

**File:** `src/components/forms/OrderItemsManager.vue`

This is the simplest refactor - use `OrderItem` class when creating new items.

#### Step 2.1: Add import for OrderItem

**Location:** Line 1 (inside `<script setup>`)

**Change from:**
```javascript
import ProductWizard from './ProductWizard.vue';
import OrderLineItem from './OrderLineItem.vue';
```

**Change to:**
```javascript
import ProductWizard from './ProductWizard.vue';
import OrderLineItem from './OrderLineItem.vue';
import { OrderItem } from '@/models/Order.js';
```

#### Step 2.2: Add taxMode prop

**Location:** After line 15 (inside props definition)

**Add new prop:**
```javascript
taxMode: {
  type: String,
  default: 'inclusive',
},
```

Full props should now be:
```javascript
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
  taxMode: {
    type: String,
    default: 'inclusive',
  },
});
```

#### Step 2.3: Refactor handleWizardSelect to use OrderItem

**Location:** Lines 20-106

**Replace entire function with:**
```javascript
const handleWizardSelect = (selection) => {
  const product = props.products.find(p => p.id === selection.product.id);
  if (!product) return;

  console.log('selection', selection);

  // Prepare base item data
  const baseItemData = {
    productId: product.id,
    productName: product.name,
    productDescription: product.description || '',
    collectionId: product.collectionId,
    collectionName: product.collectionName,
    taxPercentage: product.taxPercentage,
    quantity: selection.quantity,
    recipeId: product.recipeId,
    isComplimentary: false,
    taxMode: props.taxMode,
  };

  // Handle combination if present (new multi-dimensional system)
  if (selection.combination) {
    const basePrice = selection.combination.basePrice || 0;
    const newItem = new OrderItem({
      ...baseItemData,
      basePrice: basePrice,
      costPrice: selection.combination.costPrice || 0,
      currentPrice: basePrice,
      referencePrice: basePrice > 0 ? basePrice : basePrice,
      discountType: null,
      discountValue: 0,
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
      },
      variation: selection.variation || null,
      recipeId: selection.combination.recipeId || product.recipeId,
    });

    emit('update:modelValue', [...props.modelValue, newItem.toPlainObject()]);
    return;
  }

  // Fallback to legacy variation handling
  const basePrice = selection.variation?.basePrice || product.basePrice;
  const newItem = new OrderItem({
    ...baseItemData,
    basePrice: basePrice,
    costPrice: selection.variation?.costPrice || product.costPrice || 0,
    currentPrice: basePrice,
    referencePrice: basePrice > 0 ? basePrice : basePrice,
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
  });

  emit('update:modelValue', [...props.modelValue, newItem.toPlainObject()]);
};
```

#### Step 2.4: Refactor update functions to use OrderItem for recalculation

**Location:** Lines 108-162

**Replace `updateItemPrice` function (lines 115-122) with:**
```javascript
const updateItemPrice = (index, newPrice) => {
  const newItems = [...props.modelValue];
  const itemData = { ...newItems[index], currentPrice: newPrice, taxMode: props.taxMode };
  if (itemData.variation) {
    itemData.variation.currentPrice = newPrice;
  }
  if (itemData.combination) {
    itemData.combination.currentPrice = newPrice;
  }
  // Use OrderItem to recalculate derived values
  const recalculatedItem = new OrderItem(itemData);
  newItems[index] = recalculatedItem.toPlainObject();
  emit('update:modelValue', newItems);
};
```

**Replace `updateItemCostPrice` function (lines 136-143) with:**
```javascript
const updateItemCostPrice = (index, newCostPrice) => {
  const newItems = [...props.modelValue];
  const itemData = { ...newItems[index], costPrice: newCostPrice, taxMode: props.taxMode };
  if (itemData.combination) {
    itemData.combination.costPrice = newCostPrice;
  }
  const recalculatedItem = new OrderItem(itemData);
  newItems[index] = recalculatedItem.toPlainObject();
  emit('update:modelValue', newItems);
};
```

**Replace `updateItemTaxPercentage` function (lines 145-149) with:**
```javascript
const updateItemTaxPercentage = (index, newTaxPercentage) => {
  const newItems = [...props.modelValue];
  const itemData = { ...newItems[index], taxPercentage: newTaxPercentage, taxMode: props.taxMode };
  // Use OrderItem to recalculate derived values
  const recalculatedItem = new OrderItem(itemData);
  newItems[index] = recalculatedItem.toPlainObject();
  emit('update:modelValue', newItems);
};
```

---

### Phase 3: Refactor OrderForm.vue

**File:** `src/components/forms/OrderForm.vue`

This is the most complex refactor. We'll use an Order instance for calculations while keeping the reactive form data pattern.

#### Step 3.1: Add Order import

**Location:** Line 11 (after other imports)

**Add:**
```javascript
import { Order, OrderItem } from '@/models/Order.js';
```

#### Step 3.2: Remove duplicated calculation functions

**Location:** Lines 453-506

**DELETE the following functions entirely:**
- `calculateItemTax` (lines 454-460)
- `calculateItemPreTaxPrice` (lines 463-469)

These are now handled by OrderItem class.

#### Step 3.3: Create computed Order instance

**Location:** After line 451 (after `currentTaxMode` computed)

**Add:**
```javascript
// Create Order instance for calculations - rebuilds when dependencies change
const orderInstance = computed(() => {
  return new Order({
    ...formData.value,
    taxMode: currentTaxMode.value,
    orderItems: formData.value.orderItems.map(item => ({
      ...item,
      taxMode: currentTaxMode.value,
    })),
  });
});
```

#### Step 3.4: Replace duplicated computed properties with delegations

**Location:** Lines 471-532

**Replace `subtotal` computed (lines 472-484) with:**
```javascript
const subtotal = computed(() => {
  if (formData.value.paymentMethod === 'complimentary') {
    return 0;
  }
  return orderInstance.value.subtotal;
});
```

**Replace `preTaxSubtotal` computed (lines 487-495) with:**
```javascript
const preTaxSubtotal = computed(() => {
  if (formData.value.paymentMethod === 'complimentary') {
    return 0;
  }
  return orderInstance.value.preTaxTotal;
});
```

**Replace `totalTaxAmount` computed (lines 498-506) with:**
```javascript
const totalTaxAmount = computed(() => {
  if (formData.value.paymentMethod === 'complimentary') {
    return 0;
  }
  return orderInstance.value.totalTaxAmount;
});
```

**Replace `orderDiscountAmount` computed (lines 509-521) with:**
```javascript
const orderDiscountAmount = computed(() => {
  return orderInstance.value.orderDiscountAmount;
});
```

**Replace `total` computed (lines 523-532) with:**
```javascript
const total = computed(() => {
  if (formData.value.paymentMethod === 'complimentary') {
    return 0;
  }
  return orderInstance.value.total;
});
```

#### Step 3.5: Update OrderItemsManager usage in template

**Location:** Line 1006-1009

**Change from:**
```vue
<OrderItemsManager
  v-model="formData.orderItems"
  :products="productStore.items"
/>
```

**Change to:**
```vue
<OrderItemsManager
  v-model="formData.orderItems"
  :products="productStore.items"
  :tax-mode="currentTaxMode"
/>
```

#### Step 3.6: Update handleSubmit to use Order instance

**Location:** Lines 434-446

**Replace with:**
```javascript
const handleSubmit = () => {
  if (!validate()) return;
  formData.value.deliveryAddress = cleanString(formData.value.deliveryAddress);
  formData.value.deliveryNotes = cleanString(formData.value.deliveryNotes);
  formData.value.internalNotes = cleanString(formData.value.internalNotes);
  formData.value.isPaid = !!formData.value.paymentDate;

  // Use Order instance for consistent serialization
  const order = new Order({
    ...formData.value,
    taxMode: currentTaxMode.value,
  });

  console.log('Form Data:', order.toFirestore());
  emit('submit', order.toFirestore());
};
```

---

### Phase 4: Refactor OrderInvoice.vue

**File:** `src/components/orders/OrderInvoice.vue`

#### Step 4.1: Add Order import

**Location:** Line 5 (after other imports)

**Add:**
```javascript
import { Order } from '@/models/Order.js';
```

#### Step 4.2: Create computed Order instances

**Location:** After line 26 (after emit definition)

**Add:**
```javascript
// Convert plain order objects to Order instances for calculations
const orderInstances = computed(() => {
  return props.orders.map(orderData => {
    if (orderData instanceof Order) return orderData;
    return new Order(orderData);
  });
});
```

#### Step 4.3: Refactor combinedItems to use Order instances

**Location:** Lines 121-169

**Replace entire `combinedItems` computed with:**
```javascript
const combinedItems = computed(() => {
  const items = [];

  orderInstances.value.forEach((order, orderIndex) => {
    // Use Order's getSortedOrderItems() method
    const sortedItems = order.getSortedOrderItems();

    sortedItems.forEach((item, itemIndex) => {
      items.push({
        id: item.id,
        orderId: order.id,
        preparationDate: order.preparationDate,
        productName: item.productName || 'Producto',
        productDescription: item.productDescription || '',
        invoiceTitle: item.invoiceTitle || '',
        variation: item.variation || null,
        combination: item.combination || null,
        quantity: item.quantity || 0,
        // Use pre-calculated values from OrderItem
        unitPrice: item.preTaxPrice,
        lineTotal: item.preTaxPrice * (item.quantity || 0),
        taxPercentage: item.taxPercentage || 0,
        orderIndex,
        itemIndex,
      });
    });

    // Add delivery fee as a line item if applicable
    if (order.fulfillmentType === 'delivery' && order.deliveryFee > 0) {
      items.push({
        orderId: order.id,
        preparationDate: order.preparationDate,
        productName: 'Servicio de Domicilio',
        variation: '',
        quantity: 1,
        unitPrice: order.deliveryFee,
        lineTotal: order.deliveryFee,
        taxPercentage: 0,
      });
    }
  });

  return items;
});
```

#### Step 4.4: Refactor totals to use Order instances

**Location:** Lines 172-194

**Replace entire `totals` computed with:**
```javascript
const totals = computed(() => {
  let subtotal = 0;
  let preTaxTotal = 0;
  let totalTaxAmount = 0;
  let deliveryTotal = 0;
  let orderDiscountTotal = 0;

  orderInstances.value.forEach(order => {
    // Use pre-calculated values from Order instance
    subtotal += order.subtotal || 0;
    preTaxTotal += order.preTaxTotal || 0;
    totalTaxAmount += order.totalTaxAmount || 0;
    orderDiscountTotal += order.orderDiscountAmount || 0;
    if (order.fulfillmentType === 'delivery') {
      deliveryTotal += order.deliveryFee || 0;
    }
  });

  return {
    preTaxTotal,
    totalTaxAmount,
    subtotal,
    orderDiscount: orderDiscountTotal,
    delivery: deliveryTotal,
    total: subtotal - orderDiscountTotal + deliveryTotal,
  };
});
```

#### Step 4.5: Update isFirstItemInOrder and isLastItemInOrder helpers

**Location:** Lines 93-106

**Replace with:**
```javascript
const isFirstItemInOrder = (item) => {
  if (item.orderIndex === undefined) return true;
  const order = orderInstances.value[item.orderIndex];
  if (!order) return true;
  const sorted = order.getSortedOrderItems();
  return sorted[0]?.id === item.id;
};

const isLastItemInOrder = (item) => {
  if (item.orderIndex === undefined) return true;
  const order = orderInstances.value[item.orderIndex];
  if (!order) return true;
  const sorted = order.getSortedOrderItems();
  return sorted[sorted.length - 1]?.id === item.id;
};
```

---

### Phase 5: Update ExportOrders.vue

**File:** `src/views/orders/ExportOrders.vue`

This file already uses `new Order()` for reordering. Ensure consistency.

#### Step 5.1: Verify Order import exists

**Location:** Line 6

**Confirm this exists:**
```javascript
import { Order } from '@/models/Order.js';
```

#### Step 5.2: Convert fetched orders to Order instances

**Location:** Lines 111-112

**Change from:**
```javascript
// Filter out any null values (failed fetches)
orders.value = fetchedOrders.filter(Boolean);
```

**Change to:**
```javascript
// Filter out nulls and convert to Order instances
orders.value = fetchedOrders
  .filter(Boolean)
  .map(orderData => orderData instanceof Order ? orderData : new Order(orderData));
```

---

## Verification Steps

### Step 1: Model Changes Verification
1. Open `src/models/Order.js`
2. Verify `recalculate()` method exists and works
3. Verify `fromPlainObject()` static method works
4. Verify `setOrderItems()`, `addOrderItem()`, `removeOrderItem()`, `updateOrderItem()` methods exist
5. Test: Create an Order instance, modify items, call recalculate(), verify totals update

### Step 2: OrderItemsManager Verification
1. Create a new order
2. Add products via the ProductWizard
3. Verify items have `taxAmount`, `preTaxPrice`, `subtotal` values
4. Change item price - verify derived values recalculate
5. Change item tax percentage - verify derived values recalculate
6. Verify items display correctly in the list

### Step 3: OrderForm Verification
1. Create a new order with multiple items
2. Verify subtotal matches expected calculation
3. Verify pre-tax subtotal is correct
4. Verify total tax amount is correct
5. Add an order-level discount (percentage) - verify discount amount is correct
6. Add an order-level discount (fixed) - verify it caps at subtotal
7. Toggle fulfillment type - verify delivery fee affects total
8. Change payment method to complimentary - verify all totals become 0
9. Submit order - verify emitted data has correct structure

### Step 4: OrderInvoice Verification
1. Open an existing order's invoice view
2. Verify line items show correct pre-tax prices
3. Verify totals section shows correct values
4. Verify tax amount matches sum of item taxes
5. Reorder items - verify they save and display in new order
6. Compare invoice totals with order totals from database

### Step 5: ExportOrders Verification
1. Export a single order
2. Verify invoice renders correctly
3. Export multiple orders
4. Verify combined totals are correct
5. Edit item description - verify it saves
6. Reorder items - verify it persists

### Step 6: Cross-Component Consistency
1. Create an order in OrderForm
2. Note the displayed totals
3. View the same order in OrderInvoice
4. Verify totals match exactly
5. Test with different tax modes (inclusive/exclusive)
6. Test with order-level discounts

---

## Rollback Plan

If issues are discovered:

1. **Phase 1 (Model):** Model additions are backward compatible. No rollback needed.
2. **Phase 2 (OrderItemsManager):** Revert file to previous version. Items will work as plain objects.
3. **Phase 3 (OrderForm):** Revert computed properties. Restore duplicated calculation functions.
4. **Phase 4 (OrderInvoice):** Revert computed properties. Remove Order import.
5. **Phase 5 (ExportOrders):** Revert the map() addition. Orders work as plain objects.

---

## Notes for Implementing Agent

1. **DO NOT** modify any test files unless explicitly asked
2. **DO NOT** run the development server - it is already running
3. **Follow Vue conventions:** `<script setup>` first, then `<template>`, then `<style scoped>`
4. **Preserve existing functionality** - this is a refactor, not a feature change
5. **Keep imports organized** - group by type (Vue, components, models, utils)
6. After each phase, the code should still work - test incrementally
7. The `toPlainObject()` method is critical - always use it when emitting or storing
8. Vue's `computed()` with class instances works - the computed recreates the instance when dependencies change

# Product Variations Structure Migration Plan

## Overview
The product variations structure is changing from an array to an object format to better support multi-dimensional variations.

### Structure Change
- **Old Structure**: `variations: []` (array of variation objects)
- **New Structure**: `variations: { dimensions: [], combinations: [] }` (object with dimensions and combinations arrays)

## Current Status
- ✅ **Backend API**: Already supports the new structure
- ✅ **ProductForm.vue**: Already updated to use the new structure
- ❌ **Other Frontend Components**: Still expect the old array structure

## Files Requiring Updates

### 1. Core Model Files

#### `src/models/Product.js`
**Lines affected**: 14, 43, 46-52, 71-80, 85-87, 96-98

**Current issues**:
- Line 14: Constructor expects `variations = []` as array
- Line 43: `hasVariations` check uses `this.variations?.length > 0`
- Lines 46-52: Maps over variations array expecting array structure
- Lines 71-80: `setVariations()` method expects array and maps over it
- Lines 85-87: `toFirestore()` method checks `this.variations.length > 0`
- Lines 96-98: `fromFirestore()` maps variations as array

**Changes needed**:
- Update constructor to handle object structure `{dimensions: [], combinations: []}`
- Change `hasVariations` logic to check `combinations.length`
- Update `setVariations()` to work with new structure
- Fix serialization methods

---

### 2. Form Components

#### `src/components/forms/OrderForm.vue`
**Lines affected**: 54-55

**Current issue**:
```javascript
basePrice: product.variations[0].basePrice,
currentPrice: preserveCurrentPrice ? item.currentPrice : product.variations[0].basePrice,
```

**Changes needed**:
- Access combinations array: `product.variations.combinations[0].basePrice`

---

#### `src/components/forms/ProductWizard.vue`
**Line affected**: 160

**Current issue**:
```javascript
if (selected.variations?.length > 0) {
```

**Changes needed**:
- Check combinations: `if (selected.variations?.combinations?.length > 0) {`

---

### 3. Display Components

#### `src/components/DataTable/renderers/VariationsCell.vue`
**Lines affected**: 6-8, 12

**Current issues**:
- Props definition expects Array type
- Uses `sortVariations()` which expects array

**Changes needed**:
- Update prop type to Object
- Access combinations array for display
- Update sorting logic

---

#### `src/views/products/ShowProducts.vue`
**Line affected**: 82

**Current issue**:
```javascript
hide: row.variations.length > 0,
```

**Changes needed**:
- Check combinations: `hide: row.variations?.combinations?.length > 0,`

---

### 4. Utility Functions

#### `src/utils/helpers.js`
**Line affected**: 235

**Current issue**:
```javascript
if (!variations || !Array.isArray(variations)) return [];
```

**Changes needed**:
- Update `sortVariations()` function to handle new structure
- Should check for `variations.combinations` array

---

### 5. Test Files

#### `src/components/forms/__tests__/ProductForm.test.js`
**Status**: ✅ Already correctly expects the new structure

```javascript
expect(wrapper.vm.formData.variations).toEqual({
  dimensions: [],
  combinations: [],
});
```

---

## Files That Should Continue Working
These files reference individual variation objects from order items but don't directly access the product.variations array structure:

- `src/components/forms/OrderItemsManager.vue` - Works with individual variation objects
- `src/models/Order.js` - Stores variation object reference
- `src/utils/exportOrders.js` - Accesses variation from order items
- `src/views/orders/ShowProductionGroupedItems.vue` - Groups by variation object
- `src/views/orders/CreateOfflineOrder.vue` - Displays variation from order items
- `src/components/orders/ShowOrderHistory.vue` - Compares variation objects
- `src/components/DataCalendar/components/CalendarDay.vue` - Shows variation name
- `src/components/DataTable/renderers/ItemsCell.vue` - Displays variation name

---

## Implementation Order

### Phase 1: Core Model Update
1. Update `src/models/Product.js` to handle both old and new structures (backward compatibility)

### Phase 2: Display Components
2. Update `src/components/DataTable/renderers/VariationsCell.vue`
3. Update `src/views/products/ShowProducts.vue`
4. Update `src/utils/helpers.js` sortVariations function

### Phase 3: Order Components
5. Update `src/components/forms/OrderForm.vue`
6. Update `src/components/forms/ProductWizard.vue`

### Phase 4: Testing
7. Run existing tests
8. Test product creation/editing with variations
9. Test order creation with product variations
10. Verify data display in tables and lists

---

## Migration Strategy

### Backward Compatibility Approach
To ensure smooth transition, the Product model should temporarily handle both structures:

```javascript
// In Product.js constructor
if (Array.isArray(variations)) {
  // Old structure - convert to new
  this.variations = {
    dimensions: [],
    combinations: variations
  };
} else {
  // New structure
  this.variations = variations || { dimensions: [], combinations: [] };
}
```

This allows existing data to continue working while new data uses the updated structure.

---

## Testing Checklist

- [ ] Create new product with variations
- [ ] Edit existing product with old variation structure
- [ ] Display products list with variations
- [ ] Add product with variations to order
- [ ] View order with product variations
- [ ] Export orders with product variations
- [ ] Production views show variations correctly
- [ ] Calendar view displays variations
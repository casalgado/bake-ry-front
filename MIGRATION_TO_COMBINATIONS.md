# Migration to Multi-Dimensional Combinations

## Overview

This document outlines the migration strategy from single product variations to multi-dimensional combinations using the new VariationGroups system. The migration maintains backward compatibility while enabling complex product configurations.

## Architecture Changes

### Data Structure Transformation

**Before (Single Variation):**
```javascript
orderItem = {
  variation: {
    id: "var-123",
    name: "chocolate",
    basePrice: 25,
    isWholeGrain: false
  }
}
```

**After (Multi-Dimensional Combination):**
```javascript
orderItem = {
  combination: {
    id: "combo-456",
    selection: ["mediano", "chocolate"],
    name: "mediano + chocolate",
    basePrice: 25,
    currentPrice: 25,
    isWholeGrain: false,
    isActive: true
  },
  variation: { /* preserved for historical reference */ }
}
```

## Implementation Plan

### Phase 1: Foundation Classes

#### 1.1 Create Combination Class (`src/models/Combination.js`)

```javascript
import BaseModel from './base/BaseModel.js';

export default class Combination extends BaseModel {
  constructor(data = {}) {
    super(data);

    this.id = data.id;
    this.selection = data.selection || [];
    this.name = data.name || '';
    this.basePrice = data.basePrice || 0;
    this.currentPrice = data.currentPrice || this.basePrice;
    this.isWholeGrain = data.isWholeGrain || false;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
  }

  static fromLegacyVariation(variation, currentPrice = null) {
    return new Combination({
      id: variation.id,
      selection: [variation.name],
      name: variation.name,
      basePrice: variation.basePrice,
      currentPrice: currentPrice || variation.basePrice,
      isWholeGrain: variation.isWholeGrain || false,
      isActive: true
    });
  }

  getTotalPrice(quantity = 1) {
    return this.currentPrice * quantity;
  }

  getDisplayName() {
    return this.name || this.selection.join(' + ');
  }

  isLegacyVariation() {
    return this.selection.length === 1;
  }

  toFirestore() {
    const data = super.toFirestore();
    return {
      ...data,
      selection: this.selection,
      name: this.name,
      basePrice: this.basePrice,
      currentPrice: this.currentPrice,
      isWholeGrain: this.isWholeGrain,
      isActive: this.isActive
    };
  }
}
```

### Phase 2: Order Model Migration

#### 2.1 Update OrderItem Class (`src/models/Order.js`)

```javascript
// Add import
import Combination from './Combination.js';

// Update OrderItem constructor
class OrderItem extends BaseModel {
  constructor(data = {}) {
    super(data);

    // Auto-migration: Convert old variation to new combination
    if (data.variation && !data.combination) {
      this.combination = Combination.fromLegacyVariation(
        data.variation,
        data.currentPrice
      );
      this.variation = data.variation; // Keep for historical reference
    } else if (data.combination) {
      this.combination = new Combination(data.combination);
      this.variation = data.variation; // May be null for new orders
    }

    // Existing properties...
    this.productId = data.productId;
    this.productName = data.productName;
    this.quantity = data.quantity || 1;
    this.basePrice = data.basePrice || 0;
    this.currentPrice = data.currentPrice || this.basePrice;
    this.isComplimentary = data.isComplimentary || false;
  }

  // Update price calculation to use combination
  getItemTotal() {
    if (this.isComplimentary) return 0;

    const price = this.combination ?
      this.combination.currentPrice :
      this.currentPrice;

    return price * this.quantity;
  }

  // Helper to get display name
  getVariationName() {
    return this.combination ?
      this.combination.getDisplayName() :
      this.variation?.name || '';
  }

  toFirestore() {
    const data = super.toFirestore();
    return {
      ...data,
      combination: this.combination?.toFirestore(),
      variation: this.variation // Preserve for backward compatibility
    };
  }
}
```

### Phase 3: Component Updates

#### 3.1 ProductWizard Rewrite (`src/components/forms/ProductWizard.vue`)

**Current Flow:** Category → Product → Variation → Quantity
**New Flow:** Category → Product → [Dimension1 → Dimension2 → ...] → Quantity

Key changes:
- Add dimension iteration logic
- Track selections across multiple dimensions
- Build final combination from selections
- Emit combination instead of single variation

#### 3.2 OrderItemsManager Updates (`src/components/forms/OrderItemsManager.vue`)

```javascript
// Update handleWizardSelect method
const handleWizardSelect = (selection) => {
  const product = props.products.find(p => p.id === selection.product.id);
  if (!product) return;

  // Use combination instead of variation
  const combination = selection.combination;

  const newItem = {
    productId: product.id,
    productName: product.name,
    collectionId: product.collectionId,
    collectionName: product.collectionName,
    taxPercentage: product.taxPercentage,
    quantity: selection.quantity,
    basePrice: combination.basePrice,
    currentPrice: combination.basePrice,
    combination: combination,
    recipeId: combination.recipeId || product.recipeId,
    isComplimentary: false,
  };

  emit('update:modelValue', [...props.modelValue, newItem]);
};
```

#### 3.3 OrderLineItem Updates (`src/components/forms/OrderLineItem.vue`)

- Update display logic to show combination name
- Handle combination price updates
- Preserve variation display for migrated items

#### 3.4 OrderForm Updates (`src/components/forms/OrderForm.vue`)

```javascript
// Update addBasePricesToOrderItems function
const addBasePricesToOrderItems = (items) => {
  return items.map(item => ({
    ...item,
    basePrice: item.combination ?
      item.combination.basePrice :
      item.basePrice,
    currentPrice: item.combination ?
      item.combination.currentPrice :
      item.currentPrice
  }));
};
```

## Migration Testing

### Unit Tests
- [ ] Combination class creation and methods
- [ ] Legacy variation migration logic
- [ ] OrderItem auto-migration
- [ ] Price calculations with combinations

### Integration Tests
- [ ] ProductWizard multi-dimensional flow
- [ ] OrderItemsManager combination handling
- [ ] OrderForm price calculations
- [ ] Database save/load with combinations

### Data Migration Tests
- [ ] Load existing orders with variations
- [ ] Verify auto-migration occurs
- [ ] Ensure backward compatibility
- [ ] Test mixed orders (old + new items)

## Deployment Strategy

### Phase 1: Foundation (Low Risk)
1. Deploy Combination class
2. Update Order model with migration logic
3. Test with existing data

### Phase 2: UI Updates (Medium Risk)
1. Update OrderLineItem display
2. Update OrderItemsManager logic
3. Update OrderForm calculations
4. Test order creation/editing

### Phase 3: Wizard Rewrite (High Risk)
1. Rewrite ProductWizard for multi-dimensional selection
2. Comprehensive testing of new flow
3. Gradual rollout with feature flags

## Rollback Plan

If issues arise:
1. **Phase 1**: Revert Order model changes, data remains intact
2. **Phase 2**: Revert component updates, combinations still work
3. **Phase 3**: Revert to old ProductWizard, new combinations still supported

## Success Criteria

- [ ] All existing orders load without errors
- [ ] Legacy variations display correctly
- [ ] New multi-dimensional products can be selected
- [ ] Price calculations work for both old and new items
- [ ] No data loss during migration
- [ ] Performance remains acceptable

## Notes

- Migration is automatic and transparent to users
- Old variation data is preserved for audit trails
- New combination structure supports unlimited dimensions
- Backward compatibility maintained indefinitely
- No database migration scripts required (handled in model)
# Tax Mode Feature Implementation Plan

## Summary
Add `taxMode` property to orders to support both tax-inclusive (IVA incluido - current behavior) and tax-exclusive (IVA adicional) calculations. Each order stores its own taxMode, defaulting to the bakery's setting but overridable per order.

## Tax Calculation Logic

**Tax-Inclusive (current):**
- `currentPrice` = final price (includes tax)
- `taxAmount = (currentPrice × taxPercentage) / (100 + taxPercentage)`
- `subtotal = quantity × currentPrice`

**Tax-Exclusive (new):**
- `currentPrice` = base price (tax added on top)
- `taxAmount = (currentPrice × taxPercentage) / 100`
- `subtotal = quantity × (currentPrice + taxAmount)`

---

## Files to Modify

### 1. Frontend Order Model
**File:** `src/models/Order.js`

**Changes:**
- Add `taxMode = 'inclusive'` parameter to `OrderItem` constructor
- Store `this.taxMode = taxMode`
- Modify `calculateTaxAmount()`:
  ```javascript
  if (this.taxMode === 'exclusive') {
    return Math.round((this.currentPrice * this.taxPercentage) / 100);
  }
  return Math.round((this.currentPrice * this.taxPercentage) / (100 + this.taxPercentage));
  ```
- Modify `calculateSubtotal()`:
  ```javascript
  if (this.taxMode === 'exclusive') {
    return this.quantity * (this.currentPrice + this.taxAmount);
  }
  return this.quantity * this.currentPrice;
  ```
- Add `taxMode = 'inclusive'` parameter to `Order` constructor
- Pass `taxMode` to OrderItem when creating items
- Include `taxMode` in `toPlainObject()` and `toClientHistoryObject()`

### 2. Backend Order Model
**File:** `functions/src/models/Order.js`

**Changes:** Same as frontend Order model

### 3. Frontend BakerySettings Model
**File:** `src/models/BakerySettings.js`

**Changes:**
- Add to `DEFAULT_FEATURES.invoicing`:
  ```javascript
  taxMode: 'inclusive', // 'inclusive' or 'exclusive'
  ```

### 4. Backend BakerySettings Model
**File:** `functions/src/models/BakerySettings.js`

**Changes:** Same as frontend - add `taxMode: 'inclusive'` to DEFAULT_FEATURES.invoicing

### 5. BakeryFeaturesForm
**File:** `src/components/forms/BakeryFeaturesForm.vue`

**Changes:**
- Add `taxMode: 'inclusive'` to props.initialData default
- Add radio options for taxMode
- Add watch for taxMode changes
- Add UI section in Invoice Features area:
  ```vue
  <RadioFeatureCard
    v-model="formData.taxMode"
    title="Modo de IVA"
    description="Define cómo se calcula el IVA en los pedidos"
    :options="[
      { value: 'inclusive', label: 'IVA Incluido' },
      { value: 'exclusive', label: 'IVA Adicional' }
    ]"
  />
  ```

### 6. ShowBakerySettings
**File:** `src/views/bakerySettings/ShowBakerySettings.vue`

**Changes:**
- Add `taxMode: 'inclusive'` to `featuresFormData`
- Add taxMode handling in `initializeFeaturesForm()`
- Include taxMode in `handleFeaturesSubmit()` under features.invoicing

### 7. OrderForm
**File:** `src/components/forms/OrderForm.vue`

**Changes:**
- Add `taxMode` to initial form state (default from bakerySettings)
- Compute default taxMode from `bakerySettingsStore.items[0].features?.invoicing?.taxMode || 'inclusive'`
- Add simple select/toggle in the form for taxMode override
- Include `taxMode` in emitted form data

### 8. OrderInvoice
**File:** `src/components/orders/OrderInvoice.vue`

**Changes:**
- Add computed property for dynamic label:
  ```javascript
  const preTaxLabel = computed(() => {
    const taxMode = props.orders[0]?.taxMode || 'inclusive';
    return taxMode === 'exclusive' ? 'Subtotal' : 'Subtotal (sin IVA)';
  });
  ```
- Use `preTaxLabel` in template instead of hardcoded "Subtotal (sin IVA)"

---

## Files NOT Modified
- `SalesReport.js` - uses pre-calculated values from orders
- `OrderItemsManager.vue` - doesn't handle tax calculations
- `OrderLineItem.vue` - taxPercentage input unchanged
- `exportOrders.js` - uses calculated subtotals

---

## Default Behavior
- Existing orders without `taxMode` → defaults to `'inclusive'` (backwards compatible)
- New orders → use bakery's `features.invoicing.taxMode` setting
- Per-order override available in OrderForm

---

## Verification Steps
1. **Settings UI:** Go to Bakery Settings, verify taxMode toggle appears and saves
2. **New Order (inclusive):** Create order with tax-inclusive, verify calculations match current behavior
3. **New Order (exclusive):** Switch setting to exclusive, create order, verify tax is added to subtotal
4. **Per-order override:** With exclusive default, create order but switch to inclusive in form, verify it uses inclusive calculation
5. **Invoice display:** Print invoice for both modes, verify labels are correct
6. **Existing orders:** Load old order without taxMode, verify it defaults to inclusive and calculates correctly

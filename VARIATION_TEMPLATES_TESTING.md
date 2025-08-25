# Variation Templates Testing Checklist

## Critical Tests (Do These First)

### 1. System Settings - Unit Options Migration
- [ ] Open System Settings → Unit Options
- [ ] Verify existing units display correctly
- [ ] Add a new unit with symbol/name/type
- [ ] Save and reload page to confirm persistence

### 2. Existing Collections
- [ ] Open an existing collection in edit mode
- [ ] Verify it loads without errors
- [ ] Update the collection and save
- [ ] Check new variation fields have defaults

### 3. Existing Products  
- [ ] Open an existing product in edit mode
- [ ] Verify all variations load correctly
- [ ] Check that 'otra' variation is present
- [ ] Save without making changes

### 4. Existing orders

- [ ] Edit an existing order, change the products. 

## New Feature Tests

### 4. Create Collection with Templates
- [ ] Create new collection
- [ ] Select WEIGHT variation type
- [ ] Choose default unit (g, kg, etc.)
- [ ] Enable whole grain variations toggle
- [ ] Add variation templates (pequeño, mediano, grande)
- [ ] Save collection

### 5. Create Product Using Collection Templates
- [ ] Create new product
- [ ] Select the collection from step 4
- [ ] Verify "has variations" auto-enables
- [ ] Check CATEGORY option appears in variation type
- [ ] Select CATEGORY and verify templates load
- [ ] Set base prices for variations
- [ ] Test proportional pricing (change one price, others auto-calculate)
- [ ] Save product

### 6. Cross-Component Integration
- [ ] Create unit in System Settings
- [ ] Use that unit in a new collection
- [ ] Create product using that collection
- [ ] Verify unit appears consistently throughout

## Edge Case Tests

### 7. Data Validation
- [ ] Try saving collection without name
- [ ] Try saving product without required fields
- [ ] Test with empty variation templates
- [ ] Verify error messages are helpful

### 8. Edit Mode Scenarios
- [ ] Edit collection to add templates after creation
- [ ] Edit product to change from no variations to variations
- [ ] Edit product to switch between variation types
- [ ] Test undo/cancel functionality

### 9. Whole Grain Variations
- [ ] Create collection with whole grain enabled
- [ ] Verify integral versions are created automatically
- [ ] Test disabling whole grain (should prompt for confirmation)
- [ ] Check integral variations are removed properly

### 10. Final End-to-End Test
- [ ] System Settings: Configure units and templates
- [ ] Create collection with custom templates
- [ ] Create multiple products using the collection
- [ ] Edit existing products to use new templates
- [ ] Verify all data persists after page refresh

## Success Criteria
- ✅ No data loss on existing collections/products
- ✅ New template system creates products correctly
- ✅ Proportional pricing calculations work
- ✅ Unit options migration successful
- ✅ All forms save/load without errors
# 📋 Invoice Enhancement Implementation Plan

## 🎯 Project Goals
- Add product descriptions to invoices (loaded from products, editable per invoice)
- Add Terms & Conditions section (default from settings, editable per invoice)
- Implement inline editing capabilities for invoice content
- Maintain backward compatibility with existing orders

## 🔍 Current System Analysis

### ✅ Existing Infrastructure
1. **Product model already has `description` field** (`src/models/Product.js` lines 32, 42)
2. **Order model has solid structure** with OrderItem class
3. **BakerySettings has modular features system**
4. **Auto-save mechanism exists** in BakeryFeaturesForm

### ⚠️ Gaps Identified
1. **OrderItem doesn't capture product description** when created
2. **No invoice customization fields** in Order model
3. **No Terms & Conditions in BakerySettings**
4. **Invoice is read-only** - no editing capability
5. **OrderItemsManager doesn't pass description** to orderItems

## 🏗️ Implementation Steps

---

## STEP 1: Extend Data Models
**Impact:** Medium | **Risk:** Low | **Backward Compatible:** Yes

### 1.1 Extend OrderItem Class
**File:** `src/models/Order.js`

**Changes:**
```javascript
// Add to constructor parameters (line 6-22)
class OrderItem {
  constructor({
    // ... existing parameters ...
    productDescription,  // NEW
    // ... rest of parameters ...
  }) {
    // ... existing assignments ...
    this.productDescription = productDescription || ''; // NEW (after line 25)
    // ... rest of constructor ...
  }

  // Update toPlainObject() to include productDescription
  toPlainObject() {
    const data = { ...this };
    // ... existing logic ...
    return data;
  }

  // Update toClientHistoryObject() to include productDescription
  toClientHistoryObject() {
    return {
      // ... existing fields ...
      productDescription: this.productDescription, // NEW
      // ... rest of fields ...
    };
  }
}
```

### 1.2 Add Invoice Customizations to Order Model
**File:** `src/models/Order.js`

**Changes:**
```javascript
class Order extends BaseModel {
  constructor({
    // ... existing parameters ...
    invoiceCustomizations = {}, // NEW (line 177)
  } = {}) {
    // ... existing constructor logic ...

    // Add after line 226
    this.invoiceCustomizations = invoiceCustomizations || {
      termsAndConditions: '',
      notes: '',
      customTitle: ''
    };
  }

  // Update toFirestore() to include invoiceCustomizations
  toFirestore() {
    const data = super.toFirestore();
    // ... existing logic ...
    data.invoiceCustomizations = this.invoiceCustomizations; // NEW
    return data;
  }
}
```

---

## STEP 2: Update Order Creation Flow
**Impact:** High | **Risk:** Medium | **Backward Compatible:** Yes

### 2.1 Update OrderItemsManager to Include Description
**File:** `src/components/forms/OrderItemsManager.vue`

**Changes in handleWizardSelect():**
```javascript
// When creating combination-based item (line 29-55)
const newItem = {
  productId: product.id,
  productName: product.name,
  productDescription: product.description || '',  // ADD THIS
  // ... rest of item properties ...
};

// When creating legacy variation item (line 70-91)
const newItem = {
  productId: product.id,
  productName: product.name,
  productDescription: product.description || '',  // ADD THIS
  // ... rest of item properties ...
};
```

---

## STEP 3: Extend BakerySettings Model
**Impact:** Low | **Risk:** Low | **Backward Compatible:** Yes

### 3.1 Add Invoicing Configuration
**File:** `src/models/BakerySettings.js`

**Changes:**
```javascript
// Add new property to model
class BakerySettings extends BaseModel {
  constructor({
    // ... existing parameters ...
    invoicing = {
      defaultTermsAndConditions: '',
      showProductDescriptions: true,
      showTermsAndConditions: true
    },
    // ... rest of parameters ...
  }) {
    // ... existing constructor logic ...
    this.invoicing = invoicing;
  }
}
```

---

## STEP 4: Add Invoice Settings UI
**Impact:** Low | **Risk:** Low | **Backward Compatible:** Yes

### 4.1 Extend BakeryFeaturesForm
**File:** `src/components/forms/BakeryFeaturesForm.vue`

**Add new section in template (after line 227):**
```vue
<!-- Invoice Features Section -->
<div class="mb-6">
  <h3 class="text-lg font-semibold text-neutral-900 mb-2">
    Configuración de Facturas / Cotizaciones
  </h3>
  <p class="text-sm text-neutral-600 mb-4">
    Personaliza la información que aparece en tus facturas
  </p>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-neutral-700 mb-1">
        Términos y Condiciones
      </label>
      <textarea
        v-model="formData.defaultTermsAndConditions"
        rows="4"
        class="w-full"
        placeholder="Ingresa los términos y condiciones que aparecerán en todas las facturas..."
        :disabled="loading"
      />
    </div>
  </div>
</div>
```

**Update initialData (line 30-40):**
```javascript
initialData: {
  type: Object,
  default: () => ({
    // ... existing fields ...
    defaultTermsAndConditions: '', // NEW
  }),
}
```

### 4.2 Update Settings Save Handler
**File:** `src/views/bakerySettings/ShowBakerySettings.vue`

**Update handleFeaturesSubmit() (line 554):**
```javascript
await settingsStore.patch('default', {
  features: {
    // ... existing features ...
  },
  invoicing: { // NEW
    defaultTermsAndConditions: formData.defaultTermsAndConditions || '',
    showProductDescriptions: true,
    showTermsAndConditions: true,
  },
});
```

---

## STEP 5: Make Invoice Editable
**Impact:** High | **Risk:** Medium | **Backward Compatible:** Yes

### 5.1 Update OrderInvoice Component
**File:** `src/components/orders/OrderInvoice.vue`

**Script changes:**
```javascript
import { ref, computed, onMounted } from 'vue';
import { debounce } from '@/utils/helpers';

const emit = defineEmits(['update:order']); // NEW

// Track editing states
const editingStates = ref({
  descriptions: {},
  termsAndConditions: false
});

// Local editable copy of terms
const editableTerms = ref('');

// Load terms from order or bakery settings
const termsAndConditions = computed(() => {
  const orderTerms = props.orders[0]?.invoiceCustomizations?.termsAndConditions;
  const defaultTerms = props.bakerySettings?.invoicing?.defaultTermsAndConditions;
  return orderTerms || defaultTerms || '';
});

onMounted(() => {
  editableTerms.value = termsAndConditions.value;
});

// Update handlers with debouncing
const updateDescription = debounce((index, event) => {
  const newDescription = event.target.innerText.trim();
  emit('update:order', {
    itemIndex: index,
    field: 'description',
    value: newDescription
  });
}, 500);

const updateTerms = debounce((event) => {
  const newTerms = event.target.innerText.trim();
  emit('update:order', {
    field: 'termsAndConditions',
    value: newTerms
  });
}, 500);
```

**Template changes for product descriptions (update line 246-251):**
```vue
<td class="text-left py-2 px-2 text-gray-800">
  <div>
    {{ capitalize(item.productName) }}
    <span v-if="item.variation" class="text-gray-700 text-sm ml-1">
      ({{ capitalize(item.variation) }})
    </span>
  </div>
  <!-- NEW: Editable description -->
  <div
    v-if="item.productDescription || editingStates.descriptions[index]"
    contenteditable="true"
    @blur="updateDescription(index, $event)"
    @focus="editingStates.descriptions[index] = true"
    class="text-sm text-gray-600 mt-1 px-1 rounded hover:bg-gray-50 focus:bg-gray-50 focus:outline-none cursor-text"
    :placeholder="'Click para agregar descripción...'"
  >
    {{ item.productDescription || '' }}
  </div>
  <button
    v-else
    @click="editingStates.descriptions[index] = true"
    class="text-xs text-blue-500 hover:text-blue-700 mt-1"
  >
    + Agregar descripción
  </button>
</td>
```

**Add Terms & Conditions section (after line 280):**
```vue
<!-- Terms & Conditions Section -->
<div class="mt-6 pt-4 border-t border-gray-200">
  <h3 class="text-sm font-semibold text-gray-800 mb-2">
    Términos y Condiciones
  </h3>
  <div
    contenteditable="true"
    @blur="updateTerms($event)"
    class="text-xs text-gray-600 whitespace-pre-wrap p-2 rounded border border-transparent hover:border-gray-200 focus:border-gray-300 focus:outline-none min-h-[3rem] cursor-text"
    :placeholder="'Click para agregar términos y condiciones...'"
  >
    {{ editableTerms }}
  </div>
</div>
```

**Add CSS for editable fields:**
```css
[contenteditable]:empty:before {
  content: attr(placeholder);
  color: #9ca3af;
  pointer-events: none;
}

[contenteditable]:focus {
  background-color: #f9fafb;
}

@media print {
  [contenteditable] {
    border: none !important;
    background: transparent !important;
  }
}
```

### 5.2 Handle Updates in ExportOrders
**File:** `src/views/orders/ExportOrders.vue`

**Add after imports:**
```javascript
import { debounce } from '@/utils/helpers';
```

**Add handler (after line 106):**
```javascript
// Handle invoice edits with auto-save
const handleInvoiceUpdate = async (update) => {
  try {
    if (update.field === 'description' && orders.value.length > 0) {
      // Update specific item description
      const order = orders.value[0];
      if (order.orderItems[update.itemIndex]) {
        order.orderItems[update.itemIndex].productDescription = update.value;

        await orderStore.patch(order.id, {
          orderItems: order.orderItems.map(item => ({
            ...item,
            combination: item.combination ? {
              ...item.combination,
              getDisplayName: undefined // Remove function before sending to backend
            } : null
          }))
        });

        console.log('Description updated for item', update.itemIndex);
      }
    } else if (update.field === 'termsAndConditions' && orders.value.length > 0) {
      // Update invoice customizations
      const order = orders.value[0];
      await orderStore.patch(order.id, {
        invoiceCustomizations: {
          ...order.invoiceCustomizations,
          termsAndConditions: update.value
        }
      });

      console.log('Terms and conditions updated');
    }
  } catch (error) {
    console.error('Error saving invoice changes:', error);
    // Optionally show error toast to user
  }
};
```

**Update template (line 157):**
```vue
<OrderInvoice
  :orders="orders"
  :bakery-settings="bakerySettings"
  :invoice-type="orders.every(order => order.paymentMethod === 'quote') ? 'quote' : 'invoice'"
  @update:order="handleInvoiceUpdate"
/>
```

---

## 🧪 Testing Plan

### Manual Testing Checklist

#### Phase 1: Data Model Testing
- [ ] Create new order - verify productDescription is saved
- [ ] Load existing order - verify no errors with missing fields
- [ ] Check OrderItem includes productDescription in API calls

#### Phase 2: Invoice Creation Testing
- [ ] Create order with products that have descriptions
- [ ] Create order with products without descriptions
- [ ] Verify descriptions appear on invoice

#### Phase 3: Invoice Editing Testing
- [ ] Click on description area - verify it becomes editable
- [ ] Edit description - verify auto-save triggers
- [ ] Refresh page - verify edits persist
- [ ] Edit terms & conditions - verify save
- [ ] Test with multiple orders on same invoice

#### Phase 4: Settings Testing
- [ ] Add default terms in bakery settings
- [ ] Create new invoice - verify default terms appear
- [ ] Override default terms on specific invoice
- [ ] Verify both defaults and overrides work

#### Phase 5: Edge Cases
- [ ] Very long descriptions (500+ characters)
- [ ] Special characters in descriptions
- [ ] HTML tags in contenteditable fields
- [ ] Rapid edits (test debouncing)
- [ ] Network failure during save

### Performance Testing
- [ ] Load invoice with 50+ items
- [ ] Edit multiple descriptions rapidly
- [ ] Check browser memory usage
- [ ] Verify print performance

---

## 🚦 Implementation Order

### Day 1: Backend Models
1. Update OrderItem model ✓
2. Update Order model ✓
3. Update BakerySettings model ✓
4. Test backward compatibility ✓

### Day 2: Order Creation Flow
1. Update OrderItemsManager ✓
2. Verify description flows through ✓
3. Test with existing orders ✓

### Day 3: Settings UI
1. Add invoice settings to BakeryFeaturesForm ✓
2. Update settings save handler ✓
3. Test settings persistence ✓

### Day 4: Invoice Editing
1. Make OrderInvoice editable ✓
2. Add update handlers ✓
3. Implement auto-save ✓
4. Test editing flow ✓

### Day 5: Polish & Testing
1. Complete testing checklist ✓
2. Fix any bugs ✓
3. Performance optimization ✓
4. User acceptance testing ✓

---

## 🚨 Rollback Plan

If issues arise:
1. **Feature Flag:** Add `enableInvoiceEditing` flag to disable new features
2. **Database:** Fields are additive, no migration needed for rollback
3. **Frontend:** Can deploy previous version without breaking existing data

---

## 📊 Success Metrics

- ✅ All new orders include product descriptions
- ✅ Descriptions are editable and persist
- ✅ Terms & conditions functional
- ✅ No performance degradation
- ✅ Zero breaking changes for existing orders
- ✅ User satisfaction with editing UX

---

## 🎯 Definition of Done

- [ ] All code changes implemented
- [ ] Manual testing completed
- [ ] No console errors
- [ ] Print layout verified
- [ ] Performance acceptable (<500ms saves)
- [ ] Backward compatibility confirmed
- [ ] User documentation updated (if needed)
# POS Configuration Implementation Plan

## Overview
This plan outlines the implementation of a dual-mode system where bakeries can operate as either traditional full-service bakeries or simplified POS (Point of Sale) terminals. The system administrator will have the ability to configure each bakery's operating mode.

## Business Context

### Traditional Bakery Clients
- Take orders for future delivery/pickup
- Manage delivery routes and scheduling
- Track unpaid orders and various payment methods
- Complex workflow: order → schedule → prepare → deliver → collect payment

### POS Clients (Café/Retail Style)
- Customer walks up, pays immediately, receives product
- No delivery scheduling or future orders
- All transactions are completed sales (paid)
- Simple workflow: sale happens → record in system

## Phase 1: Configuration Foundation

### 1.1 Backend Schema Updates

#### Update BakerySettings Model
**File:** `C:\Users\casal\documents\web\back\bake-ry\functions\src\models\BakerySettings.js`

```javascript
// Add to DEFAULT_FEATURES
pos: {
  enabled: false,
  operatingMode: 'traditional', // 'traditional' | 'pos'
  settings: {
    autoMarkPaid: false,
    hideDeliveryOptions: false,
    defaultToCurrentDate: false,
    simplifiedNavigation: false,
    hiddenSidebarSections: [], // ['delivery', 'reports', 'users']
    hiddenOrderColumns: [], // ['fulfillmentType', 'deliveryFee', 'dueDate']
    defaultPaymentMethod: 'cash',
    forceFulfillmentType: null // null | 'pickup' | 'delivery'
  }
}
```

#### Frontend Model Sync
**File:** `C:\Users\casal\documents\web\front\bake-ry-front\src\models\BakerySettings.js`
- Mirror the backend schema changes

### 1.2 System Admin Interface

#### Create System Admin Bakery Management View
**New File:** `src/views/SystemAdmin/BakeryConfigurationView.vue`

**Features:**
- List all bakeries in the system
- Show current operating mode (Traditional/POS)
- Toggle switches to change operating mode
- Detailed POS configuration options per bakery
- Search and filter bakeries
- Bulk operations for common configurations

**Route:** `/system-admin/bakery-configurations`
- Restricted to `system_admin` role only

#### System Admin Navigation
**File:** `src/router/index.js`
- Add route with proper role restrictions

**Files to Update:**
- Add navigation link to system admin areas
- Ensure proper role-based access control

## Phase 2: Frontend Configuration System

### 2.1 Configuration Detection Composable

#### Create POS Configuration Composable
**New File:** `src/composables/usePOSConfiguration.js`

```javascript
export function usePOSConfiguration() {
  // Reactive access to current bakery's POS settings
  // Helper methods for checking what should be hidden
  // Computed properties for operating mode
}
```

### 2.2 Component Integration Points

#### OrderForm Updates
**File:** `src/components/forms/OrderForm.vue`

**POS Mode Changes:**
- Hide delivery address section
- Auto-select 'pickup' fulfillment type
- Auto-mark orders as paid with default payment method
- Use current date/time instead of date picker
- Remove partial payment options
- Simplified form layout

#### Sidebar Configuration
**Files:**
- `src/components/layouts/AdminSidebar.vue`
- `src/components/layouts/AccountingSidebar.vue`
- `src/components/layouts/ProductionSidebar.vue`
- `src/components/layouts/DriverSidebar.vue`

**POS Mode Changes:**
- Hide delivery section entirely
- Remove delivery calendar
- Remove delivery summary
- Simplify navigation to core functions only

#### Order Display Tables
**Files:**
- `src/views/orders/ShowOrders.vue`
- Related order view components

**POS Mode Changes:**
- Hide fulfillment type column (always pickup)
- Hide delivery fee column
- Hide delivery-related action buttons
- Simplified column set focused on sales data

## Phase 3: Implementation Details

### 3.1 Configuration Propagation

#### Settings Store Updates
**File:** `src/stores/bakerySettingsStore.js`
- Add computed properties for POS mode detection
- Add methods to check hidden sections/columns

#### Authentication Integration
**File:** `src/stores/authentication.js`
- Ensure POS configuration loads with user session
- Cache configuration for performance

### 3.2 Component Conditional Rendering

#### Pattern for Hiding Sections
```vue
<script setup>
const { isPOSMode, shouldHideSection } = usePOSConfiguration()
</script>

<template>
  <DeliverySection v-if="!shouldHideSection('delivery')" />
  <PaymentSection :simplified="isPOSMode" />
</template>
```

#### Pattern for Column Configuration
```javascript
const columns = computed(() => {
  const baseColumns = [/* base columns */]

  if (shouldHideColumn('fulfillmentType')) {
    return baseColumns.filter(col => col.id !== 'fulfillmentType')
  }

  return baseColumns
})
```

### 3.3 Default Behavior Updates

#### Order Creation Defaults
When POS mode is enabled:
- `fulfillmentType: 'pickup'`
- `isPaid: true`
- `paymentDate: new Date()`
- `paymentMethod: [configured default]`
- `preparationDate: new Date()`
- `dueDate: new Date()`

#### Form Validation Updates
**File:** `src/components/forms/OrderForm.vue`
- Skip delivery address validation in POS mode
- Skip date validations in POS mode
- Auto-populate required fields

## Phase 4: System Admin Experience

### 4.1 Bakery Management Interface

#### Configuration Panel
- **Operating Mode Toggle:** Traditional ↔ POS
- **Quick Setup Buttons:**
  - "Configure as Café POS"
  - "Configure as Retail POS"
  - "Reset to Traditional"
- **Advanced Settings:** Granular control over hidden sections

#### Bakery Overview Dashboard
- Visual indicators for operating modes
- Usage statistics per mode
- Configuration health checks

### 4.2 Bulk Operations
- Select multiple bakeries
- Apply same configuration to multiple clients
- Configuration templates for common setups

## Phase 5: Testing & Validation

### 5.1 Testing Strategy

#### Test Cases
1. **Traditional Mode (Default):**
   - All existing functionality unchanged
   - No regression in current workflows

2. **POS Mode:**
   - Orders auto-marked as paid
   - Delivery sections properly hidden
   - Navigation simplified
   - Table columns filtered correctly

3. **System Admin:**
   - Can toggle operating modes
   - Changes reflect immediately in client experience
   - Proper role restrictions

#### Test Environments
- Traditional bakery setup (existing client)
- POS café setup (new configuration)
- Mixed environment (both types)

### 5.2 Migration Strategy
- All existing bakeries default to 'traditional' mode
- No breaking changes to current functionality
- Opt-in configuration for POS features

## Phase 6: Documentation & Rollout

### 6.1 Implementation Guide
- How to configure new clients as POS vs Traditional
- Troubleshooting common configuration issues
- Best practices for different business types

### 6.2 Client Communication
- Feature announcement for new POS capabilities
- Migration guide for clients wanting to switch modes
- Training materials for simplified interface

## Technical Considerations

### Performance Impact
- Configuration loaded once per session
- Minimal runtime overhead for mode checking
- Cached configuration data

### Backwards Compatibility
- All changes are additive
- Existing clients unaffected by default
- Gradual rollout possible

### Security
- System admin role restrictions properly enforced
- Configuration changes logged for audit trail
- Client isolation maintained

### Scalability
- Configuration system designed for future expansion
- Easy to add new operating modes
- Modular component hiding system

## Implementation Timeline

### Week 1: Foundation
- Backend schema updates
- Basic composable creation
- System admin route setup

### Week 2: Core Features
- OrderForm POS mode implementation
- Sidebar configuration
- Basic system admin interface

### Week 3: Table & Display
- Order table column configuration
- Navigation updates
- Advanced admin features

### Week 4: Testing & Polish
- Comprehensive testing
- Bug fixes and refinements
- Documentation creation

## Success Metrics
- POS clients can create orders 50% faster
- Reduced support tickets about "missing features"
- Successful onboarding of café/retail clients
- No regression in traditional bakery workflows

## Future Enhancements
- Additional operating modes (kiosk, mobile, etc.)
- Per-role configuration within bakeries
- Advanced automation rules
- Integration with external POS hardware
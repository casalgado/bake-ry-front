# Product Selection Modes Implementation Plan

## Overview
Add a toggle between wizard-based and search-based product selection in OrderForm to handle both small catalogs (5 existing clients) and large catalogs (new client with thousands of products and 20-30 variations each).

## Current State Analysis

### OrderItemsManager Structure
- **Location**: `src/components/forms/OrderItemsManager.vue`
- **Current Components**:
  - ProductWizard for product selection
  - OrderLineItem for displaying selected items
- **Layout**: 3-column grid (wizard on left, selected items on right)

### User Preference Storage
- **Backend Model**: BakerySettings.js already has features object
- **Current Features Structure**:
  ```js
  features: {
    order: { activePaymentMethods, allowPartialPayment, defaultDate, timeOfDay, offlineMode },
    reports: { defaultReportFilter, showMultipleReports },
    invoicing: { defaultTermsAndConditions, showProductDescriptions, showTermsAndConditions, taxMode }
  }
  ```
- **Proposed Addition**: Add `userPreferences` to features object for per-user settings

## Implementation Plan

### 1. Create ProductSearch Component
**File**: `src/components/forms/ProductSearch.vue`

**Features**:
- Search input field with real-time filtering
- Product code and name matching (like UserCombox)
- Quick selection with quantity input
- Combination/variation selection for complex products
- Same selection output format as ProductWizard

**Props**:
- `products` (Array) - Product catalog
- `@select` event - Same format as ProductWizard

**Search Logic**:
- Filter by product name (case insensitive)
- Filter by product code/SKU
- Show results in dropdown/list format
- Handle products with combinations/variations
- Keyboard navigation support

### 2. Add Mode Toggle to OrderItemsManager
**File**: `src/components/forms/OrderItemsManager.vue`

**UI Changes**:
- Add tab interface above current content:
  ```vue
  <div class="flex border-b border-gray-200 mb-4">
    <button @click="setMode('wizard')" :class="tabClasses('wizard')">
      Browse Products
    </button>
    <button @click="setMode('search')" :class="tabClasses('search')">
      Search Products
    </button>
  </div>
  ```

**State Management**:
- `selectionMode` ref - tracks current mode ('wizard' | 'search')
- Load user preference on mount
- Save preference changes to backend

**Component Integration**:
- Conditionally render ProductWizard or ProductSearch
- Both components emit same `@select` event
- OrderLineItem remains unchanged

### 3. User Preference Persistence
**Backend Changes**:
- Extend BakerySettings features to include:
  ```js
  features: {
    // ... existing features
    userPreferences: {
      [userId]: {
        productSelectionMode: 'wizard' | 'search'
      }
    }
  }
  ```

**Frontend Integration**:
- Use existing bakerySettingsStore
- Load user preference on component mount
- Update preference when user changes mode
- Fallback to 'wizard' for new users

### 4. Search Component Implementation Details

**Search Input Features**:
- Debounced search (300ms)
- Minimum 2 characters to trigger search
- Clear search button
- Loading state indicator

**Results Display**:
- Dropdown list below search input
- Product image thumbnail (if available)
- Product name and code
- Price information
- Stock status (if applicable)
- Keyboard navigation (up/down arrows, enter to select)

**Complex Product Handling**:
- Products with variations: Show variation selector in dropdown
- Products with combinations: Show combination builder inline
- Quantity selector integrated with selection

**Performance Considerations**:
- Virtual scrolling for large result lists
- Efficient filtering algorithms
- Memoized search results

## Technical Architecture

### Component Hierarchy
```
OrderItemsManager
├── Mode Toggle Tabs
├── ProductWizard (conditional)
├── ProductSearch (conditional)
└── OrderLineItem List
```

### Data Flow
1. User selects mode → Update local state + persist to backend
2. User searches/browses → Filter/display products
3. User selects product → Emit standardized selection event
4. OrderItemsManager → Process selection → Update order items
5. OrderLineItem → Display selected items

### State Management
- **Local State**: Current selection mode, search query, search results
- **Store State**: User preferences (bakerySettingsStore)
- **Props**: Products catalog, current order items

## Implementation Steps

### Phase 1: Core Search Component
1. Create `ProductSearch.vue` with basic search functionality
2. Implement product filtering by name and code
3. Add basic selection handling
4. Test with existing product catalog

### Phase 2: Mode Toggle Integration
1. Add tabs to OrderItemsManager
2. Implement mode switching logic
3. Integrate ProductSearch component
4. Test mode switching behavior

### Phase 3: User Preferences
1. Extend BakerySettings model for user preferences
2. Add preference loading/saving logic
3. Implement preference persistence
4. Test across different users and devices

### Phase 4: Advanced Features
1. Add keyboard navigation to search
2. Implement complex product handling (combinations)
3. Add performance optimizations
4. Polish UI/UX details

## Edge Cases & Considerations

### Data Consistency
- Handle products being added/removed during session
- Ensure search results stay synchronized with product catalog
- Graceful handling of network errors during preference saving

### User Experience
- Smooth transitions between modes
- Preserve search state when switching modes temporarily
- Clear visual feedback for preference saving
- Accessible keyboard navigation

### Performance
- Large catalogs (1000+ products) should not block UI
- Efficient re-renders when switching modes
- Debounced search to avoid excessive filtering

### Backwards Compatibility
- Existing clients see no change (default to wizard mode)
- Graceful fallback if preference loading fails
- No breaking changes to existing OrderForm workflow

## Testing Strategy

### Unit Tests
- ProductSearch component filtering logic
- User preference persistence functions
- Mode switching behavior

### Integration Tests
- Complete order creation flow in both modes
- Preference persistence across sessions
- Multi-user preference isolation

### User Acceptance Testing
- Test with both small and large catalogs
- Verify performance with 1000+ products
- Ensure existing workflow remains unchanged

## Success Metrics

### Performance
- Search results appear within 100ms for catalogs < 1000 products
- No UI blocking during mode switches
- Preference saves complete within 500ms

### Usability
- Existing clients can continue using wizard without noticing changes
- New client can efficiently find products in large catalog
- Mode preference persists across devices and sessions

### Technical
- Zero breaking changes to existing code
- Clean separation of concerns between components
- Maintainable and extensible architecture
# ToggleUpdate & PatchAll Architecture

## Overview

This document explains how the `handleToggleUpdate` workflow integrates with `patchAll` methods to handle data updates in the bakery application, with special handling for orders vs. other resources.

## Architecture Flow

```
🖱️  User clicks toggle (e.g., isPaid checkbox)
    ↓
📡  useDataTable.handleToggleUpdate()
    ↓
🏪  store.patchAll(updates)
    ↓
🌐  API call to server
    ↓
📊  Server response processing
    ↓
🔄  Local state update (different paths for orders vs others)
    ↓
✅  UI reflects changes
```

## Component Breakdown

### 1. useDataTable.handleToggleUpdate()

**Location**: `src/components/DataTable/composables/useDataTable.js`

**Purpose**: Handles UI toggle interactions and prepares batch updates.

**Flow**:
```javascript
const handleToggleUpdate = async ({ rowIds, field, value }) => {
  // 1. Set loading state for affected rows
  rowIds.forEach(id => {
    toggleLoading.value[`${id}-${field}`] = true;
  });

  // 2. Prepare updates array
  const updates = rowIds.map(id => ({
    id,
    data: { [field]: value }
  }));

  // 3. Single API call for all updates
  await store.patchAll(updates);

  // 4. Call custom handler if provided
  if (options.onToggleUpdate) {
    await options.onToggleUpdate({ rowIds, field, value });
  }
}
```

**Key Features**:
- **Batch processing**: Multiple row updates in single API call
- **Loading states**: Visual feedback per row/field combination
- **Error handling**: Automatic loading state cleanup
- **Extensibility**: Custom onToggleUpdate handlers

### 2. Store Layer: Two Different Approaches

#### A. Regular Resources (Products, Users, etc.)

**Location**: `src/stores/base/resourceStore.js`

**Method**: Uses standard `patchAll` with `deepMerge`

```javascript
const patchAll = async (updates) => {
  const response = await resourceService.patchAll(updates);
  
  // Update local state based on server response
  if (response.data && response.data.success) {
    response.data.success.forEach(({ id, changes }) => {
      const index = items.value.findIndex(item => item.id === id);
      if (index !== -1) {
        // Extract 'to' values from changes
        const updatedData = {};
        Object.keys(changes).forEach(key => {
          updatedData[key] = changes[key].to;
        });

        // Deep merge preserves nested structures
        const currentItem = items.value[index];
        items.value[index] = deepMerge(currentItem, updatedData);
      }
    });
  }
};
```

**Server Response Format**:
```javascript
{
  success: [
    {
      id: "product_123",
      changes: {
        isActive: { from: false, to: true },
        lastModified: { from: "2025-01-01", to: "2025-01-15" }
      }
    }
  ],
  failed: []
}
```

#### B. Orders (Special Handling)

**Location**: `src/stores/orderStore.js`

**Method**: Overridden `patchAll` with dual-path logic

```javascript
store.patchAll = async (updates) => {
  const response = await service.patchAll(updates);

  if (response.data && response.data.success) {
    response.data.success.forEach(({ id, changes }) => {
      const index = store.items.findIndex(item => item.id === id);
      if (index !== -1) {
        const currentItem = store.items[index];

        // PATH 1: orderItems special handling
        if (changes.orderItems && Array.isArray(changes.orderItems)) {
          const originalUpdate = updates.find(update => update.id === id);
          if (originalUpdate?.data?.orderItems) {
            // Use complete array from original request
            store.items[index] = { 
              ...currentItem, 
              orderItems: originalUpdate.data.orderItems 
            };
          }
        } 
        // PATH 2: Regular field updates
        else {
          const updatedData = {};
          Object.keys(changes).forEach(key => {
            if (key !== 'orderItems') {
              updatedData[key] = changes[key].to;
            }
          });
          store.items[index] = deepMerge(currentItem, updatedData);
        }
      }
    });
  }
};
```

**Why Two Paths?**

| Update Type | Method | Reason |
|-------------|--------|---------|
| **orderItems** | Direct array replacement | Arrays need wholesale replacement, not merging. Server returns metadata, not actual array. |
| **Other fields** | deepMerge | Preserves nested object structures while updating specific properties. |

## deepMerge Algorithm

**Purpose**: Intelligently merge objects while preserving nested structures and handling edge cases.

**Decision Tree**:
```
For each property in source:
  ├── sourceValue is null/undefined?
  │   └── ✅ Use sourceValue directly
  ├── sourceValue is Array?
  │   └── ✅ Replace entire array
  ├── Both source & target are non-null objects?
  │   └── 🔄 Recursive deepMerge
  └── Otherwise (primitives, mixed types)
      └── ✅ Direct assignment
```

**Key Features**:
- **Null-safe**: Handles `null` values without crashing
- **Array preservation**: Replaces arrays completely (no element merging)
- **Recursive**: Handles nested objects of any depth
- **Type-aware**: Different handling for primitives vs objects

**Example**:
```javascript
// Current order state
target = {
  id: "order_123",
  isPaid: false,
  lastEditedBy: null,
  customerInfo: { name: "John", phone: "555-1234" }
}

// Update from server
source = {
  isPaid: true,
  lastEditedBy: { userId: "admin_456", email: "admin@bakery.com" },
  customerInfo: { phone: "555-9999" }
}

// deepMerge result
result = {
  id: "order_123",           // preserved
  isPaid: true,              // updated
  lastEditedBy: { ... },     // replaced (was null)
  customerInfo: {            // merged
    name: "John",            // preserved
    phone: "555-9999"        // updated
  }
}
```

## Use Cases & Examples

### 1. Simple Toggle (Product Active Status)
```javascript
// User toggles product active status
handleToggleUpdate({
  rowIds: ["product_123"],
  field: "isActive", 
  value: true
});

// Flows through regular resource path
// Uses deepMerge for safe property updates
```

### 2. Order Payment Status
```javascript
// User marks order as paid
handleToggleUpdate({
  rowIds: ["order_456"], 
  field: "isPaid",
  value: true
});

// Server adds additional fields (paymentDate, lastEditedBy)
// Uses deepMerge path (not orderItems)
// Preserves existing order structure
```

### 3. Order Items Update
```javascript
// User updates production status of order items
handleToggleUpdate({
  rowIds: ["order_789"],
  field: "orderItems",
  value: [/* complete updated orderItems array */]
});

// Uses orderItems special path
// Bypasses deepMerge entirely
// Replaces entire orderItems array
```

### 4. Batch Operations
```javascript
// User selects multiple rows and toggles field
handleToggleUpdate({
  rowIds: ["order_1", "order_2", "order_3"],
  field: "isPaid",
  value: true
});

// Single API call updates all three orders
// Each order processed individually in response
// Efficient batch processing with individual error handling
```

## Error Handling

### UI Level
- **Loading states**: Per-row, per-field loading indicators
- **Automatic cleanup**: Loading states cleared even on errors
- **User feedback**: Errors surface through store error handling

### Store Level  
- **Partial success**: Successfully updated items still applied to local state
- **Failed updates**: Tracked in response.failed array
- **State consistency**: Failed updates don't modify local state

### Server Communication
- **Atomic batches**: All-or-nothing server processing
- **Detailed responses**: Individual success/failure per item
- **Change tracking**: Server provides before/after values

## Performance Considerations

### Batch Processing
- **Single API call** for multiple row updates
- **Reduced network overhead** vs individual requests
- **Optimistic UI updates** with rollback on failure

### Memory Management
- **Shallow copying** at deepMerge root level
- **Selective updates** only change modified properties
- **Reference preservation** for unchanged nested objects

### Real-time Updates
- **Compatible with WebSocket updates**
- **Merge conflicts handled by server timestamps**
- **Local state stays in sync** with real-time changes

## Debugging Tips

### Console Inspection
```javascript
// Check store state
console.log(orderStore.items.find(item => item.id === 'order_123'));

// Monitor network requests
// Look for PATCH /api/orders/batch requests

// Check for errors
console.log(orderStore.error);
```

### Common Issues
- **Missing server response**: Check network tab for failed requests
- **Data not updating**: Verify server response format matches expected structure
- **UI not reflecting changes**: Check if local state update logic is being triggered

## Future Enhancements

### Potential Improvements
- **Optimistic updates**: Update UI before server confirmation
- **Conflict resolution**: Handle concurrent user updates
- **Undo functionality**: Store change history for rollback
- **Real-time collaboration**: Multi-user edit conflict handling

---

*This documentation covers the current implementation as of the system state. Refer to actual code for definitive implementation details.*
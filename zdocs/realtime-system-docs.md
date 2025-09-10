# Real-time Data Synchronization System

## Overview

This system provides real-time data synchronization between Firebase Firestore and the Vue.js frontend application. It uses a layered architecture with callback patterns to keep local state synchronized with remote database changes.

## Architecture Layers

### 1. Service Layer (`resourceService.js`)
**Location**: `src/services/base/resourceService.js:280-315`

The service layer handles direct Firebase communication:

```javascript
subscribeToChanges(onUpdate) {
  const collectionRef = collection(db, 'bakeries', this.bakeryId, this.resource);
  const q = query(collectionRef);
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const changes = [];
    snapshot.docChanges().forEach((change) => {
      const rawData = { id: change.doc.id, ...change.doc.data(), bakeryId: this.bakeryId };
      const convertedData = this.convertTimestamps(rawData);
      changes.push({ type: change.type, data: convertedData });
    });
    onUpdate(changes); // Calls the provided callback
  });
  
  return unsubscribe;
}
```

**Responsibilities**:
- Establishes Firebase Firestore listeners via `onSnapshot()`
- Processes raw Firestore document changes
- Converts Firestore timestamps to JavaScript Date objects
- Standardizes change format to `{ type: 'added'|'modified'|'removed', data: Object }`
- Calls the provided callback function with processed changes
- Returns unsubscribe function for cleanup

### 2. Store Layer (`orderStore.js` and `resourceStore.js`)

#### Base Store Implementation
**Location**: `src/stores/base/resourceStore.js:97-105`

```javascript
async function subscribeToChanges() {
  if (isSubscribed.value) return;
  
  const unsubscribe = resourceService.subscribeToChanges(
    (changes) => handleRealtimeUpdate(changes) // Generic handler
  );
  isSubscribed.value = true;
  return unsubscribe;
}
```

#### Order Store Override
**Location**: `src/stores/orderStore.js:127-182`

The order store provides custom real-time handling:

```javascript
store.subscribeToChanges = async () => {
  if (store.isSubscribed) return;
  
  const handleOrderRealtimeUpdate = (changes) => {
    changes.forEach((change) => {
      switch (change.type) {
        case 'added':
          // Custom logic: only add if not bulk load and within current period
          if (index === -1 && changes.length < 2 && isOrderInCurrentPeriod(change.data)) {
            store.items.unshift(change.data);
          }
          break;
        case 'modified':
          // Custom logic: special handling for orderItems arrays
          if (key === 'orderItems' && Array.isArray(newValue)) {
            store.items[index][key] = newValue;
          }
          break;
        case 'removed':
          console.log('REMOVED REALTIME NOT IMPLEMENTED YET', change.data);
          break;
      }
    });
  };
  
  const unsubscribe = service.subscribeToChanges(handleOrderRealtimeUpdate);
  store.isSubscribed = true;
  return unsubscribe;
};
```

**Store Responsibilities**:
- Provide business-logic-specific handlers for real-time updates
- Manage subscription state (`isSubscribed` flag)
- Update local Pinia store state based on changes
- Handle domain-specific logic (e.g., order period filtering, orderItems array handling)

### 3. Component Layer

Components subscribe to real-time updates through stores:

#### Direct Store Subscription
```javascript
// In Vue components
const unsubscribeRef = ref(null);

onMounted(async () => {
  unsubscribeRef.value = await orderStore.subscribeToChanges();
});

onUnmounted(() => {
  if (unsubscribeRef.value) {
    unsubscribeRef.value();
  }
});
```

#### Generic Component Integration
**DataTable** (`useDataTable.js:111-112`) and **DataCalendar** (`useDataCalendar.js:111-112`) composables:

```javascript
if (options.subscribeToChanges) {
  unsubscribeRef.value = await store.subscribeToChanges();
}
```

## Data Flow

```
Firebase Firestore
    ↓ (document changes)
onSnapshot listener
    ↓ (raw Firestore data)
resourceService.subscribeToChanges()
    ↓ (processes & transforms data)
Store callback function (handleOrderRealtimeUpdate)
    ↓ (updates local state)
Pinia Store (reactive state)
    ↓ (reactive updates)
Vue Components
```

## Key Design Patterns

### 1. Callback Pattern
- Services accept callback functions as parameters
- Callbacks define *what to do* with data changes
- Services provide the *mechanism* to receive changes
- Enables separation of concerns between data transport and business logic

### 2. Data Transformation Layer
- Raw Firestore data is processed before reaching stores
- Timestamp conversion happens at service level
- Consistent data format across all resources
- Shields stores from Firebase-specific data structures

### 3. Store Customization
- Base `resourceStore` provides generic real-time handling
- Specific stores (like `orderStore`) can override with custom logic
- Allows domain-specific behavior while maintaining consistent API

### 4. Subscription Management
- Each store tracks subscription state with `isSubscribed` flag
- Prevents duplicate subscriptions
- Components receive unsubscribe functions for cleanup
- Listeners are automatically managed by Firebase SDK

## Usage Examples

### Basic Real-time Table
```javascript
// Component using DataTable with real-time updates
const tableOptions = {
  subscribeToChanges: true, // Enables real-time sync
  // ... other options
};
```

### Manual Subscription
```javascript
// Component with custom real-time handling
const unsubscribeRef = ref(null);

onMounted(async () => {
  unsubscribeRef.value = await orderStore.subscribeToChanges();
});

onUnmounted(() => {
  if (unsubscribeRef.value) {
    unsubscribeRef.value();
  }
});
```

## Current Implementation Status

### Implemented Features
- Real-time document additions with filtering logic
- Real-time document modifications with special array handling
- Automatic timestamp conversion
- Subscription lifecycle management
- Generic component integration

### Known Limitations
- Document removal handling not implemented (`console.log('REMOVED REALTIME NOT IMPLEMENTED YET')`)
- Limited to single collection listening (no cross-collection updates)
- Order-specific filtering may miss some edge cases

## Components Using Real-time Updates

### Order Management Views
- `ShowProductionAssistantOrders.vue`
- `ShowSalesReport.vue`
- `ShowProductionGroupedItems.vue`
- `ShowDeliverySummary.vue`
- `ShowPaymentDates.vue`
- `ShowProductionSingleItems.vue`

### Generic Data Components
- `useDataTable.js` - Powers data tables with real-time sync
- `useDataCalendar.js` - Powers calendar views with real-time sync

All these components automatically receive updates when underlying Firestore documents change, providing a seamless real-time user experience.
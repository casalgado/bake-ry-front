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

#### Order Store Override with Route-Aware Subscription Management
**Location**: `src/stores/orderStore.js:127-245`

The order store provides route-aware subscription management with reference counting:

```javascript
// Reference counting for subscription management
let subscriptionCount = 0;
let unsubscribeFunction = null;

store.subscribeToChanges = async () => {
  subscriptionCount++; // Increment reference count

  if (subscriptionCount === 1 && !store.isSubscribed) {
    // First subscriber AND no existing subscription - create the actual Firebase listener
    console.log('🎯 Creating Firebase subscription for orders');

    const handleOrderRealtimeUpdate = (changes) => {
      changes.forEach((change) => {
        switch (change.type) {
        case 'added': {
          const index = store.items.findIndex(item => item.id === change.data.id);
          // Only add if not bulk load and within current period
          if (index === -1 && changes.length < 2 && isOrderInCurrentPeriod(change.data)) {
            store.items.unshift(change.data);
          }
          break;
        }
        case 'modified': {
          const index = store.items.findIndex(item => item.id === change.data.id);
          if (index !== -1) {
            // Special handling for orderItems arrays
            Object.entries(change.data).forEach(([key, newValue]) => {
              if (key === 'orderItems' && Array.isArray(newValue)) {
                store.items[index][key] = newValue;
              } else if (typeof newValue === 'string' || typeof newValue === 'number' || typeof newValue === 'boolean') {
                if (store.items[index][key] !== newValue) {
                  store.items[index][key] = newValue;
                }
              }
            });
          }
          break;
        }
        case 'removed':
          console.log('REMOVED REALTIME NOT IMPLEMENTED YET', change.data);
          break;
        }
      });
    };

    unsubscribeFunction = service.subscribeToChanges(handleOrderRealtimeUpdate);
    store.isSubscribed = true;
  } else if (store.isSubscribed) {
    console.log(`⚠️ Orders already subscribed (${subscriptionCount} components using it)`);
  }

  // Return component-specific cleanup function
  return () => store.unsubscribeComponent();
};

// Component-specific unsubscribe with route awareness
store.unsubscribeComponent = () => {
  subscriptionCount--; // Decrement reference count
  
  if (subscriptionCount === 0) {
    // Check if we're still in orders domain before unsubscribing
    if (isInOrdersRoute()) {
      console.log('🔄 Still in orders route, keeping Firebase listener active');
    } else {
      console.log('🛑 Leaving orders domain, closing Firebase listener');
      unsubscribeFunction?.();
      store.isSubscribed = false;
      unsubscribeFunction = null;
    }
  }
};

// Navigation guard for cleanup when leaving orders domain
router.afterEach((to, from) => {
  if (from.path?.startsWith('/dashboard/orders') && !to.path?.startsWith('/dashboard/orders')) {
    console.log('🚪 Navigating away from orders domain, forcing cleanup');
    store.forceUnsubscribe();
  }
});
```

**Store Responsibilities**:
- Provide business-logic-specific handlers for real-time updates
- Manage subscription state with reference counting
- Route-aware subscription persistence (keeps subscriptions active within same domain)
- Update local Pinia store state based on changes
- Handle domain-specific logic (e.g., order period filtering, orderItems array handling)
- Automatic cleanup when navigating away from domain

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
**DataTable** (`useDataTable.js`) and **DataCalendar** (`useDataCalendar.js`) composables:

```javascript
// Enhanced useDataTable with dynamic filter support
onMounted(async () => {
  let fetchOptions = options.fetchAll || {};
  
  // Allow for dynamic filters from onBeforeFetch
  if (options.onBeforeFetch) {
    const dynamicOptions = await options.onBeforeFetch();
    if (dynamicOptions) {
      fetchOptions = { ...fetchOptions, ...dynamicOptions };
    }
  }

  await store.fetchAll(fetchOptions);

  // Setup real-time updates with reference counting
  if (options.subscribeToChanges) {
    unsubscribeRef.value = await store.subscribeToChanges();
  }
});

onUnmounted(() => {
  if (unsubscribeRef.value && options.subscribeToChanges) {
    unsubscribeRef.value(); // Calls component-specific cleanup
  }
});
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

### 4. Route-Aware Subscription Management
- Reference counting system tracks active components
- Single Firebase listener shared across components in same domain
- Route-aware persistence: subscriptions survive navigation within domain
- Automatic cleanup when leaving domain via navigation guards
- Components receive cleanup functions that manage reference counting
- Prevents duplicate Firebase listeners while maintaining real-time sync

### 5. Dynamic Filter System
- Filters can be defined statically in `fetchAll` options
- Dynamic filters can be returned from `onBeforeFetch` hook
- Dynamic filters take precedence over static ones
- Enables period-aware filtering and other context-dependent data fetching

## Usage Examples

### Basic Real-time Table
```javascript
// Component using DataTable with real-time updates
const tableOptions = {
  subscribeToChanges: true, // Enables real-time sync with reference counting
  fetchAll: {
    // Static filters
  },
  // ... other options
};
```

### Dynamic Filter Table
```javascript
// Component using DataTable with period-aware filtering
const tableOptions = {
  subscribeToChanges: true,
  fetchAll: {
    // Static options can go here
  },
  async onBeforeFetch() {
    // Return dynamic filters based on current state
    return {
      filters: {
        dateRange: {
          dateField: 'preparationDate',
          startDate: periodStore.periodRange.start.toISOString(),
          endDate: periodStore.periodRange.end.toISOString(),
        },
      },
    };
  },
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
- **Route-aware subscription management** with reference counting
- **Real-time document additions** with period filtering logic
- **Real-time document modifications** with special array handling for orderItems
- **Initial load detection** to prevent Firebase snapshots from being processed as changes
- **Dynamic filter system** for context-dependent data fetching
- **Automatic timestamp conversion** from Firestore to JavaScript Date objects
- **Navigation-based cleanup** when leaving domain areas
- **Generic component integration** through DataTable and DataCalendar composables

### Performance Optimizations
- **Single Firebase listener per domain** instead of one per component
- **Subscription persistence** across route changes within same domain
- **Reference counting** prevents unnecessary subscription/unsubscription cycles
- **Automatic cleanup** only when actually leaving the domain

### Known Limitations
- Document removal handling not implemented (`console.log('REMOVED REALTIME NOT IMPLEMENTED YET')`)
- Limited to single collection listening (no cross-collection updates)
- Route-aware system currently only implemented for orders domain
- Period filtering logic assumes `preparationDate` field for orders

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
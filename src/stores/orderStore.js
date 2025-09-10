// stores/orderStore.js
import { createResourceStore } from './base/resourceStore';
import { OrderService } from '../services/orderService';
import { useAuthenticationStore } from './authentication';
import { usePeriodStore } from './periodStore';
import { storeToRefs } from 'pinia';
import QueryBuilder from '@/utils/queryBuilder';
import router from '@/router';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);
const service = new OrderService(getBakeryId.value);

export const useOrderStore = createResourceStore('orders', service);

// Helper function to check if order falls within current period range.
// used in subscribe to changes. Possible bug if bakeries use dueDate.
function isOrderInCurrentPeriod(order) {
  try {
    const periodStore = usePeriodStore();
    const { start, end } = periodStore.periodRange;

    // Get the order's preparation date
    const orderDate = new Date(order.preparationDate);

    // Check if order date falls within the current period
    return orderDate >= start && orderDate <= end;
  } catch (error) {
    console.warn('Error checking order period:', error);
    // If there's an error, allow the order to be added (fail-safe)
    return true;
  }
}

// Extend the store with the sales report functionality
const store = useOrderStore();

// Add the sales report method
store.salesReport = async (request = {}) => {
  store.setLoading(true);
  store.clearError();

  try {
    const queryBuilder = new QueryBuilder();

    // Handle date range filtering
    if (request.filters?.dateRange) {
      queryBuilder.setDateRange(
        request.filters.dateRange.dateField,
        request.filters.dateRange.startDate,
        request.filters.dateRange.endDate,
      );
    }

    // Handle additional filters
    if (request.filters) {
      Object.entries(request.filters).forEach(([key, value]) => {
        if (key !== 'dateRange') {
          queryBuilder.addFilter(key, value);
        }
      });
    }

    const query = queryBuilder.build();
    const response = await service.getSalesReport(query);
    return response.data;
  } catch (err) {
    store.setError(err);
    throw err;
  } finally {
    store.setLoading(false);
  }
};

store.getHistory = async (orderId) => {
  store.setLoading(true);
  store.clearError();

  try {
    const response = await service.getHistory(orderId);
    return response.data;
  } catch (err) {
    store.setError(err);
    throw err;
  } finally {
    store.setLoading(false);
  }
};

// Helper function to deep merge objects while preserving arrays
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      // If source value is null or undefined, use it directly
      if (sourceValue == null) {
        result[key] = sourceValue;
      }
      // If source is an array, replace the entire array
      else if (Array.isArray(sourceValue)) {
        result[key] = sourceValue;
      }
      // If both are objects (but not arrays or null), recursively merge
      else if (
        typeof sourceValue === 'object' &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        sourceValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      }
      // For primitive values, directly assign
      else {
        result[key] = sourceValue;
      }
    }
  }

  return result;
}

// Reference counting for subscription management
let subscriptionCount = 0;
let unsubscribeFunction = null;

// Override realtime handler specifically for orders to handle orderItems updates
const originalSubscribeToChanges = store.subscribeToChanges;
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
          // Only add if it doesn't already exist, not bulk initial load, and falls within current period
          if (index === -1 && changes.length < 2 && isOrderInCurrentPeriod(change.data)) {
            // Insert at the beginning to match typical newest-first order
            store.items.unshift(change.data);
          }
          break;
        }
        case 'modified': {
          const index = store.items.findIndex(item => item.id === change.data.id);
          if (index !== -1) {
            const currentItem = store.items[index];

            Object.entries(change.data).forEach(([key, newValue]) => {
              // Skip id field
              if (key === 'id') return;

              // Handle orderItems array specially
              if (key === 'orderItems' && Array.isArray(newValue)) {
                store.items[index][key] = newValue;
              }
              // Handle primitive values normally
              else if (
                typeof newValue === 'string' ||
                typeof newValue === 'number' ||
                typeof newValue === 'boolean'
              ) {
                if (currentItem[key] !== newValue) {
                  store.items[index][key] = newValue;
                }
              }
              // For other objects and arrays, keep existing value (original logic)
            });
          }
          break;
        }
        case 'removed': {
          console.log('REMOVED REALTIME NOT IMPLEMENTED YET', change.data);
          break;
        }
        }
      });
    };

    unsubscribeFunction = service.subscribeToChanges(handleOrderRealtimeUpdate);
    store.isSubscribed = true;
  } else if (store.isSubscribed) {
    console.log(`⚠️ Orders already subscribed (${subscriptionCount} components using it)`);
  } else {
    console.log(`🔄 Subscription exists but not marked as subscribed (${subscriptionCount} components)`);
  }

  // Return component-specific cleanup function
  return () => store.unsubscribeComponent();
};

// Check if we're still in orders-related routes
const isInOrdersRoute = () => {
  return window.location.pathname.startsWith('/dashboard/orders');
};

// Add component-specific unsubscribe method
store.unsubscribeComponent = () => {
  subscriptionCount--; // Decrement reference count
  console.log(`📊 Component unsubscribed, ${subscriptionCount} remaining`);

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
  } else {
    console.log(`📊 Still ${subscriptionCount} components subscribed to orders`);
  }
};

// Method to force cleanup when leaving orders domain entirely
store.forceUnsubscribe = () => {
  if (store.isSubscribed) {
    console.log('🛑 Force unsubscribing from orders (leaving domain)');
    unsubscribeFunction?.();
    store.isSubscribed = false;
    unsubscribeFunction = null;
    subscriptionCount = 0; // Reset count
  }
};

// Navigation guard to cleanup when leaving orders domain
router.afterEach((to, from) => {
  // If we're leaving orders routes and going somewhere else
  if (from.path?.startsWith('/dashboard/orders') && !to.path?.startsWith('/dashboard/orders')) {
    console.log('🚪 Navigating away from orders domain, forcing cleanup');
    store.forceUnsubscribe();
  }
});

// Override patchAll specifically for orders to handle orderItems correctly
store.patchAll = async (updates) => {
  try {
    const response = await service.patchAll(updates);

    // Update local state based on successful response
    if (response.data && response.data.success) {
      response.data.success.forEach(({ id, changes }) => {
        const index = store.items.findIndex(item => item.id === id);
        if (index !== -1) {
          const currentItem = store.items[index];

          // Handle orderItems specially since the server returns change metadata, not the full array
          if (changes.orderItems && Array.isArray(changes.orderItems)) {
            // Find the corresponding update in the original request to get the complete orderItems
            const originalUpdate = updates.find(update => update.id === id);
            if (originalUpdate && originalUpdate.data && originalUpdate.data.orderItems) {
              // Use the complete orderItems array from the original request
              store.items[index] = { ...currentItem, orderItems: originalUpdate.data.orderItems };
            }
          } else {
            // For non-orderItems changes, use the base store logic
            const updatedData = {};
            Object.keys(changes).forEach(key => {
              if (key !== 'orderItems') {
                updatedData[key] = changes[key].to;
              }
            });

            // Use deep merge for complex objects
            store.items[index] = deepMerge(currentItem, updatedData);
          }
        }
      });
    }

    return response;
  } catch (error) {
    store.setError(error);
    throw error;
  }
};

// stores/orderStore.js
import { createResourceStore } from './base/resourceStore';
import { OrderService } from '../services/orderService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';
import QueryBuilder from '@/utils/queryBuilder';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);
const service = new OrderService(getBakeryId.value);

export const useOrderStore = createResourceStore('orders', service);

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
      // If both are objects (but not arrays), recursively merge
      else if (
        typeof sourceValue === 'object' &&
        typeof targetValue === 'object' &&
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

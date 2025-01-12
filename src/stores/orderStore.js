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

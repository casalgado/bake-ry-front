// stores/stockStore.js
import { createResourceStore } from './base/resourceStore';
import { StockService } from '../services/stockService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new StockService(getBakeryId.value);

export const useStockStore = createResourceStore('stocks', service);

// Movements and adjustments are not CRUD on the stocks resource, so they hang
// off the service directly (same pattern as bakerySettingsStore's helpers).
const store = useStockStore();

store.getMovements = (itemKey, options) => service.getMovements(itemKey, options);
store.getOrderMovements = (orderId) => service.getOrderMovements(orderId);
store.adjust = async (itemKey, payload) => {
  const movement = await service.adjust(itemKey, payload);
  // The cache moved server-side; re-read so the table reflects it.
  await store.fetchAll();
  return movement;
};

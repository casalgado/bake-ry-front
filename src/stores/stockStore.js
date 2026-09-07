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
// Every write refetches: currentStock is a server-side cache, and the screen
// showing it has no way to recompute the increment itself.
store.adjust = async (itemKey, payload) => {
  const movement = await service.adjust(itemKey, payload);
  await store.fetchAll();
  return movement;
};

store.waste = async (itemKey, payload) => {
  const movement = await service.waste(itemKey, payload);
  await store.fetchAll();
  return movement;
};

store.transfer = async (itemKey, payload) => {
  const movements = await service.transfer(itemKey, payload);
  await store.fetchAll();
  return movements;
};

store.produce = async (payload) => {
  const result = await service.produce(payload);
  // A preview writes nothing, so there is nothing to re-read.
  if (!payload?.preview) await store.fetchAll();
  return result;
};

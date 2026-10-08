// stores/stockStore.js
import { createResourceStore } from './base/resourceStore';
import { StockService } from '../services/stockService';
import { PurchaseService } from '../services/purchaseService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new StockService(getBakeryId.value);
const purchases = new PurchaseService(getBakeryId.value);

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

// A purchase is a stock write like the rest: one `purchase` movement per line.
store.purchase = async (payload) => {
  const purchase = await purchases.create(payload);
  await store.fetchAll();
  return purchase;
};

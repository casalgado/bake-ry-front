// stores/productionRunStore.js
import { createResourceStore } from './base/resourceStore';
import { ProductionRunService } from '../services/productionRunService';
import { useAuthenticationStore } from './authentication';
import { useStockStore } from './stockStore';
import { storeToRefs } from 'pinia';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new ProductionRunService(getBakeryId.value);

export const useProductionRunStore = createResourceStore('productionRuns', service);

// Line actions are not CRUD on the run, so they hang off the service directly
// (same pattern as stockStore's movement helpers).
const store = useProductionRunStore();

store.preview = (lines) => service.preview(lines);

// The server returns the whole run after a line action: swap it in place.
const replaceRun = (run) => {
  store.items = store.items.map((r) => (r.id === run.id ? run : r));
  return run;
};

// Receiving and undoing move stock, so stock is re-read; cancelling and editing
// move none.
store.receiveLine = async (runId, lineId) => {
  const run = replaceRun(await service.receiveLine(runId, lineId));
  await useStockStore().fetchAll();
  return run;
};

store.undoLine = async (runId, lineId) => {
  const run = replaceRun(await service.undoLine(runId, lineId));
  await useStockStore().fetchAll();
  return run;
};

store.cancelLine = async (runId, lineId) => replaceRun(await service.cancelLine(runId, lineId));

store.updateLine = async (runId, lineId, plannedQty) =>
  replaceRun(await service.updateLine(runId, lineId, plannedQty));

// stores/bakerySettingsStore.js
import { createResourceStore } from './base/resourceStore';
import { BakerySettingsService } from '../services/bakerySettingsService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new BakerySettingsService(getBakeryId.value);

// Create the store with additional getters
export const useBakerySettingsStore = createResourceStore('settings', service);

// Add the staff getter to the existing store
const store = useBakerySettingsStore();
store.staff = computed(async () => {
  const response = await service.getStaff();
  return response.data;
});

store.b2b_clients = computed(async () => {
  const response = await service.getB2bClients();
  return response.data;
});

// POS Configuration helpers
store.posConfig = computed(() => {
  if (!store.currentItem?.features?.pos) return null;
  return store.currentItem.features.pos;
});

store.shouldAutoMarkPaid = computed(() => {
  const config = store.posConfig;
  return config?.autoMarkPaid || false;
});

store.shouldDefaultToCurrentDate = computed(() => {
  const config = store.posConfig;
  return config?.defaultToCurrentDate || false;
});

store.shouldHideDeliveryOptions = computed(() => {
  const config = store.posConfig;
  return config?.hideDeliveryOptions || false;
});

store.shouldAutoSelectClient = computed(() => {
  const config = store.posConfig;
  return config?.autoSelectClient || false;
});

store.posDefaultClientId = computed(() => {
  const config = store.posConfig;
  return config?.defaultClientId || null;
});

// Opt-in modules (see zplanning/inventory/INVENTORY.md §4.4).
// Read items[0] — the single settings doc — like the rest of the app does.
store.isInventoryEnabled = computed(
  () => store.items[0]?.features?.inventory?.enabled === true,
);

store.isAccountingEnabled = computed(
  () => store.items[0]?.features?.accounting?.enabled === true,
);

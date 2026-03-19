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

store.isPOSMode = computed(() => {
  const config = store.posConfig;
  return config?.enabled || false;
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

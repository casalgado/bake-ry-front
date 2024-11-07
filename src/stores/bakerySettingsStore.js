// stores/bakerySettingsStore.js
import { createResourceStore } from './base/resourceStore';
import { BakerySettingsService } from '../services/bakerySettingsService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new BakerySettingsService(getBakeryId.value);

export const useBakerySettingsStore = createResourceStore('settings', service);

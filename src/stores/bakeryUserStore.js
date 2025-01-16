// stores/bakeryUserStore.js
import { createResourceStore } from './base/resourceStore';
import { BakeryUserService } from '../services/bakeryUserService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new BakeryUserService(getBakeryId.value);

export const useBakeryUserStore = createResourceStore('users', service);

const store = useBakeryUserStore();

store.getHistory = async (userId) => {
  store.setLoading(true);
  store.clearError();

  try {
    const response = await service.getHistory(userId);
    return response.data;
  } catch (err) {
    store.setError(err);
    throw err;
  } finally {
    store.setLoading(false);
  }
};

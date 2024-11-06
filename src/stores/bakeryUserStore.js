// stores/bakeryUserStore.js
import { createResourceStore } from './base/resourceStore';
import { BakeryUserService } from '../services/bakeryUserService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new BakeryUserService(getBakeryId.value);

export const useBakeryUserStore = createResourceStore('users', service);

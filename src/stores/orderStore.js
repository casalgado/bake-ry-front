// stores/orderStore.js
import { createResourceStore } from './base/resourceStore';
import { OrderService } from '../services/orderService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

// Get bakeryId from auth store
const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

// Create service instance with bakeryId
const service = new OrderService(getBakeryId.value);

export const useOrderStore = createResourceStore('orders', service);

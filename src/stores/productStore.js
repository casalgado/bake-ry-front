// stores/productStore.js
import { createResourceStore } from './base/resourceStore';
import { ProductService } from '../services/productService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

// Get bakeryId from auth store
const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

// Create service instance with bakeryId
const service = new ProductService(getBakeryId.value);

export const useProductStore = createResourceStore('products', service);

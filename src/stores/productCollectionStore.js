// stores/productCollectionStore.js
import { createResourceStore } from './base/resourceStore';
import { ProductCollectionService } from '../services/productCollectionService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

// Get bakeryId from auth store
const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

// Create service instance with bakeryId
const service = new ProductCollectionService(getBakeryId.value);

export const useProductCollectionStore = createResourceStore('productCollections', service);

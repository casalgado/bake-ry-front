// stores/ingredientStore.js
import { createResourceStore } from './base/resourceStore';
import { IngredientService } from '../services/ingredientService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

// Get bakeryId from auth store
const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

// Create service instance with bakeryId
const service = new IngredientService(getBakeryId.value);

export const useIngredientStore = createResourceStore('ingredients', service);

// A read-only dry run, not CRUD on the resource, so it hangs off the service
// directly — same pattern as stockStore's movement helpers.
const store = useIngredientStore();

store.costImpact = (id, newCost) => service.costImpact(id, newCost);

// stores/providerStore.js
import { createResourceStore } from './base/resourceStore';
import { ProviderService } from '../services/providerService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new ProviderService(getBakeryId.value);

export const useProviderStore = createResourceStore('providers', service);

// A read of purchases, not CRUD on providers, so it hangs off the service
// directly — same pattern as ingredientStore's costImpact.
const store = useProviderStore();

store.getLastPurchase = (id) => service.getLastPurchase(id);

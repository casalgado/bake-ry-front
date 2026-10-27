// stores/receivedInvoiceStore.js
import { createResourceStore } from './base/resourceStore';
import { ReceivedInvoiceService } from '../services/receivedInvoiceService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new ReceivedInvoiceService(getBakeryId.value);

export const useReceivedInvoiceStore = createResourceStore('receivedInvoices', service);

// Actions on one invoice, not CRUD: they hang off the service directly, like
// providerStore.getLastPurchase.
const store = useReceivedInvoiceStore();

store.setDestinations = (id, destinations) => service.setDestinations(id, destinations);
store.confirm = (id, payment) => service.confirm(id, payment);
store.setPayment = (id, payment) => service.setPayment(id, payment);
store.ignore = (id) => service.ignore(id);
store.createProvider = (id) => service.createProvider(id);

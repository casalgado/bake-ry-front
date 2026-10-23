// stores/accountingTemplateStore.js
import { createResourceStore } from './base/resourceStore';
import { AccountingTemplateService } from '../services/accountingTemplateService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new AccountingTemplateService(getBakeryId.value);

export const useAccountingTemplateStore = createResourceStore('accountingTemplates', service);

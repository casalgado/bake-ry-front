// stores/accountingRecordStore.js
import { createResourceStore } from './base/resourceStore';
import { AccountingRecordService } from '../services/accountingRecordService';
import { useAuthenticationStore } from './authentication';
import { storeToRefs } from 'pinia';

const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

const service = new AccountingRecordService(getBakeryId.value);

export const useAccountingRecordStore = createResourceStore('accountingRecords', service);

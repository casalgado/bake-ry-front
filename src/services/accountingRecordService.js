import { BaseService } from './base/resourceService';

export class AccountingRecordService extends BaseService {
  constructor(bakeryId) {
    super('accounting/records', `/bakeries/${bakeryId}`);
  }
}

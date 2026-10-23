import { BaseService } from './base/resourceService';

export class AccountingTemplateService extends BaseService {
  constructor(bakeryId) {
    super('accounting/templates', `/bakeries/${bakeryId}`);
  }
}

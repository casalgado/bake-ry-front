// services/bakerySettingsService.js
import { BaseService } from './base/resourceService';

export class BakerySettingsService extends BaseService {
  constructor(bakeryId) {
    super('settings', `/bakeries/${bakeryId}`);
  }

  async getStaff() {
    return this.api.get(`${this.basePath}/settings/default/staff`);
  }
}

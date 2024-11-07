// services/bakerySettingsService.js
import { BaseService } from './base/resourceService';

export class BakerySettingsService extends BaseService {
  constructor(bakeryId) {
    super('settings', `/bakeries/${bakeryId}`);
  }
}

// services/bakeryUserService.js
import { BaseService } from './base/resourceService';

export class BakeryUserService extends BaseService {
  constructor(bakeryId) {
    super('users', `/bakeries/${bakeryId}`);
  }
}

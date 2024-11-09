// services/orderService.js
import { BaseService } from './base/resourceService';

export class OrderService extends BaseService {
  constructor(bakeryId) {
    super('orders', `/bakeries/${bakeryId}`);
  }
}

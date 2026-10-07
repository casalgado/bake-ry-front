import { BaseService } from './base/resourceService';

/**
 * Purchases are immutable once confirmed: create and read only. Called through
 * `stockStore.purchase`, which refetches stock after it.
 * `idempotencyKey` makes a resend land on the same purchase.
 */
export class PurchaseService extends BaseService {
  constructor(bakeryId) {
    super('purchases', `/bakeries/${bakeryId}`);
  }
}

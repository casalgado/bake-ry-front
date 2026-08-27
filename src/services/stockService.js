// services/stockService.js
import { BaseService } from './base/resourceService';

/**
 * The stock ledger (see zplanning/strategy/INVENTORY-IMPLEMENTATION.md §8).
 *
 * Read-only plus adjustments, on purpose: movements are append-only, so there
 * is no update or delete endpoint to call. Corrections are new adjustments or
 * a stock count.
 */
export class StockService extends BaseService {
  constructor(bakeryId) {
    super('stocks', `/bakeries/${bakeryId}`);
  }

  /** Movement history for one item, newest first. */
  async getMovements(itemKey, { limit = 50, startAfter = null } = {}) {
    try {
      const response = await this.api.get(
        `${this.getPath()}/${itemKey}/movements`,
        { params: { limit, ...(startAfter ? { startAfter } : {}) } },
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Every movement of one order — the audit trail behind a sale. */
  async getOrderMovements(orderId) {
    try {
      const response = await this.api.get(`${this.basePath}/stockMovements`, {
        params: { orderId },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Signed quantity plus a required reason. The permanent manual escape hatch.
   * `warehouseId` is the row's own bodega — the backend falls back to the
   * default one, but stock is held per (item, bodega), so we say which.
   */
  async adjust(itemKey, { qty, reason, warehouseId }) {
    try {
      const response = await this.api.post(`${this.getPath()}/${itemKey}/adjust`, {
        qty,
        reason,
        warehouseId,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

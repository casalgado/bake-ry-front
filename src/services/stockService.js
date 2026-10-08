// services/stockService.js
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { BaseService } from './base/resourceService';

// ponytail: a hand copy of the backend's COMMITTED_WINDOW_DAYS (stockService.js).
// If that number changes, orders inside the new window stop refreshing the
// screen live until this follows; the data itself stays right.
const COMMITTED_WINDOW_DAYS = 10;

/**
 * The stock ledger (see zplanning/inventory/INVENTORY-IMPLEMENTATION.md §8).
 *
 * Reads plus four appends, on purpose: movements are append-only, so there is
 * no update or delete endpoint to call anywhere. Corrections are new
 * adjustments or a stock count.
 *
 * `idempotencyKey` is the retry contract for every hand-entered movement — the
 * backend turns it into the movement's document id, so the same key twice
 * writes one movement (backend stockService.js `retryId`). Send a stable key
 * per form submission, not per attempt.
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

  /**
   * Calls onChange when something that moves Existencias changes: a stocks doc
   * written (a ship, a count) or an open pedido appearing, changing or leaving
   * (the backend's committed set, same filter). Disponible is computed on read,
   * so this only says "refetch". The first snapshot of each is data the caller
   * already has, so it is skipped. Returns one function that stops both.
   */
  subscribeToAvailability(onChange) {
    const bakery = doc(db, 'bakeries', this.bakeryId);
    const cutoff = new Date(Date.now() - COMMITTED_WINDOW_DAYS * 86400000);

    const listen = (q) => {
      let first = true;
      return onSnapshot(q, () => {
        if (first) { first = false; return; }
        onChange();
      }, (error) => console.error('Realtime stock listener:', error));
    };

    const stops = [
      listen(collection(bakery, 'stocks')),
      listen(query(
        collection(bakery, 'orders'),
        where('isDeleted', '==', false),
        where('status', 'in', [0, 1]),
        where('dueDate', '>=', cutoff),
      )),
    ];
    return () => stops.forEach((stop) => stop());
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
  async adjust(itemKey, { qty, reason, warehouseId, idempotencyKey }) {
    try {
      const response = await this.api.post(`${this.getPath()}/${itemKey}/adjust`, {
        qty,
        reason,
        warehouseId,
        idempotencyKey,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * A baja: value that left the business, always a negative quantity. Its own
   * endpoint and its own movement type, deliberately not an adjustment — the
   * merma report separates explained loss from unexplained, and an append-only
   * ledger can never be re-tagged afterwards.
   *
   * `reason` is the bare enum (damaged / expired / lost / other); free text
   * goes in `note`, so the report can still group.
   */
  async waste(itemKey, { qty, reason, note, warehouseId, idempotencyKey }) {
    try {
      const response = await this.api.post(`${this.getPath()}/${itemKey}/waste`, {
        qty,
        reason,
        note,
        warehouseId,
        idempotencyKey,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Two movements, one transaction: −qty at the origin, +qty at the destination. */
  async transfer(itemKey, { qty, fromWarehouseId, toWarehouseId, idempotencyKey }) {
    try {
      const response = await this.api.post(`${this.getPath()}/${itemKey}/transfer`, {
        qty,
        fromWarehouseId,
        toWarehouseId,
        idempotencyKey,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

}

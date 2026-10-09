// services/stockCountService.js
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { BaseService } from './base/resourceService';

const toDate = (value) => (value?.toDate ? value.toDate() : value ? new Date(value) : null);

/* The API sends ISO strings, the listener sends Timestamps; both become Dates. */
const normalize = (count) => ({
  ...count,
  createdAt: toDate(count.createdAt),
  closedAt: toDate(count.closedAt),
  items: count.items ?? {},
});

/**
 * Conteo: a count lives on the server and several people type into it at once.
 * Rows change one at a time (`setItem`); the screens read the count through
 * `subscribeToCount`, so the value on screen is always the server's.
 */
export class StockCountService extends BaseService {
  constructor(bakeryId) {
    super('stockCounts', `/bakeries/${bakeryId}`);
  }

  /** Newest first, without rows: each carries `counted`, `counters`, `netValue`. */
  async list() {
    try {
      const response = await this.api.get(this.getPath());
      return response.data.map(normalize);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Open-or-join: returns the bodega's open count when there is one. */
  async open(warehouseId) {
    try {
      const response = await this.api.post(this.getPath(), { warehouseId });
      return normalize(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** `qty: null` clears the row: an empty box is "not counted", not zero. */
  async setItem(countId, itemKey, qty) {
    try {
      const response = await this.api.put(`${this.getPath()}/${countId}/items/${itemKey}`, { qty });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async close(countId) {
    try {
      const response = await this.api.post(`${this.getPath()}/${countId}/close`);
      return normalize(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async discard(countId) {
    try {
      const response = await this.api.post(`${this.getPath()}/${countId}/discard`);
      return normalize(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Calls onChange with the count (null if there is none) on every write, and
   * onError if the listener fails (a missing read rule, the network), so a
   * screen can stop loading and say why. Returns the stop function.
   */
  subscribeToCount(countId, onChange, onError) {
    return onSnapshot(
      doc(db, 'bakeries', this.bakeryId, 'stockCounts', countId),
      (snap) => onChange(snap.exists() ? normalize({ id: snap.id, ...snap.data() }) : null),
      (error) => {
        console.error('Realtime count listener:', error);
        onError(error);
      },
    );
  }
}

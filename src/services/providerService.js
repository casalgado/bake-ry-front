import { BaseService } from './base/resourceService';

export class ProviderService extends BaseService {
  constructor(bakeryId) {
    super('providers', `/bakeries/${bakeryId}`);
  }

  /** The provider's newest purchase (lines with unitCost), or null: what Ingreso prefills from. */
  async getLastPurchase(id) {
    try {
      const response = await this.api.get(`${this.getPath()}/${id}/last-purchase`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Everything booked against the provider, newest first: `[{ kind, id, date, ref, description, total, isPaid }]`. */
  async getHistory(id) {
    try {
      const response = await this.api.get(`${this.getPath()}/${id}/history`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

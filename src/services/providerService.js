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
}

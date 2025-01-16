// services/bakeryUserService.js
import { BaseService } from './base/resourceService';

export class BakeryUserService extends BaseService {
  constructor(bakeryId) {
    super('users', `/bakeries/${bakeryId}`);
  }

  async getHistory(userId) {
    try {
      const response = await this.api.get(`${this.basePath}/users/${userId}/history`);
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

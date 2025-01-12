// services/orderService.js
import { BaseService } from './base/resourceService';

export class OrderService extends BaseService {
  constructor(bakeryId) {
    super('orders', `/bakeries/${bakeryId}`);
  }

  async getSalesReport(query = {}) {
    try {
      // Format query parameters using the base service method
      const params = this.formatQueryParams(query);

      // Make the API request using the base service's API instance
      const response = await this.api.get(
        `${this.basePath}/orders/sales_report`,
        { params },
      );

      // Use the base service's response handler for consistent error handling
      return this.handleResponse(response);
    } catch (error) {
      // Use the base service's error handler for consistent error handling
      throw this.handleError(error);
    }
  }

  async getHistory(orderId) {
    try {
      const response = await this.api.get(`${this.basePath}/orders/${orderId}/history`);
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

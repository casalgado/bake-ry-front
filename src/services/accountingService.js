import { BaseService } from './base/resourceService';

export class AccountingService extends BaseService {
  constructor(bakeryId) {
    super('accounting', `/bakeries/${bakeryId}`);
  }

  /** One month's records and totals. `period` is YYYY-MM. */
  async getMonth(period) {
    try {
      const response = await this.api.get(`${this.getPath()}/months/${period}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** The P&G, one column per month from `from` to `to` (YYYY-MM, inclusive). */
  async getIncomeStatement(from, to) {
    try {
      const response = await this.api.get(`${this.getPath()}/income_statement`, { params: { from, to } });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Freezes a month's figures; later edits show as drift on the P&G. */
  async closePeriod(period) {
    try {
      const response = await this.api.post(`${this.getPath()}/months/${period}/close`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async reopenPeriod(period) {
    try {
      const response = await this.api.delete(`${this.getPath()}/months/${period}/close`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Turns a pending template into that month's record. Overrides are whole pesos. */
  async confirmTemplate(period, templateId, overrides = {}) {
    try {
      const response = await this.api.post(
        `${this.getPath()}/months/${period}/templates/${templateId}/confirm`,
        overrides,
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

import { BaseService } from './base/resourceService';

/**
 * Production runs: sent from Producción, received line by line in the kitchen
 * list. A run is never edited as a whole, so there is no update call; the line
 * actions are their own endpoints.
 */
export class ProductionRunService extends BaseService {
  constructor(bakeryId) {
    super('productionRuns', `/bakeries/${bakeryId}`);
  }

  /** What each line would add and consume, per line. Writes nothing. */
  async preview(lines) {
    try {
      const response = await this.api.post(`${this.getPath()}/preview`, { lines });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async receiveLine(runId, lineId) {
    try {
      const response = await this.api.post(`${this.getPath()}/${runId}/lines/${lineId}/receive`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** A produced line back to pending; the server reverses its stock movements. */
  async undoLine(runId, lineId) {
    try {
      const response = await this.api.post(`${this.getPath()}/${runId}/lines/${lineId}/undo`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async cancelLine(runId, lineId) {
    try {
      const response = await this.api.post(`${this.getPath()}/${runId}/lines/${lineId}/cancel`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** The planned quantity of a pending line. The server refuses any other line. */
  async updateLine(runId, lineId, plannedQty) {
    try {
      const response = await this.api.patch(`${this.getPath()}/${runId}/lines/${lineId}`, { plannedQty });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// services/ingredientService.js
import { BaseService } from './base/resourceService';

export class IngredientService extends BaseService {
  constructor(bakeryId) {
    super('ingredients', `/bakeries/${bakeryId}`);
  }

  /**
   * Dry run: what would change downstream if this ingredient cost `newCost`.
   * The backend runs the real propagation walk in a transaction and throws the
   * writes away (recipeGraph.previewIngredientCostImpact), so this is the
   * actual result of saving, not an estimate.
   *
   * Returns `[{ path, changes }]` — one entry per OWNER document whose cached
   * cost would move (a preparación's `costPerUnit`, a product's or a
   * combination's `costPrice`, each `{ from, to }`). Recipes never appear:
   * they hold no cached cost of their own.
   */
  async costImpact(id, newCost) {
    try {
      const response = await this.api.get(
        `${this.getPath()}/${id}/cost-impact`,
        { params: { newCost } },
      );
      return response.data.impact;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

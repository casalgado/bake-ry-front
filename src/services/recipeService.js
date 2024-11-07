// services/recipeService.js
import { BaseService } from './base/resourceService';

export class RecipeService extends BaseService {
  constructor(bakeryId) {
    super('recipes', `/bakeries/${bakeryId}`);
  }
}

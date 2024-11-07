// services/ingredientService.js
import { BaseService } from './base/resourceService';

export class IngredientService extends BaseService {
  constructor(bakeryId) {
    super('ingredients', `/bakeries/${bakeryId}`);
  }
}

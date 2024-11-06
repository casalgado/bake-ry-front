// services/productService.js
import { BaseService } from './base/resourceService';

export class ProductService extends BaseService {
  constructor(bakeryId) {
    super('products', `/bakeries/${bakeryId}`);
  }
}

// services/productCollectionService.js
import { BaseService } from './base/resourceService';

export class ProductCollectionService extends BaseService {
  constructor(bakeryId) {
    super('productCollections', `/bakeries/${bakeryId}`);
  }
}

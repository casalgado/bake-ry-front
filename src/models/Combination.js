import BaseModel from './base/BaseModel.js';
import { generateId  } from '../utils/helpers.js';

class Combination extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.selection = data.selection || [];
    this.name = data.name || '';
    this.basePrice = data.basePrice || 0;
    this.currentPrice = data.currentPrice || this.basePrice;
    this.isWholeGrain = data.isWholeGrain || false;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
  }

  static fromLegacyVariation(variation, currentPrice = null) {
    // Handle legacy variations that might not have a proper name
    const name = variation.name || Object.keys(variation).find(key => key !== 'id' && variation[key]) || 'unknown';
    return new Combination({
      id: variation.id || generateId(),
      selection: [name].filter(Boolean), // Filter out undefined/null values
      name: name,
      basePrice: variation.basePrice || 0,
      currentPrice: currentPrice || variation.currentPrice || variation.basePrice || 0,
      isWholeGrain: variation.isWholeGrain || false,
      isActive: true,
    });
  }

  getTotalPrice(quantity = 1) {
    return this.currentPrice * quantity;
  }

  getDisplayName() {
    return this.name || this.selection.join(' + ');
  }

  isLegacyVariation() {
    return this.selection.length === 1;
  }

  toPlainObject() {
    const obj = {
      id: this.id,
      selection: this.selection.filter(item => item !== undefined && item !== null),
      name: this.name,
      basePrice: this.basePrice,
      currentPrice: this.currentPrice,
      isWholeGrain: this.isWholeGrain,
      isActive: this.isActive,
    };

    // Only include date fields if they have values
    if (this.createdAt !== undefined) {
      obj.createdAt = this.createdAt;
    }
    if (this.updatedAt !== undefined) {
      obj.updatedAt = this.updatedAt;
    }

    return obj;
  }

  toFirestore() {
    const data = super.toFirestore();
    return {
      ...data,
      selection: this.selection.filter(item => item !== undefined && item !== null),
      name: this.name,
      basePrice: this.basePrice,
      currentPrice: this.currentPrice,
      isWholeGrain: this.isWholeGrain,
      isActive: this.isActive,
    };
  }
}

export default Combination;

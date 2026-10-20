// models/Product.js
import BaseModel from './base/BaseModel.js';
import VariationGroups from './VariationGroups.js';

class Product extends BaseModel {
  // How a sale of this product moves stock (zplanning/inventory/INVENTORY.md §1).
  // 'none' is the default so every existing product behaves exactly as before.
  // Which tax `taxPercentage` is: IVA, or the impuesto al consumo (INC).
  // Same values as the backend's Product.TAX_TYPES. 0% is excluded either way.
  static TAX_TYPES = {
    IVA: 'IVA',
    INC: 'INC',
  };

  static INVENTORY_MODES = {
    NONE: 'none',
    UNIT: 'unit',
    RECIPE: 'recipe',
  };

  // Whether costPrice is typed by hand or computed from the recipe (§7).
  static COST_PRICE_SOURCES = {
    MANUAL: 'manual',
    RECIPE: 'recipe',
  };

  constructor({
    // Basic Information
    id,
    bakeryId,
    name = '',
    collectionId,
    collectionName,
    // Variations
    variations = [],
    hasVariations,
    // Basic price and recipe (for products without variations)
    recipeId,
    basePrice,
    costPrice,
    costPriceSource = Product.COST_PRICE_SOURCES.MANUAL,
    currentPrice,
    taxPercentage = 0,
    taxType = Product.TAX_TYPES.IVA,

    // Inventory
    inventoryMode = Product.INVENTORY_MODES.NONE,
    usedInRecipes = [], // reverse index: recipes using this product as a component

    // Display & Marketing
    displayOrder,
    // Status+
    isActive = true,
    isDeleted = false,
    // Common fields
    createdAt,
    updatedAt,
    // Custom Attributes
    customAttributes = {},
    description,
    accountingCode,
  } = {}) {
    super({ id, createdAt, updatedAt });

    // Basic Information
    this.bakeryId = bakeryId;
    this.name = name.trim().toLowerCase();
    this.collectionId = collectionId;
    this.collectionName = collectionName;
    this.recipeId = recipeId;
    this.description = description;
    this.accountingCode = accountingCode;

    // Handle variations - create instances
    this.variations = Array.isArray(variations) ? VariationGroups.fromLegacyVariations(variations) : variations;

    this.hasVariations = this.variations?.combinations?.length > 0 || hasVariations;

    // Basic price
    this.basePrice = basePrice;
    this.costPrice = costPrice;
    this.costPriceSource = costPriceSource;

    // Inventory
    this.inventoryMode = inventoryMode;
    this.usedInRecipes = usedInRecipes;
    this.currentPrice = currentPrice || basePrice;
    this.taxPercentage = Number(Number(taxPercentage).toFixed(1));
    this.taxType = taxType;

    // Display & Marketing
    this.displayOrder = displayOrder;

    // Status
    this.isActive = isActive;
    this.isDeleted = isDeleted;

    // Custom Attributes
    this.customAttributes = customAttributes;
  }

  // Override toFirestore to handle variations
  toFirestore() {
    const data = super.toFirestore();

    // Handle variations based on type
    if (this.variations) {
      if (this.variations instanceof VariationGroups) {
        // VariationGroups instance - convert to plain object
        data.variations = this.variations.toPlainObject();
      } else if (typeof this.variations === 'object' && !Array.isArray(this.variations)) {
        // Already a plain object (from new products) - pass through
        data.variations = this.variations;
      } else if (Array.isArray(this.variations)) {
        // Legacy array format - shouldn't happen after constructor conversion
        // but include for safety
        data.variations = this.variations;
      }
    }

    return data;
  }

  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);
    return new Product({
      id: doc.id,
      ...data,
    });
  }
}
export default Product;

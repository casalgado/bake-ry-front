// models/Ingredient.js
import BaseModel from './base/BaseModel.js';

class Ingredient extends BaseModel {
  constructor({
    // Basic Information
    id,
    bakeryId,
    name,
    // false: consumed to make your products. true: bought and sold as-is.
    isResale = false,
    categoryId,
    categoryName,
    createdAt,
    updatedAt,

    // Usage and Recipes
    usedInRecipes = [],
    notes,

    // Cost and Pricing
    costPerUnit = 0,
    currency = 'COP',

    // Units and Measurements
    unit,

    // Storage Requirements
    storageTemp,

    // Status
    isActive = true,
    isDiscontinued = false,
    isDeleted = false,

    // Custom Attributes
    customAttributes = {},
  } = {}) {
    // Pass common fields to BaseModel
    super({ id, createdAt, updatedAt });

    // Basic Information
    this.bakeryId = bakeryId;
    this.name = name;
    this.categoryId = categoryId;
    this.categoryName = categoryName;

    this.isResale = Boolean(isResale);

    // Usage and Recipes
    this.usedInRecipes = usedInRecipes;
    this.notes = notes;

    // Cost and Pricing
    this.costPerUnit = costPerUnit;
    this.currency = currency;

    // Current stock is NOT held here — it lives on the stocks docs
    // (zplanning/strategy/INVENTORY-IMPLEMENTATION.md §8.1).

    // Units and Measurements
    this.unit = unit;

    // Storage Requirements
    this.storageTemp = storageTemp;

    // Status
    this.isActive = isActive;
    this.isDiscontinued = isDiscontinued;
    this.isDeleted = isDeleted;
    // Custom Attributes
    this.customAttributes = customAttributes;
  }
}

export default Ingredient;

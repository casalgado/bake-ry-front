import BaseModel from './base/BaseModel.js';
import ProductVariation from './ProductVariation.js';
import { generateId  } from '../utils/helpers.js';

class ProductCollection extends BaseModel {

  constructor({
    id,
    bakeryId,
    name,
    description = '',
    displayOrder = 0,
    isActive = true,
    isDeleted = false,

    // Variation templates for this collection
    variationTemplates = [],
    defaultVariationType = null, // 'WEIGHT', 'QUANTITY', 'SIZE'
    defaultUnit = null,

    // Dimension templates for this collection (new variations system)
    dimensionTemplates = { dimensions: [] },

    // Common fields
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt });

    this.bakeryId = bakeryId;
    this.name = name;
    this.description = description;
    this.displayOrder = displayOrder;
    this.isActive = isActive;
    this.isDeleted = isDeleted;
    this.defaultVariationType = defaultVariationType;
    this.defaultUnit = defaultUnit;

    // Handle dimension templates (new variations system)
    this.dimensionTemplates = dimensionTemplates || { dimensions: [] };

    // Handle variation templates - these are templates without pricing
    this.variationTemplates = variationTemplates.map(template => {
      // Ensure we don't store pricing in collection templates
      const { basePrice, ...templateWithoutPrice } = template;
      void basePrice; // avoids eslint errors
      return new ProductVariation(templateWithoutPrice);
    });
  }

  // Get variation templates for product creation
  getVariationTemplates() {
    return this.variationTemplates.map(template => template.toPlainObject());
  }

  // Get dimension templates for product creation
  getDimensionTemplates() {
    return this.dimensionTemplates;
  }

  // Update dimension templates
  updateDimensionTemplates(dimensionTemplates) {
    this.dimensionTemplates = dimensionTemplates || { dimensions: [] };
  }

  // Add a variation template to this collection
  addVariationTemplate(template) {
    const { basePrice, ...templateWithoutPrice } = template;
    void basePrice; // avoids eslint errors
    const variation = new ProductVariation({
      ...templateWithoutPrice,
      id: template.id || generateId(),
    });

    variation.validate();
    this.variationTemplates.push(variation);
    return variation;
  }

  // Remove a variation template
  removeVariationTemplate(templateId) {
    this.variationTemplates = this.variationTemplates.filter(
      template => template.id !== templateId,
    );
  }

  // Update a variation template
  updateVariationTemplate(templateId, updates) {
    const templateIndex = this.variationTemplates.findIndex(
      template => template.id === templateId,
    );

    if (templateIndex === -1) {
      throw new Error('Variation template not found');
    }

    const { basePrice, ...updatesWithoutPrice } = updates;
    void basePrice; // avoids eslint errors
    const currentTemplate = this.variationTemplates[templateIndex];
    const updatedTemplate = new ProductVariation({
      ...currentTemplate.toPlainObject(),
      ...updatesWithoutPrice,
    });

    updatedTemplate.validate();
    this.variationTemplates[templateIndex] = updatedTemplate;
    return updatedTemplate;
  }

  // Override toFirestore to handle variation templates and dimension templates
  toFirestore() {
    const data = super.toFirestore();
    if (this.variationTemplates.length > 0) {
      data.variationTemplates = this.variationTemplates.map(template =>
        template.toPlainObject(),
      );
    }
    if (this.dimensionTemplates && this.dimensionTemplates.dimensions.length > 0) {
      data.dimensionTemplates = this.dimensionTemplates;
    }
    return data;
  }

  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);
    return new ProductCollection({
      id: doc.id,
      ...data,
      variationTemplates: data.variationTemplates || [],
      dimensionTemplates: data.dimensionTemplates || { dimensions: [] },
    });
  }

}

export default ProductCollection;

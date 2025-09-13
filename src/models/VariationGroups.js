const ProductVariation = require('./ProductVariation');
const { generateId } = require('../utils/helpers');

class VariationGroups {
  constructor({ dimensions = [], combinations = [] } = {}) {
    this.dimensions = dimensions;
    this.combinations = combinations.map(combo => ({
      ...combo,
      id: combo.id || generateId()
    }));
  }

  /**
   * Get price for a specific combination by ID
   * @param {string} combinationId - The combination ID
   * @returns {Object} - {totalPrice, totalCost, profit, profitMargin}
   */
  getCombinationPrice(combinationId) {
    const combination = this.combinations.find(c => c.id === combinationId);
    if (!combination) {
      return { totalPrice: 0, totalCost: 0, profit: 0, profitMargin: 0 };
    }

    const totalPrice = combination.basePrice || 0;
    const totalCost = combination.costPrice || 0;
    const profit = totalPrice - totalCost;
    const profitMargin = totalPrice > 0 ? ((profit / totalPrice) * 100).toFixed(2) : 0;

    return { totalPrice, totalCost, profit, profitMargin };
  }

  /**
   * Find a combination by ID
   * @param {string} combinationId - The combination ID to find
   * @returns {Object|null} - The found combination or null
   */
  findCombinationById(combinationId) {
    return this.combinations.find(c => c.id === combinationId) || null;
  }

  /**
   * Add a new dimension
   * @param {string} type - Dimension type (WEIGHT, QUANTITY, SIZE, etc.)
   * @param {string} label - Display label for the dimension
   * @param {Array} options - Array of options for this dimension
   */
  addDimension(type, label, options = []) {
    const existingIndex = this.dimensions.findIndex(d => d.type === type);
    if (existingIndex !== -1) {
      this.dimensions[existingIndex] = { type, label, options };
    } else {
      this.dimensions.push({ type, label, options });
    }
  }

  /**
   * Add option to existing dimension
   * @param {string} type - Dimension type
   * @param {Object} option - Option to add {name, value, unit?, etc.}
   */
  addOptionToDimension(type, option) {
    const dimension = this.dimensions.find(d => d.type === type);
    if (dimension) {
      dimension.options.push(option);
    }
  }

  /**
   * Generate all possible combinations from dimensions
   * @returns {Array} - Array of all possible selection combinations
   */
  generateAllCombinations() {
    if (this.dimensions.length === 0) return [];

    const combinations = [];
    const generateCombos = (dimensionIndex, currentSelection) => {
      if (dimensionIndex >= this.dimensions.length) {
        combinations.push([...currentSelection]);
        return;
      }

      const dimension = this.dimensions[dimensionIndex];
      for (const option of dimension.options) {
        currentSelection.push(option.name);
        generateCombos(dimensionIndex + 1, currentSelection);
        currentSelection.pop();
      }
    };

    generateCombos(0, []);
    return combinations;
  }

  /**
   * Set price for a specific combination
   * @param {string} combinationId - Combination ID
   * @param {Object} priceData - {basePrice, costPrice}
   */
  setCombinationPrice(combinationId, priceData) {
    const combination = this.combinations.find(c => c.id === combinationId);
    if (combination) {
      combination.basePrice = priceData.basePrice;
      combination.costPrice = priceData.costPrice;
    }
  }

  /**
   * Add a new combination
   * @param {Array} selection - Array of option names selected
   * @param {Object} priceData - {basePrice, costPrice, name?, isActive?}
   * @returns {string} - The new combination ID
   */
  addCombination(selection, priceData) {
    const combinationId = generateId();
    const name = priceData.name || this.generateCombinationName(selection);

    this.combinations.push({
      id: combinationId,
      selection,
      name,
      basePrice: priceData.basePrice || 0,
      costPrice: priceData.costPrice || 0,
      isActive: priceData.isActive !== undefined ? priceData.isActive : true
    });

    return combinationId;
  }

  /**
   * Generate a display name for a combination
   * @param {Array} selection - Array of selected option names
   * @returns {string} - Generated name
   */
  generateCombinationName(selection) {
    return selection.join(' + ');
  }

  /**
   * Convert from legacy flat array format
   * @param {Array} flatVariations - Legacy flat array of variations
   * @returns {VariationGroups} - New VariationGroups instance
   */
  static fromLegacyVariations(flatVariations) {
    // Group legacy variations by type to create dimensions
    const dimensionsMap = {};
    const combinations = [];

    flatVariations.forEach(v => {
      const dimensionKey = v.type;

      // Create dimension if it doesn't exist
      if (!dimensionsMap[dimensionKey]) {
        dimensionsMap[dimensionKey] = {
          type: v.type,
          label: v.type,
          options: []
        };
      }

      // Add option to dimension (if not already present)
      const existingOption = dimensionsMap[dimensionKey].options.find(opt => opt.name === v.name);
      if (!existingOption) {
        dimensionsMap[dimensionKey].options.push({
          name: v.name,
          value: v.value,
          unit: v.unit || ''
        });
      }

      // Create combination for this single variation
      combinations.push({
        id: v.id,
        selection: [v.name],
        name: v.name,
        basePrice: v.basePrice || 0,
        costPrice: v.costPrice || 0,
        isActive: true
      });
    });

    return new VariationGroups({
      dimensions: Object.values(dimensionsMap),
      combinations
    });
  }

  /**
   * Convert to plain object for serialization
   * @returns {Object} - Plain object representation
   */
  toPlainObject() {
    return {
      dimensions: this.dimensions,
      combinations: this.combinations
    };
  }

  /**
   * Convert to flat array for Firestore (backward compatibility)
   * @returns {Array} - Flat array of variations
   */
  toFirestoreArray() {
    // Convert combinations back to flat ProductVariation-like objects
    const flat = [];

    this.combinations.forEach(combo => {
      // For single-dimension selections, create a simple variation
      if (combo.selection.length === 1) {
        const dimensionType = this.getDimensionForOption(combo.selection[0])?.type || 'SIZE';
        const dimensionOption = this.getOptionFromDimensions(combo.selection[0]);

        flat.push({
          id: combo.id,
          name: combo.selection[0],
          value: dimensionOption?.value || 0,
          basePrice: combo.basePrice,
          costPrice: combo.costPrice,
          type: dimensionType,
          unit: dimensionOption?.unit || '',
          isWholeGrain: false,
          displayOrder: 1
        });
      }
    });

    return flat;
  }

  /**
   * Helper to find which dimension contains an option
   */
  getDimensionForOption(optionName) {
    return this.dimensions.find(dim =>
      dim.options.some(opt => opt.name === optionName)
    );
  }

  /**
   * Helper to get option details from dimensions
   */
  getOptionFromDimensions(optionName) {
    for (const dimension of this.dimensions) {
      const option = dimension.options.find(opt => opt.name === optionName);
      if (option) return option;
    }
    return null;
  }

  /**
   * Validate the structure
   * @returns {Array} - Array of validation errors (empty if valid)
   */
  validate() {
    const errors = [];

    // Validate dimensions
    this.dimensions.forEach((dimension, dimIndex) => {
      if (!dimension.type) {
        errors.push(`Dimension ${dimIndex}: type is required`);
      }
      if (!dimension.options || !Array.isArray(dimension.options)) {
        errors.push(`Dimension ${dimIndex}: options must be an array`);
      }
    });

    // Validate combinations
    this.combinations.forEach((combination, comboIndex) => {
      if (!combination.selection || !Array.isArray(combination.selection)) {
        errors.push(`Combination ${comboIndex}: selection must be an array`);
      }
      if (combination.basePrice === undefined || combination.basePrice < 0) {
        errors.push(`Combination ${comboIndex}: basePrice must be non-negative`);
      }
      if (combination.costPrice !== undefined && combination.costPrice < 0) {
        errors.push(`Combination ${comboIndex}: costPrice must be non-negative`);
      }
    });

    return errors;
  }

  /**
   * Check if there are any variations
   * @returns {boolean} - True if has variations
   */
  hasVariations() {
    return this.combinations.length > 0;
  }

  /**
   * Get total number of combinations
   * @returns {number} - Total combination count
   */
  getTotalCombinationCount() {
    return this.combinations.length;
  }

  /**
   * Check if all combinations have prices set
   * @returns {boolean} - True if all combinations have prices
   */
  allCombinationsHavePrices() {
    return this.combinations.every(combo =>
      combo.basePrice !== undefined && combo.basePrice >= 0
    );
  }
}

module.exports = VariationGroups;

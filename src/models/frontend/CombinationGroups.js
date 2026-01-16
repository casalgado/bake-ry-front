/**
 * CombinationGroups - Manages hierarchical grouping of product variations
 * for Shopify-style collapsible group interface
 */
export default class CombinationGroups {
  constructor(combinations = [], dimensions = []) {
    this.originalCombinations = combinations;
    this.dimensions = dimensions;
    this.groupByDimension = 0; // Default to first dimension
    this.groups = new Map();
    this.expandedGroups = new Set();

    this._initializeGroups();
  }

  /**
   * Initialize groups from combinations
   * @private
   */
  _initializeGroups() {
    if (this.originalCombinations.length === 0 || this.dimensions.length === 0) {
      this.groups.clear();
      return;
    }

    this.groups.clear();

    this.originalCombinations.forEach(combination => {
      const groupKey = this._getGroupKey(combination);
      const variantName = this._getVariantName(combination);

      if (!this.groups.has(groupKey)) {
        this.groups.set(groupKey, {
          name: groupKey,
          expanded: false,
          variants: [],
          priceRange: { min: Infinity, max: -Infinity },
        });
      }

      const group = this.groups.get(groupKey);
      group.variants.push({
        ...combination,
        variantName,
        originalSelection: [...combination.selection],
      });

      // Update price range
      this._updateGroupPriceRange(groupKey);
    });
  }

  /**
   * Get group key based on selected dimension
   * @private
   * @param {Object} combination
   * @returns {string}
   */
  _getGroupKey(combination) {
    if (!combination.selection || combination.selection.length === 0) {
      return 'default';
    }

    const groupIndex = Math.min(this.groupByDimension, combination.selection.length - 1);
    return combination.selection[groupIndex] || 'default';
  }

  /**
   * Get variant name (remaining selections after group key)
   * @private
   * @param {Object} combination
   * @returns {string}
   */
  _getVariantName(combination) {
    if (!combination.selection || combination.selection.length <= 1) {
      return combination.name || 'default';
    }

    const otherSelections = combination.selection
      .filter((_, index) => index !== this.groupByDimension);

    return otherSelections.join(' + ') || combination.name;
  }

  /**
   * Update price range for a specific group
   * @private
   * @param {string} groupKey
   */
  _updateGroupPriceRange(groupKey) {
    const group = this.groups.get(groupKey);
    if (!group) return;

    let min = Infinity;
    let max = -Infinity;
    let hasValidPrices = false;

    group.variants.forEach(variant => {
      const price = variant.basePrice || 0;
      if (price > 0) {
        min = Math.min(min, price);
        max = Math.max(max, price);
        hasValidPrices = true;
      }
    });

    if (hasValidPrices) {
      group.priceRange = { min, max };
    } else {
      group.priceRange = { min: 0, max: 0 };
    }
  }

  /**
   * Toggle expanded state of a group
   * @param {string} groupKey
   */
  toggleGroup(groupKey) {
    const group = this.groups.get(groupKey);
    if (!group) return;

    group.expanded = !group.expanded;

    if (group.expanded) {
      this.expandedGroups.add(groupKey);
    } else {
      this.expandedGroups.delete(groupKey);
    }
  }

  /**
   * Toggle all groups expanded/collapsed
   * @param {boolean} expand - If provided, set all to this state
   */
  toggleAllGroups(expand = null) {
    const shouldExpand = expand !== null ? expand : this.expandedGroups.size < this.groups.size;

    this.groups.forEach((group, groupKey) => {
      group.expanded = shouldExpand;
      if (shouldExpand) {
        this.expandedGroups.add(groupKey);
      } else {
        this.expandedGroups.delete(groupKey);
      }
    });
  }

  /**
   * Change grouping dimension and reorganize
   * @param {number} dimensionIndex
   */
  changeGrouping(dimensionIndex) {
    if (dimensionIndex === this.groupByDimension || dimensionIndex >= this.dimensions.length) {
      return;
    }

    this.groupByDimension = dimensionIndex;
    this.expandedGroups.clear();
    this._initializeGroups();
  }

  /**
   * Update combination price and recalculate group ranges
   * @param {string} combinationId
   * @param {string} field - 'basePrice' or 'costPrice'
   * @param {number} value
   */
  updateCombinationPrice(combinationId, field, value) {
    // Update original combinations
    const combination = this.originalCombinations.find(c => c.id === combinationId);
    if (combination) {
      combination[field] = value;
    }

    // Find and update variant in groups
    for (const [groupKey, group] of this.groups) {
      const variant = group.variants.find(v => v.id === combinationId);
      if (variant) {
        variant[field] = value;
        this._updateGroupPriceRange(groupKey);
        break;
      }
    }
  }

  /**
   * Update all variants in a group with the same price
   * @param {string} groupKey
   * @param {string} field - 'basePrice' or 'costPrice'
   * @param {number} value
   * @returns {Array} Array of combination IDs that were updated
   */
  updateGroupPrice(groupKey, field, value) {
    const group = this.groups.get(groupKey);
    if (!group) return [];

    const updatedIds = [];

    // Update all variants in the group
    group.variants.forEach(variant => {
      variant[field] = value;
      updatedIds.push(variant.id);

      // Also update original combinations
      const combination = this.originalCombinations.find(c => c.id === variant.id);
      if (combination) {
        combination[field] = value;
      }
    });

    // Update price range for this group
    this._updateGroupPriceRange(groupKey);

    return updatedIds;
  }

  /**
   * Get the price value for a group - returns single value if all same, null if mixed
   * @param {string} groupKey
   * @param {string} field - 'basePrice' or 'costPrice'
   * @returns {number|null} Single price or null if mixed
   */
  getGroupPriceValue(groupKey, field) {
    const group = this.groups.get(groupKey);
    if (!group || group.variants.length === 0) return null;

    const firstPrice = group.variants[0][field] || 0;
    const allSame = group.variants.every(variant => (variant[field] || 0) === firstPrice);

    return allSame ? firstPrice : null;
  }

  /**
   * Get price range for display in group inputs
   * @param {string} groupKey
   * @param {string} field - 'basePrice', 'costPrice', or 'accountingCode'
   * @returns {string} Display value for input
   */
  getGroupPriceDisplay(groupKey, field) {
    const group = this.groups.get(groupKey);
    if (!group || group.variants.length === 0) return '';

    // Handle text fields (like accountingCode)
    if (field === 'accountingCode') {
      const values = group.variants.map(v => v[field] || '');
      const firstValue = values[0];
      const allSame = values.every(v => v === firstValue);
      return allSame ? firstValue : 'varios';
    }

    // Handle numeric fields (prices)
    const prices = group.variants.map(v => v[field] || 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    if (min === max) {
      return min.toString();
    } else {
      return `${min} - ${max}`;
    }
  }

  /**
   * Format price range for display
   * @param {Object} group
   * @returns {string}
   */
  formatPriceRange(group) {
    const { min, max } = group.priceRange;

    if (min === 0 && max === 0) {
      return '$0.00';
    }

    if (min === max) {
      return `$${min.toLocaleString('es-CO')}`;
    }

    return `$${min.toLocaleString('es-CO')} - $${max.toLocaleString('es-CO')}`;
  }

  /**
   * Get all groups as array for template iteration
   * @returns {Array}
   */
  getGroupsArray() {
    return Array.from(this.groups.entries()).map(([key, group]) => ({
      key,
      ...group,
    }));
  }

  /**
   * Get available dimensions for grouping dropdown
   * @returns {Array}
   */
  getAvailableGroupingOptions() {
    return this.dimensions.map((dimension, index) => ({
      value: index,
      label: dimension.label || dimension.type,
      selected: index === this.groupByDimension,
    }));
  }

  /**
   * Check if all groups are expanded
   * @returns {boolean}
   */
  get allExpanded() {
    return this.groups.size > 0 && this.expandedGroups.size === this.groups.size;
  }

  /**
   * Get total variant count across all groups
   * @returns {number}
   */
  get totalVariantCount() {
    return Array.from(this.groups.values()).reduce((sum, group) => sum + group.variants.length, 0);
  }

  /**
   * Get summary statistics for all variants
   * @returns {Object}
   */
  getSummaryStats() {
    const allVariants = Array.from(this.groups.values()).flatMap(group => group.variants);

    if (allVariants.length === 0) {
      return {
        withPrices: 0,
        total: 0,
        averagePrice: 0,
        averageCost: 0,
      };
    }

    const withPrices = allVariants.filter(v => (v.basePrice || 0) > 0).length;
    const totalPrice = allVariants.reduce((sum, v) => sum + (v.basePrice || 0), 0);
    const totalCost = allVariants.reduce((sum, v) => sum + (v.costPrice || 0), 0);

    const averagePrice = Math.round(totalPrice / allVariants.length);
    const averageCost = Math.round(totalCost / allVariants.length);

    return {
      withPrices,
      total: allVariants.length,
      averagePrice,
      averageCost,
    };
  }
}

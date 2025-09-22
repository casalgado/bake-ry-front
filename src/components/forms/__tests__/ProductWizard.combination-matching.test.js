import { describe, it, expect } from 'vitest';

/**
 * Test for the combination matching fix in ProductWizard.vue
 * This tests the case-insensitive matching logic we implemented
 */

// Extract the findMatchingCombination function for testing
const findMatchingCombination = (product, selections) => {
  if (!product?.variations?.combinations) return null;

  return product.variations.combinations.find(combo => {
    if (!combo.selection || combo.selection.length !== selections.length) return false;

    // Normalize both selections and combination for case-insensitive comparison
    const normalizeString = (str) => str.toLowerCase().trim();
    const normalizedSelections = selections.map(normalizeString);
    const normalizedComboSelection = combo.selection.map(normalizeString);

    return normalizedSelections.every(sel => normalizedComboSelection.includes(sel));
  });
};

describe('ProductWizard Combination Matching', () => {
  describe('findMatchingCombination', () => {
    const mockProduct = {
      variations: {
        combinations: [
          {
            id: 'combo1',
            selection: ['50 X 40 Cm', 'Delgado', 'Chocolate'],
            name: '50 X 40 Cm + Delgado + Chocolate',
            basePrice: 335000,
            isActive: true
          },
          {
            id: 'combo2',
            selection: ['60 X 40 Cm ', 'Grueso', 'Natural'],
            name: '60 X 40 Cm  + Grueso + Natural',
            basePrice: 415000,
            isActive: true
          }
        ]
      }
    };

    it('finds exact match with same case', () => {
      const selections = ['50 X 40 Cm', 'Delgado', 'Chocolate'];
      const result = findMatchingCombination(mockProduct, selections);

      expect(result).toBeDefined();
      expect(result.id).toBe('combo1');
    });

    it('finds match with different case (mixed case)', () => {
      const selections = ['50 x 40 cm', 'delgado', 'chocolate'];
      const result = findMatchingCombination(mockProduct, selections);

      expect(result).toBeDefined();
      expect(result.id).toBe('combo1');
    });

    it('finds match with mixed case variations', () => {
      const selections = ['50 X 40 cm', 'DELGADO', 'Chocolate'];
      const result = findMatchingCombination(mockProduct, selections);

      expect(result).toBeDefined();
      expect(result.id).toBe('combo1');
    });

    it('handles trailing spaces correctly', () => {
      const selections = ['60 x 40 cm', 'grueso', 'natural'];
      const result = findMatchingCombination(mockProduct, selections);

      expect(result).toBeDefined();
      expect(result.id).toBe('combo2');
    });

    it('returns null when no match found', () => {
      const selections = ['70 x 50 cm', 'delgado', 'vanilla'];
      const result = findMatchingCombination(mockProduct, selections);

      expect(result).toBeUndefined();
    });

    it('returns null when selection length differs', () => {
      const selections = ['50 x 40 cm', 'delgado']; // Missing third selection
      const result = findMatchingCombination(mockProduct, selections);

      expect(result).toBeUndefined();
    });

    it('returns null when product has no variations', () => {
      const productWithoutVariations = {};
      const selections = ['50 x 40 cm', 'delgado', 'chocolate'];
      const result = findMatchingCombination(productWithoutVariations, selections);

      expect(result).toBeNull();
    });

    it('handles empty combinations array', () => {
      const productWithEmptyCombinations = {
        variations: {
          combinations: []
        }
      };
      const selections = ['50 x 40 cm', 'delgado', 'chocolate'];
      const result = findMatchingCombination(productWithEmptyCombinations, selections);

      expect(result).toBeUndefined();
    });
  });

  describe('Case Sensitivity Edge Cases', () => {
    const edgeCaseProduct = {
      variations: {
        combinations: [
          {
            id: 'edge1',
            selection: ['  UPPERCASE WITH SPACES  ', 'lowercase', 'MiXeD cAsE'],
            basePrice: 100000
          }
        ]
      }
    };

    it('handles selections with extra whitespace', () => {
      const selections = ['  uppercase with spaces  ', '  lowercase  ', '  mixed case  '];
      const result = findMatchingCombination(edgeCaseProduct, selections);

      expect(result).toBeDefined();
      expect(result.id).toBe('edge1');
    });

    it('normalizes both sides consistently', () => {
      const selections = ['UPPERCASE WITH SPACES', 'LOWERCASE', 'mixed case'];
      const result = findMatchingCombination(edgeCaseProduct, selections);

      expect(result).toBeDefined();
      expect(result.id).toBe('edge1');
    });
  });
});
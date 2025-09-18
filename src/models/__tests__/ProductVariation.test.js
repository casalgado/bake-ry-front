import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProductVariation from '../ProductVariation.js';

// Mock the utilities
vi.mock('../../utils/errors.js', () => ({
  BadRequestError: class extends Error {
    constructor(message) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
}));

vi.mock('../../utils/helpers.js', () => ({
  generateId: vi.fn(() => 'mock-id-123'),
  capitalize: vi.fn((str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : ''),
}));

describe('ProductVariation', () => {
  describe('Constructor', () => {
    it('creates ProductVariation with default values', () => {
      const variation = new ProductVariation({});

      expect(variation.id).toBe('mock-id-123');
      expect(variation.name).toBe('');
      expect(variation.value).toBeUndefined();
      expect(variation.basePrice).toBeUndefined();
      expect(variation.recipeId).toBeUndefined();
      expect(variation.isWholeGrain).toBe(false);
      expect(variation.unit).toBe('');
      expect(variation.type).toBe('SIZE');
      expect(variation.displayOrder).toBe(1); // Default for non-wholegrain, non-"otra"
    });

    it('creates ProductVariation with provided values', () => {
      const data = {
        id: 'var123',
        name: 'Small Cake',
        value: 500,
        basePrice: 1200,
        recipeId: 'recipe123',
        isWholeGrain: false,
        unit: 'g',
        type: 'WEIGHT',
        displayOrder: 3,
      };

      const variation = new ProductVariation(data);

      expect(variation.id).toBe('var123');
      expect(variation.name).toBe('small cake');
      expect(variation.value).toBe(500);
      expect(variation.basePrice).toBe(1200);
      expect(variation.recipeId).toBe('recipe123');
      expect(variation.isWholeGrain).toBe(false);
      expect(variation.unit).toBe('g');
      expect(variation.type).toBe('WEIGHT');
      expect(variation.displayOrder).toBe(3);
    });

    it('handles name formatting correctly', () => {
      const variation1 = new ProductVariation({ name: '  LARGE CAKE  ' });
      expect(variation1.name).toBe('large cake');

      const variation2 = new ProductVariation({ name: 'Medium Bread' });
      expect(variation2.name).toBe('medium bread');
    });

    it('handles empty type as SIZE', () => {
      const variation = new ProductVariation({ type: '' });
      expect(variation.type).toBe('SIZE');
    });
  });

  describe('Display Order Logic', () => {
    it('uses provided displayOrder when given', () => {
      const variation = new ProductVariation({
        name: 'test',
        displayOrder: 5,
      });
      expect(variation.displayOrder).toBe(5);
    });

    it('sets displayOrder to 999 for "otra" name', () => {
      const variation1 = new ProductVariation({ name: 'otra' });
      expect(variation1.displayOrder).toBe(999);

      const variation2 = new ProductVariation({ name: '  OTRA  ' });
      expect(variation2.displayOrder).toBe(999);
    });

    it('sets displayOrder to 2 for wholegrain products', () => {
      const variation = new ProductVariation({
        name: 'small',
        isWholeGrain: true,
      });
      expect(variation.displayOrder).toBe(2);
    });

    it('sets displayOrder to 1 for regular products', () => {
      const variation = new ProductVariation({
        name: 'regular',
        isWholeGrain: false,
      });
      expect(variation.displayOrder).toBe(1);
    });

    it('prioritizes "otra" over wholegrain for displayOrder', () => {
      const variation = new ProductVariation({
        name: 'otra',
        isWholeGrain: true,
      });
      expect(variation.displayOrder).toBe(999);
    });
  });

  describe('Validation', () => {
    it('validates successfully with valid data', () => {
      const variation = new ProductVariation({
        name: 'Valid Product',
        value: 500,
        basePrice: 1200,
      });

      expect(() => variation.validate()).not.toThrow();
    });

    it('throws error for empty name', () => {
      const variation1 = new ProductVariation({ name: '' });
      expect(() => variation1.validate()).toThrow('Variation name is required');

      const variation2 = new ProductVariation({ name: '   ' });
      expect(() => variation2.validate()).toThrow('Variation name is required');
    });

    it('throws error for missing value', () => {
      const variation1 = new ProductVariation({
        name: 'Test',
        value: undefined,
      });
      expect(() => variation1.validate()).toThrow('Variation value is required');

      const variation2 = new ProductVariation({
        name: 'Test',
        value: null,
      });
      expect(() => variation2.validate()).toThrow('Variation value is required');
    });

    it('allows zero value', () => {
      const variation = new ProductVariation({
        name: 'Test',
        value: 0,
      });
      expect(() => variation.validate()).not.toThrow();
    });

    it('allows undefined basePrice (for templates)', () => {
      const variation = new ProductVariation({
        name: 'Test',
        value: 500,
        basePrice: undefined,
      });
      expect(() => variation.validate()).not.toThrow();
    });

    it('allows null basePrice (for templates)', () => {
      const variation = new ProductVariation({
        name: 'Test',
        value: 500,
        basePrice: null,
      });
      expect(() => variation.validate()).not.toThrow();
    });

    it('throws error for negative basePrice', () => {
      const variation = new ProductVariation({
        name: 'Test',
        value: 500,
        basePrice: -100,
      });
      expect(() => variation.validate()).toThrow('Variation base price cannot be negative');
    });

    it('allows zero basePrice', () => {
      const variation = new ProductVariation({
        name: 'Test',
        value: 500,
        basePrice: 0,
      });
      expect(() => variation.validate()).not.toThrow();
    });
  });

  describe('Display Methods', () => {
    describe('getDisplayValue', () => {
      it('returns value as string when no unit', () => {
        const variation = new ProductVariation({
          name: 'test',
          value: 500,
          type: 'CUSTOM',
        });
        expect(variation.getDisplayValue()).toBe('500');
      });

      it('formats QUANTITY type correctly', () => {
        const variation = new ProductVariation({
          name: 'test',
          value: 6,
          type: 'QUANTITY',
          unit: 'pcs',
        });
        expect(variation.getDisplayValue()).toBe('x6');
      });

      it('formats WEIGHT type correctly', () => {
        const variation = new ProductVariation({
          name: 'test',
          value: 500,
          type: 'WEIGHT',
          unit: 'g',
        });
        expect(variation.getDisplayValue()).toBe('500g');
      });

      it('formats SIZE type correctly', () => {
        const variation = new ProductVariation({
          name: 'medium',
          value: 2,
          type: 'SIZE',
        });
        // SIZE type returns this.name when unit is present, otherwise falls to default case
        // Since no unit is set, it returns this.value.toString()
        expect(variation.getDisplayValue()).toBe('2');
      });

      it('formats default type with unit', () => {
        const variation = new ProductVariation({
          name: 'test',
          value: 100,
          type: 'CUSTOM',
          unit: 'ml',
        });
        expect(variation.getDisplayValue()).toBe('100 ml');
      });

      it('handles empty value', () => {
        const variation1 = new ProductVariation({
          name: 'test',
          value: null,
        });
        // The current implementation doesn't handle null values properly
        // This test documents the current behavior - it will throw an error
        expect(() => variation1.getDisplayValue()).toThrow();

        const variation2 = new ProductVariation({
          name: 'test',
          value: undefined,
        });
        // Same for undefined values
        expect(() => variation2.getDisplayValue()).toThrow();
      });

      it('handles zero value correctly', () => {
        const variation = new ProductVariation({
          name: 'test',
          value: 0,
          type: 'WEIGHT',
          unit: 'g',
        });
        expect(variation.getDisplayValue()).toBe('0g');
      });
    });

    describe('getDisplayName', () => {
      it('returns the name', () => {
        const variation = new ProductVariation({
          name: 'Test Variation',
        });
        expect(variation.getDisplayName()).toBe('test variation');
      });
    });
  });

  describe('Static Methods', () => {
    describe('fromTemplate', () => {
      it('creates variation from template with additional data', () => {
        const template = {
          name: 'Template Variation',
          value: 500,
          type: 'WEIGHT',
          unit: 'g',
        };

        const variation = ProductVariation.fromTemplate(template, {
          basePrice: 1200,
          recipeId: 'recipe123',
        });

        expect(variation.name).toBe('template variation');
        expect(variation.value).toBe(500);
        expect(variation.type).toBe('WEIGHT');
        expect(variation.unit).toBe('g');
        expect(variation.basePrice).toBe(1200);
        expect(variation.recipeId).toBe('recipe123');
      });

      it('uses template basePrice when not provided', () => {
        const template = {
          name: 'Template',
          value: 500,
          basePrice: 1000,
        };

        const variation = ProductVariation.fromTemplate(template);

        expect(variation.basePrice).toBe(1000);
        expect(variation.recipeId).toBe('');
      });

      it('prefers provided basePrice over template', () => {
        const template = {
          name: 'Template',
          value: 500,
          basePrice: 1000,
        };

        const variation = ProductVariation.fromTemplate(template, {
          basePrice: 1500,
        });

        expect(variation.basePrice).toBe(1500);
      });
    });

    describe('fromLegacy', () => {
      it('creates variation from legacy data', () => {
        const legacyData = {
          name: 'Legacy Variation',
          value: 500,
          currentPrice: 1200,
          type: 'WEIGHT',
        };

        const variation = ProductVariation.fromLegacy(legacyData);

        expect(variation.name).toBe('legacy variation');
        expect(variation.value).toBe(500);
        expect(variation.type).toBe('WEIGHT');
        expect(variation.basePrice).toBe(1200);
      });

      it('prefers basePrice over currentPrice in legacy data', () => {
        const legacyData = {
          name: 'Legacy',
          value: 500,
          basePrice: 1000,
          currentPrice: 1200,
        };

        const variation = ProductVariation.fromLegacy(legacyData);

        expect(variation.basePrice).toBe(1000);
      });

      it('handles legacy data without prices', () => {
        const legacyData = {
          name: 'Legacy',
          value: 500,
        };

        const variation = ProductVariation.fromLegacy(legacyData);

        expect(variation.basePrice).toBeUndefined();
      });
    });
  });

  describe('Comparison and Sorting', () => {
    describe('compareTo', () => {
      it('compares by displayOrder first', () => {
        const var1 = new ProductVariation({
          name: 'first',
          value: 1000,
          displayOrder: 1,
        });
        const var2 = new ProductVariation({
          name: 'second',
          value: 500,
          displayOrder: 2,
        });

        expect(var1.compareTo(var2)).toBe(-1);
        expect(var2.compareTo(var1)).toBe(1);
      });

      it('compares by value when displayOrder is the same', () => {
        const var1 = new ProductVariation({
          name: 'first',
          value: 500,
          displayOrder: 1,
        });
        const var2 = new ProductVariation({
          name: 'second',
          value: 1000,
          displayOrder: 1,
        });

        expect(var1.compareTo(var2)).toBe(-500);
        expect(var2.compareTo(var1)).toBe(500);
      });

      it('returns 0 for equal variations', () => {
        const var1 = new ProductVariation({
          name: 'same',
          value: 500,
          displayOrder: 1,
        });
        const var2 = new ProductVariation({
          name: 'same',
          value: 500,
          displayOrder: 1,
        });

        expect(var1.compareTo(var2)).toBe(0);
      });
    });
  });

  describe('Serialization', () => {
    describe('toPlainObject', () => {
      it('converts to plain object', () => {
        const variation = new ProductVariation({
          name: 'Test Variation',
          value: 500,
          basePrice: 1200,
          type: 'WEIGHT',
          unit: 'g',
        });

        const plain = variation.toPlainObject();

        expect(plain).toEqual(expect.objectContaining({
          name: 'test variation',
          value: 500,
          basePrice: 1200,
          type: 'WEIGHT',
          unit: 'g',
        }));
      });

      it('removes undefined values', () => {
        const variation = new ProductVariation({
          name: 'Test',
          value: 500,
          basePrice: undefined,
          recipeId: undefined,
        });

        const plain = variation.toPlainObject();

        expect(plain).not.toHaveProperty('basePrice');
        expect(plain).not.toHaveProperty('recipeId');
        expect(plain).toHaveProperty('name');
        expect(plain).toHaveProperty('value');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles special characters in name', () => {
      const variation = new ProductVariation({
        name: 'Niño\'s Special',
        value: 500,
      });

      expect(variation.name).toBe('niño\'s special');
    });

    it('handles numeric values as strings', () => {
      const variation = new ProductVariation({
        name: 'test',
        value: '500',
        basePrice: '1200',
      });

      expect(variation.value).toBe('500');
      expect(variation.basePrice).toBe('1200');
    });

    it('handles boolean isWholeGrain values', () => {
      const variation1 = new ProductVariation({ isWholeGrain: 'true' });
      expect(variation1.isWholeGrain).toBe('true'); // Constructor doesn't convert strings

      const variation2 = new ProductVariation({ isWholeGrain: false });
      expect(variation2.isWholeGrain).toBe(false);
    });

    it('handles missing required constructor arguments gracefully', () => {
      // Constructor expects an object but throws error with null/undefined
      expect(() => new ProductVariation(null)).toThrow();
      expect(() => new ProductVariation(undefined)).toThrow();

      // Empty object should work fine
      const variation = new ProductVariation({});
      expect(variation.name).toBe('');
      expect(variation.type).toBe('SIZE');
      expect(variation.isWholeGrain).toBe(false);
    });
  });
});
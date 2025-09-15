import { describe, it, expect, vi, beforeEach } from 'vitest';
import VariationGroups from '../VariationGroups.js';

// Mock generateId
vi.mock('../../utils/helpers.js', () => ({
  generateId: vi.fn(() => Math.random().toString(36).substring(2, 18)),
}));

describe('VariationGroups - Constructor and Basic Operations', () => {
  describe('Constructor', () => {
    it('creates empty VariationGroups with defaults', () => {
      const vg = new VariationGroups();

      expect(vg.dimensions).toEqual([]);
      expect(vg.combinations).toEqual([]);
    });

    it('creates VariationGroups with provided dimensions and combinations', () => {
      const data = {
        dimensions: [{
          id: 'existing-dim',
          type: 'WEIGHT',
          label: 'Weight',
          options: [{ name: 'small', value: 500 }],
        }],
        combinations: [{
          id: 'existing-combo',
          selection: ['small'],
          basePrice: 1200,
        }],
      };

      const vg = new VariationGroups(data);

      expect(vg.dimensions).toHaveLength(1);
      expect(vg.combinations).toHaveLength(1);
      expect(vg.dimensions[0].id).toBe('existing-dim');
      expect(vg.combinations[0].id).toBe('existing-combo');
    });
  });

  describe('Price Management', () => {
    it('returns price data for existing combination', () => {
      const vg = new VariationGroups({
        combinations: [{
          id: 'combo1',
          basePrice: 1500,
          costPrice: 800,
        }],
      });

      const price = vg.getCombinationPrice('combo1');

      expect(price.totalPrice).toBe(1500);
      expect(price.totalCost).toBe(800);
      expect(price.profit).toBe(700);
      expect(price.profitMargin).toBe('46.67');
    });

    it('returns zero values for non-existent combination', () => {
      const vg = new VariationGroups();
      const price = vg.getCombinationPrice('nonexistent');

      expect(price.totalPrice).toBe(0);
      expect(price.totalCost).toBe(0);
      expect(price.profit).toBe(0);
      expect(price.profitMargin).toBe(0);
    });
  });

  describe('Validation', () => {
    it('validates dimension type', () => {
      const vg = new VariationGroups({
        dimensions: [{
          id: 'dim1',
          options: [],
        }],
      });

      const errors = vg.validate();
      expect(errors).toContain('Dimension 0: type is required');
    });

    it('validates combination basePrice', () => {
      const vg = new VariationGroups({
        combinations: [{
          id: 'combo1',
          selection: ['small'],
          basePrice: -100,
        }],
      });

      const errors = vg.validate();
      expect(errors).toContain('Combination 0: basePrice must be non-negative');
    });
  });

  describe('Legacy Conversion', () => {
    it('converts flat variations to VariationGroups', () => {
      const legacyVariations = [
        {
          id: 'var1',
          name: 'small',
          type: 'WEIGHT',
          value: 500,
          unit: 'g',
          basePrice: 1200,
          costPrice: 600,
          isWholeGrain: false,
        },
        {
          id: 'var2',
          name: 'large',
          type: 'WEIGHT',
          value: 1000,
          unit: 'g',
          basePrice: 2000,
          costPrice: 1000,
          isWholeGrain: false,
        },
      ];

      const vg = VariationGroups.fromLegacyVariations(legacyVariations);

      expect(vg).toBeInstanceOf(VariationGroups);
      expect(vg.dimensions).toHaveLength(1);
      expect(vg.dimensions[0].type).toBe('WEIGHT');
      expect(vg.dimensions[0].unit).toBe('g');
      expect(vg.dimensions[0].options).toHaveLength(2);
      expect(vg.combinations).toHaveLength(2);
    });
  });
});

describe('VariationGroups - Display Order', () => {
  let variationGroup;

  beforeEach(() => {
    // Create a variation group with test data similar to the user's example
    variationGroup = new VariationGroups({
      dimensions: [
        {
          id: 'test-dim-1',
          type: 'SIZE',
          label: 'SIZE',
          unit: '',
          displayOrder: 0,
          options: [
            { name: 'pequeño', value: 500, isWholeGrain: false, displayOrder: 1 },
            { name: 'mediano', value: 950, isWholeGrain: false, displayOrder: 1 },
            { name: 'grande', value: 1700, isWholeGrain: false, displayOrder: 1 },
            { name: 'pequeño integral', value: 500, isWholeGrain: true, displayOrder: 2 },
            { name: 'mediano integral', value: 950, isWholeGrain: true, displayOrder: 2 },
            { name: 'grande integral', value: 1700, isWholeGrain: true, displayOrder: 2 },
            { name: 'rectangular mediano', value: 0, isWholeGrain: false, displayOrder: 3 },
            { name: 'otra', value: 1000, isWholeGrain: false, displayOrder: 999 },
          ],
        },
      ],
      combinations: [],
    });
  });

  describe('normalizeOptionDisplayOrders', () => {
    it('should normalize display orders to sequential values', () => {
      // Initially we have duplicate display orders: 1,1,1,2,2,2,3,999
      const dimensionId = 'test-dim-1';

      // Normalize the display orders
      variationGroup.normalizeOptionDisplayOrders(dimensionId);

      // Get the normalized options
      const options = variationGroup.getDimensionById(dimensionId).options;

      // Check that display orders are now sequential: 1,2,3,4,5,6,7,8
      expect(options[0].displayOrder).toBe(1);
      expect(options[1].displayOrder).toBe(2);
      expect(options[2].displayOrder).toBe(3);
      expect(options[3].displayOrder).toBe(4);
      expect(options[4].displayOrder).toBe(5);
      expect(options[5].displayOrder).toBe(6);
      expect(options[6].displayOrder).toBe(7);
      expect(options[7].displayOrder).toBe(8);

      // Check that the order of options hasn't changed
      expect(options[0].name).toBe('pequeño');
      expect(options[1].name).toBe('mediano');
      expect(options[2].name).toBe('grande');
      expect(options[3].name).toBe('pequeño integral');
      expect(options[4].name).toBe('mediano integral');
      expect(options[5].name).toBe('grande integral');
      expect(options[6].name).toBe('rectangular mediano');
      expect(options[7].name).toBe('otra');
    });
  });

  describe('moveOptionUpDown', () => {
    it('should move option up correctly', () => {
      const dimensionId = 'test-dim-1';

      // Normalize first to have sequential orders
      variationGroup.normalizeOptionDisplayOrders(dimensionId);

      // Move 'mediano' (position 2) up
      variationGroup.moveOptionUpDown(dimensionId, 'mediano', 'up');

      const options = variationGroup.getDimensionById(dimensionId).options;

      // 'mediano' should now be at position 0, 'pequeño' at position 1
      expect(options[0].name).toBe('mediano');
      expect(options[1].name).toBe('pequeño');

      // Display orders should be sequential
      expect(options[0].displayOrder).toBe(1);
      expect(options[1].displayOrder).toBe(2);
    });

    it('should move option down correctly', () => {
      const dimensionId = 'test-dim-1';

      // Normalize first to have sequential orders
      variationGroup.normalizeOptionDisplayOrders(dimensionId);

      // Move 'pequeño' (position 1) down
      variationGroup.moveOptionUpDown(dimensionId, 'pequeño', 'down');

      const options = variationGroup.getDimensionById(dimensionId).options;

      // 'mediano' should now be at position 0, 'pequeño' at position 1
      expect(options[0].name).toBe('mediano');
      expect(options[1].name).toBe('pequeño');

      // Display orders should be sequential
      expect(options[0].displayOrder).toBe(1);
      expect(options[1].displayOrder).toBe(2);
    });

    it('should not move first option up', () => {
      const dimensionId = 'test-dim-1';
      variationGroup.normalizeOptionDisplayOrders(dimensionId);

      const optionsBefore = [...variationGroup.getDimensionById(dimensionId).options];

      // Try to move first option up (should do nothing)
      variationGroup.moveOptionUpDown(dimensionId, 'pequeño', 'up');

      const optionsAfter = variationGroup.getDimensionById(dimensionId).options;

      // Order should remain the same
      expect(optionsAfter[0].name).toBe(optionsBefore[0].name);
    });

    it('should not move last option down', () => {
      const dimensionId = 'test-dim-1';
      variationGroup.normalizeOptionDisplayOrders(dimensionId);

      const optionsBefore = [...variationGroup.getDimensionById(dimensionId).options];

      // Try to move last option down (should do nothing)
      variationGroup.moveOptionUpDown(dimensionId, 'otra', 'down');

      const optionsAfter = variationGroup.getDimensionById(dimensionId).options;

      // Order should remain the same
      expect(optionsAfter[7].name).toBe(optionsBefore[7].name);
    });
  });

  describe('moveOptionToPosition', () => {
    it('should move option to specific position', () => {
      const dimensionId = 'test-dim-1';

      // Normalize first to have sequential orders
      variationGroup.normalizeOptionDisplayOrders(dimensionId);

      // Move 'grande' (position 3) to position 7
      variationGroup.moveOptionToPosition(dimensionId, 'grande', 7);

      const options = variationGroup.getDimensionById(dimensionId).options;

      // 'grande' should now be at position 6 (0-indexed)
      expect(options[6].name).toBe('grande');

      // Display orders should be sequential
      for (let i = 0; i < options.length; i++) {
        expect(options[i].displayOrder).toBe(i + 1);
      }
    });

    it('should handle moving to position 1', () => {
      const dimensionId = 'test-dim-1';
      variationGroup.normalizeOptionDisplayOrders(dimensionId);

      // Move 'otra' (last position) to position 1
      variationGroup.moveOptionToPosition(dimensionId, 'otra', 1);

      const options = variationGroup.getDimensionById(dimensionId).options;

      // 'otra' should now be at position 0
      expect(options[0].name).toBe('otra');
      expect(options[0].displayOrder).toBe(1);
    });
  });

  describe('getSortedOptions', () => {
    it('should return options sorted by display order', () => {
      const dimensionId = 'test-dim-1';

      // Get sorted options (should be sorted by current display orders)
      const sortedOptions = variationGroup.getSortedOptions(dimensionId);

      // With initial display orders 1,1,1,2,2,2,3,999
      // The order should be maintained as defined
      expect(sortedOptions[0].name).toBe('pequeño');
      expect(sortedOptions[7].name).toBe('otra');
    });

    it('should reflect changes after moving options', () => {
      const dimensionId = 'test-dim-1';

      // Normalize and move an option
      variationGroup.normalizeOptionDisplayOrders(dimensionId);
      variationGroup.moveOptionUpDown(dimensionId, 'grande', 'down');

      const sortedOptions = variationGroup.getSortedOptions(dimensionId);

      // 'grande' should have moved down one position
      expect(sortedOptions[3].name).toBe('grande');
      expect(sortedOptions[2].name).toBe('pequeño integral');
    });
  });

  describe('toPlainObject and reconstruction', () => {
    it('should preserve display orders when converting to plain object and back', () => {
      const dimensionId = 'test-dim-1';

      // Normalize and make some changes
      variationGroup.normalizeOptionDisplayOrders(dimensionId);
      variationGroup.moveOptionUpDown(dimensionId, 'mediano', 'down');

      // Convert to plain object
      const plainObj = variationGroup.toPlainObject();

      // Create new instance from plain object
      const newVariationGroup = new VariationGroups(plainObj);

      // Check that the order is preserved
      const options = newVariationGroup.getDimensionById(dimensionId).options;
      expect(options[1].name).toBe('grande');
      expect(options[2].name).toBe('mediano');

      // Display orders should still be sequential
      for (let i = 0; i < options.length; i++) {
        expect(options[i].displayOrder).toBe(i + 1);
      }
    });
  });

  describe('Multiple dimensions', () => {
    beforeEach(() => {
      // Create a variation group with multiple dimensions
      variationGroup = new VariationGroups({
        dimensions: [
          {
            id: 'dim-1',
            type: 'SIZE',
            label: 'Size',
            displayOrder: 1,
            options: [
              { name: 'small', value: 1, displayOrder: 1 },
              { name: 'large', value: 2, displayOrder: 2 },
            ],
          },
          {
            id: 'dim-2',
            type: 'COLOR',
            label: 'Color',
            displayOrder: 2,
            options: [
              { name: 'red', value: 1, displayOrder: 1 },
              { name: 'blue', value: 2, displayOrder: 2 },
            ],
          },
        ],
        combinations: [],
      });
    });

    it('should move dimensions up and down', () => {
      // Move second dimension up
      variationGroup.moveDimensionUpDown('dim-2', 'up');

      const dimensions = variationGroup.dimensions;

      // Color should now be first
      expect(dimensions[0].id).toBe('dim-2');
      expect(dimensions[1].id).toBe('dim-1');

      // Display orders should be updated
      expect(dimensions[0].displayOrder).toBe(1);
      expect(dimensions[1].displayOrder).toBe(2);
    });

    it('should get sorted dimensions', () => {
      const sortedDimensions = variationGroup.getSortedDimensions();

      // Should be sorted by display order
      expect(sortedDimensions[0].id).toBe('dim-1');
      expect(sortedDimensions[1].id).toBe('dim-2');
    });
  });
});
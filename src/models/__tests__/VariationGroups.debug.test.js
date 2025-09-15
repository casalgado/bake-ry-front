import { describe, it, expect } from 'vitest';
import VariationGroups from '../VariationGroups';

describe('Debug VariationGroups', () => {
  it('should debug moveOptionToPosition', () => {
    const vg = new VariationGroups({
      dimensions: [{
        id: 'test-dim-1',
        type: 'SIZE',
        label: 'SIZE',
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
      }],
      combinations: [],
    });

    const dimensionId = 'test-dim-1';

    console.log('Initial options:', vg.getDimensionById(dimensionId).options.map(o => o.name));

    // Normalize first
    vg.normalizeOptionDisplayOrders(dimensionId);
    console.log('After normalize:', vg.getDimensionById(dimensionId).options.map(o => o.name));

    // Find position of 'grande'
    const grandeIndex = vg.getDimensionById(dimensionId).options.findIndex(o => o.name === 'grande');
    console.log('Position of grande:', grandeIndex, '(0-based), so position', grandeIndex + 1, '(1-based)');

    // Move 'grande' to position 7 (1-based)
    console.log('Moving grande from position', grandeIndex + 1, '(1-based) to position 7 (1-based)...');
    console.log('This means from index', grandeIndex, 'to index 6 (0-based)');
    vg.moveOptionToPosition(dimensionId, 'grande', 7);

    const options = vg.getDimensionById(dimensionId).options;
    console.log('After move:', options.map(o => o.name));
    console.log('Position 6 (0-indexed):', options[6]?.name);
    console.log('Expected at position 6: grande');
    console.log('Test result:', options[6]?.name === 'grande' ? 'PASS' : 'FAIL');

    // Test moving 'otra' to position 1
    console.log('\n=== Test moving otra to position 1 ===');
    vg.normalizeOptionDisplayOrders(dimensionId);
    console.log('Before move:', vg.getDimensionById(dimensionId).options.map(o => o.name));

    vg.moveOptionToPosition(dimensionId, 'otra', 1);
    console.log('After moving otra to position 1:', vg.getDimensionById(dimensionId).options.map(o => o.name));
    console.log('Position 0:', vg.getDimensionById(dimensionId).options[0]?.name);
  });

  it('should debug moveOption', () => {
    const vg = new VariationGroups({
      dimensions: [{
        id: 'test-dim',
        type: 'SIZE',
        label: 'Size',
        options: [
          { name: 'A', value: 1, displayOrder: 1 },
          { name: 'B', value: 2, displayOrder: 2 },
          { name: 'C', value: 3, displayOrder: 3 },
        ],
      }],
      combinations: [],
    });

    console.log('Initial options:', vg.dimensions[0].options.map(o => o.name));

    // Try to move B up (should swap A and B)
    vg.moveOptionUpDown('test-dim', 'B', 'up');
    console.log('After moving B up:', vg.dimensions[0].options.map(o => o.name));

    // Reset
    vg.dimensions[0].options = [
      { name: 'A', value: 1, displayOrder: 1 },
      { name: 'B', value: 2, displayOrder: 2 },
      { name: 'C', value: 3, displayOrder: 3 },
    ];

    // Try direct moveOption
    console.log('Before moveOption(0, 1):', vg.dimensions[0].options.map(o => o.name));
    vg.moveOption('test-dim', 0, 1);
    console.log('After moveOption(0, 1):', vg.dimensions[0].options.map(o => o.name));

    // Reset again
    vg.dimensions[0].options = [
      { name: 'A', value: 1, displayOrder: 1 },
      { name: 'B', value: 2, displayOrder: 2 },
      { name: 'C', value: 3, displayOrder: 3 },
    ];

    // Test moveOption with different indices
    console.log('\n=== Testing moveOption scenarios ===');
    console.log('Initial:', vg.dimensions[0].options.map(o => o.name));

    // Move C (index 2) to position 1
    vg.moveOption('test-dim', 2, 0);
    console.log('After moving C (index 2) to position 0:', vg.dimensions[0].options.map(o => o.name));

    // Reset for next test
    vg.dimensions[0].options = [
      { name: 'A', value: 1, displayOrder: 1 },
      { name: 'B', value: 2, displayOrder: 2 },
      { name: 'C', value: 3, displayOrder: 3 },
      { name: 'D', value: 4, displayOrder: 4 },
    ];

    console.log('\nWith 4 items:', vg.dimensions[0].options.map(o => o.name));
    vg.moveOption('test-dim', 0, 3);
    console.log('After moving A (index 0) to position 3:', vg.dimensions[0].options.map(o => o.name));

    // Test the splice logic directly
    const options = [1, 2, 3, 4];
    console.log('\n=== Direct splice test ===');
    console.log('Array:', options);
    const [removed] = options.splice(0, 1); // Remove first
    console.log('After removing index 0:', options, 'Removed:', removed);
    options.splice(2, 0, removed); // Insert at index 2
    console.log('After inserting at index 2:', options);
  });
});
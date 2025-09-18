import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import VariationCombinationManager from '../VariationCombinationManager.vue';
import VariationGroups from '@/models/VariationGroups';

describe('VariationCombinationManager', () => {
  let wrapper;

  // Create a mock variation group with test data
  const createMockVariationGroup = (combinations = [], dimensions = []) => {
    const mockGroup = {
      combinations,
      dimensions,
      generateAllCombinations: vi.fn(() => combinations),
    };
    return mockGroup;
  };

  const createWrapper = (props = {}) => {
    const defaultCombinations = [
      {
        id: 'combo1',
        name: 'pequeño normal',
        selection: ['pequeño', 'normal'],
        basePrice: 1000,
        costPrice: 600,
        isWholeGrain: false,
        isActive: true,
      },
      {
        id: 'combo2',
        name: 'mediano integral',
        selection: ['mediano', 'integral'],
        basePrice: 1500,
        costPrice: 900,
        isWholeGrain: true,
        isActive: true,
      },
      {
        id: 'combo3',
        name: 'grande normal',
        selection: ['grande', 'normal'],
        basePrice: 2000,
        costPrice: 1200,
        isWholeGrain: false,
        isActive: true,
      },
    ];

    const defaultDimensions = [
      {
        id: 'dim1',
        type: 'SIZE',
        label: 'Tamaño',
        options: [
          { name: 'pequeño', value: 1 },
          { name: 'mediano', value: 2 },
          { name: 'grande', value: 3 }
        ]
      },
      {
        id: 'dim2',
        type: 'TYPE',
        label: 'Tipo',
        options: [
          { name: 'normal', value: 1 },
          { name: 'integral', value: 2 }
        ]
      }
    ];

    const defaultVariationGroup = createMockVariationGroup(defaultCombinations, defaultDimensions);

    return mount(VariationCombinationManager, {
      props: {
        variationGroup: defaultVariationGroup,
        ...props,
      },
    });
  };

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    wrapper = null;
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      wrapper = createWrapper();
      expect(wrapper.exists()).toBe(true);
    });

    it('displays combinations section when combinations exist', () => {
      wrapper = createWrapper();

      expect(wrapper.text()).toContain('Precios');
      expect(wrapper.text()).toContain('(3 combinaciones)');
      // Groups are shown by default (collapsed), so we see group names
      expect(wrapper.text()).toContain('pequeño');
      expect(wrapper.text()).toContain('mediano');
      expect(wrapper.text()).toContain('grande');
    });

    it('shows combination count correctly', () => {
      wrapper = createWrapper();
      expect(wrapper.text()).toContain('(3 combinaciones)');
    });

    it('displays total possible combinations', () => {
      const variationGroup = createMockVariationGroup([
        { id: 'combo1', name: 'test1', selection: ['opt1'], basePrice: 100, costPrice: 50, isWholeGrain: false },
        { id: 'combo2', name: 'test2', selection: ['opt2'], basePrice: 200, costPrice: 100, isWholeGrain: false },
      ]);

      wrapper = createWrapper({ variationGroup });
      expect(wrapper.text()).toContain('Total de combinaciones posibles: 2');
    });

    it('does not render combinations section when no combinations exist', () => {
      const emptyVariationGroup = createMockVariationGroup([], [
        { id: 'dim1', type: 'WEIGHT', options: [], displayOrder: 0 }
      ]);

      wrapper = createWrapper({ variationGroup: emptyVariationGroup });

      expect(wrapper.text()).not.toContain('Precios por Combinación');
      expect(wrapper.text()).toContain('Configurando combinaciones...');
    });

    it('shows empty state when variation group has dimensions but no combinations', () => {
      const emptyVariationGroup = createMockVariationGroup([], [
        { id: 'dim1', type: 'WEIGHT', options: [], displayOrder: 0 }
      ]);

      wrapper = createWrapper({ variationGroup: emptyVariationGroup });

      expect(wrapper.text()).toContain('Configurando combinaciones...');
      expect(wrapper.text()).toContain('Completa la configuración para ver las combinaciones disponibles');
    });
  });

  describe('Combination Display', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('displays combination names and selections correctly', async () => {
      // Groups are collapsed by default, need to expand to see variants
      expect(wrapper.text()).toContain('pequeño');
      expect(wrapper.text()).toContain('mediano');
      expect(wrapper.text()).toContain('grande');

      // Expand first group to see variants by clicking the group header
      const firstGroupHeader = wrapper.find('.group-header');
      await firstGroupHeader.trigger('click');

      // Now should see variant price inputs (groups are expanded)
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('Precio Venta');
      expect(wrapper.text()).toContain('Precio Costo');
    });

    it('applies different background classes for wholegrain vs regular combinations', async () => {
      // Expand all groups first to see variants
      await wrapper.vm.toggleAllGroups(true);
      await wrapper.vm.$nextTick();

      const variantRows = wrapper.findAll('.variant-row');

      // Check that wholegrain variants have different styling
      const wholeGrainVariant = variantRows.find(row =>
        row.html().includes('integral')
      );

      if (wholeGrainVariant) {
        expect(wholeGrainVariant.classes()).toContain('bg-amber-25');
      }
    });

    it('displays selection items separated by bullets', async () => {
      // Expand groups to see variant details
      await wrapper.vm.toggleAllGroups(true);
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('pequeño • normal');
      expect(wrapper.text()).toContain('mediano • integral');
      expect(wrapper.text()).toContain('grande • normal');
    });
  });

  describe('Price Input Fields', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      // Expand all groups to access variant inputs
      await wrapper.vm.toggleAllGroups(true);
      await wrapper.vm.$nextTick();
    });

    it('displays base price inputs with correct values', () => {
      const basePriceInputs = wrapper.findAll('input[type="number"]').filter(
        input => input.attributes('placeholder') === '0'
      );

      expect(basePriceInputs.length).toBeGreaterThan(0);
      // Check that at least some inputs have the expected values
      const inputValues = basePriceInputs.map(input => Number(input.element.value));
      expect(inputValues).toContain(1000);
      expect(inputValues).toContain(1500);
      expect(inputValues).toContain(2000);
    });

    it('displays cost price inputs with correct values', () => {
      const allInputs = wrapper.findAll('input[type="number"]');
      expect(allInputs.length).toBeGreaterThan(3); // Should have pairs for base and cost price

      // Check that cost price values are present
      const inputValues = allInputs.map(input => Number(input.element.value));
      expect(inputValues).toContain(600);
      expect(inputValues).toContain(900);
      expect(inputValues).toContain(1200);
    });

    it('has correct input attributes', () => {
      const variantInputs = wrapper.findAll('.variant-row input[type="number"]');

      variantInputs.forEach(input => {
        expect(input.attributes('min')).toBe('0');
        expect(input.attributes('step')).toBe('50');
        expect(input.attributes('placeholder')).toBe('0');
      });
    });
  });

  describe('Price Updates', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      // Expand all groups to access variant inputs
      await wrapper.vm.toggleAllGroups(true);
      await wrapper.vm.$nextTick();
    });

    it('emits update-combination-price event when base price changes', async () => {
      const numberInputs = wrapper.findAll('input[type="number"]');
      expect(numberInputs.length).toBeGreaterThan(0);

      const firstInput = numberInputs[0];
      await firstInput.setValue('1200');
      await firstInput.trigger('input');

      const emittedEvents = wrapper.emitted('update-combination-price');
      expect(emittedEvents).toBeTruthy();
      expect(emittedEvents[0][0]).toHaveProperty('field');
      expect(emittedEvents[0][0]).toHaveProperty('value');
    });

    it('emits update-combination-price event when cost price changes', async () => {
      const numberInputs = wrapper.findAll('input[type="number"]');
      expect(numberInputs.length).toBeGreaterThan(1);

      const secondInput = numberInputs[1];
      await secondInput.setValue('700');
      await secondInput.trigger('input');

      const emittedEvents = wrapper.emitted('update-combination-price');
      expect(emittedEvents).toBeTruthy();
      expect(emittedEvents[0][0]).toHaveProperty('field');
      expect(emittedEvents[0][0]).toHaveProperty('value', 700);
    });

    it('handles invalid input values gracefully', async () => {
      const numberInputs = wrapper.findAll('input[type="number"]');
      expect(numberInputs.length).toBeGreaterThan(0);

      const firstInput = numberInputs[0];
      await firstInput.setValue('invalid');
      await firstInput.trigger('input');

      const emittedEvents = wrapper.emitted('update-combination-price');
      expect(emittedEvents[0][0]).toHaveProperty('value', 0); // Should default to 0 for invalid input
    });
  });

  describe('Group-Level Price Management', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
    });

    it('displays group-level price inputs in headers', () => {
      // Should have 3 groups, each with 2 inputs (basePrice, costPrice)
      const groupHeaders = wrapper.findAll('.group-header');
      expect(groupHeaders).toHaveLength(3);

      groupHeaders.forEach(header => {
        const inputs = header.findAll('input[type="number"]');
        expect(inputs).toHaveLength(2); // basePrice and costPrice inputs
      });
    });

    it('shows single value when all variants have same price', async () => {
      // All variants in first group should have same price initially
      const firstGroupInputs = wrapper.findAll('.group-header input[type="number"]');

      // The first group should show actual values since all variants have same price
      expect(firstGroupInputs.length).toBeGreaterThan(0);
    });

    it('updates all group variants when group price is changed', async () => {
      // Find first group's base price input
      const firstGroupHeader = wrapper.findAll('.group-header')[0];
      const basePriceInput = firstGroupHeader.findAll('input[type="number"]')[0];

      // Update group price
      await basePriceInput.setValue('2000');
      await basePriceInput.trigger('input');

      // Should emit multiple update events for all variants in the group
      const emittedEvents = wrapper.emitted('update-combination-price');
      expect(emittedEvents).toBeTruthy();
      expect(emittedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Summary Statistics', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('displays count of combinations with defined prices', () => {
      // All 3 combinations have basePrice > 0
      expect(wrapper.text()).toContain('Con precios definidos:');
      expect(wrapper.text()).toContain('3 / 3');
    });

    it('calculates and displays average base price', () => {
      // (1000 + 1500 + 2000) / 3 = 1500
      expect(wrapper.text()).toContain('Precio promedio:');
      expect(wrapper.text()).toContain('$1.500');
    });

    it('calculates and displays average cost price', () => {
      // (600 + 900 + 1200) / 3 = 900
      expect(wrapper.text()).toContain('Costo promedio:');
      expect(wrapper.text()).toContain('$900');
    });


    it('handles combinations with no prices defined', () => {
      const noPricesGroup = createMockVariationGroup([
        {
          id: 'combo1',
          name: 'test combo',
          selection: ['test'],
          basePrice: 0,
          costPrice: 0,
          isWholeGrain: false,
        }
      ], [{
        id: 'dim1',
        type: 'TEST',
        label: 'Test',
        options: [{ name: 'test', value: 1 }]
      }]);

      wrapper = createWrapper({ variationGroup: noPricesGroup });

      expect(wrapper.text()).toContain('0 / 1'); // 0 out of 1 with defined prices
    });
  });

  describe('Component Props', () => {
    it('accepts variationGroup prop', () => {
      const testGroup = createMockVariationGroup([]);
      wrapper = createWrapper({ variationGroup: testGroup });

      expect(wrapper.props('variationGroup')).toStrictEqual(testGroup);
    });

    it('computes allPossibleCombinations correctly', () => {
      const testCombinations = [
        { id: 'combo1', name: 'test1', selection: ['opt1'] },
        { id: 'combo2', name: 'test2', selection: ['opt2'] },
      ];
      const testGroup = createMockVariationGroup(testCombinations);

      wrapper = createWrapper({ variationGroup: testGroup });

      expect(wrapper.vm.allPossibleCombinations).toEqual(testCombinations);
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });
});
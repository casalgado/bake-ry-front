import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CombinedProductionInfoCell from '../CombinedProductionInfoCell.vue';
import Combination from '@/models/Combination.js';

describe('CombinedProductionInfoCell', () => {
  const baseProps = {
    productName: 'Pan Francés',
    totalQuantity: 5,
  };

  describe('Legacy variation display', () => {
    it('displays variation name when only variation is provided', () => {
      const wrapper = mount(CombinedProductionInfoCell, {
        props: {
          ...baseProps,
          variation: { name: 'Grande' },
        },
      });

      expect(wrapper.text()).toBe('5 Pan Francés Grande');
    });

    it('displays product name only when variation name is empty', () => {
      const wrapper = mount(CombinedProductionInfoCell, {
        props: {
          ...baseProps,
          variation: { name: '' },
        },
      });

      expect(wrapper.text()).toBe('5 Pan Francés');
    });

    it('displays product name only when no variation is provided', () => {
      const wrapper = mount(CombinedProductionInfoCell, {
        props: baseProps,
      });

      expect(wrapper.text()).toBe('5 Pan Francés');
    });
  });

  describe('New combination display', () => {
    it('displays combination name when combination is provided', () => {
      const combination = new Combination({
        name: 'Mediano Integral',
        selection: ['Mediano', 'Integral'],
      });

      const wrapper = mount(CombinedProductionInfoCell, {
        props: {
          ...baseProps,
          combination,
        },
      });

      expect(wrapper.text()).toBe('5 Pan Francés Mediano Integral');
    });

    it('displays combination selection when name is not provided', () => {
      const combination = new Combination({
        selection: ['Grande', 'Con Semillas'],
      });

      const wrapper = mount(CombinedProductionInfoCell, {
        props: {
          ...baseProps,
          combination,
        },
      });

      expect(wrapper.text()).toBe('5 Pan Francés Grande + Con Semillas');
    });

    it('prioritizes combination over variation when both are provided', () => {
      const combination = new Combination({
        name: 'Mediano Integral',
      });

      const wrapper = mount(CombinedProductionInfoCell, {
        props: {
          ...baseProps,
          combination,
          variation: { name: 'Grande' },
        },
      });

      expect(wrapper.text()).toBe('5 Pan Francés Mediano Integral');
    });
  });

  describe('Migration scenarios', () => {
    it('handles legacy variation converted to combination', () => {
      const legacyVariation = { name: 'Extra Grande', basePrice: 2500 };
      const combination = Combination.fromLegacyVariation(legacyVariation);

      const wrapper = mount(CombinedProductionInfoCell, {
        props: {
          ...baseProps,
          combination,
          variation: legacyVariation,
        },
      });

      expect(wrapper.text()).toBe('5 Pan Francés Extra Grande');
    });

    it('handles combination with empty selection gracefully', () => {
      const combination = new Combination({
        selection: [],
        name: '',
      });

      const wrapper = mount(CombinedProductionInfoCell, {
        props: {
          ...baseProps,
          combination,
        },
      });

      expect(wrapper.text()).toBe('5 Pan Francés');
    });
  });

  describe('Edge cases', () => {
    it('handles null combination and variation', () => {
      const wrapper = mount(CombinedProductionInfoCell, {
        props: {
          ...baseProps,
          combination: null,
          variation: null,
        },
      });

      expect(wrapper.text()).toBe('5 Pan Francés');
    });

    it('handles combination without getDisplayName method', () => {
      const plainCombination = {
        name: 'Pequeño',
        selection: ['Pequeño'],
      };

      const wrapper = mount(CombinedProductionInfoCell, {
        props: {
          ...baseProps,
          combination: plainCombination,
        },
      });

      // Should fall back to variation behavior when combination lacks getDisplayName
      expect(wrapper.text()).toBe('5 Pan Francés');
    });
  });
});
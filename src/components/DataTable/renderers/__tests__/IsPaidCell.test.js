import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import IsPaidCell from '../IsPaidCell.vue';

describe('IsPaidCell', () => {
  const baseOrder = {
    id: '123',
    isPaid: false,
    isComplimentary: false,
    status: 0,
    paymentDate: null,
    partialPaymentAmount: null,
    partialPaymentDate: null,
  };

  describe('Icon display', () => {
    it('shows gift icon for complimentary orders', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            paymentMethod: 'complimentary',
          },
        },
      });

      const giftIcon = wrapper.find('[data-testid="gift-icon"]');
      expect(giftIcon.exists()).toBe(true);
    });

    it('shows check icon for paid orders', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            isPaid: true,
            paymentDate: '2024-01-15',
          },
        },
      });

      const checkIcon = wrapper.find('[data-testid="check-icon"]');
      expect(checkIcon.exists()).toBe(true);
    });

    it('shows partial payment icon for orders with partial payment', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            partialPaymentAmount: 50000,
            partialPaymentDate: '2024-01-10',
          },
        },
      });

      const partialIcon = wrapper.find('[data-testid="partial-icon"]');
      expect(partialIcon.exists()).toBe(true);
    });

    it('shows minus icon for unpaid orders without partial payment', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: baseOrder,
        },
      });

      const minusIcon = wrapper.find('[data-testid="minus-icon"]');
      expect(minusIcon.exists()).toBe(true);
    });
  });

  describe('Date display', () => {
    it('displays payment date when order is paid', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            isPaid: true,
            paymentDate: '2024-01-15T10:30:00',
          },
        },
      });

      const dateText = wrapper.find('p');
      expect(dateText.exists()).toBe(true);
      expect(dateText.text()).toContain('15/1');
    });

    it('displays partial payment date when there is partial payment', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            partialPaymentAmount: 25000,
            partialPaymentDate: '2024-02-20T14:15:00',
          },
        },
      });

      const dateText = wrapper.find('p');
      expect(dateText.exists()).toBe(true);
      expect(dateText.text()).toContain('20/2');
    });

    it('prioritizes payment date over partial payment date when both exist', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            isPaid: true,
            paymentDate: '2024-01-15T10:30:00',
            partialPaymentAmount: 25000,
            partialPaymentDate: '2024-01-10T14:15:00',
          },
        },
      });

      const dateText = wrapper.find('p');
      expect(dateText.text()).toContain('15/1');
      expect(dateText.text()).not.toContain('10/1');
    });

    it('does not display date for unpaid orders without partial payment', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: baseOrder,
        },
      });

      const dateText = wrapper.find('p');
      expect(dateText.exists()).toBe(false);
    });

    it('does not display date for complimentary orders', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            paymentMethod: 'complimentary',
            paymentDate: '2024-01-15T10:30:00',
          },
        },
      });

      const dateText = wrapper.find('p');
      expect(dateText.exists()).toBe(false);
    });
  });

  describe('Amount display', () => {
    it('displays partial payment amount when order is not fully paid', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            partialPaymentAmount: 45000,
            partialPaymentDate: '2024-01-10',
          },
        },
      });

      const amountText = wrapper.find('.text-neutral-500');
      expect(amountText.exists()).toBe(true);
      expect(amountText.text()).toContain('45k');
    });

    it('does not display amount for fully paid orders', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            isPaid: true,
            paymentDate: '2024-01-15',
            partialPaymentAmount: 45000,
          },
        },
      });

      const amountText = wrapper.find('.text-neutral-500');
      // The span exists but should be empty since displayAmount returns empty string for paid orders
      expect(amountText.text()).toBe('');
    });

    it('does not display amount when partial payment is zero', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            partialPaymentAmount: 0,
            partialPaymentDate: '2024-01-10',
          },
        },
      });

      const amountText = wrapper.find('.text-neutral-500');
      expect(amountText.exists()).toBe(false);
    });

    it('does not display amount for complimentary orders', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            paymentMethod: 'complimentary',
            partialPaymentAmount: 25000,
          },
        },
      });

      const amountText = wrapper.find('.text-neutral-500');
      expect(amountText.exists()).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('handles null payment dates gracefully', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            isPaid: true,
            paymentDate: null,
            partialPaymentDate: null,
          },
        },
      });

      expect(() => wrapper.html()).not.toThrow();
      const dateText = wrapper.find('p');
      // The p element should exist because isPaid is true, even though dates are null
      expect(dateText.exists()).toBe(true);
      // But the text should be empty since displayDate returns empty string
      expect(dateText.text().trim()).toBe('');
    });

    it('handles invalid date strings gracefully', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            isPaid: true,
            paymentDate: 'invalid-date',
          },
        },
      });

      expect(() => wrapper.html()).not.toThrow();
    });

    it('handles negative partial payment amounts', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            partialPaymentAmount: -1000,
            partialPaymentDate: '2024-01-10',
          },
        },
      });

      const minusIcon = wrapper.find('[data-testid="minus-icon"]');
      expect(minusIcon.exists()).toBe(true);
    });

    it('handles missing order properties gracefully', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            id: '123',
          },
        },
      });

      expect(() => wrapper.html()).not.toThrow();
      const minusIcon = wrapper.find('[data-testid="minus-icon"]');
      expect(minusIcon.exists()).toBe(true);
    });
  });

  describe('Complex scenarios', () => {
    it('displays correct state for order with partial payment but later marked as paid', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            isPaid: true,
            paymentDate: '2024-01-20T16:00:00',
            partialPaymentAmount: 30000,
            partialPaymentDate: '2024-01-15T10:00:00',
          },
        },
      });

      // Should show check icon (paid)
      const checkIcon = wrapper.find('[data-testid="check-icon"]');
      expect(checkIcon.exists()).toBe(true);

      // Should show payment date, not partial payment date
      const dateText = wrapper.find('p');
      expect(dateText.text()).toContain('20/1');

      // Should not show partial payment amount since it's fully paid
      const amountText = wrapper.find('.text-neutral-500');
      expect(amountText.text()).toBe('');
    });

    it('handles order that was complimentary but has payment information', () => {
      const wrapper = mount(IsPaidCell, {
        props: {
          order: {
            ...baseOrder,
            paymentMethod: 'complimentary',
            isPaid: true,
            paymentDate: '2024-01-15',
            partialPaymentAmount: 25000,
          },
        },
      });

      // Should prioritize complimentary status
      const giftIcon = wrapper.find('[data-testid="gift-icon"]');
      expect(giftIcon.exists()).toBe(true);

      // Should not show any payment information
      const dateText = wrapper.find('p');
      expect(dateText.exists()).toBe(false);
    });
  });

  describe('Props validation', () => {
    it('requires order prop', () => {
      // This test ensures the component properly handles the required order prop
      // Vue Test Utils doesn't throw for missing required props, but console warnings are generated
      // We'll test that the component doesn't crash without the prop
      const wrapper = mount(IsPaidCell, {
        props: {},
      });
      // Component should still render something (likely the minus icon as fallback)
      expect(wrapper.exists()).toBe(true);
    });

    it('accepts order as object', () => {
      expect(() => {
        mount(IsPaidCell, {
          props: {
            order: baseOrder,
          },
        });
      }).not.toThrow();
    });
  });
});
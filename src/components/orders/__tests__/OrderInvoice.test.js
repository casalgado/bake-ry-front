import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderInvoice from '../OrderInvoice.vue';

describe('OrderInvoice', () => {
  let wrapper;
  const mockBakerySettings = {
    name: 'Test Bakery',
    legalName: 'Test Bakery S.A.S.',
    nationalId: '900123456-7',
    address: 'Calle 123 #45-67',
    phone: '+57 300 123 4567',
    email: 'info@testbakery.com',
    website: 'www.testbakery.com',
    branding: {
      logos: {
        original: 'https://example.com/logo.png',
        medium: 'https://example.com/logo-medium.png',
      },
    },
  };

  const mockOrder = {
    id: 'order-123',
    preparationDate: '2025-10-01',
    userName: 'Juan Pérez',
    userLegalName: 'Juan Pérez E.U.',
    userEmail: 'juan@example.com',
    userPhone: '+57 301 234 5678',
    userNationalId: '1234567890',
    deliveryAddress: 'Carrera 7 #12-34',
    subtotal: 50000,
    deliveryFee: 5000,
    fulfillmentType: 'delivery',
    paymentMethod: 'cash',
    orderItems: [
      {
        productName: 'Pan Francés',
        variation: { name: 'Grande' },
        quantity: 2,
        subtotal: 10000,
      },
      {
        productName: 'Torta de Chocolate',
        variation: { name: 'Mediana' },
        quantity: 1,
        subtotal: 40000,
      },
    ],
  };

  beforeEach(() => {
    wrapper = null;
  });

  describe('Component Rendering', () => {
    it('renders correctly with single order', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.find('.min-h-screen').exists()).toBe(true);
      expect(wrapper.text()).toContain('Test Bakery');
    });

    it('renders with multiple orders', () => {
      const order2 = { ...mockOrder, id: 'order-456', preparationDate: '2025-10-02' };
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder, order2],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('2 pedidos');
    });

    it('displays logo when available', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      const img = wrapper.find('img');
      expect(img.exists()).toBe(true);
      expect(img.attributes('src')).toBe('https://example.com/logo-medium.png');
    });

    it('displays bakery name when no logo', () => {
      const settingsNoLogo = { ...mockBakerySettings, branding: {} };
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: settingsNoLogo,
        },
      });

      expect(wrapper.text()).toContain('Test Bakery');
      expect(wrapper.find('img').exists()).toBe(false);
    });
  });

  describe('Invoice Type', () => {
    it('displays "FACTURA" by default', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('FACTURA');
    });

    it('displays "COTIZACIÓN" when invoice type is quote', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
          invoiceType: 'quote',
        },
      });

      expect(wrapper.text()).toContain('COTIZACIÓN');
    });

    it('displays custom invoice number when provided', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
          invoiceNumber: 'INV-2025-001',
        },
      });

      expect(wrapper.text()).toContain('No. INV-2025-001');
    });

    it('displays order ID for single order when no invoice number', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('Pedido #order');
    });
  });

  describe('Client Information', () => {
    it('displays all client details', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('Juan Pérez');
      expect(wrapper.text()).toContain('Juan Pérez E.U.');
      expect(wrapper.text()).toContain('1234567890');
      expect(wrapper.text()).toContain('Carrera 7 #12-34');
      expect(wrapper.text()).toContain('+57 301 234 5678');
      expect(wrapper.text()).toContain('juan@example.com');
    });

    it('hides pendiente email addresses', () => {
      const orderWithPendingEmail = {
        ...mockOrder,
        userEmail: 'pendiente@bakery.com',
      };

      wrapper = mount(OrderInvoice, {
        props: {
          orders: [orderWithPendingEmail],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).not.toContain('pendiente@bakery.com');
    });

    it('handles missing optional client fields', () => {
      const orderMinimalClient = {
        ...mockOrder,
        userLegalName: '',
        userNationalId: '',
        deliveryAddress: '',
      };

      wrapper = mount(OrderInvoice, {
        props: {
          orders: [orderMinimalClient],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('Juan Pérez');
      expect(wrapper.text()).not.toContain('Razón Social:');
      expect(wrapper.text()).not.toContain('NIT/CC:');
    });
  });

  describe('Order Items Display', () => {
    it('displays all order items correctly', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('Pan Francés');
      expect(wrapper.text()).toContain('Grande');
      expect(wrapper.text()).toContain('Torta de Chocolate');
      expect(wrapper.text()).toContain('Mediana');
    });

    it('displays delivery fee as line item when applicable', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('Servicio de Domicilio');
      expect(wrapper.text()).toContain('$5,000');
    });

    it('does not display delivery fee for pickup orders', () => {
      const pickupOrder = { ...mockOrder, fulfillmentType: 'pickup', deliveryFee: 0 };
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [pickupOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).not.toContain('Servicio de Domicilio');
    });

    it('shows order ID column for multiple orders', () => {
      const order2 = { ...mockOrder, id: 'order-456' };
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder, order2],
          bakerySettings: mockBakerySettings,
        },
      });

      const table = wrapper.find('table');
      expect(table.text()).toContain('Pedido');
      expect(table.text()).toContain('Fecha');
    });

    it('hides order ID column for single order', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      const tableHeaders = wrapper.findAll('thead th');
      const headerTexts = tableHeaders.map(th => th.text());
      expect(headerTexts).not.toContain('Pedido');
    });

    it('handles items without variation', () => {
      const orderNoVariation = {
        ...mockOrder,
        orderItems: [
          {
            productName: 'Pan Integral',
            quantity: 3,
            subtotal: 15000,
          },
        ],
      };

      wrapper = mount(OrderInvoice, {
        props: {
          orders: [orderNoVariation],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('Pan Integral');
    });
  });

  describe('Price Calculations', () => {
    it('calculates totals correctly for single order', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('$50,000'); // subtotal
      expect(wrapper.text()).toContain('$5,000'); // delivery
      expect(wrapper.text()).toContain('$55,000'); // total
    });

    it('calculates totals correctly for multiple orders', () => {
      const order2 = {
        ...mockOrder,
        id: 'order-456',
        subtotal: 30000,
        deliveryFee: 3000,
      };

      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder, order2],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('$80,000'); // 50000 + 30000
      expect(wrapper.text()).toContain('$8,000'); // 5000 + 3000
      expect(wrapper.text()).toContain('$88,000'); // total
    });

    it('displays unit price correctly', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      // Unit price for first item: 10000 / 2 = 5000
      expect(wrapper.text()).toContain('$5,000');
      // Unit price for second item: 40000 / 1 = 40000
      expect(wrapper.text()).toContain('$40,000');
    });

    it('shows delivery total only when applicable', () => {
      const orderNoDelivery = {
        ...mockOrder,
        fulfillmentType: 'pickup',
        deliveryFee: 0,
      };

      wrapper = mount(OrderInvoice, {
        props: {
          orders: [orderNoDelivery],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).not.toContain('Domicilios:');
    });
  });

  describe('Date Formatting', () => {
    it('formats single order date in long format', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('01 Oct 2025');
    });

    it('displays date range for multiple orders with different dates', () => {
      const order2 = { ...mockOrder, id: 'order-456', preparationDate: '2025-10-05' };
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder, order2],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('01 Oct 2025 - 05 Oct 2025');
    });

    it('displays single date for multiple orders on same day', () => {
      const order2 = { ...mockOrder, id: 'order-456', preparationDate: '2025-10-01' };
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder, order2],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('01 Oct 2025');
      expect(wrapper.text()).not.toContain('-');
    });

    it('formats table dates in short format (dd/mm/yy)', () => {
      const order2 = { ...mockOrder, id: 'order-456', preparationDate: '2025-10-05' };
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder, order2],
          bakerySettings: mockBakerySettings,
        },
      });

      const table = wrapper.find('table');
      expect(table.text()).toContain('01/10/25');
      expect(table.text()).toContain('05/10/25');
    });
  });

  describe('Company Information', () => {
    it('displays all bakery details', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('Test Bakery S.A.S.');
      expect(wrapper.text()).toContain('NIT: 900123456-7');
      expect(wrapper.text()).toContain('Calle 123 #45-67');
      expect(wrapper.text()).toContain('Tel: +57 300 123 4567');
      expect(wrapper.text()).toContain('info@testbakery.com');
      expect(wrapper.text()).toContain('www.testbakery.com');
    });

    it('handles missing optional bakery fields', () => {
      const minimalSettings = {
        name: 'Simple Bakery',
      };

      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: minimalSettings,
        },
      });

      expect(wrapper.text()).toContain('Simple Bakery');
      expect(wrapper.text()).not.toContain('NIT:');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty orders array gracefully', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.find('.min-h-screen').exists()).toBe(true);
    });

    it('handles orders without items', () => {
      const orderNoItems = { ...mockOrder, orderItems: [] };
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [orderNoItems],
          bakerySettings: mockBakerySettings,
        },
      });

      const table = wrapper.find('table tbody');
      // Should only show delivery fee row if applicable
      const rows = table.findAll('tr');
      expect(rows.length).toBe(1); // Only delivery fee row
    });

    it('handles zero prices correctly', () => {
      const freeOrder = {
        ...mockOrder,
        subtotal: 0,
        deliveryFee: 0,
        orderItems: [
          {
            productName: 'Sample',
            quantity: 1,
            subtotal: 0,
          },
        ],
      };

      wrapper = mount(OrderInvoice, {
        props: {
          orders: [freeOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('$0');
    });

    it('formats order ID to first 5 characters', () => {
      const longIdOrder = { ...mockOrder, id: '1234567890abcdef' };
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [longIdOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('Pedido #12345');
    });
  });

  describe('Computed Properties', () => {
    it('combines items from multiple orders correctly', () => {
      const order2 = {
        ...mockOrder,
        id: 'order-456',
        orderItems: [
          {
            productName: 'Croissant',
            quantity: 5,
            subtotal: 25000,
          },
        ],
      };

      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder, order2],
          bakerySettings: mockBakerySettings,
        },
      });

      expect(wrapper.text()).toContain('Pan Francés');
      expect(wrapper.text()).toContain('Torta de Chocolate');
      expect(wrapper.text()).toContain('Croissant');
    });

    it('extracts client info from first order', () => {
      const order2 = {
        ...mockOrder,
        id: 'order-456',
        userName: 'Different User',
      };

      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder, order2],
          bakerySettings: mockBakerySettings,
        },
      });

      // Should use first order's client info
      expect(wrapper.text()).toContain('Juan Pérez');
      expect(wrapper.text()).not.toContain('Different User');
    });
  });

  describe('Print Functionality', () => {
    it('applies print-specific styles', () => {
      wrapper = mount(OrderInvoice, {
        props: {
          orders: [mockOrder],
          bakerySettings: mockBakerySettings,
        },
      });

      // Check that print styles are present in component
      const style = wrapper.html();
      expect(style).toContain('@media print');
    });
  });
});

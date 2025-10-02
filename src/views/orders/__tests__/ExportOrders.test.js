import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ExportOrders from '../ExportOrders.vue';
import OrderInvoice from '@/components/orders/OrderInvoice.vue';
import { useOrderStore } from '@/stores/orderStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

// Mock window.print and window.close
const mockPrint = vi.fn();
const mockClose = vi.fn();
global.window.print = mockPrint;
global.window.close = mockClose;

// Mock router
const mockRouter = {
  back: vi.fn(),
};

const mockRoute = {
  query: {
    orderIds: 'order-123,order-456',
  },
};

describe('ExportOrders', () => {
  let wrapper;
  let orderStore;
  let settingsStore;

  const mockOrder1 = {
    id: 'order-123',
    preparationDate: '2025-10-01',
    userName: 'Juan Pérez',
    userEmail: 'juan@example.com',
    userPhone: '+57 301 234 5678',
    subtotal: 50000,
    deliveryFee: 5000,
    fulfillmentType: 'delivery',
    paymentMethod: 'cash',
    orderItems: [
      {
        productName: 'Pan Francés',
        quantity: 2,
        subtotal: 10000,
      },
    ],
  };

  const mockOrder2 = {
    id: 'order-456',
    preparationDate: '2025-10-02',
    userName: 'Juan Pérez',
    userEmail: 'juan@example.com',
    subtotal: 30000,
    deliveryFee: 3000,
    fulfillmentType: 'delivery',
    paymentMethod: 'cash',
    orderItems: [
      {
        productName: 'Croissant',
        quantity: 5,
        subtotal: 30000,
      },
    ],
  };

  const mockBakerySettings = {
    name: 'Test Bakery',
    address: 'Calle 123',
    phone: '+57 300 123 4567',
    email: 'info@testbakery.com',
  };

  beforeEach(() => {
    // Reset mocks
    mockPrint.mockClear();
    mockClose.mockClear();
    mockRouter.back.mockClear();
    Object.defineProperty(window, 'closed', { value: false, writable: true, configurable: true });

    // Create fresh pinia instance
    const pinia = createPinia();
    setActivePinia(pinia);
    orderStore = useOrderStore();
    settingsStore = useBakerySettingsStore();

    // Setup mock data in stores
    orderStore.items = [mockOrder1, mockOrder2];
    settingsStore.items = [mockBakerySettings];

    // Mock fetchById methods
    orderStore.fetchById = vi.fn((id) => {
      const order = orderStore.items.find(o => o.id === id);
      if (!order) throw new Error(`Order ${id} not found`);
      return Promise.resolve(order);
    });

    settingsStore.fetchById = vi.fn(() => Promise.resolve(mockBakerySettings));

    wrapper = null;
  });

  describe('Component Loading and Initialization', () => {
    it('renders loading state initially', () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      expect(wrapper.text()).toContain('Cargando órdenes...');
      expect(wrapper.find('.spinner').exists()).toBe(true);
    });

    it('fetches orders on mount', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      expect(orderStore.fetchById).toHaveBeenCalledWith('order-123');
      expect(orderStore.fetchById).toHaveBeenCalledWith('order-456');
      expect(orderStore.fetchById).toHaveBeenCalledTimes(2);
    });

    it('fetches bakery settings on mount', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      expect(settingsStore.fetchById).toHaveBeenCalledWith('default');
    });

    it('parses multiple order IDs from query params', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const vm = wrapper.vm;
      expect(vm.orderIds).toEqual(['order-123', 'order-456']);
    });

    it('renders OrderInvoice component after loading', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      expect(wrapper.findComponent(OrderInvoice).exists()).toBe(true);
      expect(wrapper.find('.spinner').exists()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('displays error when no order IDs provided', async () => {
      const emptyRoute = {
        query: {},
      };

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: emptyRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      expect(wrapper.text()).toContain('No se especificaron órdenes para imprimir');
      expect(wrapper.findComponent(OrderInvoice).exists()).toBe(false);
    });

    it('displays error when orders not found', async () => {
      orderStore.fetchById = vi.fn(() => Promise.reject(new Error('Order not found')));

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      expect(wrapper.text()).toContain('No se encontraron las órdenes especificadas');
    });

    it('displays error message for fetch failures', async () => {
      orderStore.fetchById = vi.fn(() => Promise.reject(new Error('Network error')));

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      expect(wrapper.text()).toContain('Error al cargar las órdenes');
      expect(wrapper.text()).toContain('Network error');
    });

    it('disables print button when error occurs', async () => {
      orderStore.fetchById = vi.fn(() => Promise.reject(new Error('Test error')));

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const printButton = wrapper.findAll('button').find(btn => btn.text().includes('Imprimir'));
      expect(printButton.attributes('disabled')).toBeDefined();
    });

    it('handles partial order fetch failures', async () => {
      orderStore.fetchById = vi.fn((id) => {
        if (id === 'order-123') {
          return Promise.resolve(mockOrder1);
        }
        return Promise.reject(new Error('Order not found'));
      });

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      // Should render with the one successful order
      expect(wrapper.findComponent(OrderInvoice).exists()).toBe(true);
      const invoiceProps = wrapper.findComponent(OrderInvoice).props();
      expect(invoiceProps.orders).toHaveLength(1);
      expect(invoiceProps.orders[0].id).toBe('order-123');
    });
  });

  describe('Print Controls', () => {
    it('displays print controls bar', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      expect(wrapper.find('.print-controls').exists()).toBe(true);
      expect(wrapper.text()).toContain('Vista Previa');
    });

    it('shows print button when loaded', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const printButton = wrapper.findAll('button').find(btn => btn.text().includes('Imprimir'));
      expect(printButton.exists()).toBe(true);
      expect(printButton.attributes('disabled')).toBeUndefined();
    });

    it('shows close button', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const closeButton = wrapper.findAll('button').find(btn => btn.text().includes('Cerrar'));
      expect(closeButton.exists()).toBe(true);
    });

    it('calls window.print when print button clicked', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const printButton = wrapper.findAll('button').find(btn => btn.text().includes('Imprimir'));
      await printButton.trigger('click');

      expect(mockPrint).toHaveBeenCalled();
    });

    it('calls window.close when close button clicked', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const closeButton = wrapper.findAll('button').find(btn => btn.text().includes('Cerrar'));
      await closeButton.trigger('click');

      expect(mockClose).toHaveBeenCalled();
    });

    it('falls back to router.back if window.close fails', async () => {
      Object.defineProperty(window, 'closed', { value: false, writable: true, configurable: true });

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const closeButton = wrapper.findAll('button').find(btn => btn.text().includes('Cerrar'));
      await closeButton.trigger('click');

      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  describe('OrderInvoice Integration', () => {
    it('passes orders to OrderInvoice component', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const invoiceComponent = wrapper.findComponent(OrderInvoice);
      expect(invoiceComponent.props('orders')).toHaveLength(2);
      expect(invoiceComponent.props('orders')[0].id).toBe('order-123');
      expect(invoiceComponent.props('orders')[1].id).toBe('order-456');
    });

    it('passes bakery settings to OrderInvoice component', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const invoiceComponent = wrapper.findComponent(OrderInvoice);
      expect(invoiceComponent.props('bakerySettings')).toEqual(mockBakerySettings);
    });

    it('sets invoice type to quote when all orders are quotes', async () => {
      const quoteOrder1 = { ...mockOrder1, paymentMethod: 'quote' };
      const quoteOrder2 = { ...mockOrder2, paymentMethod: 'quote' };
      orderStore.items = [quoteOrder1, quoteOrder2];

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const invoiceComponent = wrapper.findComponent(OrderInvoice);
      expect(invoiceComponent.props('invoiceType')).toBe('quote');
    });

    it('sets invoice type to invoice when orders are mixed payment methods', async () => {
      const quoteOrder = { ...mockOrder1, paymentMethod: 'quote' };
      const cashOrder = { ...mockOrder2, paymentMethod: 'cash' };
      orderStore.items = [quoteOrder, cashOrder];

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const invoiceComponent = wrapper.findComponent(OrderInvoice);
      expect(invoiceComponent.props('invoiceType')).toBe('invoice');
    });
  });

  describe('Single Order ID', () => {
    it('handles single order ID correctly', async () => {
      const singleRoute = {
        query: {
          orderIds: 'order-123',
        },
      };

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: singleRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const invoiceComponent = wrapper.findComponent(OrderInvoice);
      expect(invoiceComponent.props('orders')).toHaveLength(1);
      expect(invoiceComponent.props('orders')[0].id).toBe('order-123');
    });
  });

  describe('UI Layout', () => {
    it('applies correct container classes', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      expect(wrapper.find('.min-h-screen').exists()).toBe(true);
      expect(wrapper.find('.bg-gray-50').exists()).toBe(true);
    });

    it('applies print-friendly layout classes to invoice', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const invoiceContainer = wrapper.find('.max-w-\\[210mm\\]');
      expect(invoiceContainer.exists()).toBe(true);
    });

    it('has sticky print controls bar', async () => {
      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      const controls = wrapper.find('.print-controls');
      expect(controls.classes()).toContain('sticky');
      expect(controls.classes()).toContain('top-0');
    });
  });

  describe('Console Logging', () => {
    it('logs route query on mount', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      expect(consoleSpy).toHaveBeenCalledWith('Route query orderIds:', 'order-123,order-456');

      consoleSpy.mockRestore();
    });

    it('logs fetching orders message', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      wrapper = mount(ExportOrders, {
        global: {
          plugins: [createPinia()],
          mocks: {
            $route: mockRoute,
            $router: mockRouter,
          },
        },
      });

      await flushPromises();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Fetching orders for IDs:',
        ['order-123', 'order-456'],
      );

      consoleSpy.mockRestore();
    });
  });
});

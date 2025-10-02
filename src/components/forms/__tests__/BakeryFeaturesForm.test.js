import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BakeryFeaturesForm from '../BakeryFeaturesForm.vue';
import FeatureCard from '../FeatureCard.vue';
import RadioFeatureCard from '../RadioFeatureCard.vue';

describe('BakeryFeaturesForm', () => {
  let wrapper;

  const mockInitialData = {
    activePaymentMethods: ['cash', 'transfer'],
    allowPartialPayment: true,
    timeOfDay: false,
    offlineMode: false,
    defaultReportFilter: 'dueDate',
    showMultipleReports: true,
    useProductCost: false,
  };

  const mockPaymentMethods = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'bancolombia', label: 'Bancolombia' },
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    wrapper = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  describe('Component Rendering', () => {
    it('renders correctly with default props', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.find('.form-container').exists()).toBe(true);
      expect(wrapper.text()).toContain('Configuración de Características');
    });

    it('renders with custom title', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          title: 'Custom Features Title',
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.text()).toContain('Custom Features Title');
    });

    it('renders all payment method cards', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const featureCards = wrapper.findAllComponents(FeatureCard);
      // Should have payment methods + additional features (partial payment, time of day, offline mode, multiple reports)
      expect(featureCards.length).toBeGreaterThanOrEqual(4);
    });

    it('displays payment methods section', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.text()).toContain('Métodos de Pago');
      expect(wrapper.text()).toContain('Selecciona los métodos de pago que acepta tu negocio');
    });

    it('displays additional features section', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.text()).toContain('Características Adicionales');
      expect(wrapper.text()).toContain('Pagos Parciales');
      expect(wrapper.text()).toContain('Hora de Entrega');
      expect(wrapper.text()).toContain('Modo Sin Conexión');
    });

    it('displays reports configuration section', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.text()).toContain('Configuración de Reportes');
      expect(wrapper.text()).toContain('Reporte de Ventas');
    });

    it('hides products configuration section', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const productsSection = wrapper.findAll('div').find(div =>
        div.text().includes('Configuración de Productos'),
      );
      expect(productsSection.classes()).toContain('hidden');
    });
  });

  describe('Form Initialization', () => {
    it('initializes with provided initial data', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.formData.activePaymentMethods).toEqual(['cash', 'transfer']);
      expect(vm.formData.allowPartialPayment).toBe(true);
      expect(vm.formData.timeOfDay).toBe(false);
      expect(vm.formData.defaultReportFilter).toBe('dueDate');
    });

    it('initializes with default data when no initial data provided', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.formData.activePaymentMethods).toEqual([]);
      expect(vm.formData.allowPartialPayment).toBe(false);
      expect(vm.formData.defaultReportFilter).toBe('dueDate');
    });
  });

  describe('Payment Methods Management', () => {
    it('displays active payment methods correctly', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.isPaymentMethodActive('cash')).toBe(true);
      expect(vm.isPaymentMethodActive('transfer')).toBe(true);
      expect(vm.isPaymentMethodActive('card')).toBe(false);
    });

    it('toggles payment method on', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: { ...mockInitialData, activePaymentMethods: [] },
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.togglePaymentMethod('cash', true);
      await wrapper.vm.$nextTick();

      expect(vm.formData.activePaymentMethods).toContain('cash');
    });

    it('toggles payment method off', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.togglePaymentMethod('cash', false);
      await wrapper.vm.$nextTick();

      expect(vm.formData.activePaymentMethods).not.toContain('cash');
    });

    it('does not add duplicate payment methods', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      const initialLength = vm.formData.activePaymentMethods.length;

      vm.togglePaymentMethod('cash', true);
      await wrapper.vm.$nextTick();

      expect(vm.formData.activePaymentMethods.length).toBe(initialLength);
      expect(vm.formData.activePaymentMethods.filter(m => m === 'cash').length).toBe(1);
    });
  });

  describe('Auto-save Functionality', () => {
    it('emits submit event after changes with debounce', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.formData.allowPartialPayment = false;
      await wrapper.vm.$nextTick();

      // Should not emit immediately
      expect(wrapper.emitted('submit')).toBeFalsy();

      // Advance timers by 2 seconds (debounce time)
      vi.advanceTimersByTime(2000);
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeTruthy();
      expect(wrapper.emitted('submit')[0][0].allowPartialPayment).toBe(false);
    });

    it('debounces multiple rapid changes', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;

      // Make multiple changes rapidly
      vm.formData.allowPartialPayment = false;
      await wrapper.vm.$nextTick();
      vi.advanceTimersByTime(1000);

      vm.formData.timeOfDay = true;
      await wrapper.vm.$nextTick();
      vi.advanceTimersByTime(1000);

      vm.formData.offlineMode = true;
      await wrapper.vm.$nextTick();

      // Should not have emitted yet
      expect(wrapper.emitted('submit')).toBeFalsy();

      // Advance by 2 more seconds
      vi.advanceTimersByTime(2000);
      await flushPromises();

      // Should emit only once with final state
      expect(wrapper.emitted('submit')).toBeTruthy();
      expect(wrapper.emitted('submit').length).toBe(1);
      expect(wrapper.emitted('submit')[0][0].offlineMode).toBe(true);
    });

    it('cancels previous debounce timer on new change', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;

      vm.formData.allowPartialPayment = false;
      await wrapper.vm.$nextTick();
      vi.advanceTimersByTime(1500); // 1.5 seconds

      vm.formData.timeOfDay = true;
      await wrapper.vm.$nextTick();
      vi.advanceTimersByTime(500); // Another 0.5 seconds (total 2s from first change)

      // Should not emit yet (timer was reset by second change)
      expect(wrapper.emitted('submit')).toBeFalsy();

      vi.advanceTimersByTime(1500); // Complete the 2s from second change
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeTruthy();
    });

    it('auto-saves payment method changes', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.togglePaymentMethod('card', true);
      await wrapper.vm.$nextTick();

      vi.advanceTimersByTime(2000);
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeTruthy();
      expect(wrapper.emitted('submit')[0][0].activePaymentMethods).toContain('card');
    });

    it('auto-saves report filter changes', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.formData.defaultReportFilter = 'paymentDate';
      await wrapper.vm.$nextTick();

      vi.advanceTimersByTime(2000);
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeTruthy();
      expect(wrapper.emitted('submit')[0][0].defaultReportFilter).toBe('paymentDate');
    });
  });

  describe('Feature Toggles', () => {
    it('toggles partial payment feature', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      const initialValue = vm.formData.allowPartialPayment;

      vm.formData.allowPartialPayment = !initialValue;
      await wrapper.vm.$nextTick();

      expect(vm.formData.allowPartialPayment).toBe(!initialValue);
    });

    it('toggles time of day feature', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.formData.timeOfDay = true;
      await wrapper.vm.$nextTick();

      expect(vm.formData.timeOfDay).toBe(true);
    });

    it('toggles offline mode feature', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.formData.offlineMode = true;
      await wrapper.vm.$nextTick();

      expect(vm.formData.offlineMode).toBe(true);
    });

    it('toggles show multiple reports feature', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.formData.showMultipleReports = false;
      await wrapper.vm.$nextTick();

      expect(vm.formData.showMultipleReports).toBe(false);
    });
  });

  describe('Report Filter Options', () => {
    it('provides correct report filter options', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.reportFilterOptions).toHaveLength(2);
      expect(vm.reportFilterOptions[0]).toEqual({ value: 'dueDate', label: 'Fecha de Pedido' });
      expect(vm.reportFilterOptions[1]).toEqual({ value: 'paymentDate', label: 'Fecha de Pago' });
    });

    it('renders RadioFeatureCard for report filter', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const radioFeatureCard = wrapper.findComponent(RadioFeatureCard);
      expect(radioFeatureCard.exists()).toBe(true);
      expect(radioFeatureCard.props('options')).toEqual([
        { value: 'dueDate', label: 'Fecha de Pedido' },
        { value: 'paymentDate', label: 'Fecha de Pago' },
      ]);
    });
  });

  describe('Watchers', () => {
    it('updates form data when initialData prop changes', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const newData = {
        ...mockInitialData,
        allowPartialPayment: false,
        activePaymentMethods: ['card'],
      };

      await wrapper.setProps({ initialData: newData });
      await wrapper.vm.$nextTick();

      const vm = wrapper.vm;
      expect(vm.formData.allowPartialPayment).toBe(false);
      expect(vm.formData.activePaymentMethods).toEqual(['card']);
    });

    it('only updates changed fields to prevent overriding user input', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.formData.timeOfDay = true; // User makes a change

      const newData = {
        ...mockInitialData,
        allowPartialPayment: false, // Different from initial
        timeOfDay: false, // Same as initial but different from user change
      };

      await wrapper.setProps({ initialData: newData });
      await wrapper.vm.$nextTick();

      // Should update allowPartialPayment (changed in prop)
      expect(vm.formData.allowPartialPayment).toBe(false);
      // Should update timeOfDay even though user changed it (prop changed too)
      expect(vm.formData.timeOfDay).toBe(false);
    });

    it('handles deep changes in payment methods array', async () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const newData = {
        ...mockInitialData,
        activePaymentMethods: ['cash', 'transfer', 'card'],
      };

      await wrapper.setProps({ initialData: newData });
      await wrapper.vm.$nextTick();

      const vm = wrapper.vm;
      expect(vm.formData.activePaymentMethods).toEqual(['cash', 'transfer', 'card']);
    });
  });

  describe('Loading State', () => {
    it('disables features when loading', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          loading: true,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const featureCards = wrapper.findAllComponents(FeatureCard);
      featureCards.forEach(card => {
        expect(card.props('disabled')).toBe(true);
      });
    });

    it('enables features when not loading', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          loading: false,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const featureCards = wrapper.findAllComponents(FeatureCard);
      featureCards.forEach(card => {
        expect(card.props('disabled')).toBe(false);
      });
    });
  });

  describe('Payment Icon Mapping', () => {
    it('has correct icon mapping for payment methods', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.paymentIconMap).toHaveProperty('cash');
      expect(vm.paymentIconMap).toHaveProperty('transfer');
      expect(vm.paymentIconMap).toHaveProperty('card');
      expect(vm.paymentIconMap).toHaveProperty('bancolombia');
      expect(vm.paymentIconMap).toHaveProperty('davivienda');
      expect(vm.paymentIconMap).toHaveProperty('complimentary');
      expect(vm.paymentIconMap).toHaveProperty('quote');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty payment methods array', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: [],
        },
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.vm.availablePaymentMethods).toEqual([]);
    });

    it('handles undefined initial data', () => {
      wrapper = mount(BakeryFeaturesForm, {
        props: {
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.formData).toBeDefined();
      expect(vm.formData.activePaymentMethods).toEqual([]);
    });

    it('clears debounce timer on component unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      wrapper = mount(BakeryFeaturesForm, {
        props: {
          initialData: mockInitialData,
          availablePaymentMethods: mockPaymentMethods,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.formData.allowPartialPayment = false;

      wrapper.unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});

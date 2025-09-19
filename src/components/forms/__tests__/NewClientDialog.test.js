import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import NewClientDialog from '../NewClientDialog.vue';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';

// Mock Dialog components
vi.mock('@headlessui/vue', () => ({
  Dialog: {
    name: 'Dialog',
    template: '<div><slot /></div>',
    props: ['open'],
    emits: ['close'],
  },
  DialogPanel: {
    name: 'DialogPanel',
    template: '<div class="dialog-panel"><slot /></div>',
  },
  DialogTitle: {
    name: 'DialogTitle',
    template: '<h3><slot /></h3>',
  },
}));

// Mock RadioButtonGroup
vi.mock('@/components/forms/RadioButtonGroup.vue', () => ({
  default: {
    name: 'RadioButtonGroup',
    template: '<div data-testid="radio-button-group"></div>',
    props: ['modelValue', 'options', 'name', 'label'],
    emits: ['update:modelValue'],
  },
}));

describe('NewClientDialog', () => {
  let wrapper;
  let pinia;
  let bakeryUserStore;

  beforeEach(() => {
    pinia = createPinia();

    wrapper = mount(NewClientDialog, {
      props: {
        isOpen: true,
      },
      global: {
        plugins: [pinia],
      },
    });

    bakeryUserStore = useBakeryUserStore();

    // Mock the store methods
    bakeryUserStore.create = vi.fn();
  });

  describe('Dialog Structure', () => {
    it('renders dialog with correct title', () => {
      const title = wrapper.find('h3');
      expect(title.text()).toBe('Nuevo Cliente');
    });

    it('renders client type selection', () => {
      const radioGroup = wrapper.find('[data-testid="radio-button-group"]');
      expect(radioGroup.exists()).toBe(true);
    });

    it('renders all required form fields', () => {
      const nameInput = wrapper.find('input[type="text"]');
      const emailInput = wrapper.find('input[type="email"]');
      const phoneInput = wrapper.find('input[type="tel"]');
      const addressTextarea = wrapper.find('textarea');
      const nationalIdInput = wrapper.find('input[type="text"]');

      expect(nameInput.exists()).toBe(true);
      expect(emailInput.exists()).toBe(true);
      expect(phoneInput.exists()).toBe(true);
      expect(addressTextarea.exists()).toBe(true);
      expect(nationalIdInput.exists()).toBe(true);
    });
  });

  describe('New Fields Implementation', () => {
    it('renders legal name field for B2B clients', async () => {
      // Set client type to B2B
      await wrapper.setData({ selectedClientType: 'B2B' });

      const legalNameInput = wrapper.find('input[placeholder="Razón social de la empresa"]');
      expect(legalNameInput.exists()).toBe(true);

      const legalNameLabel = wrapper.find('label:contains("Razón Social")');
      expect(legalNameLabel.exists()).toBe(true);
    });

    it('does not render legal name field for B2C clients', async () => {
      // Set client type to B2C (default)
      await wrapper.setData({ selectedClientType: 'B2C' });

      const legalNameInput = wrapper.find('input[placeholder="Razón social de la empresa"]');
      expect(legalNameInput.exists()).toBe(false);
    });

    it('renders birthday field', () => {
      const birthdayInput = wrapper.find('input[type="date"]');
      expect(birthdayInput.exists()).toBe(true);

      const birthdayLabel = wrapper.text();
      expect(birthdayLabel).toContain('Fecha de Nacimiento');
    });

    it('renders comments field', () => {
      const commentsTextarea = wrapper.find('textarea[placeholder="Comentarios adicionales sobre el cliente"]');
      expect(commentsTextarea.exists()).toBe(true);

      const commentsLabel = wrapper.text();
      expect(commentsLabel).toContain('Comentarios');
    });

    it('has correct rows attribute for comments textarea', () => {
      const commentsTextarea = wrapper.find('textarea[placeholder="Comentarios adicionales sobre el cliente"]');
      expect(commentsTextarea.attributes('rows')).toBe('3');
    });
  });

  describe('Form Data Management', () => {
    it('initializes form data with new fields', () => {
      const vm = wrapper.vm;
      expect(vm.formData).toEqual({
        name: '',
        email: '',
        phone: '',
        address: '',
        nationalId: '',
        legalName: '',
        birthday: '',
        comment: '',
        category: 'B2C',
      });
    });

    it('updates form data when inputs change', async () => {
      const nameInput = wrapper.find('input[type="text"]');
      const emailInput = wrapper.find('input[type="email"]');
      const birthdayInput = wrapper.find('input[type="date"]');

      await nameInput.setValue('Test Client');
      await emailInput.setValue('test@example.com');
      await birthdayInput.setValue('1990-01-01');

      expect(wrapper.vm.formData.name).toBe('Test Client');
      expect(wrapper.vm.formData.email).toBe('test@example.com');
      expect(wrapper.vm.formData.birthday).toBe('1990-01-01');
    });

    it('resets form data properly including new fields', async () => {
      // Set some form data
      await wrapper.setData({
        formData: {
          name: 'Test',
          email: 'test@example.com',
          legalName: 'Test Corp',
          birthday: '1990-01-01',
          comment: 'Test comment',
          category: 'B2B',
        },
      });

      // Call reset
      wrapper.vm.resetForm();

      expect(wrapper.vm.formData).toEqual({
        name: '',
        email: '',
        phone: '',
        address: '',
        nationalId: '',
        legalName: '',
        birthday: '',
        comment: '',
        category: 'B2C',
      });
    });
  });

  describe('Client Type Handling', () => {
    it('changes field labels based on client type', async () => {
      // Test B2C label
      await wrapper.setData({ selectedClientType: 'B2C' });
      expect(wrapper.text()).toContain('Nombre');

      // Test B2B label
      await wrapper.setData({ selectedClientType: 'B2B' });
      expect(wrapper.text()).toContain('Nombre de Empresa');
    });

    it('updates category when client type changes', async () => {
      const vm = wrapper.vm;

      // Test B2B selection
      vm.handleClientTypeChange('B2B');
      expect(vm.formData.category).toBe('B2B');

      // Test B2C selection
      vm.handleClientTypeChange('B2C');
      expect(vm.formData.category).toBe('B2C');
    });
  });

  describe('Form Submission', () => {
    it('includes new fields in submission data', async () => {
      // Mock the create method
      bakeryUserStore.create = vi.fn().mockResolvedValue({ id: '1' });

      // Set form data including new fields
      await wrapper.setData({
        formData: {
          name: 'Test Client',
          email: 'test@example.com',
          phone: '123-456-7890',
          address: '123 Test St',
          nationalId: '12345678',
          legalName: 'Test Corp',
          birthday: '1990-01-01',
          comment: 'Test comment',
          category: 'B2B',
        },
      });

      // Submit form
      const form = wrapper.find('form');
      await form.trigger('submit');

      // Check that create was called with correct data including new fields
      expect(bakeryUserStore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Client',
          email: 'test@example.com',
          legalName: 'Test Corp',
          birthday: '1990-01-01',
          comment: 'Test comment',
          category: 'B2B',
          role: 'bakery_customer',
        })
      );
    });

    it('emits clientCreated event after successful submission', async () => {
      const mockClient = { id: '1', name: 'Test Client' };
      bakeryUserStore.create = vi.fn().mockResolvedValue(mockClient);

      const form = wrapper.find('form');
      await form.trigger('submit');

      expect(wrapper.emitted('clientCreated')).toBeTruthy();
      expect(wrapper.emitted('clientCreated')[0]).toEqual([mockClient]);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('submits form on Ctrl+Enter', async () => {
      bakeryUserStore.create = vi.fn().mockResolvedValue({ id: '1' });

      const form = wrapper.find('form');
      await form.trigger('keydown', {
        key: 'Enter',
        ctrlKey: true
      });

      expect(bakeryUserStore.create).toHaveBeenCalled();
    });
  });

  describe('Button States', () => {
    it('shows loading state on submit button', async () => {
      await wrapper.setData({ loading: true });

      const submitButton = wrapper.find('button[type="submit"]');
      expect(submitButton.text()).toBe('Creando...');
      expect(submitButton.attributes('disabled')).toBeDefined();
    });

    it('shows normal state when not loading', () => {
      const submitButton = wrapper.find('button[type="submit"]');
      expect(submitButton.text()).toBe('Crear Cliente');
      expect(submitButton.attributes('disabled')).toBeUndefined();
    });
  });
});
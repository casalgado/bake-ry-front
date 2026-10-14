import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import ProductCollectionForm from '../ProductCollectionForm.vue';
import UiYesNo from '@/components/ui/UiYesNo.vue';

// Mock helpers
vi.mock('@/utils/helpers', () => ({
  cleanString: (str) => str.toLowerCase().trim(),
}));

const MockConfirmDialog = {
  name: 'ConfirmDialog',
  props: ['isOpen', 'title', 'message'],
  emits: ['confirm', 'cancel'],
  template: '<div v-if="isOpen" class="mock-confirm">{{ title }}</div>',
};

const MockVariationsManager = {
  name: 'VariationsManager',
  props: ['initialVariations', 'productName', 'isCategoryTemplateMode'],
  emits: ['update'],
  template: '<div class="mock-variations-manager">{{ productName }}</div>',
};

describe('ProductCollectionForm', () => {
  let wrapper;

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const createWrapper = (props = {}) => {
    return mount(ProductCollectionForm, {
      props,
      global: {
        stubs: {
          ConfirmDialog: MockConfirmDialog,
          VariationsManager: MockVariationsManager,
          teleport: true,
        },
      },
    });
  };

  describe('Component Initialization', () => {
    it('renders with default props', () => {
      wrapper = createWrapper();

      expect(wrapper.find('h2').text()).toBe('Crear Categoría');
      expect(wrapper.find('#name').exists()).toBe(true);
      expect(wrapper.find('#description').exists()).toBe(true);
    });

    it('uses custom title when provided', () => {
      wrapper = createWrapper({ title: 'Editar Categoría' });

      expect(wrapper.find('h2').text()).toBe('Editar Categoría');
    });

    it('initializes with provided data', async () => {
      const initialData = {
        name: 'Test Category',
        description: 'Test Description',
        isActive: false,
        variationTemplates: [{ name: 'pequeño', value: 100 }],
        dimensionTemplates: {
          dimensions: [{ id: 'dim1', type: 'SIZE', label: 'Size' }],
        },
      };

      wrapper = createWrapper({ initialData });
      await flushPromises();

      expect(wrapper.vm.formData.name).toBe('Test Category');
      expect(wrapper.vm.formData.description).toBe('Test Description');
      expect(wrapper.vm.formData.isActive).toBe(false);
      expect(wrapper.vm.hasDimensionTemplates).toBe(true);
    });

    it('carries legacy variationTemplates through untouched', () => {
      const initialData = { name: 'Old', variationTemplates: [{ name: 'pequeño', value: 100 }] };
      wrapper = createWrapper({ initialData });

      expect(wrapper.vm.formData.variationTemplates).toEqual([{ name: 'pequeño', value: 100 }]);
    });

    it('initializes with empty state when no initial data', () => {
      wrapper = createWrapper();

      expect(wrapper.vm.formData.name).toBe('');
      expect(wrapper.vm.formData.description).toBe('');
      expect(wrapper.vm.formData.isActive).toBe(true);
      expect(wrapper.vm.hasDimensionTemplates).toBe(false);
    });
  });

  describe('Basic Form Fields', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('updates name field', async () => {
      await wrapper.find('#name').setValue('New Category Name');

      expect(wrapper.vm.formData.name).toBe('New Category Name');
    });

    it('updates description field', async () => {
      await wrapper.find('#description').setValue('New Category Description');

      expect(wrapper.vm.formData.description).toBe('New Category Description');
    });

    it('shows dimension templates toggle', () => {
      const toggle = wrapper.findComponent(UiYesNo);
      expect(toggle.exists()).toBe(true);
      expect(toggle.props('label')).toContain('variaciones');
    });

    it('toggles dimension templates', async () => {
      await wrapper.findComponent(UiYesNo).vm.$emit('update:modelValue', true);

      expect(wrapper.vm.hasDimensionTemplates).toBe(true);
    });
  });

  describe('Dimension Templates Integration', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('shows VariationsManager when dimension templates enabled', async () => {
      wrapper.vm.hasDimensionTemplates = true;
      await nextTick();

      const variationsManager = wrapper.findComponent(MockVariationsManager);
      expect(variationsManager.exists()).toBe(true);
      expect(variationsManager.props('isCategoryTemplateMode')).toBe(true);
    });

    it('handles dimension template updates', async () => {
      wrapper.vm.hasDimensionTemplates = true;
      await nextTick();

      wrapper.vm.handleDimensionTemplateUpdate({
        dimensions: [{ id: 'dim1', type: 'WEIGHT', label: 'Weight', unit: 'g' }],
      });

      expect(wrapper.vm.formData.dimensionTemplates.dimensions).toHaveLength(1);
      expect(wrapper.vm.formData.dimensionTemplates.dimensions[0].id).toBe('dim1');
    });

    it('shows confirmation when disabling dimension templates with existing data', async () => {
      wrapper.vm.formData.dimensionTemplates = {
        dimensions: [{ id: 'dim1', type: 'WEIGHT', label: 'Weight' }],
      };
      wrapper.vm.hasDimensionTemplates = true;
      await nextTick();

      wrapper.vm.hasDimensionTemplates = false;
      await nextTick();

      expect(wrapper.vm.confirmDialog.isOpen).toBe(true);
      expect(wrapper.vm.confirmDialog.title).toContain('variaciones');
      // The toggle stays on until the user confirms.
      expect(wrapper.vm.hasDimensionTemplates).toBe(true);
    });

    it('cancelling the confirmation keeps the dimensions', async () => {
      wrapper.vm.formData.dimensionTemplates = {
        dimensions: [{ id: 'dim1', type: 'WEIGHT', label: 'Weight' }],
      };
      wrapper.vm.hasDimensionTemplates = true;
      await nextTick();
      wrapper.vm.hasDimensionTemplates = false;
      await nextTick();

      wrapper.vm.confirmDialog.onCancel();
      await nextTick();

      expect(wrapper.vm.confirmDialog.isOpen).toBe(false);
      expect(wrapper.vm.hasDimensionTemplates).toBe(true);
      expect(wrapper.vm.formData.dimensionTemplates.dimensions).toHaveLength(1);
    });

    it('confirming the dialog drops the dimensions', async () => {
      wrapper.vm.formData.dimensionTemplates = {
        dimensions: [{ id: 'dim1', type: 'WEIGHT', label: 'Weight' }],
      };
      wrapper.vm.hasDimensionTemplates = true;
      await nextTick();
      wrapper.vm.hasDimensionTemplates = false;
      await nextTick();

      wrapper.vm.confirmDialog.onConfirm();
      await nextTick();

      expect(wrapper.vm.confirmDialog.isOpen).toBe(false);
      expect(wrapper.vm.formData.dimensionTemplates.dimensions).toHaveLength(0);
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('validates required name field', () => {
      expect(wrapper.vm.validate()).toBe(false);
      expect(wrapper.vm.errors.name).toBeTruthy();
    });

    it('validates minimum name length', () => {
      wrapper.vm.formData.name = 'AB';

      expect(wrapper.vm.validate()).toBe(false);
      expect(wrapper.vm.errors.name).toBe('Nombre debe tener al menos 3 caracteres');
    });

    it('passes validation with valid data', () => {
      wrapper.vm.formData.name = 'Valid Category Name';

      expect(wrapper.vm.validate()).toBe(true);
      expect(Object.keys(wrapper.vm.errors)).toHaveLength(0);
    });

    it('marks the name invalid and links the message', async () => {
      await wrapper.find('form').trigger('submit.prevent');

      expect(wrapper.find('#name').attributes('aria-invalid')).toBe('true');
      expect(wrapper.find('#name').attributes('aria-describedby')).toBe('name-e');
      expect(wrapper.find('#name-e').exists()).toBe(true);
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('emits submit event with cleaned data', async () => {
      wrapper.vm.formData.name = '  Test Category  ';
      wrapper.vm.formData.description = 'Test Description';

      await wrapper.find('form').trigger('submit.prevent');

      expect(wrapper.emitted('submit')).toBeTruthy();
      const submittedData = wrapper.emitted('submit')[0][0];
      expect(submittedData.name).toBe('test category');
      expect(submittedData.description).toBe('Test Description');
    });

    it('does not submit if validation fails', async () => {
      wrapper.vm.formData.name = '';

      await wrapper.find('form').trigger('submit.prevent');

      expect(wrapper.emitted('submit')).toBeFalsy();
    });

    it('emits cancel event when cancel button clicked', async () => {
      const cancelButton = wrapper.findAll('button').find(button => button.text() === 'Cancelar');
      await cancelButton.trigger('click');

      expect(wrapper.emitted('cancel')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('disables form when loading', () => {
      wrapper = createWrapper({ loading: true });

      const submitButton = wrapper.find('button[type="submit"]');
      const cancelButton = wrapper.findAll('button').find(button => button.text() === 'Cancelar');

      expect(submitButton.attributes('disabled')).toBeDefined();
      expect(cancelButton.attributes('disabled')).toBeDefined();
    });

    it('shows loading text for create mode', () => {
      wrapper = createWrapper({ loading: true });

      expect(wrapper.find('button[type="submit"]').text()).toBe('Creando...');
    });

    it('shows loading text for edit mode', () => {
      wrapper = createWrapper({ loading: true, initialData: { name: 'Test' } });

      expect(wrapper.find('button[type="submit"]').text()).toBe('Actualizando...');
    });
  });
});

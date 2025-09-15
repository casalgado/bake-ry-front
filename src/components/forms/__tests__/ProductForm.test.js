import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import ProductForm from '../ProductForm.vue';

// Mock the stores
vi.mock('@/stores/productCollectionStore', () => ({
  useProductCollectionStore: vi.fn(() => ({
    items: [
      { id: 'cat1', name: 'Pasteles', variationTemplates: [] },
      { id: 'cat2', name: 'Panes', variationTemplates: [{ name: 'Small', value: 500 }] },
    ],
    isLoaded: true,
    fetchAll: vi.fn(),
  })),
}));

// Mock components
const MockConfirmDialog = {
  name: 'ConfirmDialog',
  props: ['isOpen', 'title', 'message'],
  emits: ['confirm', 'cancel'],
  template: '<div v-if="isOpen">{{ title }}</div>',
};

const MockYesNoToggle = {
  name: 'YesNoToggle',
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template: `
    <div>
      <label>{{ label }}</label>
      <input
        type="checkbox"
        :checked="modelValue"
        @change="$emit('update:modelValue', $event.target.checked)"
      />
    </div>
  `,
};

// Mock VariationCombinationManager
const MockVariationCombinationManager = {
  name: 'VariationCombinationManager',
  props: ['variationGroup'],
  emits: ['update-combination-price'],
  template: '<div class="mock-combination-manager">Mock Combination Manager</div>',
};

// Mock VariationsManager that doesn't exist yet
const MockVariationsManager = {
  name: 'VariationsManager',
  props: ['initialVariations', 'categoryTemplates', 'productName', 'collectionId'],
  emits: ['update'],
  template: '<div class="mock-variations-manager">Mock VariationsManager</div>',
};

describe('ProductForm', () => {
  let wrapper;

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const createWrapper = (props = {}) => {
    return mount(ProductForm, {
      props,
      global: {
        components: {
          ConfirmDialog: MockConfirmDialog,
          YesNoToggle: MockYesNoToggle,
          VariationsManager: MockVariationsManager,
          VariationCombinationManager: MockVariationCombinationManager,
        },
        stubs: {
          teleport: true,
        },
      },
    });
  };

  describe('Basic Structure', () => {
    it('renders the form with all basic fields', () => {
      wrapper = createWrapper();

      expect(wrapper.find('#name').exists()).toBe(true);
      expect(wrapper.find('#description').exists()).toBe(true);
      expect(wrapper.find('#collection').exists()).toBe(true);
      expect(wrapper.find('#taxPercentage').exists()).toBe(true);
      expect(wrapper.find('#basePrice').exists()).toBe(true);
      expect(wrapper.find('#costPrice').exists()).toBe(true);
    });

    it('uses the new variations structure', () => {
      wrapper = createWrapper();

      expect(wrapper.vm.formData.variations).toEqual({
        dimensions: [],
        combinations: [],
      });
    });

    it('displays custom title when provided', () => {
      wrapper = createWrapper({ title: 'Editar Producto' });

      expect(wrapper.find('h2').text()).toBe('Editar Producto');
    });
  });

  describe('Price Fields Visibility', () => {
    it('shows basePrice and costPrice when no variations', async () => {
      wrapper = createWrapper();

      expect(wrapper.find('#basePrice').exists()).toBe(true);
      expect(wrapper.find('#costPrice').exists()).toBe(true);
    });

    it('hides basePrice and costPrice when variations exist', async () => {
      wrapper = createWrapper();

      // Enable variations
      wrapper.vm.formData.hasVariations = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.find('#basePrice').exists()).toBe(false);
      expect(wrapper.find('#costPrice').exists()).toBe(false);
    });
  });

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      wrapper = createWrapper();

      // Submit without filling required fields
      await wrapper.find('form').trigger('submit.prevent');

      expect(wrapper.vm.errors.name).toBeTruthy();
      expect(wrapper.vm.errors.collectionId).toBeTruthy();
      expect(wrapper.vm.errors.basePrice).toBeTruthy();
    });

    it('validates name length', async () => {
      wrapper = createWrapper();

      await wrapper.find('#name').setValue('AB');
      await wrapper.find('form').trigger('submit.prevent');

      expect(wrapper.vm.errors.name).toBe('Nombre debe tener al menos 3 caracteres');
    });

    it('validates costPrice is not negative', async () => {
      wrapper = createWrapper();

      await wrapper.find('#name').setValue('Test Product');
      await wrapper.find('#collection').setValue('cat1');
      await wrapper.find('#basePrice').setValue(1000);
      await wrapper.find('#costPrice').setValue(-100);

      await wrapper.find('form').trigger('submit.prevent');

      expect(wrapper.vm.errors.costPrice).toBe('Precio de costo no puede ser negativo');
    });

    it('does not validate prices when variations exist', async () => {
      wrapper = createWrapper();

      // Enable variations with proper structure
      wrapper.vm.formData.hasVariations = true;
      wrapper.vm.formData.variations = {
        dimensions: [{
          id: 'dim1',
          type: 'SIZE',
          label: 'Size',
          options: [{ name: 'small', value: 1 }],
          displayOrder: 0
        }],
        combinations: [{
          id: 'combo1',
          selection: ['small'],
          name: 'small',
          basePrice: 100,
          costPrice: 50,
          isActive: true,
          isWholeGrain: false
        }],
      };

      await wrapper.find('#name').setValue('Test Product');
      await wrapper.find('#collection').setValue('cat1');

      await wrapper.find('form').trigger('submit.prevent');

      expect(wrapper.vm.errors.basePrice).toBeUndefined();
      expect(wrapper.vm.errors.costPrice).toBeUndefined();
    });
  });

  describe('Variation Management', () => {
    it('handles variation toggle', async () => {
      wrapper = createWrapper();

      const toggle = wrapper.findAllComponents(MockYesNoToggle).find(
        (c) => c.props('label') === '¿Este producto tiene variaciones?'
      );

      // Enable variations
      await toggle.vm.$emit('update:modelValue', true);
      expect(wrapper.vm.formData.hasVariations).toBe(true);

      // Disable variations
      await toggle.vm.$emit('update:modelValue', false);
      expect(wrapper.vm.formData.hasVariations).toBe(false);
    });

    it('shows confirmation when disabling variations with data', async () => {
      wrapper = createWrapper();

      // Add some variations with proper structure
      wrapper.vm.formData.variations = {
        dimensions: [{
          id: 'dim1',
          type: 'SIZE',
          label: 'Size',
          options: [{ name: 'small', value: 1 }],
          displayOrder: 0
        }],
        combinations: [{
          id: 'combo1',
          selection: ['small'],
          name: 'small',
          basePrice: 100,
          costPrice: 50,
          isActive: true,
          isWholeGrain: false
        }],
      };
      wrapper.vm.formData.hasVariations = true;

      await wrapper.vm.$nextTick();

      // Try to disable variations
      wrapper.vm.toggleVariations(false, true);

      expect(wrapper.vm.confirmDialog.isOpen).toBe(true);
      expect(wrapper.vm.confirmDialog.title).toBe('Eliminar variaciones');
    });

    it('clears variations when confirmed', async () => {
      wrapper = createWrapper();

      wrapper.vm.formData.variations = {
        dimensions: [{
          id: 'dim1',
          type: 'SIZE',
          label: 'Size',
          options: [{ name: 'small', value: 1 }],
          displayOrder: 0
        }],
        combinations: [{
          id: 'combo1',
          selection: ['small'],
          name: 'small',
          basePrice: 100,
          costPrice: 50,
          isActive: true,
          isWholeGrain: false
        }],
      };
      wrapper.vm.formData.hasVariations = true;

      wrapper.vm.toggleVariations(false, true);

      // Confirm deletion
      wrapper.vm.confirmDialog.onConfirm();

      expect(wrapper.vm.formData.variations).toEqual({
        dimensions: [],
        combinations: [],
      });
      expect(wrapper.vm.formData.hasVariations).toBe(false);
    });

    it('handles variation updates from VariationsManager', async () => {
      wrapper = createWrapper();

      const testVariations = {
        dimensions: [
          {
            id: 'dim1',
            type: 'WEIGHT',
            label: 'Weight',
            unit: 'g',
            options: [
              { name: 'small', value: 500 },
              { name: 'large', value: 1000 },
            ],
          },
        ],
        combinations: [
          { id: 'combo1', selection: ['small'], basePrice: 100, costPrice: 50 },
          { id: 'combo2', selection: ['large'], basePrice: 200, costPrice: 100 },
        ],
      };

      wrapper.vm.handleVariationUpdate(testVariations);

      expect(wrapper.vm.formData.variations).toEqual(testVariations);
      expect(wrapper.vm.formData.hasVariations).toBe(true);
      expect(wrapper.vm.formData.basePrice).toBe(0);
      expect(wrapper.vm.formData.costPrice).toBe(0);
    });
  });

  describe('Form Submission', () => {
    it('emits submit event with form data', async () => {
      wrapper = createWrapper();

      await wrapper.find('#name').setValue('Test Product');
      await wrapper.find('#description').setValue('Test Description');
      await wrapper.find('#collection').setValue('cat1');
      await wrapper.find('#taxPercentage').setValue(15);
      await wrapper.find('#basePrice').setValue(1000);
      await wrapper.find('#costPrice').setValue(500);

      await wrapper.find('form').trigger('submit.prevent');

      expect(wrapper.emitted('submit')).toBeTruthy();
      const submittedData = wrapper.emitted('submit')[0][0];

      expect(submittedData.name).toBe('test product');
      expect(submittedData.description).toBe('test description');
      expect(submittedData.collectionId).toBe('cat1');
      expect(submittedData.taxPercentage).toBe(15);
      expect(submittedData.basePrice).toBe(1000);
      expect(submittedData.costPrice).toBe(500);
      expect(submittedData.variations).toEqual({
        dimensions: [],
        combinations: [],
      });
    });

    it('cleans strings before submission', async () => {
      wrapper = createWrapper();

      await wrapper.find('#name').setValue('  Test Product  ');
      await wrapper.find('#description').setValue('  Test Description  ');
      await wrapper.find('#collection').setValue('cat1');
      await wrapper.find('#basePrice').setValue(1000);

      await wrapper.find('form').trigger('submit.prevent');

      const submittedData = wrapper.emitted('submit')[0][0];
      expect(submittedData.name).toBe('test product');
      expect(submittedData.description).toBe('test description');
    });
  });

  describe('Initial Data', () => {
    it('loads initial data when editing', async () => {
      const initialData = {
        name: 'Existing Product',
        description: 'Existing Description',
        collectionId: 'cat1',
        collectionName: 'Pasteles',
        taxPercentage: 10,
        basePrice: 2000,
        costPrice: 1000,
        isActive: false,
        variations: {
          dimensions: [{
            id: 'dim1',
            type: 'SIZE',
            label: 'Size',
            options: [{ name: 'medium', value: 1 }],
            displayOrder: 0
          }],
          combinations: [{
            id: 'combo1',
            selection: ['medium'],
            name: 'medium',
            basePrice: 100,
            costPrice: 50,
            isActive: true,
            isWholeGrain: false
          }],
        },
      };

      wrapper = createWrapper({ initialData });
      await flushPromises();

      expect(wrapper.vm.formData.name).toBe('Existing Product');
      expect(wrapper.vm.formData.description).toBe('Existing Description');
      expect(wrapper.vm.formData.collectionId).toBe('cat1');
      expect(wrapper.vm.formData.taxPercentage).toBe(10);
      expect(wrapper.vm.formData.isActive).toBe(false);
      expect(wrapper.vm.formData.hasVariations).toBe(true);
      expect(wrapper.vm.formData.variations.combinations.length).toBe(1);
    });

    it('handles initial data without variations', async () => {
      const initialData = {
        name: 'Simple Product',
        collectionId: 'cat1',
        basePrice: 1500,
        costPrice: 750,
        hasVariations: false,
      };

      wrapper = createWrapper({ initialData });
      await flushPromises();

      expect(wrapper.vm.formData.variations).toEqual({
        dimensions: [],
        combinations: [],
      });
      expect(wrapper.vm.formData.hasVariations).toBe(false);
    });
  });

  describe('Category Management', () => {
    it('updates collection name when category is selected', async () => {
      wrapper = createWrapper();

      await wrapper.find('#collection').setValue('cat1');
      wrapper.vm.handleCategoryChange();

      expect(wrapper.vm.formData.collectionName).toBe('Pasteles');
    });

    it('clears collection name when no category is selected', async () => {
      wrapper = createWrapper();

      wrapper.vm.formData.collectionId = '';
      wrapper.vm.handleCategoryChange();

      expect(wrapper.vm.formData.collectionName).toBe('');
    });

    it('provides selected category to VariationsManager placeholder', async () => {
      wrapper = createWrapper();

      await wrapper.find('#collection').setValue('cat2');
      wrapper.vm.formData.hasVariations = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.selectedCategory.id).toBe('cat2');
      expect(wrapper.vm.selectedCategory.variationTemplates).toHaveLength(1);
    });
  });

  describe('Form Reset', () => {
    it('resets form to initial state', async () => {
      wrapper = createWrapper();

      // Fill form
      await wrapper.find('#name').setValue('Test Product');
      await wrapper.find('#collection').setValue('cat1');
      wrapper.vm.formData.hasVariations = true;

      // Reset
      wrapper.vm.resetForm();

      expect(wrapper.vm.formData.name).toBe('');
      expect(wrapper.vm.formData.collectionId).toBe('');
      expect(wrapper.vm.formData.hasVariations).toBe(false);
      expect(wrapper.vm.formData.basePrice).toBe(0);
      expect(wrapper.vm.formData.costPrice).toBe(0);
      expect(wrapper.vm.formData.variations).toEqual({
        dimensions: [],
        combinations: [],
      });
      expect(wrapper.vm.errors).toEqual({});
    });
  });

  describe('Loading State', () => {
    it('disables submit button when loading', async () => {
      wrapper = createWrapper({ loading: true });

      const submitButton = wrapper.find('button[type="submit"]');
      expect(submitButton.attributes('disabled')).toBeDefined();
      expect(submitButton.text()).toContain('Creando...');
    });

    it('shows correct loading text when editing', async () => {
      wrapper = createWrapper({
        loading: true,
        initialData: { name: 'Test' },
      });

      const submitButton = wrapper.find('button[type="submit"]');
      expect(submitButton.text()).toContain('Actualizando...');
    });
  });
});
import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import ProductCollectionForm from '../ProductCollectionForm.vue';

// Mock the system settings store
const mockSystemSettingsStore = {
  isLoaded: true,
  unitOptions: [
    { symbol: 'g', name: 'Gram', type: 'weight', template: 'WEIGHT' },
    { symbol: 'Kg', name: 'Kilogram', type: 'weight', template: 'WEIGHT' },
    { symbol: 'ml', name: 'Milliliter', type: 'volume', template: 'WEIGHT' },
    { symbol: 'uds', name: 'Units', type: 'count', template: 'QUANTITY' },
    { symbol: 'docena', name: 'Dozen', type: 'count', template: 'QUANTITY' },
  ],
  defaultVariationTemplates: {
    WEIGHT: {
      label: 'Peso / Volumen',
      unit: 'g',
      defaults: [
        { name: 'pequeño', value: 100, basePrice: 0, recipeId: '' },
        { name: 'mediano', value: 200, basePrice: 0, recipeId: '' },
        { name: 'grande', value: 300, basePrice: 0, recipeId: '' },
      ],
    },
    QUANTITY: {
      label: 'Cantidad',
      unit: 'uds',
      prefix: 'x',
      defaults: [
        { name: 'x4', value: 4, basePrice: 0, recipeId: '' },
        { name: 'x6', value: 6, basePrice: 0, recipeId: '' },
        { name: 'x12', value: 12, basePrice: 0, recipeId: '' },
      ],
    },
    SIZE: {
      label: 'Tamaño',
      unit: '',
      defaults: [
        { name: 'pequeño', value: 2, basePrice: 0, recipeId: '' },
        { name: 'mediano', value: 4, basePrice: 0, recipeId: '' },
        { name: 'grande', value: 6, basePrice: 0, recipeId: '' },
      ],
    },
  },
  fetchSettings: vi.fn().mockResolvedValue({}),
};

vi.mock('@/stores/systemSettingsStore', () => ({
  useSystemSettingsStore: () => mockSystemSettingsStore,
}));

// Mock the router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  currentRoute: { value: { path: '/test' } },
};

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
}));

// Mock helpers
vi.mock('@/utils/helpers', () => ({
  cleanString: (str) => str.toLowerCase().trim(),
  getVariationTypeLabel: (type) => {
    const labels = {
      WEIGHT: 'Peso / Volumen',
      QUANTITY: 'Cantidad',
      SIZE: 'Tamaño / Color',
    };
    return labels[type] || type;
  },
  getUnitTypeLabel: (type) => {
    const labels = {
      weight: 'Peso',
      volume: 'Volumen',
      count: 'Cantidad',
    };
    return labels[type] || type;
  },
  capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
}));

// Mock child components
const MockTemplateVariation = {
  name: 'TemplateVariation',
  props: ['template', 'isNew', 'defaultVariationType', 'basePrice'],
  emits: ['add', 'remove', 'update'],
  template: `
    <div class="mock-template-variation">
      <span class="template-name">{{ template.name || 'New Template' }}</span>
      <span class="template-value">{{ template.value }}</span>
      <span class="template-unit">{{ template.unit }}</span>
      <button v-if="!isNew" @click="$emit('remove')" class="remove-btn">Remove</button>
      <button v-if="isNew" @click="$emit('add')" class="add-btn">Add</button>
      <input
        v-if="isNew"
        @input="$emit('update', { field: 'name', value: $event.target.value })"
        placeholder="Template name"
        class="name-input"
      />
      <input
        v-if="isNew"
        type="number"
        @input="$emit('update', { field: 'value', value: Number($event.target.value) })"
        placeholder="Template value"
        class="value-input"
      />
    </div>
  `,
};

const MockConfirmDialog = {
  name: 'ConfirmDialog',
  props: ['isOpen', 'title', 'message', 'confirmText', 'cancelText'],
  emits: ['confirm', 'cancel'],
  template: `
    <div v-if="isOpen" class="mock-confirm-dialog">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <button @click="$emit('confirm')" class="confirm-btn">{{ confirmText }}</button>
      <button @click="$emit('cancel')" class="cancel-btn">{{ cancelText }}</button>
    </div>
  `,
};

const MockYesNoToggle = {
  name: 'YesNoToggle',
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template: `
    <div class="mock-yes-no-toggle" @click="$emit('update:modelValue', !modelValue)">
      <label>{{ label }}</label>
      <span class="toggle-state">{{ modelValue ? 'Yes' : 'No' }}</span>
    </div>
  `,
};

const MockVariationsManager = {
  name: 'VariationsManager',
  props: ['initialVariations', 'productName', 'isCategoryTemplateMode'],
  emits: ['update'],
  template: `
    <div class="mock-variations-manager">
      <h4>Variations Manager</h4>
      <p>Product: {{ productName }}</p>
      <p>Template Mode: {{ isCategoryTemplateMode }}</p>
      <button @click="$emit('update', { dimensions: [{ id: 'dim1', type: 'WEIGHT', label: 'Weight' }] })" class="emit-update-btn">
        Emit Update
      </button>
    </div>
  `,
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
        components: {
          TemplateVariation: MockTemplateVariation,
          ConfirmDialog: MockConfirmDialog,
          YesNoToggle: MockYesNoToggle,
          VariationsManager: MockVariationsManager,
        },
        stubs: {
          teleport: true,
        },
      },
    });
  };

  describe('Component Initialization', () => {
    it('renders with default props', () => {
      wrapper = createWrapper();

      expect(wrapper.exists()).toBe(true);
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
        defaultVariationType: 'WEIGHT',
        defaultUnit: 'Kg',
        hasWholeGrainVariations: true,
        variationTemplates: [
          { name: 'pequeño', value: 100, unit: 'g', type: 'WEIGHT', isWholeGrain: false },
        ],
        dimensionTemplates: {
          dimensions: [{ id: 'dim1', type: 'SIZE', label: 'Size' }],
        },
      };

      wrapper = createWrapper({ initialData });
      await flushPromises();

      expect(wrapper.vm.formData.name).toBe('Test Category');
      expect(wrapper.vm.formData.description).toBe('Test Description');
      expect(wrapper.vm.formData.isActive).toBe(false);
      expect(wrapper.vm.formData.defaultVariationType).toBe('WEIGHT');
      expect(wrapper.vm.formData.defaultUnit).toBe('Kg');
      expect(wrapper.vm.formData.hasWholeGrainVariations).toBe(true);
      expect(wrapper.vm.formData.variationTemplates).toHaveLength(1);
      expect(wrapper.vm.hasVariationTemplates).toBe(true);
      expect(wrapper.vm.hasDimensionTemplates).toBe(true);
    });

    it('initializes with empty state when no initial data', () => {
      wrapper = createWrapper();

      expect(wrapper.vm.formData.name).toBe('');
      expect(wrapper.vm.formData.description).toBe('');
      expect(wrapper.vm.formData.isActive).toBe(true);
      expect(wrapper.vm.formData.defaultVariationType).toBe('');
      expect(wrapper.vm.formData.defaultUnit).toBe('g');
      expect(wrapper.vm.formData.hasWholeGrainVariations).toBe(false);
      expect(wrapper.vm.formData.variationTemplates).toHaveLength(0);
      expect(wrapper.vm.hasVariationTemplates).toBe(false);
      expect(wrapper.vm.hasDimensionTemplates).toBe(false);
    });
  });

  describe('Basic Form Fields', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('updates name field', async () => {
      const nameInput = wrapper.find('#name');
      await nameInput.setValue('New Category Name');

      expect(wrapper.vm.formData.name).toBe('New Category Name');
    });

    it('updates description field', async () => {
      const descriptionInput = wrapper.find('#description');
      await descriptionInput.setValue('New Category Description');

      expect(wrapper.vm.formData.description).toBe('New Category Description');
    });

    it('shows dimension templates toggle', () => {
      const toggle = wrapper.findComponent(MockYesNoToggle);
      expect(toggle.exists()).toBe(true);
      expect(toggle.props('label')).toContain('variaciones');
    });

    it('toggles dimension templates', async () => {
      const toggle = wrapper.findComponent(MockYesNoToggle);
      await toggle.vm.$emit('update:modelValue', true);

      expect(wrapper.vm.hasDimensionTemplates).toBe(true);
    });
  });

  describe('Variation Type Management', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      // Enable variation templates first
      wrapper.vm.hasVariationTemplates = true;
      await nextTick();
    });

    it('shows variation type selection when templates enabled', () => {
      const weightRadio = wrapper.find('#variation-type-weight');
      const quantityRadio = wrapper.find('#variation-type-quantity');
      const sizeRadio = wrapper.find('#variation-type-size');

      expect(weightRadio.exists()).toBe(true);
      expect(quantityRadio.exists()).toBe(true);
      expect(sizeRadio.exists()).toBe(true);
    });

    it('selects variation type', async () => {
      const weightRadio = wrapper.find('#variation-type-weight');
      await weightRadio.setChecked(true);

      expect(wrapper.vm.formData.defaultVariationType).toBe('WEIGHT');
    });

    it('shows unit selection for WEIGHT type', async () => {
      wrapper.vm.formData.defaultVariationType = 'WEIGHT';
      await nextTick();

      expect(wrapper.vm.showUnitSelection).toBeTruthy(); // Returns 'g' which is truthy
      const unitOptions = wrapper.findAll('input[name="defaultUnit"]');
      expect(unitOptions.length).toBeGreaterThan(0);
    });

    it('shows unit selection for QUANTITY type', async () => {
      wrapper.vm.formData.defaultVariationType = 'QUANTITY';
      await nextTick();

      expect(wrapper.vm.showUnitSelection).toBeTruthy(); // Returns 'uds' which is truthy
    });

    it('does not show unit selection for SIZE type', async () => {
      wrapper.vm.formData.defaultVariationType = 'SIZE';
      await nextTick();

      expect(wrapper.vm.showUnitSelection).toBeFalsy(); // Returns '' which is falsy
    });

    it('filters unit options by variation type', async () => {
      wrapper.vm.formData.defaultVariationType = 'WEIGHT';
      await nextTick();

      const weightUnits = wrapper.vm.unitPillOptions;
      expect(weightUnits.every(unit => unit.value === 'g' || unit.value === 'Kg' || unit.value === 'ml')).toBe(true);
    });

    it('loads system default templates when type changes', async () => {
      wrapper.vm.formData.defaultVariationType = 'WEIGHT';
      await nextTick();

      expect(wrapper.vm.formData.variationTemplates.length).toBeGreaterThan(0);
      expect(wrapper.vm.formData.variationTemplates[0].name).toBe('pequeño');
      expect(wrapper.vm.formData.variationTemplates[0].type).toBe('WEIGHT');
    });
  });

  describe('Whole Grain Variations', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      wrapper.vm.hasVariationTemplates = true;
      wrapper.vm.formData.defaultVariationType = 'WEIGHT';
      await nextTick();
    });

    it('shows whole grain toggle for non-SIZE types', () => {
      const wholeGrainToggles = wrapper.findAllComponents(MockYesNoToggle);
      const wholeGrainToggle = wholeGrainToggles.find(toggle =>
        toggle.props('label').includes('integrales')
      );
      expect(wholeGrainToggle.exists()).toBe(true);
    });

    it('does not show whole grain toggle for SIZE type', async () => {
      wrapper.vm.formData.defaultVariationType = 'SIZE';
      await nextTick();

      const wholeGrainToggles = wrapper.findAllComponents(MockYesNoToggle);
      const wholeGrainToggle = wholeGrainToggles.find(toggle =>
        toggle.props('label').includes('integrales')
      );
      expect(wholeGrainToggle).toBe(undefined);
    });

    it('adds whole grain variations when enabled', async () => {
      const initialCount = wrapper.vm.formData.variationTemplates.length;

      wrapper.vm.formData.hasWholeGrainVariations = true;
      await nextTick();

      // Should have added integral versions
      const finalCount = wrapper.vm.formData.variationTemplates.length;
      expect(finalCount).toBeGreaterThan(initialCount);

      const integralTemplates = wrapper.vm.formData.variationTemplates.filter(t => t.isWholeGrain);
      expect(integralTemplates.length).toBeGreaterThan(0);
      expect(integralTemplates[0].name).toContain('integral');
    });

    it('shows confirmation when disabling whole grain with existing variations', async () => {
      // Enable whole grain first
      wrapper.vm.formData.hasWholeGrainVariations = true;
      await nextTick();

      // Try to disable - should show confirmation
      wrapper.vm.formData.hasWholeGrainVariations = false;
      await nextTick();

      expect(wrapper.vm.confirmDialog.isOpen).toBe(true);
      expect(wrapper.vm.confirmDialog.title).toContain('integrales');
    });
  });

  describe('Template Management', () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      wrapper.vm.hasVariationTemplates = true;
      wrapper.vm.formData.defaultVariationType = 'WEIGHT';
      await nextTick();
    });

    it('displays existing templates', () => {
      const templateComponents = wrapper.findAllComponents(MockTemplateVariation);
      // Should have existing templates + 1 new template form
      expect(templateComponents.length).toBeGreaterThan(1);
    });

    it('can add new template', async () => {
      const initialCount = wrapper.vm.formData.variationTemplates.length;

      // Set values for new template
      wrapper.vm.newTemplate.name = 'extra grande';
      wrapper.vm.newTemplate.value = 400;

      // Trigger add
      wrapper.vm.addNewTemplate();

      expect(wrapper.vm.formData.variationTemplates.length).toBe(initialCount + 1);
      const newTemplate = wrapper.vm.formData.variationTemplates.find(t => t.name === 'extra grande');
      expect(newTemplate).toBeTruthy();
      expect(newTemplate.value).toBe(400);
    });

    it('can remove existing template', async () => {
      const initialCount = wrapper.vm.formData.variationTemplates.length;

      wrapper.vm.removeTemplate(0);

      expect(wrapper.vm.formData.variationTemplates.length).toBe(initialCount - 1);
    });

    it('can update existing template', async () => {
      wrapper.vm.updateTemplate(0, { field: 'name', value: 'updated name' });

      expect(wrapper.vm.formData.variationTemplates[0].name).toBe('updated name');
    });

    it('validates new template before adding', async () => {
      const initialCount = wrapper.vm.formData.variationTemplates.length;

      // Try to add template without name
      wrapper.vm.newTemplate.name = '';
      wrapper.vm.newTemplate.value = 100;

      wrapper.vm.addNewTemplate();

      // Should not add template
      expect(wrapper.vm.formData.variationTemplates.length).toBe(initialCount);
    });

    it('resets template form after adding', async () => {
      wrapper.vm.newTemplate.name = 'test template';
      wrapper.vm.newTemplate.value = 100;

      wrapper.vm.addNewTemplate();

      expect(wrapper.vm.newTemplate.name).toBe('');
      expect(wrapper.vm.newTemplate.value).toBe(0);
    });

    it('adds whole grain version when whole grain is enabled', async () => {
      wrapper.vm.formData.hasWholeGrainVariations = true;
      await nextTick();

      const initialCount = wrapper.vm.formData.variationTemplates.length;

      wrapper.vm.newTemplate.name = 'test template';
      wrapper.vm.newTemplate.value = 100;
      wrapper.vm.addNewTemplate();

      // Should add both regular and integral versions
      expect(wrapper.vm.formData.variationTemplates.length).toBe(initialCount + 2);

      const regularTemplate = wrapper.vm.formData.variationTemplates.find(t =>
        t.name === 'test template' && !t.isWholeGrain
      );
      const integralTemplate = wrapper.vm.formData.variationTemplates.find(t =>
        t.name === 'test template integral' && t.isWholeGrain
      );

      expect(regularTemplate).toBeTruthy();
      expect(integralTemplate).toBeTruthy();
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

      const updateData = {
        dimensions: [
          { id: 'dim1', type: 'WEIGHT', label: 'Weight', unit: 'g' },
        ],
      };

      wrapper.vm.handleDimensionTemplateUpdate(updateData);

      expect(wrapper.vm.formData.dimensionTemplates.dimensions).toHaveLength(1);
      expect(wrapper.vm.formData.dimensionTemplates.dimensions[0].id).toBe('dim1');
    });

    it('shows confirmation when disabling dimension templates with existing data', async () => {
      // Set up existing dimension templates
      wrapper.vm.formData.dimensionTemplates = {
        dimensions: [{ id: 'dim1', type: 'WEIGHT', label: 'Weight' }],
      };
      wrapper.vm.hasDimensionTemplates = true;
      await nextTick();

      // Try to disable
      wrapper.vm.hasDimensionTemplates = false;
      await nextTick();

      expect(wrapper.vm.confirmDialog.isOpen).toBe(true);
      expect(wrapper.vm.confirmDialog.title).toContain('variaciones');
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('validates required name field', async () => {
      const result = wrapper.vm.validate();

      expect(result).toBe(false);
      expect(wrapper.vm.errors.name).toBeTruthy();
    });

    it('validates minimum name length', async () => {
      wrapper.vm.formData.name = 'AB';
      const result = wrapper.vm.validate();

      expect(result).toBe(false);
      expect(wrapper.vm.errors.name).toBe('Nombre debe tener al menos 3 caracteres');
    });

    it('passes validation with valid data', async () => {
      wrapper.vm.formData.name = 'Valid Category Name';
      const result = wrapper.vm.validate();

      expect(result).toBe(true);
      expect(Object.keys(wrapper.vm.errors)).toHaveLength(0);
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
      expect(submittedData.name).toBe('test category'); // cleaned
      expect(submittedData.description).toBe('Test Description');
    });

    it('does not submit if validation fails', async () => {
      wrapper.vm.formData.name = ''; // Invalid name

      await wrapper.find('form').trigger('submit.prevent');

      expect(wrapper.emitted('submit')).toBeFalsy();
    });

    it('emits cancel event when cancel button clicked', async () => {
      const buttons = wrapper.findAll('button');
      const cancelButton = buttons.find(button => button.text() === 'Cancelar');
      await cancelButton.trigger('click');

      expect(wrapper.emitted('cancel')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('disables form when loading', () => {
      wrapper = createWrapper({ loading: true });

      const submitButton = wrapper.find('button[type="submit"]');
      const buttons = wrapper.findAll('button');
      const cancelButton = buttons.find(button => button.text() === 'Cancelar');

      expect(submitButton.attributes('disabled')).toBeDefined();
      expect(cancelButton.attributes('disabled')).toBeDefined();
    });

    it('shows loading text for create mode', () => {
      wrapper = createWrapper({ loading: true });

      const submitButton = wrapper.find('button[type="submit"]');
      expect(submitButton.text()).toBe('Creando...');
    });

    it('shows loading text for edit mode', () => {
      const initialData = { name: 'Test' };
      wrapper = createWrapper({ loading: true, initialData });

      const submitButton = wrapper.find('button[type="submit"]');
      expect(submitButton.text()).toBe('Actualizando...');
    });
  });

  describe('Confirmation Dialogs', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('shows confirmation dialog when template type changes with existing templates', async () => {
      wrapper = createWrapper();

      // Set up existing templates
      wrapper.vm.hasVariationTemplates = true;
      wrapper.vm.formData.defaultVariationType = 'WEIGHT';
      wrapper.vm.formData.variationTemplates = [
        { name: 'test', value: 100, type: 'WEIGHT' },
      ];
      wrapper.vm.previousDefaultVariationType = 'WEIGHT';
      await nextTick();

      // Simulate type change manually to trigger confirmation
      wrapper.vm.handleDefaultTypeChange();

      expect(wrapper.vm.confirmDialog.isOpen).toBe(true);
      expect(wrapper.vm.confirmDialog.title).toContain('plantillas por defecto');
    });

    it('handles confirmation dialog confirm', async () => {
      wrapper.vm.confirmDialog = {
        isOpen: true,
        title: 'Test',
        message: 'Test message',
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      };
      await nextTick();

      const confirmDialog = wrapper.findComponent(MockConfirmDialog);
      await confirmDialog.vm.$emit('confirm');

      expect(wrapper.vm.confirmDialog.onConfirm).toHaveBeenCalled();
    });

    it('handles confirmation dialog cancel', async () => {
      wrapper.vm.confirmDialog = {
        isOpen: true,
        title: 'Test',
        message: 'Test message',
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      };
      await nextTick();

      const confirmDialog = wrapper.findComponent(MockConfirmDialog);
      await confirmDialog.vm.$emit('cancel');

      expect(wrapper.vm.confirmDialog.onCancel).toHaveBeenCalled();
    });
  });

  describe('System Settings Integration', () => {
    it('loads system settings on mount', async () => {
      // Since our mock is already loaded, this test should verify the component mounts successfully
      wrapper = createWrapper();
      await flushPromises();

      // Verify that the component was initialized successfully with the mock store
      expect(wrapper.vm.systemDefaultTemplates).toBeTruthy();
      expect(wrapper.vm.systemDefaultTemplates.WEIGHT).toBeTruthy();
    });

    it('uses system default templates', () => {
      wrapper = createWrapper();

      const systemDefaults = wrapper.vm.systemDefaultTemplates;
      expect(systemDefaults.WEIGHT).toBeTruthy();
      expect(systemDefaults.WEIGHT.defaults).toHaveLength(3);
    });

    it('filters unit options correctly', () => {
      wrapper = createWrapper();
      wrapper.vm.formData.defaultVariationType = 'WEIGHT';

      const unitOptions = wrapper.vm.unitPillOptions;
      expect(unitOptions.length).toBeGreaterThan(0);
      expect(unitOptions[0]).toHaveProperty('value');
      expect(unitOptions[0]).toHaveProperty('label');
    });
  });

  describe('Form Reset', () => {
    it('resets form to initial state', () => {
      wrapper = createWrapper();

      // Modify form
      wrapper.vm.formData.name = 'Test Category';
      wrapper.vm.formData.description = 'Test Description';
      wrapper.vm.hasVariationTemplates = true;
      wrapper.vm.errors.name = 'Some error';

      // Reset
      wrapper.vm.resetForm();

      expect(wrapper.vm.formData.name).toBe('');
      expect(wrapper.vm.formData.description).toBe('');
      expect(wrapper.vm.hasVariationTemplates).toBe(false);
      expect(wrapper.vm.errors).toEqual({});
    });
  });

  describe('Computed Properties', () => {
    it('computes correct submit button text', () => {
      wrapper = createWrapper();
      expect(wrapper.vm.submitButtonText).toBe('Crear Categoría');

      wrapper = createWrapper({ initialData: { name: 'Test' } });
      expect(wrapper.vm.submitButtonText).toBe('Actualizar Categoría');
    });

    it('computes correct loading text', () => {
      wrapper = createWrapper();
      expect(wrapper.vm.loadingText).toBe('Creando...');

      wrapper = createWrapper({ initialData: { name: 'Test' } });
      expect(wrapper.vm.loadingText).toBe('Actualizando...');
    });

    it('computes show unit selection correctly', () => {
      wrapper = createWrapper();

      // No variation type selected
      expect(wrapper.vm.showUnitSelection).toBeFalsy();

      // WEIGHT type selected
      wrapper.vm.formData.defaultVariationType = 'WEIGHT';
      expect(wrapper.vm.showUnitSelection).toBeTruthy(); // Returns 'g'

      // SIZE type selected (no units in system defaults)
      wrapper.vm.formData.defaultVariationType = 'SIZE';
      expect(wrapper.vm.showUnitSelection).toBeFalsy(); // Returns ''
    });
  });
});
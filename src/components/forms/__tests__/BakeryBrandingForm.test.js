import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BakeryBrandingForm from '../BakeryBrandingForm.vue';
import ImageUpload from '../ImageUpload.vue';
import { useAuthenticationStore } from '@/stores/authentication';

describe('BakeryBrandingForm', () => {
  let wrapper;
  let authStore;

  const mockInitialData = {
    logos: {
      original: 'https://example.com/logo.png',
      small: 'https://example.com/logo-small.png',
      medium: 'https://example.com/logo-medium.png',
      large: 'https://example.com/logo-large.png',
    },
    primaryColor: '#FF6B6B',
    secondaryColor: '#4ECDC4',
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    authStore = useAuthenticationStore();
    // Mock the getter properly
    vi.spyOn(authStore, 'getBakeryId', 'get').mockReturnValue('test-bakery-123');
    wrapper = null;
  });

  describe('Component Rendering', () => {
    it('renders correctly with default props', () => {
      wrapper = mount(BakeryBrandingForm, {
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.find('.form-container').exists()).toBe(true);
      expect(wrapper.text()).toContain('Identidad');
    });

    it('renders with custom title', () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          title: 'Custom Branding Title',
        },
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.text()).toContain('Custom Branding Title');
    });

    it('renders ImageUpload component', () => {
      wrapper = mount(BakeryBrandingForm, {
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.findComponent(ImageUpload).exists()).toBe(true);
    });

    it('displays logo section', () => {
      wrapper = mount(BakeryBrandingForm, {
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.text()).toContain('Logo');
    });

    it('displays color scheme section but keeps it hidden', () => {
      wrapper = mount(BakeryBrandingForm, {
        global: {
          plugins: [createPinia()],
        },
      });

      const colorSection = wrapper.findAll('div').find(div =>
        div.text().includes('Esquema de Colores'),
      );
      expect(colorSection).toBeDefined();
      expect(colorSection.classes()).toContain('hidden');
    });
  });

  describe('Form Initialization', () => {
    it('initializes with provided initial data', () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.formData.logos.original).toBe('https://example.com/logo.png');
      expect(vm.formData.logos.medium).toBe('https://example.com/logo-medium.png');
    });

    it('initializes with empty data when no initial data provided', () => {
      wrapper = mount(BakeryBrandingForm, {
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.formData.logos.original).toBe('');
      expect(vm.formData.logos.small).toBe('');
      expect(vm.formData.logos.medium).toBe('');
      expect(vm.formData.logos.large).toBe('');
    });

    it('creates deep clone of initial data to avoid mutations', () => {
      const originalData = { ...mockInitialData };
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: originalData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.formData.logos.original = 'changed-url';

      // Original data should not be mutated
      expect(originalData.logos.original).toBe('https://example.com/logo.png');
    });
  });

  describe('ImageUpload Integration', () => {
    it('passes correct props to ImageUpload', () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const imageUpload = wrapper.findComponent(ImageUpload);
      expect(imageUpload.props('modelValue')).toBe('https://example.com/logo.png');
      expect(imageUpload.props('uploadPath')).toContain('bakeries/test-bakery-123/branding/logos/');
      expect(imageUpload.props('label')).toBe('Sube el logo de tu negocio.');
    });

    it('disables ImageUpload when form is loading', () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          loading: true,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const imageUpload = wrapper.findComponent(ImageUpload);
      expect(imageUpload.props('disabled')).toBe(true);
    });

    it('handles logo upload success', async () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: { logos: {} },
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const uploadResult = {
        originalUrl: 'https://example.com/new-logo.png',
        resizedUrls: {
          small: 'https://example.com/new-logo-small.png',
          medium: 'https://example.com/new-logo-medium.png',
          large: 'https://example.com/new-logo-large.png',
        },
      };

      const imageUpload = wrapper.findComponent(ImageUpload);
      await imageUpload.vm.$emit('upload-success', uploadResult);

      const vm = wrapper.vm;
      expect(vm.formData.logos.original).toBe('https://example.com/new-logo.png');
      expect(vm.formData.logos.small).toBe('https://example.com/new-logo-small.png');
      expect(vm.formData.logos.medium).toBe('https://example.com/new-logo-medium.png');
      expect(vm.formData.logos.large).toBe('https://example.com/new-logo-large.png');
    });

    it('emits validation-error when image upload fails validation', async () => {
      wrapper = mount(BakeryBrandingForm, {
        global: {
          plugins: [createPinia()],
        },
      });

      const validationError = {
        type: 'file-too-large',
        message: 'File too large',
      };

      const imageUpload = wrapper.findComponent(ImageUpload);
      await imageUpload.vm.$emit('validation-error', validationError);

      expect(wrapper.emitted('validation-error')).toBeTruthy();
      expect(wrapper.emitted('validation-error')[0]).toEqual([validationError]);
    });

    it('logs upload errors to console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      wrapper = mount(BakeryBrandingForm, {
        global: {
          plugins: [createPinia()],
        },
      });

      const uploadError = new Error('Upload failed');
      const imageUpload = wrapper.findComponent(ImageUpload);
      await imageUpload.vm.$emit('upload-error', uploadError);

      expect(consoleSpy).toHaveBeenCalledWith('Logo upload error:', uploadError);

      consoleSpy.mockRestore();
    });
  });

  describe('Form State Management', () => {
    it('detects changes correctly', async () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.hasChanges).toBe(false);

      // Simulate logo change
      vm.formData.logos.original = 'https://example.com/new-logo.png';
      await wrapper.vm.$nextTick();

      expect(vm.hasChanges).toBe(true);
    });

    it('normalizes empty logo values for comparison', () => {
      const dataWithNulls = {
        logos: {
          original: null,
          small: null,
          medium: null,
          large: null,
        },
      };

      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: dataWithNulls,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      // Should not detect changes when both are empty
      expect(vm.hasChanges).toBe(false);
    });

    it('enables submit button when there are changes', async () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const submitButton = wrapper.findAll('button').find(btn => btn.text().includes('Guardar'));
      expect(submitButton.attributes('disabled')).toBeDefined();

      // Make a change
      const vm = wrapper.vm;
      vm.formData.logos.original = 'https://example.com/changed.png';
      await wrapper.vm.$nextTick();

      expect(submitButton.attributes('disabled')).toBeUndefined();
    });

    it('disables submit button when loading', () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          loading: true,
          initialData: {
            logos: {
              original: 'https://example.com/logo.png',
            },
          },
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.formData.logos.original = 'changed';

      const submitButton = wrapper.findAll('button').find(btn => btn.text().includes('Guardar'));
      expect(submitButton.attributes('disabled')).toBeDefined();
    });
  });

  describe('Form Submission', () => {
    it('emits submit event with form data', async () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      // Make a change
      const vm = wrapper.vm;
      vm.formData.logos.original = 'https://example.com/new.png';
      await wrapper.vm.$nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');

      expect(wrapper.emitted('submit')).toBeTruthy();
      expect(wrapper.emitted('submit')[0][0].logos.original).toBe('https://example.com/new.png');
    });

    it('does not submit when no changes', async () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const submitButton = wrapper.findAll('button').find(btn => btn.text().includes('Guardar'));
      expect(submitButton.attributes('disabled')).toBeDefined();
    });

    it('displays loading text when submitting', () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          loading: true,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.text()).toContain('Guardando...');
    });
  });

  describe('Cancel Functionality', () => {
    it('resets form to initial state when cancelled', async () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      // Make changes
      vm.formData.logos.original = 'https://example.com/changed.png';
      await wrapper.vm.$nextTick();

      expect(vm.hasChanges).toBe(true);

      // Cancel
      const cancelButton = wrapper.findAll('button').find(btn => btn.text().includes('Cancelar'));
      await cancelButton.trigger('click');

      expect(vm.formData.logos.original).toBe('https://example.com/logo.png');
      expect(vm.hasChanges).toBe(false);
    });

    it('disables cancel button when no changes', () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const cancelButton = wrapper.findAll('button').find(btn => btn.text().includes('Cancelar'));
      expect(cancelButton.attributes('disabled')).toBeDefined();
    });

    it('applies danger style to cancel button when there are changes', async () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      vm.formData.logos.original = 'changed';
      await wrapper.vm.$nextTick();

      const cancelButton = wrapper.findAll('button').find(btn => btn.text().includes('Cancelar'));
      expect(cancelButton.classes()).toContain('danger-btn');
    });
  });

  describe('Upload Path Generation', () => {
    it('generates correct upload path with bakery ID', () => {
      wrapper = mount(BakeryBrandingForm, {
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.getLogoUploadPath).toBe('bakeries/test-bakery-123/branding/logos/');
    });

    it('uses default bakery ID when not available', () => {
      vi.spyOn(authStore, 'getBakeryId', 'get').mockReturnValue(null);

      wrapper = mount(BakeryBrandingForm, {
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.getLogoUploadPath).toBe('bakeries/default/branding/logos/');
    });
  });

  describe('Watchers', () => {
    it('updates form data when initialData prop changes', async () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const newData = {
        logos: {
          original: 'https://example.com/new-logo.png',
          small: '',
          medium: '',
          large: '',
        },
      };

      await wrapper.setProps({ initialData: newData });

      const vm = wrapper.vm;
      expect(vm.formData.logos.original).toBe('https://example.com/new-logo.png');
    });

    it('performs deep cloning when updating from prop changes', async () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const newData = {
        logos: {
          original: 'https://example.com/new-logo.png',
        },
      };

      await wrapper.setProps({ initialData: newData });

      const vm = wrapper.vm;
      vm.formData.logos.original = 'changed-again';

      // Original prop should not be mutated
      expect(wrapper.props('initialData').logos.original).toBe('https://example.com/new-logo.png');
    });
  });

  describe('Logo Preview Versions', () => {
    it('hides logo preview section by default', () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const previewSection = wrapper.findAll('div').find(div =>
        div.text().includes('Versiones Disponibles'),
      );
      expect(previewSection.classes()).toContain('hidden');
    });

    it('displays all logo size versions when available', () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: mockInitialData,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const html = wrapper.html();
      expect(html).toContain('Original');
      expect(html).toContain('Grande (800px)');
      expect(html).toContain('Mediano (400px)');
      expect(html).toContain('Pequeño (200px)');
    });
  });

  describe('Reactivity', () => {
    it('ensures reactivity when updating logos with spread operator', async () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: { logos: {} },
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const uploadResult = {
        originalUrl: 'https://example.com/logo.png',
        resizedUrls: {
          medium: 'https://example.com/logo-medium.png',
        },
      };

      const imageUpload = wrapper.findComponent(ImageUpload);
      await imageUpload.vm.$emit('upload-success', uploadResult);
      await wrapper.vm.$nextTick();

      const vm = wrapper.vm;
      expect(vm.formData.logos).toBeDefined();
      expect(vm.formData.logos.original).toBe('https://example.com/logo.png');
    });
  });

  describe('Edge Cases', () => {
    it('handles missing resized URLs in upload result', async () => {
      wrapper = mount(BakeryBrandingForm, {
        global: {
          plugins: [createPinia()],
        },
      });

      const uploadResult = {
        originalUrl: 'https://example.com/logo.png',
        resizedUrls: {},
      };

      const imageUpload = wrapper.findComponent(ImageUpload);
      await imageUpload.vm.$emit('upload-success', uploadResult);

      const vm = wrapper.vm;
      expect(vm.formData.logos.original).toBe('https://example.com/logo.png');
      expect(vm.formData.logos.small).toBe('');
      expect(vm.formData.logos.medium).toBe('');
      expect(vm.formData.logos.large).toBe('');
    });

    it('handles undefined initial data gracefully', () => {
      wrapper = mount(BakeryBrandingForm, {
        props: {
          initialData: undefined,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const vm = wrapper.vm;
      expect(vm.formData).toBeDefined();
      expect(vm.formData.logos).toBeDefined();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ImageUpload from '../ImageUpload.vue';
import storageService from '@/services/storageService';

vi.mock('@/services/storageService', () => ({
  default: {
    uploadImage: vi.fn(),
    deleteImage: vi.fn(),
  },
}));

describe('ImageUpload', () => {
  let wrapper;

  const defaultProps = {
    modelValue: '',
    uploadPath: 'test/uploads/',
    label: 'Test Image',
    helpText: 'Upload your image here',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock implementation
    storageService.uploadImage.mockResolvedValue({
      originalUrl: 'https://example.com/uploaded.png',
      resizedUrls: {
        small: 'https://example.com/uploaded-small.png',
        medium: 'https://example.com/uploaded-medium.png',
        large: 'https://example.com/uploaded-large.png',
      },
    });
    wrapper = null;
  });

  describe('Component Rendering', () => {
    it('renders correctly with default props', () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      expect(wrapper.find('.image-upload-container').exists()).toBe(true);
      expect(wrapper.text()).toContain('Test Image');
    });

    it('displays empty state when no image', () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      expect(wrapper.find('.empty-state').exists()).toBe(true);
      expect(wrapper.text()).toContain('Upload your image here');
    });

    it('displays max file size in help text', () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          maxSizeInMB: 10,
        },
      });

      expect(wrapper.text()).toContain('Máximo 10 MB');
    });

    it('displays accepted file formats', () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      expect(wrapper.text()).toContain('JPG, PNG, GIF, WebP');
    });

    it('displays preview when modelValue is provided', () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          modelValue: 'https://example.com/image.png',
        },
      });

      expect(wrapper.find('.image-preview').exists()).toBe(true);
      expect(wrapper.find('img').attributes('src')).toBe('https://example.com/image.png');
    });

    it('hides label when not provided', () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          label: '',
        },
      });

      expect(wrapper.find('label').exists()).toBe(false);
    });
  });

  describe('File Selection', () => {
    it('triggers file input when upload area is clicked', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const fileInput = wrapper.find('input[type="file"]');
      const clickSpy = vi.spyOn(fileInput.element, 'click');

      const uploadArea = wrapper.find('.upload-area');
      await uploadArea.trigger('click');

      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not trigger file input when disabled', async () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          disabled: true,
        },
      });

      const fileInput = wrapper.find('input[type="file"]');
      const clickSpy = vi.spyOn(fileInput.element, 'click');

      const uploadArea = wrapper.find('.upload-area');
      await uploadArea.trigger('click');

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('processes file when selected', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = wrapper.find('input[type="file"]');

      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        writable: false,
      });

      await fileInput.trigger('change');

      const vm = wrapper.vm;
      expect(vm.selectedFile).toBe(file);
    });
  });

  describe('Drag and Drop', () => {
    it('adds dragging class on dragover', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const uploadArea = wrapper.find('.upload-area');
      await uploadArea.trigger('dragover');

      expect(uploadArea.classes()).toContain('dragging');
    });

    it('removes dragging class on dragleave', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const uploadArea = wrapper.find('.upload-area');
      await uploadArea.trigger('dragover');
      await uploadArea.trigger('dragleave');

      expect(uploadArea.classes()).not.toContain('dragging');
    });

    it('does not add dragging class when disabled', async () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          disabled: true,
        },
      });

      const uploadArea = wrapper.find('.upload-area');
      await uploadArea.trigger('dragover');

      expect(uploadArea.classes()).not.toContain('dragging');
    });

    it('handles file drop', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const dropEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          files: [file],
        },
      };

      const uploadArea = wrapper.find('.upload-area');
      await uploadArea.trigger('drop', dropEvent);

      expect(dropEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('File Validation', () => {
    it('validates file type', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const fileInput = wrapper.find('input[type="file"]');

      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
      });

      await fileInput.trigger('change');
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('Por favor selecciona un archivo de imagen válido');
      expect(wrapper.emitted('validation-error')).toBeTruthy();
      expect(wrapper.emitted('validation-error')[0][0].type).toBe('invalid-type');
    });

    it('validates file size', async () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          maxSizeInMB: 1,
        },
      });

      // Create a file larger than 1MB
      const largeFile = new File(['x'.repeat(2 * 1024 * 1024)], 'large.png', {
        type: 'image/png',
      });

      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [largeFile],
      });

      await fileInput.trigger('change');
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('El archivo es muy grande');
      expect(wrapper.emitted('validation-error')).toBeTruthy();
      expect(wrapper.emitted('validation-error')[0][0].type).toBe('file-too-large');
    });

    it('accepts valid image files', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = wrapper.find('input[type="file"]');

      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
      });

      await fileInput.trigger('change');

      expect(wrapper.vm.selectedFile).toBe(file);
      expect(wrapper.vm.error).toBe('');
    });

    it('calculates file size in MB correctly', () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          maxSizeInMB: 5,
        },
      });

      const vm = wrapper.vm;
      expect(vm.maxSizeInBytes).toBe(5 * 1024 * 1024);
    });
  });

  describe('File Upload', () => {
    it('displays upload progress', async () => {
      storageService.uploadImage.mockImplementation((file, path, onProgress) => {
        onProgress(50);
        return new Promise(() => {}); // Never resolves to keep in uploading state
      });

      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const vm = wrapper.vm;
      vm.selectedFile = file;
      vm.uploadImage();

      await wrapper.vm.$nextTick();

      expect(wrapper.find('.upload-progress').exists()).toBe(true);
      expect(wrapper.text()).toContain('Subiendo... 50%');
    });

    it('uploads file successfully', async () => {
      const uploadResult = {
        originalUrl: 'https://example.com/test.png',
        resizedUrls: {
          small: 'https://example.com/test-small.png',
          medium: 'https://example.com/test-medium.png',
          large: 'https://example.com/test-large.png',
        },
      };

      storageService.uploadImage.mockResolvedValue(uploadResult);

      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = wrapper.find('input[type="file"]');

      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([uploadResult.originalUrl]);
      expect(wrapper.emitted('upload-success')).toBeTruthy();
      expect(wrapper.emitted('upload-success')[0]).toEqual([uploadResult]);
    });

    it('handles upload errors', async () => {
      const uploadError = new Error('Upload failed');
      storageService.uploadImage.mockRejectedValue(uploadError);

      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = wrapper.find('input[type="file"]');

      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(wrapper.text()).toContain('Error al subir la imagen');
      expect(wrapper.emitted('upload-error')).toBeTruthy();
      expect(wrapper.emitted('upload-error')[0]).toEqual([uploadError]);
    });

    it('resets state after successful upload', async () => {
      storageService.uploadImage.mockResolvedValue({
        originalUrl: 'https://example.com/test.png',
        resizedUrls: {},
      });

      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const vm = wrapper.vm;
      vm.selectedFile = file;
      await vm.uploadImage();
      await flushPromises();

      expect(vm.selectedFile).toBeNull();
      expect(vm.uploadProgress).toBe(0);
      expect(vm.isUploading).toBe(false);
    });

    it('does not upload when disabled', async () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          disabled: true,
        },
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const vm = wrapper.vm;
      vm.selectedFile = file;
      await vm.uploadImage();

      expect(storageService.uploadImage).not.toHaveBeenCalled();
    });

    it('tracks upload progress correctly', async () => {
      let progressCallback;
      storageService.uploadImage.mockImplementation((file, path, onProgress) => {
        progressCallback = onProgress;
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ originalUrl: 'test.png', resizedUrls: {} });
          }, 100);
        });
      });

      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const vm = wrapper.vm;
      vm.selectedFile = file;
      vm.uploadImage();

      await wrapper.vm.$nextTick();

      progressCallback(25);
      await wrapper.vm.$nextTick();
      expect(vm.uploadProgress).toBe(25);

      progressCallback(75);
      await wrapper.vm.$nextTick();
      expect(vm.uploadProgress).toBe(75);
    });
  });

  describe('Image Deletion', () => {
    it('deletes image successfully', async () => {
      storageService.deleteImage.mockResolvedValue();

      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          modelValue: 'https://storage.googleapis.com/bucket/o/path%2Fto%2Fimage.png?token=abc',
        },
      });

      const vm = wrapper.vm;
      await vm.deleteImage();
      await flushPromises();

      expect(storageService.deleteImage).toHaveBeenCalled();
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['']);
      expect(wrapper.emitted('delete-success')).toBeTruthy();
    });

    it('handles delete errors', async () => {
      const deleteError = new Error('Delete failed');
      storageService.deleteImage.mockRejectedValue(deleteError);

      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          modelValue: 'https://storage.googleapis.com/bucket/o/path%2Fto%2Fimage.png',
        },
      });

      const vm = wrapper.vm;
      await vm.deleteImage();
      await flushPromises();

      expect(wrapper.text()).toContain('Error al eliminar la imagen');
      expect(wrapper.emitted('delete-error')).toBeTruthy();
    });

    it('does not delete when no image', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const vm = wrapper.vm;
      await vm.deleteImage();

      expect(storageService.deleteImage).not.toHaveBeenCalled();
    });

    it('does not delete when disabled', async () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          modelValue: 'https://example.com/image.png',
          disabled: true,
        },
      });

      const vm = wrapper.vm;
      await vm.deleteImage();

      expect(storageService.deleteImage).not.toHaveBeenCalled();
    });

    it('extracts storage path from URL correctly', async () => {
      storageService.deleteImage.mockResolvedValue();

      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          modelValue: 'https://storage.googleapis.com/bucket/o/test%2Fpath%2Fimage.png?token=123',
        },
      });

      const vm = wrapper.vm;
      await vm.deleteImage();
      await flushPromises();

      expect(storageService.deleteImage).toHaveBeenCalledWith('test/path/image.png');
    });
  });

  describe('Preview Management', () => {
    it('creates file preview from FileReader', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const vm = wrapper.vm;

      // Mock FileReader
      const mockFileReader = {
        readAsDataURL: vi.fn(function () {
          this.onload({ target: { result: 'data:image/png;base64,test' } });
        }),
      };
      global.FileReader = vi.fn(() => mockFileReader);

      vm.processFile(file);
      await wrapper.vm.$nextTick();

      expect(vm.previewUrl).toBe('data:image/png;base64,test');
    });

    it('updates preview when modelValue changes', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      await wrapper.setProps({ modelValue: 'https://example.com/new-image.png' });
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.previewUrl).toBe('https://example.com/new-image.png');
    });

    it('does not update preview when file is being processed', async () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          modelValue: 'https://example.com/original.png',
        },
      });

      const vm = wrapper.vm;
      vm.selectedFile = new File(['test'], 'test.png', { type: 'image/png' });
      vm.previewUrl = 'data:image/png;base64,local';

      await wrapper.setProps({ modelValue: 'https://example.com/new.png' });
      await wrapper.vm.$nextTick();

      // Should not update because selectedFile is set
      expect(vm.previewUrl).toBe('data:image/png;base64,local');
    });
  });

  describe('UI States', () => {
    it('applies disabled class when disabled', () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          disabled: true,
        },
      });

      expect(wrapper.find('.upload-area').classes()).toContain('disabled');
    });

    it('applies error class when error exists', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const vm = wrapper.vm;
      vm.error = 'Test error';
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.upload-area').classes()).toContain('has-error');
    });

    it('applies has-image class when image is present', () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          modelValue: 'https://example.com/image.png',
        },
      });

      expect(wrapper.find('.upload-area').classes()).toContain('has-image');
    });

    it('displays error message when present', async () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const vm = wrapper.vm;
      vm.error = 'This is an error message';
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('This is an error message');
    });
  });

  describe('Computed Properties', () => {
    it('hasImage returns true when preview URL exists', () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          modelValue: 'https://example.com/image.png',
        },
      });

      expect(wrapper.vm.hasImage).toBe(true);
    });

    it('hasImage returns false when no image', () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      expect(wrapper.vm.hasImage).toBe(false);
    });

    it('hasImage logs debug information', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          modelValue: 'https://example.com/image.png',
        },
      });

      const result = wrapper.vm.hasImage;

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('File Input Attributes', () => {
    it('sets correct accept attribute', () => {
      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const fileInput = wrapper.find('input[type="file"]');
      expect(fileInput.attributes('accept')).toBe('image/jpeg,image/png,image/gif,image/webp');
    });

    it('allows custom accepted formats', () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          acceptedFormats: 'image/png,image/svg+xml',
        },
      });

      const fileInput = wrapper.find('input[type="file"]');
      expect(fileInput.attributes('accept')).toBe('image/png,image/svg+xml');
    });

    it('disables file input when component is disabled', () => {
      wrapper = mount(ImageUpload, {
        props: {
          ...defaultProps,
          disabled: true,
        },
      });

      const fileInput = wrapper.find('input[type="file"]');
      expect(fileInput.attributes('disabled')).toBeDefined();
    });
  });

  describe('Auto-upload Behavior', () => {
    it('automatically uploads after file is selected', async () => {
      storageService.uploadImage.mockResolvedValue({
        originalUrl: 'https://example.com/test.png',
        resizedUrls: {},
      });

      wrapper = mount(ImageUpload, {
        props: defaultProps,
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = wrapper.find('input[type="file"]');

      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
      });

      await fileInput.trigger('change');
      await flushPromises();

      expect(storageService.uploadImage).toHaveBeenCalled();
    });
  });
});

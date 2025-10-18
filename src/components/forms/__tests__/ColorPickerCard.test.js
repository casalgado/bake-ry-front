import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ColorPickerCard from '../ColorPickerCard.vue';
import { PhNumberCircleOne } from '@phosphor-icons/vue';

describe('ColorPickerCard', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = null;
  });

  describe('Component Rendering', () => {
    it('renders correctly with required props', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#FF6B6B',
          title: 'Primary Color',
        },
      });

      expect(wrapper.find('.flex').exists()).toBe(true);
      expect(wrapper.text()).toContain('Primary Color');
    });

    it('displays title correctly', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Test Color',
        },
      });

      expect(wrapper.find('h3').text()).toBe('Test Color');
    });

    it('displays description when provided', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
          description: 'This is a test description',
        },
      });

      expect(wrapper.text()).toContain('This is a test description');
    });

    it('does not display description when not provided', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
        },
      });

      expect(wrapper.find('p').exists()).toBe(false);
    });

    it('renders icon when provided', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
          icon: PhNumberCircleOne,
        },
      });

      expect(wrapper.findComponent(PhNumberCircleOne).exists()).toBe(true);
    });

    it('does not render icon when not provided', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
        },
      });

      expect(wrapper.findComponent(PhNumberCircleOne).exists()).toBe(false);
    });
  });

  describe('Color Value Handling', () => {
    it('displays the correct color value', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#FF6B6B',
          title: 'Color',
        },
      });

      const textInput = wrapper.find('input[type="text"]');
      expect(textInput.element.value).toBe('#FF6B6B');
    });

    it('uses default color when modelValue is empty', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '',
          title: 'Color',
        },
      });

      const textInput = wrapper.find('input[type="text"]');
      expect(textInput.element.value).toBe('#000000');
    });

    it('applies color to preview circle', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#4ECDC4',
          title: 'Color',
        },
      });

      const preview = wrapper.find('.rounded-full');
      // Check for hex color format instead of rgb
      expect(preview.attributes('style')).toContain('background-color: #4ECDC4');
    });

    it('emits update:modelValue when text input changes', async () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
        },
      });

      const textInput = wrapper.find('input[type="text"]');
      await textInput.setValue('#FFFFFF');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['#FFFFFF']);
    });

    it('emits update:modelValue when color picker changes', async () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
        },
      });

      const colorInput = wrapper.find('input[type="color"]');
      await colorInput.setValue('#FF0000');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      // Color input may lowercase the value
      expect(wrapper.emitted('update:modelValue')[0][0].toLowerCase()).toBe('#ff0000');
    });
  });

  describe('Disabled State', () => {
    it('disables text input when disabled prop is true', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
          disabled: true,
        },
      });

      const textInput = wrapper.find('input[type="text"]');
      expect(textInput.attributes('disabled')).toBeDefined();
    });

    it('disables color picker when disabled prop is true', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
          disabled: true,
        },
      });

      const colorInput = wrapper.find('input[type="color"]');
      expect(colorInput.attributes('disabled')).toBeDefined();
    });

    it('applies disabled styling to card when disabled', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
          disabled: true,
        },
      });

      const card = wrapper.find('div');
      expect(card.classes()).toContain('opacity-60');
      expect(card.classes()).toContain('cursor-not-allowed');
    });

    it('applies active styling when not disabled', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
          disabled: false,
        },
      });

      const card = wrapper.find('div');
      expect(card.classes()).toContain('bg-white');
      expect(card.classes()).not.toContain('opacity-60');
    });

    it('applies disabled styling to preview when disabled', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
          disabled: true,
        },
      });

      const preview = wrapper.find('.rounded-full');
      expect(preview.classes()).toContain('opacity-60');
    });
  });

  describe('Hex Input Validation', () => {
    it('has maxlength of 7 characters', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
        },
      });

      const textInput = wrapper.find('input[type="text"]');
      expect(textInput.attributes('maxlength')).toBe('7');
    });

    it('displays text input with monospace font', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
        },
      });

      const textInput = wrapper.find('input[type="text"]');
      expect(textInput.classes()).toContain('font-mono');
    });
  });

  describe('UI Styling', () => {
    it('applies border and padding to card', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
        },
      });

      const card = wrapper.find('div');
      expect(card.classes()).toContain('border-2');
      expect(card.classes()).toContain('rounded-lg');
      expect(card.classes()).toContain('p-4');
    });

    it('has transition classes for smooth animations', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
        },
      });

      const card = wrapper.find('div');
      expect(card.classes()).toContain('transition-all');
      expect(card.classes()).toContain('duration-200');
    });

    it('color preview is circular with shadow', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
        },
      });

      const preview = wrapper.find('.rounded-full');
      expect(preview.classes()).toContain('rounded-full');
      expect(preview.classes()).toContain('shadow-md');
      expect(preview.classes()).toContain('w-12');
      expect(preview.classes()).toContain('h-12');
    });
  });

  describe('Label and ID Generation', () => {
    it('generates unique ID for color input based on title', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Primary Color',
        },
      });

      const colorInput = wrapper.find('input[type="color"]');
      expect(colorInput.attributes('id')).toBe('color-Primary Color');
    });

    it('label for attribute matches color input id', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Secondary Color',
        },
      });

      const label = wrapper.find('label');
      expect(label.attributes('for')).toBe('color-Secondary Color');
    });
  });

  describe('Two-way Binding', () => {
    it('supports v-model pattern', async () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
          'onUpdate:modelValue': (e) => wrapper.setProps({ modelValue: e }),
        },
      });

      const textInput = wrapper.find('input[type="text"]');
      await textInput.setValue('#ABCDEF');

      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['#ABCDEF']);
    });
  });

  describe('Edge Cases', () => {
    it('handles null modelValue', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: null,
          title: 'Color',
        },
      });

      const textInput = wrapper.find('input[type="text"]');
      expect(textInput.element.value).toBe('#000000');
    });

    it('handles undefined modelValue', () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: undefined,
          title: 'Color',
        },
      });

      const textInput = wrapper.find('input[type="text"]');
      expect(textInput.element.value).toBe('#000000');
    });

    it('preserves user input even if invalid hex', async () => {
      wrapper = mount(ColorPickerCard, {
        props: {
          modelValue: '#000000',
          title: 'Color',
        },
      });

      const textInput = wrapper.find('input[type="text"]');
      await textInput.setValue('invalid');

      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['invalid']);
    });
  });
});

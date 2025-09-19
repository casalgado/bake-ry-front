import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { markRaw } from 'vue';
import RadioFeatureCard from '../RadioFeatureCard.vue';
import { PhCalendarBlank } from '@phosphor-icons/vue';

describe('RadioFeatureCard', () => {
  let wrapper;

  const defaultProps = {
    modelValue: 'delivery',
    icon: markRaw(PhCalendarBlank),
    title: 'Default Date Type',
    description: 'Choose your preferred date workflow',
    options: [
      { value: 'delivery', label: 'Entrega' },
      { value: 'production', label: 'Producción' },
    ],
    name: 'default-date',
  };

  beforeEach(() => {
    wrapper = mount(RadioFeatureCard, {
      props: defaultProps,
    });
  });

  describe('Component Structure', () => {
    it('renders the component with correct structure', () => {
      expect(wrapper.find('.relative.p-4').exists()).toBe(true);
    });

    it('displays the icon', () => {
      const icon = wrapper.findComponent(PhCalendarBlank);
      expect(icon.exists()).toBe(true);
      expect(icon.classes()).toContain('w-6');
      expect(icon.classes()).toContain('h-6');
    });

    it('displays the title', () => {
      const title = wrapper.find('h3');
      expect(title.text()).toBe('Default Date Type');
      expect(title.classes()).toContain('font-medium');
    });

    it('displays the description', () => {
      const description = wrapper.find('p');
      expect(description.text()).toBe('Choose your preferred date workflow');
      expect(description.classes()).toContain('text-sm');
    });

    it('renders badge when provided', async () => {
      await wrapper.setProps({ badge: 'New' });

      const badge = wrapper.find('.bg-neutral-100');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toBe('New');
    });

    it('does not render badge when not provided', () => {
      const badge = wrapper.find('.bg-neutral-100');
      expect(badge.exists()).toBe(false);
    });
  });

  describe('Radio Button Options', () => {
    it('renders all radio button options', () => {
      const radioInputs = wrapper.findAll('input[type="radio"]');
      expect(radioInputs).toHaveLength(2);

      const labels = wrapper.findAll('label');
      expect(labels[0].text()).toBe('Entrega');
      expect(labels[1].text()).toBe('Producción');
    });

    it('sets correct input attributes', () => {
      const radioInputs = wrapper.findAll('input[type="radio"]');

      // First radio (delivery)
      expect(radioInputs[0].attributes('id')).toBe('default-date-delivery');
      expect(radioInputs[0].attributes('value')).toBe('delivery');
      expect(radioInputs[0].attributes('name')).toBe('default-date');
      expect(radioInputs[0].attributes('checked')).toBeDefined(); // Should be checked as it matches modelValue

      // Second radio (production)
      expect(radioInputs[1].attributes('id')).toBe('default-date-production');
      expect(radioInputs[1].attributes('value')).toBe('production');
      expect(radioInputs[1].attributes('name')).toBe('default-date');
      expect(radioInputs[1].attributes('checked')).toBeUndefined(); // Should not be checked
    });

    it('applies correct label styling', () => {
      const labels = wrapper.findAll('label');

      labels.forEach(label => {
        expect(label.classes()).toContain('w-full');
        expect(label.classes()).toContain('cursor-pointer');
        expect(label.classes()).toContain('py-2');
        expect(label.classes()).toContain('px-3');
        expect(label.classes()).toContain('rounded-md');
        expect(label.classes()).toContain('text-center');
      });
    });

    it('uses grid layout for options', () => {
      const optionsContainer = wrapper.find('.grid.grid-cols-2');
      expect(optionsContainer.exists()).toBe(true);
      expect(optionsContainer.classes()).toContain('gap-2');
    });
  });

  describe('Value Management', () => {
    it('emits update when radio button is changed', async () => {
      const productionRadio = wrapper.find('input[value="production"]');
      await productionRadio.trigger('change');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['production']);
    });

    it('reflects the current modelValue', async () => {
      // Initially 'delivery' should be checked
      expect(wrapper.find('input[value="delivery"]').attributes('checked')).toBeDefined();
      expect(wrapper.find('input[value="production"]').attributes('checked')).toBeUndefined();

      // Change to 'production'
      await wrapper.setProps({ modelValue: 'production' });

      expect(wrapper.find('input[value="delivery"]').attributes('checked')).toBeUndefined();
      expect(wrapper.find('input[value="production"]').attributes('checked')).toBeDefined();
    });

    it('has correct computed selectedValue', () => {
      expect(wrapper.vm.selectedValue).toBe('delivery');
    });
  });

  describe('Disabled State', () => {
    beforeEach(async () => {
      await wrapper.setProps({ disabled: true });
    });

    it('applies disabled styles to card', () => {
      const card = wrapper.find('.relative.p-4');
      expect(card.classes()).toContain('border-neutral-100');
      expect(card.classes()).toContain('bg-neutral-50');
      expect(card.classes()).toContain('cursor-not-allowed');
      expect(card.classes()).toContain('opacity-60');
    });

    it('disables all radio inputs', () => {
      const radioInputs = wrapper.findAll('input[type="radio"]');
      radioInputs.forEach(input => {
        expect(input.attributes('disabled')).toBeDefined();
      });
    });

    it('does not emit update when disabled', async () => {
      const productionRadio = wrapper.find('input[value="production"]');
      await productionRadio.trigger('change');

      // Should not emit when disabled
      expect(wrapper.emitted('update:modelValue')).toBeFalsy();
    });

    it('does not handle radio change when disabled', () => {
      const vm = wrapper.vm;
      vm.handleRadioChange('production');

      // selectedValue should not change when disabled
      expect(vm.selectedValue).toBe('delivery');
    });
  });

  describe('Enabled State', () => {
    it('applies enabled styles to card', () => {
      const card = wrapper.find('.relative.p-4');
      expect(card.classes()).toContain('border-neutral-200');
      expect(card.classes()).toContain('bg-white');
      expect(card.classes()).not.toContain('cursor-not-allowed');
      expect(card.classes()).not.toContain('opacity-60');
    });

    it('does not disable radio inputs', () => {
      const radioInputs = wrapper.findAll('input[type="radio"]');
      radioInputs.forEach(input => {
        expect(input.attributes('disabled')).toBeUndefined();
      });
    });
  });

  describe('Accessibility', () => {
    it('associates labels with radio inputs correctly', () => {
      const labels = wrapper.findAll('label');
      const radioInputs = wrapper.findAll('input[type="radio"]');

      expect(labels[0].attributes('for')).toBe(radioInputs[0].attributes('id'));
      expect(labels[1].attributes('for')).toBe(radioInputs[1].attributes('id'));
    });

    it('uses sr-only class for radio inputs (custom styling)', () => {
      const radioInputs = wrapper.findAll('input[type="radio"]');
      radioInputs.forEach(input => {
        expect(input.classes()).toContain('sr-only');
      });
    });

    it('uses peer classes for styling interaction', () => {
      const radioInputs = wrapper.findAll('input[type="radio"]');
      radioInputs.forEach(input => {
        expect(input.classes()).toContain('peer');
      });
    });

    it('labels have proper focus and interaction styling', () => {
      const labels = wrapper.findAll('label');
      labels.forEach(label => {
        expect(label.classes()).toContain('peer-checked:action-btn');
        expect(label.classes()).toContain('peer-focus-visible:ring-2');
        expect(label.classes()).toContain('peer-disabled:opacity-50');
        expect(label.classes()).toContain('peer-disabled:cursor-not-allowed');
      });
    });
  });

  describe('Props Validation', () => {
    it('requires icon prop', () => {
      // This would show a Vue warning in development
      const props = RadioFeatureCard.props;
      expect(props.icon.required).toBe(true);
    });

    it('requires title prop', () => {
      const props = RadioFeatureCard.props;
      expect(props.title.required).toBe(true);
    });

    it('requires options prop', () => {
      const props = RadioFeatureCard.props;
      expect(props.options.required).toBe(true);
    });

    it('requires name prop', () => {
      const props = RadioFeatureCard.props;
      expect(props.name.required).toBe(true);
    });

    it('has correct default values', () => {
      const props = RadioFeatureCard.props;
      expect(props.modelValue.default).toBe('');
      expect(props.description.default).toBe(null);
      expect(props.badge.default).toBe(null);
      expect(props.disabled.default).toBe(false);
    });
  });
});
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import YesNoToggle from '../YesNoToggle.vue';

describe('YesNoToggle', () => {
  describe('Props and Initial State', () => {
    it('renders with required label', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
        },
      });

      expect(wrapper.find('label').text()).toBe('Test Label');
      expect(wrapper.findAll('button')[0].text()).toBe('No');
      expect(wrapper.findAll('button')[1].text()).toBe('Sí');
    });

    it('renders with null modelValue by default', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
        },
      });

      // When modelValue is null, neither button should be active
      const noButton = wrapper.findAll('button')[0];
      const yesButton = wrapper.findAll('button')[1];

      expect(noButton.classes()).not.toContain('utility-btn-active');
      expect(yesButton.classes()).not.toContain('utility-btn-active');
      expect(noButton.classes()).toContain('utility-btn-inactive');
      expect(yesButton.classes()).toContain('utility-btn-inactive');
    });

    it('renders with boolean true modelValue', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: true,
        },
      });

      const noButton = wrapper.findAll('button')[0];
      const yesButton = wrapper.findAll('button')[1];

      expect(noButton.classes()).toContain('utility-btn-inactive');
      expect(yesButton.classes()).toContain('utility-btn-active');
    });

    it('renders with boolean false modelValue', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: false,
        },
      });

      const noButton = wrapper.findAll('button')[0];
      const yesButton = wrapper.findAll('button')[1];

      expect(noButton.classes()).toContain('utility-btn-active');
      expect(yesButton.classes()).toContain('utility-btn-inactive');
    });
  });

  describe('User Interactions', () => {
    it('emits update:modelValue with false when No button is clicked', async () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: true, // Start with true
        },
      });

      const noButton = wrapper.findAll('button')[0];
      await noButton.trigger('click');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false]);
    });

    it('emits update:modelValue with true when Yes button is clicked', async () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: false, // Start with false
        },
      });

      const yesButton = wrapper.findAll('button')[1];
      await yesButton.trigger('click');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([true]);
    });

    it('emits update:modelValue from null state', async () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: null,
        },
      });

      // Click Yes from null state
      const yesButton = wrapper.findAll('button')[1];
      await yesButton.trigger('click');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([true]);

      // Reset and click No from null state
      wrapper.unmount();
      const wrapper2 = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: null,
        },
      });

      const noButton = wrapper2.findAll('button')[0];
      await noButton.trigger('click');

      expect(wrapper2.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper2.emitted('update:modelValue')[0]).toEqual([false]);
    });

    it('allows toggling between true and false multiple times', async () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: false,
        },
      });

      const noButton = wrapper.findAll('button')[0];
      const yesButton = wrapper.findAll('button')[1];

      // Click Yes
      await yesButton.trigger('click');
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([true]);

      // Click No
      await noButton.trigger('click');
      expect(wrapper.emitted('update:modelValue')[1]).toEqual([false]);

      // Click Yes again
      await yesButton.trigger('click');
      expect(wrapper.emitted('update:modelValue')[2]).toEqual([true]);

      // Verify we have 3 emissions total
      expect(wrapper.emitted('update:modelValue')).toHaveLength(3);
    });
  });

  describe('Button States and Classes', () => {
    it('applies correct classes for true state', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: true,
        },
      });

      const buttons = wrapper.findAll('button');
      const noButton = buttons[0];
      const yesButton = buttons[1];

      // No button should be inactive
      expect(noButton.classes()).toContain('utility-btn');
      expect(noButton.classes()).toContain('utility-btn-inactive');
      expect(noButton.classes()).not.toContain('utility-btn-active');

      // Yes button should be active
      expect(yesButton.classes()).toContain('utility-btn');
      expect(yesButton.classes()).toContain('utility-btn-active');
      expect(yesButton.classes()).not.toContain('utility-btn-inactive');
    });

    it('applies correct classes for false state', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: false,
        },
      });

      const buttons = wrapper.findAll('button');
      const noButton = buttons[0];
      const yesButton = buttons[1];

      // No button should be active
      expect(noButton.classes()).toContain('utility-btn');
      expect(noButton.classes()).toContain('utility-btn-active');
      expect(noButton.classes()).not.toContain('utility-btn-inactive');

      // Yes button should be inactive
      expect(yesButton.classes()).toContain('utility-btn');
      expect(yesButton.classes()).toContain('utility-btn-inactive');
      expect(yesButton.classes()).not.toContain('utility-btn-active');
    });

    it('applies correct classes for null state', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: null,
        },
      });

      const buttons = wrapper.findAll('button');
      const noButton = buttons[0];
      const yesButton = buttons[1];

      // Both buttons should be inactive when value is null
      expect(noButton.classes()).toContain('utility-btn-inactive');
      expect(noButton.classes()).not.toContain('utility-btn-active');

      expect(yesButton.classes()).toContain('utility-btn-inactive');
      expect(yesButton.classes()).not.toContain('utility-btn-active');
    });

    it('always includes base utility-btn and w-10 p-1 classes', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: true,
        },
      });

      const buttons = wrapper.findAll('button');

      buttons.forEach(button => {
        expect(button.classes()).toContain('utility-btn');
        expect(button.classes()).toContain('w-10');
        expect(button.classes()).toContain('p-1');
      });
    });
  });

  describe('Button Attributes', () => {
    it('sets button type to button to prevent form submission', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
        },
      });

      const buttons = wrapper.findAll('button');

      buttons.forEach(button => {
        expect(button.attributes('type')).toBe('button');
      });
    });

    it('has correct button text content', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
        },
      });

      const buttons = wrapper.findAll('button');
      expect(buttons[0].text().trim()).toBe('No');
      expect(buttons[1].text().trim()).toBe('Sí');
    });
  });

  describe('Component Structure', () => {
    it('renders the correct HTML structure', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
        },
      });

      // Should have form-container at root
      expect(wrapper.find('.form-container').exists()).toBe(true);

      // Should have flex container with items-center and gap-1
      expect(wrapper.find('.flex.items-center.gap-1').exists()).toBe(true);

      // Should have label element
      expect(wrapper.find('label').exists()).toBe(true);

      // Should have button container with flex and gap-1
      expect(wrapper.find('.flex.gap-1').exists()).toBe(true);

      // Should have exactly 2 buttons
      expect(wrapper.findAll('button')).toHaveLength(2);
    });

    it('renders label text correctly', () => {
      const testLabels = [
        'Simple Label',
        'Complex Label with Numbers 123',
        'Label with Special Characters @#$',
        'Very Long Label That Should Still Work Properly',
        '',
      ];

      testLabels.forEach(label => {
        const wrapper = mount(YesNoToggle, {
          props: { label },
        });

        expect(wrapper.find('label').text()).toBe(label);
        wrapper.unmount();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid button clicks correctly', async () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: null,
        },
      });

      const yesButton = wrapper.findAll('button')[1];
      const noButton = wrapper.findAll('button')[0];

      // Rapid clicks
      await yesButton.trigger('click');
      await noButton.trigger('click');
      await yesButton.trigger('click');
      await noButton.trigger('click');
      await yesButton.trigger('click');

      const emissions = wrapper.emitted('update:modelValue');
      expect(emissions).toHaveLength(5);
      expect(emissions[0]).toEqual([true]);
      expect(emissions[1]).toEqual([false]);
      expect(emissions[2]).toEqual([true]);
      expect(emissions[3]).toEqual([false]);
      expect(emissions[4]).toEqual([true]);
    });

    it('handles same button clicked multiple times', async () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: null,
        },
      });

      const yesButton = wrapper.findAll('button')[1];

      // Click same button multiple times
      await yesButton.trigger('click');
      await yesButton.trigger('click');
      await yesButton.trigger('click');

      const emissions = wrapper.emitted('update:modelValue');
      expect(emissions).toHaveLength(3);
      expect(emissions[0]).toEqual([true]);
      expect(emissions[1]).toEqual([true]);
      expect(emissions[2]).toEqual([true]);
    });

    it('handles modelValue prop changes correctly', async () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
          modelValue: null,
        },
      });

      // Check initial state
      let buttons = wrapper.findAll('button');
      expect(buttons[0].classes()).toContain('utility-btn-inactive');
      expect(buttons[1].classes()).toContain('utility-btn-inactive');

      // Change to true
      await wrapper.setProps({ modelValue: true });
      buttons = wrapper.findAll('button');
      expect(buttons[0].classes()).toContain('utility-btn-inactive');
      expect(buttons[1].classes()).toContain('utility-btn-active');

      // Change to false
      await wrapper.setProps({ modelValue: false });
      buttons = wrapper.findAll('button');
      expect(buttons[0].classes()).toContain('utility-btn-active');
      expect(buttons[1].classes()).toContain('utility-btn-inactive');

      // Change back to null
      await wrapper.setProps({ modelValue: null });
      buttons = wrapper.findAll('button');
      expect(buttons[0].classes()).toContain('utility-btn-inactive');
      expect(buttons[1].classes()).toContain('utility-btn-inactive');
    });
  });

  describe('Accessibility', () => {
    it('has proper button elements for screen readers', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Test Label',
        },
      });

      const buttons = wrapper.findAll('button');

      // Buttons should be actual button elements
      buttons.forEach(button => {
        expect(button.element.tagName.toLowerCase()).toBe('button');
      });

      // Buttons should have text content for screen readers
      expect(buttons[0].text()).toBeTruthy();
      expect(buttons[1].text()).toBeTruthy();
    });

    it('provides label context for the toggle group', () => {
      const wrapper = mount(YesNoToggle, {
        props: {
          label: 'Enable Feature',
        },
      });

      const label = wrapper.find('label');
      expect(label.text()).toBe('Enable Feature');
      expect(label.exists()).toBe(true);
    });
  });
});
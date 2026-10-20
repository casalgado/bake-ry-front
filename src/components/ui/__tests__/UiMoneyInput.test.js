import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import UiMoneyInput from '../UiMoneyInput.vue';

let wrapper;
// v-model in a test: feed each update back in as the new prop.
const mountWith = (modelValue) => mount(UiMoneyInput, {
  props: {
    modelValue,
    'onUpdate:modelValue': (v) => wrapper.setProps({ modelValue: v }),
  },
});

describe('UiMoneyInput', () => {
  it('groups thousands and emits a Number', async () => {
    wrapper = mountWith(null);
    await wrapper.find('input').setValue('1250000');
    expect(wrapper.props('modelValue')).toBe(1250000);
    expect(wrapper.find('input').element.value).toBe('1,250,000');
  });

  it('drops non-digits and empties to null', async () => {
    wrapper = mountWith(500);
    await wrapper.find('input').setValue('abc');
    expect(wrapper.props('modelValue')).toBeNull();
    expect(wrapper.find('input').element.value).toBe('');
  });

  it('follows a value set by the parent', async () => {
    wrapper = mountWith(4800);
    expect(wrapper.find('input').element.value).toBe('4,800');
    await wrapper.setProps({ modelValue: 1820 });
    expect(wrapper.find('input').element.value).toBe('1,820');
  });
});

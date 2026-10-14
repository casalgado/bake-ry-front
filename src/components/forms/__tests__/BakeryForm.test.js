import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BakeryForm from '../BakeryForm.vue';

const mountForm = (props = {}) => mount(BakeryForm, { props });

const fillRequired = async (wrapper, overrides = {}) => {
  const values = {
    '#user-name': 'Ana Gómez',
    '#user-email': 'ana@panaderia.co',
    '#user-password': 'secreto1',
    '#user-confirm-password': 'secreto1',
    '#bakery-name': 'La Esquina',
    ...overrides,
  };
  for (const [selector, value] of Object.entries(values)) {
    await wrapper.find(selector).setValue(value);
  }
};

const submit = (wrapper) => wrapper.find('form').trigger('submit');
const payload = (wrapper, index = 0) => wrapper.emitted('submit')[index][0];

// The payment method cards come first among the checkboxes: cash, transfer, card...
const paymentCheckbox = (wrapper, index) => wrapper.findAll('input[type=checkbox]')[index];

describe('BakeryForm (signup)', () => {
  it('emits the payload POST /bakeries expects, with complimentary always on', async () => {
    const wrapper = mountForm();
    await fillRequired(wrapper);
    await submit(wrapper);

    expect(payload(wrapper)).toEqual({
      user: { name: 'Ana Gómez', email: 'ana@panaderia.co', password: 'secreto1' },
      bakery: { name: 'La Esquina' },
      settings: {
        features: {
          order: {
            activePaymentMethods: ['cash', 'transfer', 'complimentary'],
            defaultDate: 'delivery',
            allowPartialPayment: false,
            timeOfDay: false,
          },
        },
      },
    });
  });

  it('sends the optional fields trimmed, and the owner phone on the user', async () => {
    const wrapper = mountForm();
    await fillRequired(wrapper, {
      '#user-phone': ' 3001112233 ',
      '#bakery-legal-name': ' Inversiones La Esquina S.A.S. ',
      '#bakery-national-id': ' 900123456 ',
      '#bakery-phone': '6015550000',
      '#bakery-address': ' Calle 1 #2-3 ',
    });
    await submit(wrapper);

    const { user, bakery } = payload(wrapper);
    expect(user.phone).toBe('3001112233');
    expect(bakery).toEqual({
      name: 'La Esquina',
      legalName: 'Inversiones La Esquina S.A.S.',
      nationalId: '900123456',
      phone: '6015550000',
      address: 'Calle 1 #2-3',
    });
  });

  it('leaves optional fields out when empty or blank', async () => {
    const wrapper = mountForm();
    await fillRequired(wrapper, { '#bakery-legal-name': '   ', '#user-phone': '  ' });
    await submit(wrapper);

    expect(payload(wrapper).bakery).toEqual({ name: 'La Esquina' });
    expect(payload(wrapper).user).not.toHaveProperty('phone');
  });

  it('adds complimentary once per submit, without changing what the cards show', async () => {
    const wrapper = mountForm();
    await fillRequired(wrapper);
    await submit(wrapper);
    await submit(wrapper);

    for (const index of [0, 1]) {
      const methods = payload(wrapper, index).settings.features.order.activePaymentMethods;
      expect(methods.filter(method => method === 'complimentary')).toHaveLength(1);
    }
    expect(paymentCheckbox(wrapper, 0).element.checked).toBe(true);
    expect(paymentCheckbox(wrapper, 1).element.checked).toBe(true);
    expect(paymentCheckbox(wrapper, 2).element.checked).toBe(false);
  });

  it('follows the payment cards the user turns on and off', async () => {
    const wrapper = mountForm();
    await fillRequired(wrapper);
    await paymentCheckbox(wrapper, 1).setValue(false); // transfer off
    await paymentCheckbox(wrapper, 2).setValue(true); // card on
    await submit(wrapper);

    expect(payload(wrapper).settings.features.order.activePaymentMethods)
      .toEqual(['cash', 'card', 'complimentary']);
  });

  it('blocks a password that is too short', async () => {
    const wrapper = mountForm();
    await fillRequired(wrapper, { '#user-password': '123', '#user-confirm-password': '123' });
    await submit(wrapper);

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('al menos 6 caracteres');
  });

  it('blocks passwords that do not match', async () => {
    const wrapper = mountForm();
    await fillRequired(wrapper, { '#user-confirm-password': 'otra-cosa' });
    await submit(wrapper);

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('Las contraseñas no coinciden');
  });

  it('will not submit with no payment method selected', async () => {
    const wrapper = mountForm();
    await fillRequired(wrapper);
    await paymentCheckbox(wrapper, 0).setValue(false);
    await paymentCheckbox(wrapper, 1).setValue(false);
    await submit(wrapper);

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('Selecciona al menos un método de pago');
    expect(wrapper.find('button[type=submit]').element.disabled).toBe(true);
  });

  it('disables everything while loading', () => {
    const wrapper = mountForm({ loading: true });

    expect(wrapper.find('#user-name').element.disabled).toBe(true);
    expect(wrapper.find('button[type=submit]').text()).toBe('Comenzando...');
  });
});

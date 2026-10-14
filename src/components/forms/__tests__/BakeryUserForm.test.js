import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BakeryUserForm from '../BakeryUserForm.vue';

const mountForm = (props = {}) => mount(BakeryUserForm, { props });

const fill = async (wrapper, { name, email }) => {
  if (name !== undefined) await wrapper.find('input[type=text]').setValue(name);
  if (email !== undefined) await wrapper.find('input[type=email]').setValue(email);
};

const pick = (wrapper, value) => wrapper.find(`input[type=radio][id$="-${value}"]`).setValue(true);

const submit = (wrapper) => wrapper.find('form').trigger('submit');

describe('BakeryUserForm validation', () => {
  it('blocks an empty name', async () => {
    const wrapper = mountForm();
    await submit(wrapper);

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('El nombre es requerido');
  });

  it('rejects a malformed email', async () => {
    const wrapper = mountForm();
    await fill(wrapper, { name: 'Ana Prueba', email: 'no-es-un-correo' });
    await submit(wrapper);

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('Formato de correo electrónico inválido');
  });

  it('allows a client without email', async () => {
    const wrapper = mountForm();
    await fill(wrapper, { name: 'Ana Prueba' });
    await submit(wrapper);

    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it.each(['staff', 'delivery', 'production', 'accounting'])(
    'blocks a %s without email',
    async (type) => {
      const wrapper = mountForm();
      await pick(wrapper, type);
      await fill(wrapper, { name: 'Ana Prueba' });
      await submit(wrapper);

      expect(wrapper.emitted('submit')).toBeUndefined();
      expect(wrapper.text()).toContain('El correo es requerido para el equipo');
    },
  );

  it('accepts a team member with email', async () => {
    const wrapper = mountForm();
    await pick(wrapper, 'delivery');
    await fill(wrapper, { name: 'Ana Prueba', email: 'ana@example.com' });
    await submit(wrapper);

    expect(wrapper.emitted('submit')[0][0]).toMatchObject({ role: 'delivery_assistant', category: 'PER' });
  });
});

describe('BakeryUserForm company fields', () => {
  it('clears legalName and credit days when switching Empresa -> Persona', async () => {
    const wrapper = mountForm();
    await pick(wrapper, 'company');
    await fill(wrapper, { name: 'Panadería Sol' });

    const [, legal] = wrapper.findAll('input[type=text]');
    await legal.setValue('Sol SAS');
    await wrapper.find('input[type=number]').setValue('30');

    await pick(wrapper, 'client');
    await submit(wrapper);

    expect(wrapper.emitted('submit')[0][0]).toMatchObject({
      legalName: '',
      invoiceGracePeriod: null,
    });
  });
});

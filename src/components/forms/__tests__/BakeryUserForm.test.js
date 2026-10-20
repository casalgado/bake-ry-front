import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BakeryUserForm from '../BakeryUserForm.vue';

// The real store reaches for Pinia and the API when imported; the form only
// asks whether e-invoicing is on, which shows its fiscal block.
const settings = vi.hoisted(() => ({ isEinvoicingEnabled: true }));
vi.mock('@/stores/bakerySettingsStore', () => ({ useBakerySettingsStore: () => settings }));

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

describe('BakeryUserForm e-invoicing', () => {
  const setDocument = (wrapper, value) => wrapper.find('input[id$="-nid"]').setValue(value);
  const checked = (wrapper, value) => wrapper.find(`input[type=radio][id$="-${value}"]`).element.checked;

  it('infers the document kind from the client type and stores no override', async () => {
    const wrapper = mountForm();
    await fill(wrapper, { name: 'Ana Prueba' });
    expect(checked(wrapper, '00')).toBe(true); // no document yet: consumidor final

    await setDocument(wrapper, '1047');
    expect(checked(wrapper, '13')).toBe(true); // a person's document: cédula

    await pick(wrapper, 'company');
    expect(checked(wrapper, '31')).toBe(true); // a company's: NIT

    await submit(wrapper);
    expect(wrapper.emitted('submit')[0][0].fiscal).toMatchObject({ idType: '' });
  });

  it('stores an override, and "consumidor final" with a document as 00', async () => {
    const wrapper = mountForm();
    await fill(wrapper, { name: 'Ana Prueba' });
    await setDocument(wrapper, 'AB123');
    await pick(wrapper, '41');
    await submit(wrapper);
    expect(wrapper.emitted('submit')[0][0].fiscal.idType).toBe('41');

    await pick(wrapper, '00');
    await submit(wrapper);
    expect(wrapper.emitted('submit')[1][0].fiscal).toMatchObject({ idType: '00', email: '' });
  });

  it('asks for the document when a kind is forced without one', async () => {
    const wrapper = mountForm();
    await fill(wrapper, { name: 'Ana Prueba' });
    await pick(wrapper, '13');
    await submit(wrapper);

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('hace falta el número de documento');
  });

  it('keeps stored fiscal fields it does not edit, and survives a null email', async () => {
    const wrapper = mountForm({
      initialData: {
        name: 'Hotel', category: 'B2B', role: 'bakery_customer', nationalId: '900123456',
        fiscal: { idType: '', email: null, cityCode: '11001', taxLevelCode: 'O-13' },
      },
    });
    await submit(wrapper);

    expect(wrapper.emitted('submit')[0][0].fiscal).toMatchObject({ cityCode: '11001', taxLevelCode: 'O-13', email: '' });
  });

  it('does not ask for the document of a stored override while e-invoicing is off', async () => {
    settings.isEinvoicingEnabled = false;
    const wrapper = mountForm({
      initialData: { name: 'Ana Prueba', category: 'B2C', role: 'bakery_customer', nationalId: '', fiscal: { idType: '41' } },
    });
    await submit(wrapper);
    settings.isEinvoicingEnabled = true;

    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('leaves fiscal data alone when e-invoicing is off', async () => {
    settings.isEinvoicingEnabled = false;
    const wrapper = mountForm();
    await fill(wrapper, { name: 'Ana Prueba' });
    await submit(wrapper);
    settings.isEinvoicingEnabled = true;

    expect(wrapper.emitted('submit')[0][0]).not.toHaveProperty('fiscal');
  });
});

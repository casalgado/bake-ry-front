import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BakeryFeaturesForm from '../BakeryFeaturesForm.vue';
import UiFeatureCard from '@/components/ui/UiFeatureCard.vue';
import { featuresToForm, OWNER_FIELDS } from '@/utils/settingsForm';

// What the backend returns: the owner's groups plus ones this form must never send.
const features = {
  order: {
    activePaymentMethods: ['cash', 'transfer', 'complimentary'],
    defaultDate: 'production',
    allowPartialPayment: false,
    timeOfDay: false,
    offlineMode: false,
    loadHistoricalOnUserSelection: false,
  },
  products: { useProductCost: false, offersWholeGrain: false },
  reports: { defaultReportFilter: 'dueDate', showMultipleReports: false },
  invoicing: { taxMode: 'inclusive', defaultTermsAndConditions: '' },
  pos: { autoMarkPaid: true },
  inventory: { enabled: true, warehouses: [] },
  accounting: { enabled: true },
  einvoicing: { enabled: true },
};

const paymentMethods = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
];

const mountForm = (props = {}) => mount(BakeryFeaturesForm, {
  props: { initialData: featuresToForm(features, OWNER_FIELDS), paymentMethods, ...props },
});

const card = (wrapper, title) =>
  wrapper.findAllComponents(UiFeatureCard).find(c => c.props('title') === title);

const submit = (wrapper) => wrapper.find('form').trigger('submit');
const saveButton = (wrapper) => wrapper.find('button[type=submit]');
const cancelButton = (wrapper) => wrapper.find('button[type=button]');

describe('BakeryFeaturesForm (owner)', () => {
  it('sends a patch with only the groups the owner owns', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Pagos parciales').find('input').setValue(true);
    await submit(wrapper);

    const patch = wrapper.emitted('save')[0][0];
    expect(Object.keys(patch).sort()).toEqual(['invoicing', 'order', 'products', 'reports']);
    expect(patch.order.allowPartialPayment).toBe(true);
    expect(patch.order.activePaymentMethods).toEqual(['cash', 'transfer', 'complimentary']);
  });

  it('sends nothing the admin owns', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Pagos parciales').find('input').setValue(true);
    await submit(wrapper);

    const patch = wrapper.emitted('save')[0][0];
    for (const group of ['pos', 'inventory', 'accounting', 'einvoicing']) {
      expect(patch).not.toHaveProperty(group);
    }
  });

  it('keeps complimentary on when payment methods are toggled', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Tarjeta').find('input').setValue(true);
    await card(wrapper, 'Transferencia').find('input').setValue(false);
    await submit(wrapper);

    expect(wrapper.emitted('save')[0][0].order.activePaymentMethods)
      .toEqual(['cash', 'complimentary', 'card']);
  });

  it('does not save, and is not dirty, until something changes', async () => {
    const wrapper = mountForm();
    expect(wrapper.vm.isDirty).toBe(false);
    expect(saveButton(wrapper).element.disabled).toBe(true);

    await submit(wrapper);
    expect(wrapper.emitted('save')).toBeUndefined();
  });

  it('cancel puts the form back as it was', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Pagos parciales').find('input').setValue(true);
    expect(wrapper.vm.isDirty).toBe(true);

    await cancelButton(wrapper).trigger('click');
    expect(wrapper.vm.isDirty).toBe(false);
    expect(card(wrapper, 'Pagos parciales').find('input').element.checked).toBe(false);
  });

  it('keeps unsaved edits when the same data is fetched again', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Pagos parciales').find('input').setValue(true);

    await wrapper.setProps({ initialData: featuresToForm(features, OWNER_FIELDS) });

    expect(wrapper.vm.isDirty).toBe(true);
    expect(card(wrapper, 'Pagos parciales').find('input').element.checked).toBe(true);
  });

  it('becomes the new baseline when saved data comes back', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Pagos parciales').find('input').setValue(true);

    const saved = structuredClone(features);
    saved.order.allowPartialPayment = true;
    await wrapper.setProps({ initialData: featuresToForm(saved, OWNER_FIELDS) });

    expect(wrapper.vm.isDirty).toBe(false);
  });

  it('will not save with no payment method selected', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Efectivo').find('input').setValue(false);
    await card(wrapper, 'Transferencia').find('input').setValue(false);
    await submit(wrapper);

    expect(wrapper.emitted('save')).toBeUndefined();
    expect(saveButton(wrapper).element.disabled).toBe(true);
    expect(wrapper.text()).toContain('Selecciona al menos un método de pago');
  });

  it('locks every option while saving', () => {
    const wrapper = mountForm({ loading: true });

    const inputs = wrapper.findAll('input');
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every(input => input.element.disabled)).toBe(true);
    expect(saveButton(wrapper).text()).toBe('Guardando...');
  });
});

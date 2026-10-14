import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BakeryModulesForm from '../BakeryModulesForm.vue';
import UiFeatureCard from '@/components/ui/UiFeatureCard.vue';
import { featuresToForm, ADMIN_FIELDS } from '@/utils/settingsForm';

// What the backend returns: the admin's groups plus ones this form must never send.
const features = {
  order: { activePaymentMethods: ['cash'], defaultDate: 'delivery' },
  reports: { defaultReportFilter: 'paymentDate' },
  pos: { enabled: true, autoMarkPaid: false, defaultToCurrentDate: false, hideDeliveryOptions: false, autoSelectClient: false },
  inventory: { enabled: false, enabledAt: '2026-09-01', warehouses: [{ id: 'main' }] },
  accounting: { enabled: false },
  einvoicing: { enabled: true },
};

const mountForm = (props = {}) => mount(BakeryModulesForm, {
  props: { initialData: featuresToForm(features, ADMIN_FIELDS), ...props },
});

const card = (wrapper, title) =>
  wrapper.findAllComponents(UiFeatureCard).find(c => c.props('title') === title);

const submit = (wrapper) => wrapper.find('form').trigger('submit');

describe('BakeryModulesForm (system admin)', () => {
  it('sends a patch with only POS and the modules', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Inventario').find('input').setValue(true);
    await submit(wrapper);

    const patch = wrapper.emitted('save')[0][0];
    expect(Object.keys(patch).sort()).toEqual(['accounting', 'inventory', 'pos']);
    expect(patch.inventory.enabled).toBe(true);
  });

  it('sends only `enabled` for a module, never what the server owns', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Inventario').find('input').setValue(true);
    await submit(wrapper);

    expect(wrapper.emitted('save')[0][0].inventory).toEqual({ enabled: true });
  });

  it('sends nothing the owner owns', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Contabilidad').find('input').setValue(true);
    await submit(wrapper);

    const patch = wrapper.emitted('save')[0][0];
    for (const group of ['order', 'reports', 'invoicing', 'products', 'einvoicing']) {
      expect(patch).not.toHaveProperty(group);
    }
  });

  it('does not save until something changes', async () => {
    const wrapper = mountForm();
    expect(wrapper.vm.isDirty).toBe(false);
    expect(wrapper.find('button[type=submit]').element.disabled).toBe(true);

    await submit(wrapper);
    expect(wrapper.emitted('save')).toBeUndefined();
  });

  it('cancel puts the form back as it was', async () => {
    const wrapper = mountForm();
    await card(wrapper, 'Inventario').find('input').setValue(true);
    expect(wrapper.vm.isDirty).toBe(true);

    await wrapper.find('button[type=button]').trigger('click');
    expect(wrapper.vm.isDirty).toBe(false);
    expect(card(wrapper, 'Inventario').find('input').element.checked).toBe(false);
  });
});

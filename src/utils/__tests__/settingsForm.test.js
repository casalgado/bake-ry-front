import { describe, it, expect } from 'vitest';
import { useDraft } from '@/composables/useUnsavedChanges';
import { featuresToForm, formToFeatures, SIGNUP_FIELDS, OWNER_FIELDS, ADMIN_FIELDS } from '../settingsForm';

const features = {
  order: { activePaymentMethods: ['cash'], defaultDate: 'delivery', allowPartialPayment: true, timeOfDay: false },
  pos: { autoMarkPaid: true, enabled: true },
  inventory: { enabled: true, enabledAt: 'x', warehouses: [] },
};

describe('settingsForm', () => {
  it('reads only the keys it is asked for', () => {
    expect(featuresToForm(features, SIGNUP_FIELDS)).toEqual({
      activePaymentMethods: ['cash'],
      defaultDate: 'delivery',
      allowPartialPayment: true,
      timeOfDay: false,
    });
  });

  it('is null until features exist', () => {
    expect(featuresToForm(undefined, OWNER_FIELDS)).toBeNull();
  });

  it('writes a patch holding only the keys it owns', () => {
    const form = featuresToForm(features, ADMIN_FIELDS);
    form.inventoryEnabled = false;

    const patch = formToFeatures(form, ADMIN_FIELDS);

    expect(patch.inventory).toEqual({ enabled: false });
    expect(patch.pos.autoMarkPaid).toBe(true);
    expect(patch.order).toBeUndefined();
    expect(patch.pos.enabled).toBeUndefined();
  });

  it('does not share the payment method array with the source', () => {
    const form = featuresToForm(features, SIGNUP_FIELDS);
    form.activePaymentMethods.push('nequi');
    expect(features.order.activePaymentMethods).toEqual(['cash']);
  });
});

describe('useDraft', () => {
  it('is dirty only while it differs from what was loaded', () => {
    const { form, isDirty, load, reset } = useDraft();
    load({ a: 1 });
    expect(isDirty.value).toBe(false);

    form.value.a = 2;
    expect(isDirty.value).toBe(true);

    reset();
    expect(form.value.a).toBe(1);
    expect(isDirty.value).toBe(false);

    form.value.a = 3;
    load({ a: 3 }); // what a successful save does: the refetched data becomes the baseline
    expect(isDirty.value).toBe(false);
  });

  it('ignores a refetch that changes nothing', () => {
    const { isStale, load } = useDraft();
    load({ a: 1 });
    expect(isStale({ a: 1 })).toBe(false);
    expect(isStale({ a: 2 })).toBe(true);
  });
});

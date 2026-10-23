<script setup>
/* One recurring gasto. It saves itself (create, or patch when `template` is given)
 * and emits `saved`; the screen decides what to reload. */
import { ref, computed, onMounted, useId } from 'vue';
import { useAccountingTemplateStore } from '@/stores/accountingTemplateStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useProviderStore } from '@/stores/providerStore';
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue';

const props = defineProps({
  /* A stored template to edit; null creates one. */
  template: { type: Object, default: null },
});
const emit = defineEmits(['saved', 'cancel']);

const uid = useId();
const templateStore = useAccountingTemplateStore();
const settingsStore = useBakerySettingsStore();
const providerStore = useProviderStore();

const form = ref({
  name: props.template?.name ?? '',
  categoryId: props.template?.categoryId ?? '',
  defaultAmount: props.template?.defaultAmount ?? null,
  defaultIvaAmount: props.template?.defaultIvaAmount || null,
  dayOfMonth: props.template?.dayOfMonth ?? null,
  providerId: props.template?.providerId ?? '',
  notes: props.template?.notes ?? '',
});

const saving = ref(false);
const error = ref('');

// An edited template keeps its own category even after it is deactivated.
const categories = computed(() =>
  (settingsStore.items[0]?.expenseCategories ?? [])
    .filter((cat) => cat.isActive || cat.id === props.template?.categoryId),
);
const expenseOptions = computed(() => categories.value.filter((cat) => !cat.isInvestment));
const investmentOptions = computed(() => categories.value.filter((cat) => cat.isInvestment));
const providers = computed(() => providerStore.items.filter((p) => !p.isDeleted));

const canSave = computed(() =>
  !!form.value.name.trim() && !!form.value.categoryId && form.value.defaultAmount > 0 && !saving.value,
);

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  error.value = '';
  const payload = {
    name: form.value.name.trim(),
    categoryId: form.value.categoryId,
    defaultAmount: form.value.defaultAmount,
    defaultIvaAmount: form.value.defaultIvaAmount || 0,
    dayOfMonth: form.value.dayOfMonth || null,
    providerId: form.value.providerId || null,
    notes: form.value.notes.trim(),
  };
  try {
    if (props.template) await templateStore.patch(props.template.id, payload);
    else await templateStore.create({ type: 'expense', ...payload });
    emit('saved');
  } catch (err) {
    error.value = err?.message || 'No se pudo guardar el gasto recurrente';
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (!settingsStore.items.length) settingsStore.fetchById('default');
  if (!providerStore.items.length) providerStore.fetchAll();
});
</script>

<template>
  <form class="ui-card flex flex-col gap-4" data-ui-theme="light" @submit.prevent="save">
    <h2 class="ui-panehead-title">{{ template ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente' }}</h2>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-name`" data-required>Nombre</label>
      <input :id="`${uid}-name`" v-model="form.name" class="ui-input" placeholder="Arriendo local" required>
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-cat`" data-required>Categoría</label>
      <select :id="`${uid}-cat`" v-model="form.categoryId" class="ui-input" required>
        <option value="" disabled>Seleccionar categoría</option>
        <optgroup label="Gastos">
          <option v-for="cat in expenseOptions" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </optgroup>
        <optgroup v-if="investmentOptions.length" label="Inversión">
          <option v-for="cat in investmentOptions" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </optgroup>
      </select>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-amount`" data-required>Monto</label>
        <UiMoneyInput :id="`${uid}-amount`" v-model="form.defaultAmount" class="ui-field-unit" required />
      </div>
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-iva`">IVA</label>
        <UiMoneyInput :id="`${uid}-iva`" v-model="form.defaultIvaAmount" class="ui-field-unit" />
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-day`">Día del mes</label>
        <input
          :id="`${uid}-day`"
          v-model.number="form.dayOfMonth"
          type="number"
          min="1"
          max="31"
          class="ui-input"
        >
      </div>
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-provider`">Proveedor</label>
        <select :id="`${uid}-provider`" v-model="form.providerId" class="ui-input">
          <option value="">Sin proveedor</option>
          <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-notes`">Notas</label>
      <input :id="`${uid}-notes`" v-model="form.notes" class="ui-input">
    </div>

    <span v-if="error" class="ui-field-error" role="alert">{{ error }}</span>

    <div class="flex gap-2 justify-end">
      <button type="button" class="ui-btn ui-btn-danger" :disabled="saving" @click="emit('cancel')">
        Cancelar
      </button>
      <button type="submit" class="ui-btn ui-btn-solid" :disabled="!canSave">
        {{ saving ? 'Guardando…' : 'Guardar' }}
      </button>
    </div>
  </form>
</template>

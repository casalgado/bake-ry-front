<script setup>
/* One provider. It saves itself (create, or patch when `provider` is given) and
 * emits `saved`; the screen decides what to reload. */
import { ref, computed, watch, onMounted, useId } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useProviderStore } from '@/stores/providerStore';

const props = defineProps({
  /* A stored provider to edit; null creates one. */
  provider: { type: Object, default: null },
});
const emit = defineEmits(['saved', 'cancel']);

const uid = useId();
const settingsStore = useBakerySettingsStore();
const providerStore = useProviderStore();

/* The select's value, as in the invoice review: '', 'insumo' or `${kind}:${categoryId}`. */
const choiceOf = (destination) => {
  if (!destination) return '';
  return destination.kind === 'insumo' ? 'insumo' : `${destination.kind}:${destination.categoryId}`;
};

const form = ref({
  name: props.provider?.name ?? '',
  documentType: props.provider?.documentType ?? 'NIT',
  nationalId: props.provider?.nationalId ?? '',
  email: props.provider?.email ?? '',
  phone: props.provider?.phone ?? '',
  destination: choiceOf(props.provider?.defaultDestination),
  // '' unknown, 'yes' sends e-invoices, 'no' needs a documento soporte
  issuesEinvoice: { true: 'yes', false: 'no' }[props.provider?.issuesEinvoice] ?? '',
  legalName: props.provider?.legalName ?? '',
  personType: props.provider?.personType ?? '2',
  taxLevelCode: props.provider?.taxLevelCode ?? 'R-99-PN',
  address: {
    line: '', cityCode: '', cityName: '', deptCode: '', deptName: '', postalCode: '',
    ...props.provider?.address,
  },
});

const ISSUES = { yes: true, no: false };

const saving = ref(false);
const error = ref('');

const categories = computed(() =>
  (settingsStore.items[0]?.expenseCategories ?? []).filter((cat) => cat.isActive));
const expenseOptions = computed(() => categories.value.filter((cat) => !cat.isInvestment));
const investmentOptions = computed(() => categories.value.filter((cat) => cat.isInvestment));

// A stored category deactivated since is not offered; the backend refuses it, so pick again.
watch(categories, (options) => {
  const categoryId = form.value.destination.split(':')[1];
  if (settingsStore.items.length && categoryId && !options.some((cat) => cat.id === categoryId)) {
    form.value.destination = '';
  }
}, { immediate: true });

// A shared mailbox is legitimate, so this only warns.
const sharedEmail = computed(() => {
  const email = form.value.email.trim().toLowerCase();
  if (!email) return null;
  return providerStore.items.find((other) =>
    !other.isDeleted && other.id !== props.provider?.id && other.email?.toLowerCase() === email) ?? null;
});

const canSave = computed(() =>
  !!form.value.name.trim() && !saving.value,
);

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  error.value = '';
  const [kind, categoryId] = form.value.destination.split(':');
  const payload = {
    name: form.value.name.trim(),
    documentType: form.value.documentType,
    nationalId: form.value.nationalId.trim() || null,
    email: form.value.email.trim(),
    phone: form.value.phone.trim() || null,
    defaultDestination: kind ? { kind, ...(categoryId && { categoryId }) } : null,
    issuesEinvoice: ISSUES[form.value.issuesEinvoice] ?? null,
    legalName: form.value.legalName.trim() || null,
    personType: form.value.personType,
    taxLevelCode: form.value.taxLevelCode,
    address: Object.values(form.value.address).some((part) => String(part ?? '').trim())
      ? Object.fromEntries(Object.entries(form.value.address).map(([key, part]) => [key, String(part ?? '').trim()]))
      : null,
  };
  try {
    if (props.provider) await providerStore.patch(props.provider.id, payload);
    else await providerStore.create(payload);
    emit('saved');
  } catch (err) {
    error.value = err?.message || 'No se pudo guardar el proveedor';
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
    <h2 class="ui-panehead-title">{{ provider ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-name`" data-required>Nombre</label>
      <input :id="`${uid}-name`" v-model="form.name" class="ui-input" required>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-type`">Tipo de documento</label>
        <select :id="`${uid}-type`" v-model="form.documentType" class="ui-input">
          <option value="NIT">NIT</option>
          <option value="CC">Cédula de ciudadanía</option>
          <option value="CE">Cédula de extranjería</option>
        </select>
      </div>
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-id`">Número de documento</label>
        <input :id="`${uid}-id`" v-model="form.nationalId" class="ui-input" inputmode="numeric">
        <span class="ui-field-hint">Sin dígito de verificación.</span>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-email`">Correo</label>
        <input :id="`${uid}-email`" v-model="form.email" type="email" class="ui-input">
        <span v-if="sharedEmail" class="ui-field-hint">Otro proveedor utiliza este correo: {{ sharedEmail.name }}.</span>
      </div>
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-phone`">Teléfono</label>
        <input :id="`${uid}-phone`" v-model="form.phone" type="tel" class="ui-input">
      </div>
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-dest`">Clasificar facturas como</label>
      <select :id="`${uid}-dest`" v-model="form.destination" class="ui-input">
        <option value="">Sin clasificación predeterminada</option>
        <option value="insumo">Compra de insumos</option>
        <optgroup label="Gasto">
          <option v-for="cat in expenseOptions" :key="cat.id" :value="`expense:${cat.id}`">{{ cat.name }}</option>
        </optgroup>
        <optgroup v-if="investmentOptions.length" label="Inversión">
          <option v-for="cat in investmentOptions" :key="cat.id" :value="`investment:${cat.id}`">{{ cat.name }}</option>
        </optgroup>
      </select>
    </div>

    <details v-if="settingsStore.isEinvoicingEnabled">
      <summary class="ui-field-k cursor-pointer">Datos fiscales (documento soporte)</summary>
      <div class="flex flex-col gap-4 mt-3">
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-issues`">¿Factura electrónicamente?</label>
          <select :id="`${uid}-issues`" v-model="form.issuesEinvoice" class="ui-input">
            <option value="">No se sabe</option>
            <option value="yes">Sí, envía factura electrónica</option>
            <option value="no">No: sus compras requieren documento soporte</option>
          </select>
        </div>
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-legal`">Razón social</label>
          <input :id="`${uid}-legal`" v-model="form.legalName" class="ui-input">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-person`">Tipo de persona</label>
            <select :id="`${uid}-person`" v-model="form.personType" class="ui-input">
              <option value="2">Natural</option>
              <option value="1">Jurídica</option>
            </select>
          </div>
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-tax`">Responsabilidad fiscal</label>
            <select :id="`${uid}-tax`" v-model="form.taxLevelCode" class="ui-input">
              <option value="R-99-PN">No responsable de IVA</option>
              <option value="O-47">Régimen simple de tributación</option>
              <option v-if="!['R-99-PN', 'O-47'].includes(form.taxLevelCode)" :value="form.taxLevelCode">{{ form.taxLevelCode }}</option>
            </select>
          </div>
        </div>
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-line`">Dirección</label>
          <input :id="`${uid}-line`" v-model="form.address.line" class="ui-input">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-city`">Municipio</label>
            <input :id="`${uid}-city`" v-model="form.address.cityName" class="ui-input">
          </div>
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-citycode`">Código del municipio</label>
            <input :id="`${uid}-citycode`" v-model="form.address.cityCode" class="ui-input" inputmode="numeric" placeholder="11001">
          </div>
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-dept`">Departamento</label>
            <input :id="`${uid}-dept`" v-model="form.address.deptName" class="ui-input">
          </div>
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-deptcode`">Código del departamento</label>
            <input :id="`${uid}-deptcode`" v-model="form.address.deptCode" class="ui-input" inputmode="numeric" placeholder="11">
          </div>
          <div class="ui-field">
            <label class="ui-field-k" :for="`${uid}-postal`">Código postal</label>
            <input :id="`${uid}-postal`" v-model="form.address.postalCode" class="ui-input" inputmode="numeric" placeholder="110111">
            <span class="ui-field-hint">Seis dígitos. Los códigos son los de la DIVIPOLA (DANE).</span>
          </div>
        </div>
      </div>
    </details>

    <span v-if="error" class="ui-field-error" role="alert">{{ error }}</span>

    <div class="flex gap-2 justify-end">
      <button type="button" class="ui-btn ui-btn-danger" :disabled="saving" @click="emit('cancel')">
        Cancelar
      </button>
      <button type="submit" class="ui-btn ui-btn-solid" :disabled="!canSave">
        {{ saving ? 'Guardando…' : 'Guardar proveedor' }}
      </button>
    </div>
  </form>
</template>

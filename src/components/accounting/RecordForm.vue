<script setup>
/* One gasto, inversión or otro ingreso. It saves itself (create, or patch when
 * `record` is given) and emits `saved`; the screen decides what to reload.
 * An ingreso names who paid (`counterparty`), never a provider, and has no taxes:
 * anything sold to a customer is an order, not an ingreso.
 * "Ingredientes y materia prima" is in the picker on purpose: the
 * insumos that go in a recipe are bought in Compra de insumos, so picking it only
 * explains that and blocks Guardar. */
import { ref, computed, onMounted, useId } from 'vue';
import { useRoute } from 'vue-router';
import { useAccountingRecordStore } from '@/stores/accountingRecordStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useProviderStore } from '@/stores/providerStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { getTodayString, formatDateForInput } from '@/utils/dateUtils';
import { paymentIconMap } from '@/utils/paymentIcons';
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue';
import UiPills from '@/components/ui/UiPills.vue';

const props = defineProps({
  /* The month Resumen is showing (YYYY-MM): where the gasto lands by default. */
  period: { type: String, required: true },
  /* A stored record to repeat: everything but the date and the invoice number. */
  prefill: { type: Object, default: null },
  /* A stored record to edit, with its own date, period and invoice number. */
  record: { type: Object, default: null },
  /* 'expense' or 'revenue' for a new one; an existing record brings its own. */
  type: { type: String, default: 'expense' },
});
const emit = defineEmits(['saved', 'cancel']);

const INSUMOS_ID = 'ingredients';

const uid = useId();
const recordStore = useAccountingRecordStore();
const settingsStore = useBakerySettingsStore();
const providerStore = useProviderStore();
const systemSettingsStore = useSystemSettingsStore();

// Compra de insumos lives under the admin dashboard; the accounting role cannot create purchases.
const inDashboard = useRoute().path.startsWith('/dashboard');

const source = props.record ?? props.prefill;
const isRevenue = (source?.type ?? props.type) === 'revenue';

const form = ref({
  categoryId: source?.categoryId ?? '',
  amount: source?.amount ?? null,
  description: source?.description ?? '',
  date: props.record ? formatDateForInput(props.record.date) : getTodayString(),
  period: props.record?.period ?? props.period,
  providerId: source?.providerId ?? '',
  paymentMethod: source?.paymentMethod ?? 'transfer',
  ivaAmount: source?.ivaAmount || null,
  retefuente: source?.retefuente || null,
  reteica: source?.reteica || null,
  reteiva: source?.reteiva || null,
  invoiceRef: props.record?.invoiceRef ?? '',
  counterparty: source?.counterparty ?? '',
});

const saving = ref(false);
const error = ref('');

// An edited record keeps its own category even after it is deactivated.
const categories = computed(() =>
  (settingsStore.items[0]?.[isRevenue ? 'revenueCategories' : 'expenseCategories'] ?? [])
    .filter((cat) => cat.isActive || cat.id === props.record?.categoryId),
);
const expenseOptions = computed(() => categories.value.filter((cat) => !cat.isInvestment));
const investmentOptions = computed(() => categories.value.filter((cat) => cat.isInvestment));
const isInsumos = computed(() => form.value.categoryId === INSUMOS_ID);

const paymentOptions = computed(() => {
  const active = settingsStore.items[0]?.features?.order?.activePaymentMethods ?? [];
  const methods = systemSettingsStore.configurablePaymentMethods
    .filter((method) => active.includes(method.value));
  return (methods.length ? methods : [
    { value: 'cash', label: 'Efectivo' },
    { value: 'transfer', label: 'Transferencia' },
  ]).map((method) => ({ ...method, icon: paymentIconMap[method.value] }));
});

const providers = computed(() => providerStore.items.filter((p) => !p.isDeleted));

// A new provider is typed inline, in the same place the picker is, and created on save.
const NEW_PROVIDER = '__new__';
const newProvider = ref({ name: '', documentType: 'NIT', nationalId: '' });

const isNewProvider = computed(() => form.value.providerId === NEW_PROVIDER);
const hasProvider = computed(() => !!form.value.providerId);
const canSave = computed(() => !!form.value.categoryId && !isInsumos.value && form.value.amount > 0
  && !(isNewProvider.value && !newProvider.value.name.trim()) && !saving.value);

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  error.value = '';
  try {
    // Stored in the form, so a retry after a failed save reuses it instead of creating another.
    if (!isRevenue && isNewProvider.value) {
      const { name, documentType, nationalId } = newProvider.value;
      const created = await providerStore.create({
        name: name.trim(),
        documentType,
        nationalId: nationalId.trim() || null,
      });
      form.value.providerId = created.id;
    }
    const { amount, ivaAmount, retefuente, reteica, reteiva } = form.value;
    const common = {
      categoryId: form.value.categoryId,
      amount,
      description: form.value.description.trim(),
      date: form.value.date,
      period: form.value.period,
      paymentMethod: form.value.paymentMethod,
    };
    const payload = isRevenue
      ? { ...common, counterparty: form.value.counterparty.trim() }
      : {
        ...common,
        ivaAmount: ivaAmount || 0,
        retefuente: retefuente || 0,
        reteica: reteica || 0,
        reteiva: reteiva || 0,
        providerId: hasProvider.value ? form.value.providerId : null,
        invoiceRef: hasProvider.value ? form.value.invoiceRef.trim() : '',
      };
    if (props.record) await recordStore.patch(props.record.id, payload);
    else await recordStore.create({ type: isRevenue ? 'revenue' : 'expense', ...payload });
    emit('saved');
  } catch (err) {
    error.value = err?.message || (isRevenue ? 'No se pudo guardar el ingreso' : 'No se pudo guardar el gasto');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (!settingsStore.items.length) settingsStore.fetchById('default');
  if (!providerStore.items.length) providerStore.fetchAll();
  if (!systemSettingsStore.availablePaymentMethods.length) systemSettingsStore.fetchSettings();
});
</script>

<template>
  <form class="ui-card flex flex-col gap-4" data-ui-theme="light" @submit.prevent="save">
    <h2 class="ui-panehead-title">
      {{ isRevenue ? (record ? 'Editar ingreso' : 'Nuevo ingreso') : (record ? 'Editar gasto' : 'Nuevo gasto') }}
    </h2>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-cat`" data-required>Categoría</label>
      <template v-if="isRevenue">
        <select :id="`${uid}-cat`" v-model="form.categoryId" class="ui-input" required>
          <option value="" disabled>Seleccionar categoría</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
        <span v-if="!categories.length" class="ui-field-hint">
          No hay categorías de ingreso activas. Se activan en Configuración, sección Contabilidad.
        </span>
        <span class="ui-field-hint">
          Las ventas a clientes se registran como pedidos, no como ingresos.
        </span>
      </template>
      <template v-else>
        <select :id="`${uid}-cat`" v-model="form.categoryId" class="ui-input" required>
          <option value="" disabled>Seleccionar categoría</option>
          <optgroup label="Gastos">
            <option v-for="cat in expenseOptions" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            <option :value="INSUMOS_ID">Ingredientes y materia prima</option>
          </optgroup>
          <optgroup v-if="investmentOptions.length" label="Inversión">
            <option v-for="cat in investmentOptions" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </optgroup>
        </select>
        <span v-if="isInsumos" class="ui-field-hint">
          Los insumos utilizados en recetas se registran en Compra de insumos, para que se
          incorporen al inventario y al costo de ventas.
          <RouterLink v-if="inDashboard" to="/dashboard/accounting/compra-de-insumos" class="underline">
            Ir a Compra de insumos
          </RouterLink>
        </span>
      </template>
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-amount`" data-required>Monto</label>
      <UiMoneyInput :id="`${uid}-amount`" v-model="form.amount" class="ui-field-unit" required />
      <span v-if="!isRevenue" class="ui-field-hint">Valor total pagado, con IVA incluido.</span>
    </div>

    <div class="ui-field">
      <label class="ui-field-k" :for="`${uid}-desc`">Descripción</label>
      <input :id="`${uid}-desc`" v-model="form.description" class="ui-input">
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-date`" data-required>Fecha</label>
        <input :id="`${uid}-date`" v-model="form.date" type="date" class="ui-input" required>
      </div>
      <div class="ui-field">
        <label class="ui-field-k" :for="`${uid}-period`" data-required>Período contable</label>
        <input :id="`${uid}-period`" v-model="form.period" type="month" class="ui-input" required>
      </div>
    </div>

    <div v-if="isRevenue" class="ui-field">
      <label class="ui-field-k" :for="`${uid}-counterparty`">Cliente o tercero</label>
      <input :id="`${uid}-counterparty`" v-model="form.counterparty" class="ui-input">
    </div>

    <div v-if="!isRevenue" class="ui-field">
      <label class="ui-field-k" :for="`${uid}-provider`">Proveedor</label>
      <select :id="`${uid}-provider`" v-model="form.providerId" class="ui-input">
        <option value="">Sin proveedor</option>
        <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
        <option :value="NEW_PROVIDER">+ Nuevo proveedor…</option>
      </select>
      <div v-if="isNewProvider" class="flex flex-col gap-2 mt-2">
        <input
          v-model="newProvider.name"
          class="ui-input"
          placeholder="Nombre del proveedor"
          aria-label="Nombre del nuevo proveedor"
        >
        <div class="flex gap-2">
          <select v-model="newProvider.documentType" class="ui-input w-28" aria-label="Tipo de documento">
            <option value="NIT">NIT</option>
            <option value="CC">Cédula</option>
          </select>
          <input
            v-model="newProvider.nationalId"
            class="ui-input flex-1"
            inputmode="numeric"
            placeholder="Número (opcional)"
            aria-label="Número de documento"
          >
        </div>
      </div>
    </div>

    <div v-if="hasProvider" class="ui-field">
      <label class="ui-field-k" :for="`${uid}-ref`">N.º de factura</label>
      <input :id="`${uid}-ref`" v-model="form.invoiceRef" class="ui-input">
    </div>

    <UiPills v-model="form.paymentMethod" :options="paymentOptions" label="Pago" />

    <details v-if="!isRevenue">
      <summary class="ui-field-k cursor-pointer">Impuestos</summary>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-iva`">IVA</label>
          <UiMoneyInput :id="`${uid}-iva`" v-model="form.ivaAmount" class="ui-field-unit" />
        </div>
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-rf`">Retefuente</label>
          <UiMoneyInput :id="`${uid}-rf`" v-model="form.retefuente" class="ui-field-unit" />
        </div>
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-ri`">ReteICA</label>
          <UiMoneyInput :id="`${uid}-ri`" v-model="form.reteica" class="ui-field-unit" />
        </div>
        <div class="ui-field">
          <label class="ui-field-k" :for="`${uid}-rv`">ReteIVA</label>
          <UiMoneyInput :id="`${uid}-rv`" v-model="form.reteiva" class="ui-field-unit" />
        </div>
      </div>
    </details>

    <span v-if="error" class="ui-field-error" role="alert">{{ error }}</span>

    <div class="flex gap-2 justify-end">
      <button type="button" class="ui-btn ui-btn-danger" :disabled="saving" @click="emit('cancel')">
        Cancelar
      </button>
      <button type="submit" class="ui-btn ui-btn-solid" :disabled="!canSave">
        {{ saving ? 'Guardando…' : record ? 'Guardar cambios' : isRevenue ? 'Guardar ingreso' : 'Guardar gasto' }}
      </button>
    </div>
  </form>
</template>

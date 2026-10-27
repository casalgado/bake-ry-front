<script setup>
/* The month at a glance: its gastos, inversiones and otros ingresos, what is still
 * pending. The month comes from the global period selector,
 * locked to months while this screen is open. */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { Dialog, DialogPanel } from '@headlessui/vue';

// DataTable Core
import DataTable from '@/components/DataTable/index.vue';

// DataTable Renderers
import DateCell from '@/components/DataTable/renderers/DateCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import ValueWithDescription from '@/components/DataTable/renderers/ValueWithDescription.vue';

// Components
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import TotalsSummary from '@/components/common/TotalsSummary.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import RecordForm from '@/components/accounting/RecordForm.vue';
import PendingTemplates from '@/components/accounting/PendingTemplates.vue';
import SupportDocForm from '@/components/accounting/SupportDocForm.vue';

// Stores
import { isAnnulled } from '@/services/supportDocService';
import { useSupportDocStore } from '@/stores/supportDocStore';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useAccountingStore } from '@/stores/accountingStore';
import { useAccountingRecordStore } from '@/stores/accountingRecordStore';
import { useProviderStore } from '@/stores/providerStore';
import { usePeriodStore } from '@/stores/periodStore';

// Icons
import { PhPen, PhTrash, PhArrowsClockwise, PhFileText, PhPlus } from '@phosphor-icons/vue';

// Utils
import { formatMoney } from '@/utils/helpers';

const accountingStore = useAccountingStore();
const recordStore = useAccountingRecordStore();
const providerStore = useProviderStore();
const settingsStore = useBakerySettingsStore();
const supportDocStore = useSupportDocStore();
const periodStore = usePeriodStore();

// The selector below locks the shared period to months; leaving puts back what the
// other screens had, so Pedidos does not open on a whole month.
const previousPeriod = {
  type: periodStore.periodType,
  start: periodStore.customStartDate,
  end: periodStore.customEndDate,
};

// The same screen lives under both dashboards; the link stays in the one it is in.
const route = useRoute();
const pygRoute = computed(() => (route.name === 'accounting-resumen' ? 'accounting-pyg' : 'admin-accounting-pyg'));
const receivedRoute = computed(() => (route.name === 'accounting-resumen' ? 'accounting-received' : 'admin-accounting-received'));

const providerOf = (record) => providerStore.items.find((provider) => provider.id === record.providerId);
const supportDocOf = (record) => supportDocStore.bySourceId(record.id);

const TYPE_LABELS = { expense: 'Gasto', investment: 'Inversión', revenue: 'Ingreso' };
const kindOf = (record) => {
  if (record.type === 'revenue') return 'revenue';
  return record.isInvestment ? 'investment' : 'expense';
};

// Documento soporte: only with e-invoicing on, for a gasto whose supplier does not
// invoice. A gasto from the Buzón already has an e-invoice, so it never needs one.
// An annulled one stays annulled: the backend issues one document per record.
const supportDocStatus = (record) => {
  const doc = supportDocOf(record);
  if (doc) return isAnnulled(doc) ? 'annulled' : 'issued';
  if (!settingsStore.isEinvoicingEnabled || record.type !== 'expense' || record.receivedInvoiceId) return '';
  if (!record.providerId) return 'noProvider';
  return providerOf(record)?.issuesEinvoice === true ? '' : 'pending';
};

const supportDocLabel = (record, status) => {
  const doc = supportDocOf(record);
  return {
    issued: doc?.number,
    annulled: `${doc?.number} · Anulado`,
    pending: 'Pendiente',
    noProvider: 'Sin proveedor',
  }[status] ?? '';
};

// Flat fields so the table can search, sort and filter on them.
const tableData = computed(() => accountingStore.records.map((record) => {
  const kind = kindOf(record);
  const supportDoc = supportDocStatus(record);
  return {
    ...record,
    kind,
    kindLabel: TYPE_LABELS[kind],
    detail: [
      record.description,
      record.counterparty,
      providerOf(record)?.name,
      record.invoiceRef && `Factura ${record.invoiceRef}`,
    ].filter(Boolean).join(' · '),
    supportDoc,
    supportDocLabel: supportDocLabel(record, supportDoc),
  };
}));

const pendingSupportDocs = computed(() => tableData.value.filter((record) => record.supportDoc === 'pending').length);

// Selection
const dataTable = ref(null);
const selectedIds = ref([]);
const selectedItems = computed(() => tableData.value.filter((record) => selectedIds.value.includes(record.id)));

const handleSelectionChange = (ids) => {
  selectedIds.value = ids;
};

const clearSelection = () => {
  dataTable.value?.clearSelection();
};

// Compute totals
const totals = computed(() => {
  // Use selected records if any are selected, otherwise use all table data
  const records = selectedItems.value.length > 0 ? selectedItems.value : tableData.value;
  const sumOf = (kind) => records
    .filter((record) => record.kind === kind)
    .reduce((sum, record) => sum + record.amount, 0);

  return [
    { label: 'Gastos', value: sumOf('expense') },
    { label: 'Inversiones', value: sumOf('investment') },
    { label: 'Otros ingresos', value: sumOf('revenue') },
  ];
});

// Dialog state
// `formKey` remounts the form, so a repeat never inherits the last one's typing.
const isFormOpen = ref(false);
const formKey = ref(0);
const prefill = ref(null);
const editing = ref(null);
const newType = ref('expense');
const supportDocRecord = ref(null);
const recordToDelete = ref(null);
const deleteError = ref('');
const actionError = ref('');

// `repeat` starts a new record from a stored one; otherwise the record is edited.
// `type` only matters for a blank form: a stored record brings its own.
function openForm(record = null, { repeat = false, type = 'expense' } = {}) {
  newType.value = type;
  prefill.value = repeat ? record : null;
  editing.value = repeat ? null : record;
  formKey.value++;
  isFormOpen.value = true;
}

const supportDocRefusals = {
  issued: (doc) => `Este gasto ya tiene el documento soporte ${doc.number}.`,
  annulled: (doc) => `El documento soporte ${doc.number} de este gasto fue anulado.`,
  noProvider: () => 'Asigna un proveedor al gasto para emitir el documento soporte.',
  '': () => 'Este registro no requiere documento soporte.',
};

const handleAction = ({ actionId, selectedIds: ids }) => {
  const record = tableData.value.find((item) => item.id === ids[0]);
  const stored = accountingStore.records.find((item) => item.id === ids[0]);
  actionError.value = '';

  switch (actionId) {
  case 'edit':
    openForm(stored);
    break;
  case 'repeat':
    openForm(stored, { repeat: true });
    break;
  case 'delete':
    deleteError.value = '';
    recordToDelete.value = record;
    break;
  case 'support-doc':
    if (record.supportDoc !== 'pending') {
      actionError.value = supportDocRefusals[record.supportDoc](supportDocOf(record));
      return;
    }
    supportDocRecord.value = record;
    break;
  }
};

const columns = computed(() => [
  {
    id: 'date',
    label: 'Fecha',
    field: 'date',
    sortable: true,
    component: DateCell,
    getProps: (row) => ({
      value: row.date,
    }),
  },
  {
    id: 'categoryName',
    label: 'Categoría',
    field: 'categoryName',
    sortable: true,
    component: ValueWithDescription,
    getProps: (row) => ({
      value: row.categoryName,
      description: row.detail || null,
    }),
  },
  {
    id: 'kind',
    label: 'Tipo',
    field: 'kindLabel',
    sortable: true,
  },
  {
    id: 'amount',
    label: 'Monto',
    field: 'amount',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.amount,
    }),
  },
  ...(settingsStore.isEinvoicingEnabled ? [{
    id: 'supportDoc',
    label: 'Doc. soporte',
    field: 'supportDocLabel',
    sortable: true,
  }] : []),
]);

const tableFilters = computed(() => [
  {
    field: 'kind',
    options: [
      { label: 'gasto', value: 'expense' },
      { label: 'inversión', value: 'investment' },
      { label: 'ingreso', value: 'revenue' },
    ],
  },
  {
    field: 'paymentMethod',
    options: [
      { label: 'efectivo', value: 'cash' },
      { label: 'transferencia', value: 'transfer' },
    ],
  },
  ...(settingsStore.isEinvoicingEnabled ? [{
    field: 'supportDoc',
    options: [
      { label: 'doc. soporte pendiente', value: 'pending' },
      { label: 'doc. soporte emitido', value: 'issued' },
      { label: 'doc. soporte anulado', value: 'annulled' },
      { label: 'sin proveedor', value: 'noProvider' },
    ],
  }] : []),
]);

const tableActions = computed(() => [
  {
    id: 'edit',
    label: 'Editar',
    icon: PhPen,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
  {
    id: 'repeat',
    label: 'Repetir',
    icon: PhArrowsClockwise,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
  {
    id: 'delete',
    label: 'Eliminar',
    icon: PhTrash,
    minSelected: 1,
    maxSelected: 1,
    variant: 'danger',
  },
  ...(settingsStore.isEinvoicingEnabled ? [{
    id: 'support-doc',
    label: 'Doc. soporte',
    icon: PhFileText,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  }] : []),
]);

const closeDialog = () => {
  isFormOpen.value = false;
  supportDocRecord.value = null;
  recordToDelete.value = null;
  clearSelection();
};

async function onSaved() {
  closeDialog();
  await accountingStore.loadMonth();
}

const handleConfirmDelete = async () => {
  try {
    await recordStore.remove(recordToDelete.value.id);
    closeDialog();
    await accountingStore.loadMonth();
  } catch (err) {
    deleteError.value = err?.message || 'No se pudo eliminar el registro';
  }
};

// Watch for period changes and reload the month
watch(() => accountingStore.period, () => {
  clearSelection();
  accountingStore.loadMonth();
});

onMounted(async () => {
  accountingStore.loadMonth();
  if (!providerStore.items.length) providerStore.fetchAll();
  if (!settingsStore.items.length) await settingsStore.fetchById('default');
  if (settingsStore.isEinvoicingEnabled) supportDocStore.ensureLoaded();
});

onUnmounted(() => {
  if (previousPeriod.type === 'custom') periodStore.setCustomRange(previousPeriod.start, previousPeriod.end);
  else periodStore.setPeriodType(previousPeriod.type);
});
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Resumen</h2>
      <div class="flex flex-col gap-2 items-center lg:items-stretch">
        <PeriodSelector :only-for="['month']" :range="false" />
        <TotalsSummary
          class="relative lg:fixed lg:bottom-5 lg:left-[216px] z-[9]"
          :categories="totals"
          :format-value="formatMoney"
        />
      </div>
    </div>

    <!-- Month Bar -->
    <div class="flex flex-col lg:flex-row justify-between items-center gap-2 mb-4">
      <div class="flex flex-wrap items-center justify-center gap-2">
        <RouterLink :to="{ name: pygRoute }" class="ui-btn">
          Ver P&G
        </RouterLink>
        <RouterLink
          v-if="accountingStore.pendingReceivedInvoices"
          :to="{ name: receivedRoute }"
          class="ui-btn"
        >
          {{ accountingStore.pendingReceivedInvoices }}
          {{ accountingStore.pendingReceivedInvoices === 1 ? 'factura por registrar' : 'facturas por registrar' }}
        </RouterLink>
        <button
          v-if="pendingSupportDocs"
          type="button"
          class="ui-btn"
          @click="dataTable?.toggleFilter('supportDoc', 'pending')"
        >
          {{ pendingSupportDocs }}
          {{ pendingSupportDocs === 1 ? 'documento soporte pendiente' : 'documentos soporte pendientes' }}
        </button>
      </div>
      <div class="flex gap-2">
        <button type="button" class="ui-btn" @click="openForm(null, { type: 'revenue' })">
          <PhPlus :size="14" weight="bold" /> Nuevo ingreso
        </button>
        <button type="button" class="ui-btn ui-btn-solid" @click="openForm()">
          <PhPlus :size="14" weight="bold" /> Nuevo gasto
        </button>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="actionError || accountingStore.error || supportDocStore.error" class="text-danger text-center py-4">
      {{ actionError || accountingStore.error || supportDocStore.error }}
    </div>

    <PendingTemplates v-if="accountingStore.pendingTemplates.length" :templates="accountingStore.pendingTemplates" />

    <!-- Record Form Dialog -->
    <Dialog :open="isFormOpen" @close="closeDialog" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 32rem">
          <RecordForm
            :key="formKey"
            :period="accountingStore.period"
            :prefill="prefill"
            :record="editing"
            :type="newType"
            @saved="onSaved"
            @cancel="closeDialog"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Support Doc Dialog -->
    <Dialog :open="!!supportDocRecord" @close="closeDialog" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 36rem">
          <SupportDocForm
            v-if="supportDocRecord"
            :key="supportDocRecord.id"
            :record="supportDocRecord"
            :provider="providerOf(supportDocRecord)"
            @cancel="closeDialog"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog
      :is-open="!!recordToDelete"
      title="Eliminar Registro"
      :message="deleteError || `¿Estás seguro de querer eliminar ${recordToDelete?.categoryName ?? ''} por ${formatMoney(recordToDelete?.amount ?? 0)}?`"
      confirm-text="Eliminar"
      cancel-text="Cancelar"
      :loading="recordStore.loading"
      @confirm="handleConfirmDelete"
      @cancel="recordToDelete = null"
    />

    <!-- Table -->
    <DataTable
      ref="dataTable"
      :data="tableData"
      :columns="columns"
      :actions="tableActions"
      :filters="tableFilters"
      :searchable-columns="['categoryName', 'detail', 'invoiceRef']"
      :data-loading="accountingStore.loading"
      @selection-change="handleSelectionChange"
      @action="handleAction"
      class="bg-white shadow-lg rounded-lg"
    />
  </div>
</template>

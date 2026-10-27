<script setup>
/* Cuentas por pagar: booked supplier invoices nobody has paid yet.
 * The mirror of Por cobrar. Paying one takes it off the list. */
import { ref, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';
import DateCell from '@/components/DataTable/renderers/DateCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import ValueWithDescription from '@/components/DataTable/renderers/ValueWithDescription.vue';
import TotalsSummary from '@/components/common/TotalsSummary.vue';
import ToastNotification from '@/components/ToastNotification.vue';
import SupplierPaymentFields from '@/components/accounting/SupplierPaymentFields.vue';
import { useReceivedInvoiceStore } from '@/stores/receivedInvoiceStore';
import { PhMoney } from '@phosphor-icons/vue';
import { formatMoney } from '@/utils/helpers';
import { getTodayString, formatDateDisplay } from '@/utils/dateUtils';

const invoiceStore = useReceivedInvoiceStore();

const paying = ref(null);
const payment = ref(null);
const busy = ref(false);
const error = ref('');
const toastRef = ref(null);

const isOverdue = (invoice) => !!invoice.dueDate && new Date(invoice.dueDate) < new Date(getTodayString());

// Flat fields so the table can search, sort and filter on them.
// ponytail: loads every invoice and filters here; a server filter on status/isPaid needs a Firestore index first.
const processData = (invoices) => invoices
  .filter((invoice) => invoice.status === 'confirmed' && invoice.kind === 'invoice' && !invoice.isPaid)
  .map((invoice) => ({
    ...invoice,
    supplierName: invoice.supplier.name,
    supplierNationalId: invoice.supplier.nationalId,
    total: invoice.totals.total,
    overdue: isOverdue(invoice) ? 'Vencida' : '',
  }));

const {
  dataTable,
  actionLoading,
  selectedItems,
  isLoading,
  tableData,
  handleSelectionChange,
  handleAction,
  clearSelection,
} = useDataTable(invoiceStore, {
  processData,
  async onAction({ actionId, selectedItems }) {
    switch (actionId) {
    case 'pay':
      paying.value = selectedItems[0];
      payment.value = { paymentDate: getTodayString(), paymentMethod: 'transfer' };
      error.value = '';
      break;
    }
  },
});

const columns = [
  {
    id: 'issueDate',
    label: 'Fecha',
    field: 'issueDate',
    sortable: true,
    component: DateCell,
    getProps: (row) => ({
      value: row.issueDate,
    }),
  },
  {
    id: 'supplierName',
    label: 'Proveedor',
    field: 'supplierName',
    sortable: true,
    component: ValueWithDescription,
    getProps: (row) => ({
      value: row.supplierName,
      description: row.supplierNationalId ? `${row.supplier.documentType || 'NIT'} ${row.supplierNationalId}` : null,
    }),
  },
  {
    id: 'invoiceRef',
    label: 'Factura',
    field: 'invoiceRef',
    sortable: true,
    component: ValueWithDescription,
    getProps: (row) => ({
      value: row.invoiceRef,
      description: `Vence ${row.dueDate ? formatDateDisplay(row.dueDate, { year: 'numeric' }) : 'sin fecha'}`,
    }),
  },
  {
    id: 'total',
    label: 'Total',
    field: 'total',
    sortable: true,
    component: MoneyCell,
    getProps: (row) => ({
      value: row.total,
    }),
  },
  {
    id: 'overdue',
    label: 'Estado',
    field: 'overdue',
    sortable: true,
  },
];

const tableActions = [
  {
    id: 'pay',
    label: 'Registrar pago',
    icon: PhMoney,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
];

const tableFilters = [
  {
    field: 'overdue',
    options: [
      { label: 'vencida', value: 'Vencida' },
    ],
  },
];

// Selected invoices if any are selected, otherwise every visible one.
const totals = computed(() => {
  const invoices = selectedItems.value.length > 0 ? selectedItems.value : tableData.value;
  const sum = (list) => list.reduce((total, invoice) => total + invoice.totals.total, 0);

  return [
    { label: 'Por pagar', value: sum(invoices) },
    { label: 'Vencido', value: sum(invoices.filter(isOverdue)) },
  ];
});

const closeDialog = () => {
  paying.value = null;
  clearSelection();
};

async function pay() {
  busy.value = true;
  error.value = '';
  try {
    await invoiceStore.setPayment(paying.value.id, { isPaid: true, ...payment.value });
    toastRef.value?.showSuccess('Por pagar', `Factura ${paying.value.invoiceRef} pagada`);
    closeDialog();
    await invoiceStore.fetchAll();
  } catch (err) {
    error.value = err?.message || 'No se pudo registrar el pago';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4 lg:min-h-[52px]">
      <h2 class="text-2xl font-bold text-neutral-800">Por pagar</h2>
      <TotalsSummary
        class="relative lg:fixed lg:bottom-5 lg:left-[216px] z-[9]"
        :categories="totals"
        :format-value="formatMoney"
      />
    </div>

    <!-- Error State -->
    <div v-if="invoiceStore.error" class="text-danger text-center py-4">
      {{ invoiceStore.error }}
    </div>

    <!-- Payment Dialog -->
    <Dialog :open="!!paying" @close="closeDialog" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 32rem">
          <div v-if="paying" class="ui-card flex flex-col gap-4" data-ui-theme="light">
            <div>
              <h2 class="ui-panehead-title">Pagar factura {{ paying.invoiceRef }}</h2>
              <p class="ui-item-desc">{{ paying.supplier.name }} · {{ formatMoney(paying.totals.total) }}</p>
            </div>
            <SupplierPaymentFields v-model="payment" />
            <span v-if="error" class="ui-field-error" role="alert">{{ error }}</span>
            <div class="flex flex-wrap gap-2 justify-end">
              <button type="button" class="ui-btn ui-btn-danger" :disabled="busy" @click="closeDialog">Cancelar</button>
              <button
                type="button"
                class="ui-btn ui-btn-solid"
                :disabled="busy || !payment.paymentDate || !payment.paymentMethod"
                @click="pay"
              >
                {{ busy ? 'Procesando…' : 'Pagar' }}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :data="tableData"
        :columns="columns"
        :actions="tableActions"
        :filters="tableFilters"
        :searchable-columns="['supplierName', 'supplierNationalId', 'invoiceRef']"
        :action-loading="actionLoading"
        :data-loading="invoiceStore.loading || isLoading"
        @selection-change="handleSelectionChange"
        @action="handleAction"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>

    <ToastNotification ref="toastRef" />
  </div>
</template>

<style scoped lang="scss">
* {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

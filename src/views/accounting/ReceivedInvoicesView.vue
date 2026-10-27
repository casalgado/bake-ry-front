<script setup>
/* The inbox: supplier invoices that arrived by email and are not booked yet.
 * Each opens to decide where its lines go. */
import { ref, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';
import DateCell from '@/components/DataTable/renderers/DateCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import ValueWithDescription from '@/components/DataTable/renderers/ValueWithDescription.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ToastNotification from '@/components/ToastNotification.vue';
import ReceivedInvoiceReview from '@/components/accounting/ReceivedInvoiceReview.vue';
import { useReceivedInvoiceStore } from '@/stores/receivedInvoiceStore';
import { PhMagnifyingGlass, PhProhibit } from '@phosphor-icons/vue';
import { formatDateDisplay } from '@/utils/dateUtils';

const invoiceStore = useReceivedInvoiceStore();

const reviewing = ref(null);
const invoiceToIgnore = ref(null);
const ignoreError = ref('');
const ignoring = ref(false);
const toastRef = ref(null);

// Flat fields so the table can search, sort and filter on them.
const processData = (invoices) => invoices
  .filter((invoice) => invoice.status === 'pending')
  .map((invoice) => ({
    ...invoice,
    supplierName: invoice.supplier.name,
    supplierNationalId: invoice.supplier.nationalId,
    total: invoice.totals.total,
    hasProvider: invoice.providerId ? 'yes' : 'no',
    flags: [
      invoice.kind === 'credit_note' && 'Nota crédito',
      !invoice.providerId && 'Proveedor nuevo',
      invoice.buyerMismatch && 'NIT distinto',
    ].filter(Boolean).join(' · '),
  }));

const {
  dataTable,
  actionLoading,
  isLoading,
  tableData,
  handleSelectionChange,
  handleAction,
  clearSelection,
} = useDataTable(invoiceStore, {
  processData,
  async onAction({ actionId, selectedItems }) {
    const selectedInvoice = selectedItems[0];

    switch (actionId) {
    case 'review':
      reviewing.value = selectedInvoice;
      break;
    case 'ignore':
      ignoreError.value = '';
      invoiceToIgnore.value = selectedInvoice;
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
      description: `${row.lines.length} línea(s)`,
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
    id: 'flags',
    label: 'Estado',
    field: 'flags',
    sortable: true,
  },
];

const tableActions = [
  {
    id: 'review',
    label: 'Revisar',
    icon: PhMagnifyingGlass,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
  {
    id: 'ignore',
    label: 'Omitir',
    icon: PhProhibit,
    minSelected: 1,
    maxSelected: 1,
    variant: 'danger',
  },
];

const tableFilters = [
  {
    field: 'hasProvider',
    options: [
      { label: 'proveedor nuevo', value: 'no' },
      { label: 'con proveedor', value: 'yes' },
    ],
  },
  {
    field: 'kind',
    options: [
      { label: 'factura', value: 'invoice' },
      { label: 'nota crédito', value: 'credit_note' },
    ],
  },
];

const unreadable = computed(() => invoiceStore.items.filter((invoice) => invoice.status === 'unreadable'));

const closeDialog = () => {
  reviewing.value = null;
  invoiceToIgnore.value = null;
  clearSelection();
};

async function onDone(message) {
  closeDialog();
  toastRef.value?.showSuccess('Buzón', message);
  await invoiceStore.fetchAll();
}

// The review stays open: creating the provider is a step toward confirming.
async function onProviderCreated() {
  toastRef.value?.showSuccess('Proveedor creado', reviewing.value?.supplier.name);
  await invoiceStore.fetchAll();
  reviewing.value = invoiceStore.items.find((invoice) => invoice.id === reviewing.value?.id) ?? null;
}

const handleConfirmIgnore = async () => {
  ignoring.value = true;
  try {
    await invoiceStore.ignore(invoiceToIgnore.value.id);
    await onDone('Factura omitida');
  } catch (err) {
    ignoreError.value = err?.message || 'No se pudo omitir la factura';
  } finally {
    ignoring.value = false;
  }
};

const dismissError = ref('');

async function dismiss(invoice) {
  dismissError.value = '';
  try {
    await invoiceStore.ignore(invoice.id);
    toastRef.value?.showSuccess('Buzón', 'Mensaje omitido');
    await invoiceStore.fetchAll();
  } catch (err) {
    dismissError.value = err?.message || 'No se pudo omitir el mensaje';
  }
}
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4 lg:min-h-[52px]">
      <h2 class="text-2xl font-bold text-neutral-800">Buzón</h2>
    </div>

    <!-- Error State -->
    <div v-if="invoiceStore.error" class="text-danger text-center py-4">
      {{ invoiceStore.error }}
    </div>

    <!-- Review Dialog -->
    <Dialog :open="!!reviewing" @close="closeDialog" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 40rem">
          <ReceivedInvoiceReview
            v-if="reviewing"
            :key="reviewing.id"
            :invoice="reviewing"
            @done="onDone"
            @cancel="closeDialog"
            @provider-created="onProviderCreated"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Confirm Ignore Dialog -->
    <ConfirmDialog
      :is-open="!!invoiceToIgnore"
      title="Omitir Factura"
      :message="ignoreError || `¿Estás seguro de querer omitir la factura ${invoiceToIgnore?.invoiceRef ?? ''}? No se registrará.`"
      confirm-text="Omitir"
      cancel-text="Cancelar"
      :loading="ignoring"
      @confirm="handleConfirmIgnore"
      @cancel="invoiceToIgnore = null"
    />

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

    <!-- Unreadable Emails -->
    <div v-if="unreadable.length" class="mt-6 bg-white shadow-lg rounded-lg p-4">
      <h3 class="text-lg font-bold text-neutral-800 mb-2">Correos no procesados</h3>
      <div v-if="dismissError" class="text-danger py-2">{{ dismissError }}</div>
      <div
        v-for="invoice in unreadable"
        :key="invoice.id"
        class="flex items-center gap-4 py-2 border-b border-neutral-200 last:border-0"
      >
        <span class="w-24 shrink-0 text-sm text-neutral-500">{{ formatDateDisplay(invoice.createdAt, { year: 'numeric' }) }}</span>
        <div class="min-w-0 flex-1">
          <div class="font-medium text-neutral-800">{{ invoice.email?.subject || 'Correo sin asunto' }}</div>
          <div class="text-xs text-neutral-500">{{ [invoice.email?.from, invoice.reason].filter(Boolean).join(' · ') }}</div>
        </div>
        <button class="utility-btn" @click="dismiss(invoice)">Omitir</button>
      </div>
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

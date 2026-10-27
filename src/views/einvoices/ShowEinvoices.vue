<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from '@/components/DataTable/index.vue';
import DateCell from '@/components/DataTable/renderers/DateCell.vue';
import MoneyCell from '@/components/DataTable/renderers/MoneyCell.vue';
import PeriodSelector from '@/components/common/PeriodSelector.vue';
import ToastNotification from '@/components/ToastNotification.vue';
import { EinvoiceService } from '@/services/einvoiceService';
import { useAuthenticationStore } from '@/stores/authentication';
import { usePeriodStore } from '@/stores/periodStore';
import { PhArrowSquareOut, PhCopy } from '@phosphor-icons/vue';

// The register of issued invoices and credit notes, for the period.
const router = useRouter();
const authStore = useAuthenticationStore();
const periodStore = usePeriodStore();
const service = new EinvoiceService(authStore.getBakeryId);

const STATUS_LABELS = {
  draft: 'En preparación', signed: 'Sin enviar', sent: 'Verificando', accepted: 'Aceptada', rejected: 'Rechazada',
};

const docs = ref([]);
const error = ref('');
const isLoading = ref(false);

const dataTable = ref(null);

const load = async () => {
  error.value = '';
  isLoading.value = true;
  try {
    docs.value = await service.list({
      startDate: periodStore.periodRange.start.toISOString(),
      endDate: periodStore.periodRange.end.toISOString(),
    });
    dataTable.value?.clearSelection();
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
};

// Flat fields so the table can search, sort and filter on them.
const tableData = computed(() => docs.value.map((doc) => ({
  ...doc,
  displayNumber: `${doc.kind === 'creditNote' ? 'NC ' : ''}${doc.number}`,
  clientName: doc.client?.name ?? '',
  total: doc.totals?.payable,
  statusLabel: `${STATUS_LABELS[doc.status] ?? doc.status}${doc.creditNote?.status === 'accepted' ? ' · anulada' : ''}`,
})));

const columns = [
  {
    id: 'displayNumber',
    label: 'Número',
    field: 'displayNumber',
    sortable: true,
  },
  {
    id: 'clientName',
    label: 'Cliente',
    field: 'clientName',
    sortable: true,
  },
  {
    id: 'issuedAt',
    label: 'Fecha',
    field: 'issuedAt',
    sortable: true,
    component: DateCell,
    getProps: (row) => ({
      value: row.issuedAt,
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
    id: 'statusLabel',
    label: 'Estado',
    field: 'statusLabel',
    sortable: true,
  },
];

const tableActions = [
  {
    id: 'open',
    label: 'Abrir',
    icon: PhArrowSquareOut,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
  {
    id: 'copy-cufe',
    label: 'Copiar CUFE',
    icon: PhCopy,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
];

const tableFilters = [
  {
    field: 'status',
    options: Object.entries(STATUS_LABELS).map(([value, label]) => ({
      label: label.toLowerCase(),
      value,
    })),
  },
  {
    field: 'kind',
    options: [
      { label: 'factura', value: 'invoice' },
      { label: 'nota crédito', value: 'creditNote' },
    ],
  },
];

const toastRef = ref(null);

async function copyCufe(cufe) {
  if (!cufe) {
    toastRef.value?.showError('Facturas', 'Este documento no tiene CUFE');
    return;
  }
  try {
    await navigator.clipboard.writeText(cufe);
    toastRef.value?.showSuccess('Facturas', 'CUFE copiado');
  } catch {
    toastRef.value?.showError('Facturas', 'No se pudo copiar el CUFE');
  }
}

// No store behind this register, so the selected docs are looked up here.
const handleAction = ({ actionId, selectedIds: ids }) => {
  const doc = docs.value.find((d) => d.id === ids[0]);
  if (!doc) return;

  switch (actionId) {
  case 'open':
    router.push({ name: 'einvoice', params: { orderId: doc.orderId } });
    break;
  case 'copy-cufe':
    copyCufe(doc.cufe);
    break;
  }
};

watch(() => periodStore.periodRange, load, { deep: true, immediate: true });
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Facturas</h2>
      <PeriodSelector />
    </div>

    <!-- Error State -->
    <div v-if="error" class="text-danger text-center py-4">
      {{ error }}
    </div>

    <!-- Table -->
    <DataTable
      ref="dataTable"
      :data="tableData"
      :columns="columns"
      :actions="tableActions"
      :filters="tableFilters"
      :searchable-columns="['displayNumber', 'clientName']"
      :data-loading="isLoading"
      @action="handleAction"
      class="bg-white shadow-lg rounded-lg"
    />

    <ToastNotification ref="toastRef" />
  </div>
</template>

<script setup>
/* The business's providers: who it buys from. Shared by inventory (Compra de
 * insumos), accounting (gastos) and e-invoicing (documento soporte). */
import { ref, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';
import ValueWithDescription from '@/components/DataTable/renderers/ValueWithDescription.vue';
import EmailCell from '@/components/DataTable/renderers/EmailCell.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ProviderForm from '@/components/providers/ProviderForm.vue';
import { useProviderStore } from '@/stores/providerStore';
import { PhPen, PhTrash, PhClockCounterClockwise } from '@phosphor-icons/vue';
import { formatMoney } from '@/utils/helpers';
import { formatDateDisplay } from '@/utils/dateUtils';

const providerStore = useProviderStore();

const isFormOpen = ref(false);
const editing = ref(null);
const providerToDelete = ref(null);
const deleteError = ref('');

// A flat field so the table can search and sort on the document.
const processData = (providers) => providers
  .filter((provider) => !provider.isDeleted)
  .map((provider) => ({
    ...provider,
    document: provider.nationalId ? `${provider.documentType || 'NIT'} ${provider.nationalId}` : '',
  }));

const {
  dataTable,
  actionLoading,
  isLoading,
  tableData,
  handleSelectionChange,
  handleAction,
  clearSelection,
} = useDataTable(providerStore, {
  processData,
  fetchAll: {
    sort: { field: 'name', direction: 'asc' },
  },
  async onAction({ actionId, selectedItems }) {
    const selectedProvider = selectedItems[0];

    switch (actionId) {
    case 'edit':
      editing.value = selectedProvider;
      isFormOpen.value = true;
      break;
    case 'delete':
      deleteError.value = '';
      providerToDelete.value = selectedProvider;
      break;
    case 'history':
      openHistory(selectedProvider);
      break;
    }
  },
});

const columns = [
  {
    id: 'name',
    label: 'Nombre',
    field: 'name',
    sortable: true,
    component: ValueWithDescription,
    getProps: (row) => ({
      value: row.name,
      description: row.document || null,
    }),
  },
  {
    id: 'email',
    label: 'Mail',
    field: 'email',
    sortable: true,
    component: EmailCell,
    getProps: (row) => ({
      email: row.email,
    }),
  },
  {
    id: 'phone',
    label: 'Tel',
    field: 'phone',
    sortable: true,
  },
];

const tableActions = [
  {
    id: 'edit',
    label: 'Editar',
    icon: PhPen,
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
  {
    id: 'history',
    label: 'Historial',
    icon: PhClockCounterClockwise,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
];

// What was bought from one provider, read when its dialog opens.
const historyOf = ref(null);
const history = ref([]);
const historyLoading = ref(false);
const historyError = ref('');

const owed = computed(() => history.value
  .filter((entry) => entry.isPaid === false)
  .reduce((sum, entry) => sum + entry.total, 0));

async function openHistory(provider) {
  historyOf.value = provider;
  history.value = [];
  historyError.value = '';
  historyLoading.value = true;
  try {
    history.value = await providerStore.getHistory(provider.id);
  } catch (err) {
    historyError.value = err?.message || 'No se pudo cargar el historial';
  } finally {
    historyLoading.value = false;
  }
}

const navigateToCreate = () => {
  editing.value = null;
  clearSelection();
  isFormOpen.value = true;
};

const closeDialog = () => {
  isFormOpen.value = false;
  editing.value = null;
  historyOf.value = null;
  providerToDelete.value = null;
  clearSelection();
};

const handleConfirmDelete = async () => {
  try {
    await providerStore.remove(providerToDelete.value.id);
    closeDialog();
  } catch (err) {
    deleteError.value = err?.message || 'No se pudo eliminar el proveedor';
  }
};
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4 lg:min-h-[52px]">
      <h2 class="text-2xl font-bold text-neutral-800">Proveedores</h2>
      <button class="action-btn" @click="navigateToCreate">
        Crear Proveedor
      </button>
    </div>

    <!-- Error State -->
    <div v-if="providerStore.error" class="text-danger text-center py-4">
      {{ providerStore.error }}
    </div>

    <!-- Form Dialog -->
    <Dialog :open="isFormOpen" @close="closeDialog" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto" style="--ui-form-w: 32rem">
          <ProviderForm
            v-if="isFormOpen"
            :key="editing?.id ?? 'new'"
            :provider="editing"
            @saved="closeDialog"
            @cancel="closeDialog"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- History Dialog -->
    <Dialog :open="!!historyOf" @close="closeDialog" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <h2 class="text-2xl font-bold text-neutral-800">
            {{ historyOf?.name }}
          </h2>
          <p class="text-sm text-neutral-500 mb-4">
            {{ owed ? `Por pagar: ${formatMoney(owed)}` : 'Historial de Compras' }}
          </p>

          <div v-if="historyError" class="text-danger text-center py-4">{{ historyError }}</div>
          <div v-else-if="historyLoading" class="text-neutral-500 text-center py-4">Cargando...</div>
          <div v-else-if="!history.length" class="text-neutral-500 text-center py-4">Sin compras registradas.</div>
          <table v-else class="w-full text-sm">
            <tbody>
              <tr
                v-for="entry in history"
                :key="`${entry.kind}-${entry.id}`"
                class="border-b border-neutral-200 last:border-0"
              >
                <td class="py-2 pr-4 whitespace-nowrap text-neutral-500">{{ formatDateDisplay(entry.date, { year: 'numeric' }) }}</td>
                <td class="py-2 pr-4">
                  <div class="font-medium text-neutral-800">{{ entry.ref ? `Factura ${entry.ref}` : 'Sin factura' }}</div>
                  <div class="text-xs text-neutral-500">{{ entry.description }}</div>
                </td>
                <td class="py-2 pr-4 whitespace-nowrap text-danger">{{ entry.isPaid === false ? 'Por pagar' : '' }}</td>
                <td class="py-2 text-right whitespace-nowrap">{{ formatMoney(entry.total) }}</td>
              </tr>
            </tbody>
          </table>
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog
      :is-open="!!providerToDelete"
      title="Eliminar Proveedor"
      :message="deleteError || `¿Estás seguro de querer eliminar a ${providerToDelete?.name ?? ''}? Las compras ya registradas se conservan.`"
      confirm-text="Eliminar"
      cancel-text="Cancelar"
      :loading="providerStore.loading"
      @confirm="handleConfirmDelete"
      @cancel="providerToDelete = null"
    />

    <!-- Table -->
    <DataTable
      ref="dataTable"
      :data="tableData"
      :columns="columns"
      :actions="tableActions"
      :searchable-columns="['name', 'document', 'email', 'phone']"
      :action-loading="actionLoading"
      :data-loading="providerStore.loading || isLoading"
      @selection-change="handleSelectionChange"
      @action="handleAction"
      class="bg-white shadow-lg rounded-lg"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useRouter } from 'vue-router';
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';
import BakeryUserForm from '@/components/forms/BakeryUserForm.vue';
import ShowUserHistory from '@/components/bakeryUsers/ShowUserHistory.vue';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import { PhPen, PhTrash, PhClockCounterClockwise } from '@phosphor-icons/vue';
import UserCell from '@/components/DataTable/renderers/UserCell.vue';
import EmailCell from '@/components/DataTable/renderers/EmailCell.vue';

const router = useRouter();
const bakeryUserStore = useBakeryUserStore();
const isFormOpen = ref(false);
const isHistoryOpen = ref(false);
const userHistory = ref([]);

const {
  dataTable,
  actionLoading,
  selectedItems,
  isLoading,
  tableData,
  handleSelectionChange,
  handleAction,
  clearSelection,
} = useDataTable(bakeryUserStore, {
  processData: (items) => items.filter((user) => user.category !== 'PER'),
  fetchAll: {
    sort: { field: 'name', direction: 'asc' },
  },
  onAction: async ({ actionId, selectedItems }) => {
    const selectedClient = selectedItems[0];

    switch (actionId) {
    case 'edit':
      isFormOpen.value = true;
      console.log(selectedClient);
      break;

    case 'delete': {
      const confirmDelete = window.confirm(
        `¿Estás seguro de que deseas eliminar al cliente "${selectedClient.name}"?`,
      );
      if (confirmDelete) {
        try {
          await bakeryUserStore.remove(selectedClient.id);
          clearSelection();
        } catch (error) {
          console.error('Error al eliminar cliente:', error);
        }
      }
      break;
    }

    case 'history':
      userHistory.value = await bakeryUserStore.getHistory(selectedClient.id);
      isHistoryOpen.value = true;
      break;
    }
  },
});

// Table configuration
const columns = [
  {
    id: 'name',
    label: 'Nombre',
    field: 'name',
    sortable: true,
    component: UserCell,
    getProps: (row) => ({
      category: row.category,
      legalName: row.legalName,
      name: row.name,
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
    id: 'address',
    label: 'Dir',
    field: 'address',
    sortable: true,
  },
  {
    id: 'birthday',
    label: 'Cump',
    field: 'birthday',
    sortable: true,
  },
  {
    id: 'category',
    label: 'Category',
    field: 'category',
    sortable: true,
  },
  {
    id: 'phone',
    label: 'Tel',
    field: 'phone',
    sortable: true,
  },
  {
    id: 'nationalId',
    label: 'Cédula',
    field: 'nationalId',
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

const tableFilters = [
  {
    field: 'category',
    options: [
      { label: 'B2C', value: 'b2c' },
      { label: 'B2B', value: 'b2b' },
    ],
  },
];

// Form handlers
const handleSubmit = async (formData) => {
  try {
    if (selectedItems.value[0]) {
      await bakeryUserStore.update(selectedItems.value[0].id, formData);
    }
    closeForm();
  } catch (error) {
    console.error('Failed to update client:', error);
  }
};

const closeForm = () => {
  isFormOpen.value = false;
  isHistoryOpen.value = false;
  clearSelection();
};

const navigateToCreate = () => {
  router.push('/dashboard/users/create-client');
};
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex justify-between items-center mb-1">
      <h2 class="text-2xl font-bold mb-0">Clientes</h2>
      <button
        label="Crear Cliente"
        class="action-btn"
        @click="navigateToCreate"
      >
        Crear Cliente
      </button>
    </div>

    <!-- Error State -->
    <div v-if="bakeryUserStore.error" class="text-danger text-center py-4">
      {{ bakeryUserStore.error }}
    </div>

    <!-- Edit Form Dialog -->
    <Dialog :open="isFormOpen" @close="closeForm" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <BakeryUserForm
            v-if="selectedItems[0]"
            :title="'Editar Usuario'"
            :key="selectedItems[0].id"
            :initial-data="selectedItems[0]"
            :loading="bakeryUserStore.loading"
            class="w-full"
            @submit="handleSubmit"
            @cancel="closeForm"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- History Dialog -->
    <Dialog :open="isHistoryOpen" @close="closeForm" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          class="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        >
          <h2 class="text-2xl font-bold text-neutral-800 mb-4">
            Historial de Pedidos
          </h2>
          <ShowUserHistory :orders="userHistory" />
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
        :action-loading="actionLoading"
        :data-loading="bakeryUserStore.loading || isLoading"
        @selection-change="handleSelectionChange"
        @action="handleAction"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.dialog-overlay {
  @apply bg-black bg-opacity-50;
}

.dialog-content {
  @apply bg-white rounded-lg shadow-xl transform transition-all;

  &:focus {
    @apply outline-none;
  }
}

* {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

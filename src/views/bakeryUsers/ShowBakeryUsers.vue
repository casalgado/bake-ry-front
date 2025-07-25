<script setup>
import { ref } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import DataTable from '@/components/DataTable/index.vue';
import { useDataTable } from '@/components/DataTable/composables/useDataTable.js';
import BakeryUserForm from '@/components/forms/BakeryUserForm.vue';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import { PhPen, PhTrash } from '@phosphor-icons/vue'; // 👈 Importar ícono de basura

const bakeryUserStore = useBakeryUserStore();
const isFormOpen = ref(false);

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
          `¿Estás seguro de que deseas eliminar al cliente "${selectedClient.name}"?`
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
  },
  {
    id: 'email',
    label: 'Mail',
    field: 'email',
    sortable: true,
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
    id: 'delete', // 👈 Nueva acción
    label: 'Eliminar',
    icon: PhTrash,
    minSelected: 1,
    maxSelected: 1,
    variant: 'danger', // Asumiendo que el DataTable lo soporta
  },
];

const tableFilters = [
  {
    field: 'category',
    options: [
      { label: 'B2C', value: 'B2C' },
      { label: 'B2B', value: 'B2B' },
      { label: 'PER', value: 'PER' },
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
  clearSelection();
};
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Clientes</h2>
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
            :title="'Editar Cliente'"
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

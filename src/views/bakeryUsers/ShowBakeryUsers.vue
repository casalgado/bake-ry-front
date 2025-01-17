<script setup>
import { ref, onMounted } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { PhPen, PhTrash } from '@phosphor-icons/vue';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import DataTable from '@/components/DataTable/index.vue';
import BakeryUserForm from '@/components/forms/BakeryUserForm.vue';

const bakeryUserStore = useBakeryUserStore();
const dataTable = ref(null);
const isFormOpen = ref(false);
const selectedClient = ref(null);
const actionLoading = ref({});

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
    id: 'national_id',
    label: 'Cédula',
    field: 'national_id',
    sortable: true,
  },
];

const tableActions = [
  {
    id: 'edit',
    label: 'Edit',
    icon: PhPen,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
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

const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedClient.value = bakeryUserStore.items.find(client => client.id === selectedIds[0]);
  } else {
    selectedClient.value = null;
  }
};

const handleAction = async ({ actionId, selectedIds }) => {
  actionLoading.value[actionId] = true;

  try {
    switch (actionId) {
    case 'edit':
      selectedClient.value = bakeryUserStore.items.find(client => client.id === selectedIds[0]);
      isFormOpen.value = true;
      break;
    case 'delete':
      if (window.confirm('Estas seguro que deseas eliminar este cliente?')) {
        selectedClient.value = bakeryUserStore.items.find(client => client.id === selectedIds[0]);
        await bakeryUserStore.remove(selectedClient.value.id);
        dataTable.value?.clearSelection();
      }
      break;
    }
  } catch (error) {
    console.error('Action failed:', error);
  } finally {
    actionLoading.value[actionId] = false;
  }
};

const handleSubmit = async (formData) => {
  try {
    if (selectedClient.value) {
      await bakeryUserStore.update(selectedClient.value.id, formData);
    }
    closeForm();
  } catch (error) {
    console.error('Failed to update client:', error);
  }
};

const closeForm = () => {
  isFormOpen.value = false;
  selectedClient.value = null;
};

onMounted(async () => {
  try {
    await bakeryUserStore.fetchAll({ sort: { field: 'name', direction: 'asc' } });
  } catch (error) {
    console.error('Failed to fetch clients:', error);
  }
});
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row  justify-between items-center mb-4">
      <h2 class="text-2xl font-bold text-neutral-800">Clientes</h2>
    </div>

    <!-- Error State -->
    <div
      v-if="bakeryUserStore.error"
      class="text-danger text-center py-4"
    >
      {{ bakeryUserStore.error }}
    </div>

    <!-- Edit Form Dialog -->
    <Dialog
      :open="isFormOpen"
      @close="closeForm"
      class="relative z-50"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <!-- Full-screen container for centering -->
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <BakeryUserForm
            v-if="selectedClient"
            :title="'Edit Client'"
            :key="selectedClient.id"
            :initial-data="selectedClient"
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
        :data="bakeryUserStore.items.filter(user => user.category !== 'PER')"
        :columns="columns"
        :actions="tableActions"
        :filters="tableFilters"
        :action-loading="actionLoading"
        :data-loading="bakeryUserStore.loading"
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

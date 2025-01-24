<script setup>
// Vue and Headless UI
import { ref, onMounted } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';

// DataTable Core
import DataTable from '@/components/DataTable/index.vue';

// Components
import BakeryUserForm from '@/components/forms/BakeryUserForm.vue';

// Stores
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';

// Icons
import { PhPen, PhTrash } from '@phosphor-icons/vue';

// Store initialization
const settingsStore = useBakerySettingsStore();
const bakeryUserStore = useBakeryUserStore();

// State management
const clientsData = ref([]);
const isFormOpen = ref(false);
const selectedUser = ref(null);
const dataTable = ref(null);
const actionLoading = ref({});

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
    label: 'Email',
    field: 'email',
    sortable: true,
  },
  {
    id: 'phone',
    label: 'Teléfono',
    field: 'phone',
    sortable: true,
  },
  {
    id: 'address',
    label: 'Dirección',
    field: 'address',
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
];

// Event handlers
const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedUser.value = clientsData.value.find(client => client.id === selectedIds[0]);
  } else {
    selectedUser.value = null;
  }
};

const handleAction = async ({ actionId, selectedIds }) => {
  actionLoading.value[actionId] = true;
  try {
    switch (actionId) {
    case 'edit':
      selectedUser.value = await bakeryUserStore.fetchById(selectedIds[0]);
      isFormOpen.value = true;
      break;
    case 'delete':
      if (window.confirm('¿Estás seguro de querer eliminar este cliente B2B?')) {
        await bakeryUserStore.remove(selectedIds[0]);
        await refreshData();
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
    if (selectedUser.value) {
      await bakeryUserStore.update(selectedUser.value.id, formData);
      await refreshData();
    }
    closeForm();
  } catch (error) {
    console.error('Failed to update user:', error);
  }
};

const closeForm = () => {
  isFormOpen.value = false;
  selectedUser.value = null;
};

// Data fetching
const refreshData = async () => {
  await settingsStore.fetchById('default');
  clientsData.value = await settingsStore.b2b_clients;
};

onMounted(async () => {
  await refreshData();
});
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-neutral-800">Clientes B2B</h2>
    </div>

    <!-- Error State -->
    <div v-if="settingsStore.error" class="text-danger text-center py-4">
      {{ settingsStore.error }}
    </div>

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :data="clientsData"
        :columns="columns"
        :actions="tableActions"
        :action-loading="actionLoading"
        :data-loading="settingsStore.loading"
        @selection-change="handleSelectionChange"
        @action="handleAction"
        :wrapper-class="`bg-white shadow-lg rounded-lg`"
      />
    </div>

    <!-- Edit Form Dialog -->
    <Dialog
      :open="isFormOpen"
      @close="closeForm"
      class="relative z-50"
    >
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <BakeryUserForm
            v-if="selectedUser"
            title="Edit B2B Client"
            :key="selectedUser.id"
            :initial-data="selectedUser"
            :loading="settingsStore.loading"
            class="w-full"
            @submit="handleSubmit"
            @cancel="closeForm"
          />
        </DialogPanel>
      </div>
    </Dialog>
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

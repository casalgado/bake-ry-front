<script setup>
// Vue and Headless UI
import { ref, onMounted, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';

// Firebase Auth
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

// DataTable Core
import DataTable from '@/components/DataTable/index.vue';

// Components
import BakeryUserForm from '@/components/forms/BakeryUserForm.vue';

// Stores
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';

// Icons
import { PhPen, PhKey } from '@phosphor-icons/vue';

// Store initialization
const settingsStore = useBakerySettingsStore();
const bakeryUserStore = useBakeryUserStore();

// State management
const staffData = ref([]);
const isFormOpen = ref(false);
const selectedUser = ref(null);
const dataTable = ref(null);
const actionLoading = ref({});

const sortedStaffData = computed(() => {
  return [...staffData.value].sort((a, b) => {
    // Priority names
    const priorityNames = ['Esteban', 'Jesus'];

    // Check if either name starts with a priority name
    const aIsPriority = priorityNames.findIndex(name =>
      a.name.toLowerCase().startsWith(name.toLowerCase()),
    );
    const bIsPriority = priorityNames.findIndex(name =>
      b.name.toLowerCase().startsWith(name.toLowerCase()),
    );

    // If both are priority names, sort by their order in priorityNames
    if (aIsPriority !== -1 && bIsPriority !== -1) {
      return aIsPriority - bIsPriority;
    }

    // If only one is a priority name, it should come first
    if (aIsPriority !== -1) return -1;
    if (bIsPriority !== -1) return 1;

    // Otherwise, sort alphabetically
    return a.firstName.localeCompare(b.firstName);
  });
});

// Table configuration
const columns = [
  {
    id: 'firstName',
    label: 'Nombre',
    field: 'firstName',
    sortable: true,
  },
  {
    id: 'role',
    label: 'Rol',
    field: 'role',
    sortable: true,
    displayText: {
      'bakery_admin': 'Gerente',
      'bakery_staff': 'Equipo',
      'system_admin': 'Equipo',
      'delivery_assistant': 'Asistente Domicilio',
      'production_assistant': 'Asistente Producción',
    },
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
    id: 'resetPassword',
    label: 'Reset Password',
    icon: PhKey,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
];

// Event handlers
const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedUser.value = staffData.value.find(staff => staff.id === selectedIds[0]);
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
    case 'resetPassword': {
      const user = staffData.value.find(staff => staff.id === selectedIds[0]);
      if (user && user.email) {
        const auth = getAuth();
        await sendPasswordResetEmail(auth, user.email);
        console.log(`Password reset email sent to ${user.email}`);
        // You might want to show a success notification here
      }
      break;
    }
    }
  } catch (error) {
    console.error('Action failed:', error);
    // You might want to show an error notification here
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
  staffData.value = await settingsStore.staff;
};

onMounted(async () => {
  await refreshData();
});
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex flex-col lg:flex-row justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-neutral-800">Equipo</h2>
    </div>

    <!-- Error State -->
    <div v-if="settingsStore.error" class="text-danger text-center py-4">
      {{ settingsStore.error }}
    </div>

    <!-- Table -->
    <div>
      <DataTable
        ref="dataTable"
        :data="sortedStaffData"
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
            title="Edit Staff Member"
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

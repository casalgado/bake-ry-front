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
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ToastNotification from '@/components/ToastNotification.vue';

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

// Notification state
const isConfirmOpen = ref(false);
const confirmAction = ref(null);
const toastRef = ref(null);

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
      'bakery_staff': 'Supervisor',
      'system_admin': 'Equipo',
      'delivery_assistant': 'Asistente Domicilio',
      'production_assistant': 'Asistente Producción',
      'accounting_assistant': 'Contador',
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

const tableActions = computed(() => [
  {
    id: 'edit',
    label: 'Editar',
    icon: PhPen,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
    hideIf: selectedUser.value && (selectedUser.value.role === 'bakery_admin' || selectedUser.value.role === 'system_admin'),
  },
  {
    id: 'resetPassword',
    label: 'Restablecer Contraseña',
    icon: PhKey,
    minSelected: 1,
    maxSelected: 1,
    variant: 'primary',
  },
]);

// Event handlers
const handleSelectionChange = (selectedIds) => {
  if (selectedIds.length === 1) {
    selectedUser.value = staffData.value.find(staff => staff.id === selectedIds[0]);
  } else {
    selectedUser.value = null;
  }
};

const handleAction = async ({ actionId, selectedIds }) => {
  switch (actionId) {
  case 'edit':
    actionLoading.value[actionId] = true;
    try {
      selectedUser.value = await bakeryUserStore.fetchById(selectedIds[0]);
      isFormOpen.value = true;
    } catch (error) {
      console.error('Action failed:', error);
      toastRef.value?.showError('Error', 'No se pudieron cargar los datos del usuario');
    } finally {
      actionLoading.value[actionId] = false;
    }
    break;
  case 'resetPassword': {
    const user = staffData.value.find(staff => staff.id === selectedIds[0]);
    if (user && user.email) {
      // Store the action for confirmation
      confirmAction.value = {
        actionId,
        user,
      };
      isConfirmOpen.value = true;
    }
    break;
  }
  }
};

const handleConfirmPasswordReset = async () => {
  if (!confirmAction.value) return;

  actionLoading.value.resetPassword = true;

  try {
    const auth = getAuth();
    await sendPasswordResetEmail(auth, confirmAction.value.user.email);

    toastRef.value?.showSuccess(
      'Correo de Restablecimiento Enviado',
      `Enlace de restablecimiento enviado a ${confirmAction.value.user.email}`,
    );
  } catch (error) {
    console.error('Password reset failed:', error);
    toastRef.value?.showError(
      'Error al Enviar Correo de Restablecimiento',
      error.message || 'Por favor, inténtelo de nuevo más tarde',
    );
  } finally {
    actionLoading.value.resetPassword = false;
    isConfirmOpen.value = false;
    confirmAction.value = null;
  }
};

const handleCancelPasswordReset = () => {
  isConfirmOpen.value = false;
  confirmAction.value = null;
  actionLoading.value.resetPassword = false;
};

const handleSubmit = async (formData) => {
  try {
    if (selectedUser.value) {
      await bakeryUserStore.update(selectedUser.value.id, formData);
      await refreshData();
      toastRef.value?.showSuccess('Usuario Actualizado', 'El miembro del equipo ha sido actualizado exitosamente');
    }
    closeForm();
  } catch (error) {
    console.error('Failed to update user:', error);
    toastRef.value?.showError('Error de Actualización', 'No se pudo actualizar el miembro del equipo');
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
            title="Editar Miembro del Equipo"
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

    <!-- Password Reset Confirmation Dialog -->
    <ConfirmDialog
      :is-open="isConfirmOpen"
      title="Restablecer Contraseña"
      :message="`¿Enviar correo para restablecer la contraseña a ${confirmAction?.user?.email}?`"
      confirm-text="Enviar Correo"
      cancel-text="Cancelar"
      :loading="actionLoading.resetPassword"
      @confirm="handleConfirmPasswordReset"
      @cancel="handleCancelPasswordReset"
    />

    <!-- Toast Notifications -->
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

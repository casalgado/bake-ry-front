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
import { PhPen, PhKey, PhTrash } from '@phosphor-icons/vue';

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
    console.log('Comparing:', a, 'with', b);
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
    return a.name.localeCompare(b.name);
  });
});

// Table configuration
const columns = [
  {
    id: 'fullName',
    label: 'Nombre',
    field: 'name',
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
  {
    id: 'delete',
    label: 'Eliminar',
    icon: PhTrash,
    minSelected: 1,
    maxSelected: 1,
    variant: 'danger',
    hideIf: selectedUser.value && (selectedUser.value.role === 'bakery_admin' || selectedUser.value.role === 'system_admin'),
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
  case 'delete': {
    const user = staffData.value.find(staff => staff.id === selectedIds[0]);
    console.log('Delete action triggered for user:', user);
    if (user) {
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

const handleConfirmDelete = async () => {
  if (!confirmAction.value) return;

  console.log('Starting delete process for user:', confirmAction.value.user);
  actionLoading.value.delete = true;

  try {
    console.log('Calling bakeryUserStore.remove with ID:', confirmAction.value.user.id);
    console.log('Current bakeryUserStore state:', bakeryUserStore);
    console.log('User object being deleted:', confirmAction.value.user);

    const deleteResult = await bakeryUserStore.remove(confirmAction.value.user.id);
    console.log('Delete API result:', deleteResult);

    console.log('Delete successful, refreshing data...');
    await refreshData();

    // Clear selection after successful deletion
    selectedUser.value = null;
    dataTable.value?.clearSelection();

    toastRef.value?.showSuccess(
      'Usuario Eliminado',
      `${confirmAction.value.user.firstName} ha sido eliminado exitosamente`,
    );
    console.log('Delete process completed successfully');
  } catch (error) {
    console.error('Delete failed:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack,
    });
    toastRef.value?.showError(
      'Error al Eliminar Usuario',
      error.message || 'Por favor, inténtelo de nuevo más tarde',
    );
  } finally {
    actionLoading.value.delete = false;
    isConfirmOpen.value = false;
    confirmAction.value = null;
  }
};

const handleCancelDelete = () => {
  console.log('Delete cancelled by user');
  isConfirmOpen.value = false;
  confirmAction.value = null;
  actionLoading.value.delete = false;
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
  console.log('refreshData: Starting data refresh...');
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
  console.log('refreshData: New staff data:', staffData.value);
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
        <!-- No surface of its own: the form is a ui-card and paints itself. -->
        <DialogPanel class="ui-formhost ui-gutter max-h-[90dvh] overflow-y-auto">
          <BakeryUserForm
            v-if="selectedUser"
            title="Editar Miembro del Equipo"
            :key="selectedUser.id"
            :initial-data="selectedUser"
            :loading="settingsStore.loading"
            @submit="handleSubmit"
            @cancel="closeForm"
          />
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Confirmation Dialog (Password Reset / Delete) -->
    <ConfirmDialog
      :is-open="isConfirmOpen"
      :title="confirmAction?.actionId === 'delete' ? 'Eliminar Usuario' : 'Restablecer Contraseña'"
      :message="confirmAction?.actionId === 'delete'
        ? `¿Está seguro que desea eliminar a ${confirmAction?.user?.firstName}? Esta acción no se puede deshacer.`
        : `¿Enviar correo para restablecer la contraseña a ${confirmAction?.user?.email}?`"
      :confirm-text="confirmAction?.actionId === 'delete' ? 'Eliminar' : 'Enviar Correo'"
      cancel-text="Cancelar"
      :loading="confirmAction?.actionId === 'delete' ? actionLoading.delete : actionLoading.resetPassword"
      :variant="confirmAction?.actionId === 'delete' ? 'danger' : 'primary'"
      @confirm="confirmAction?.actionId === 'delete' ? handleConfirmDelete() : handleConfirmPasswordReset()"
      @cancel="confirmAction?.actionId === 'delete' ? handleCancelDelete() : handleCancelPasswordReset()"
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

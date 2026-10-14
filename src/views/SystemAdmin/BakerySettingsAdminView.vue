<script setup>
/* A customer's own settings (orders, reports, invoicing), edited by a system
 * admin on their behalf: the same BakeryFeaturesForm the owner sees, fed from the
 * admin store instead of the logged-in bakery. The backend records the admin as
 * the editor of every change. */
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useSystemAdminStore } from '@/stores/systemAdminStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChanges';
import { featuresToForm, OWNER_FIELDS } from '@/utils/settingsForm';
import PageHeader from '@/components/ui/PageHeader.vue';
import BakeryFeaturesForm from '@/components/forms/BakeryFeaturesForm.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ToastNotification from '@/components/ToastNotification.vue';

const bakeryId = useRoute().params.bakeryId;
const systemAdminStore = useSystemAdminStore();
const systemSettingsStore = useSystemSettingsStore();

const isSaving = ref(false);
const formRef = ref(null);
const toastRef = ref(null);

const isDirty = computed(() => !!formRef.value?.isDirty);
const { isOpen: leaveOpen, leave, stay } = useUnsavedChangesGuard(isDirty);

// The list comes first: a deep link or a refresh arrives with the store empty.
onMounted(async () => {
  if (!systemAdminStore.bakeries.length) await systemAdminStore.fetchBakeries();
  try {
    await Promise.all([
      systemAdminStore.fetchBakerySettings(bakeryId),
      systemSettingsStore.fetchSettings(),
    ]);
  } catch (error) {
    console.error('Error loading bakery settings:', error);
  }
});

const bakery = computed(() => systemAdminStore.bakeries.find(b => b.id === bakeryId));

const formData = computed(() =>
  featuresToForm(bakery.value?.settings?.features, OWNER_FIELDS),
);

const handleSave = async (features) => {
  isSaving.value = true;
  try {
    await systemAdminStore.updateBakerySettings(bakeryId, features);
    toastRef.value?.showSuccess('Configuración guardada', 'Los cambios ya están activos.');
  } catch (error) {
    console.error('Error saving bakery settings:', error);
    toastRef.value?.showError('Error al guardar', 'No se pudo guardar la configuración. Intenta nuevamente.');
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="ui-formhost p-4 lg:p-6 flex flex-col gap-4">
    <PageHeader
      :title="bakery ? `Configuración de ${bakery.name}` : 'Configuración'"
      subtitle="Estás editando como administrador. Los cambios se aplican al negocio de inmediato."
    >
      <router-link to="/system-admin/bakeries" class="ui-btn">Volver</router-link>
    </PageHeader>

    <p v-if="systemAdminStore.error" class="ui-field-error">{{ systemAdminStore.error }}</p>
    <p v-else-if="bakery?.settingsError" class="ui-field-error">
      No se pudo cargar la configuración: {{ bakery.settingsError }}
    </p>
    <p v-else-if="!systemAdminStore.loading && !bakery" class="ui-field-error">
      Negocio no encontrado.
    </p>

    <BakeryFeaturesForm
      v-if="formData"
      ref="formRef"
      :initial-data="formData"
      :payment-methods="systemSettingsStore.configurablePaymentMethods"
      :loading="isSaving"
      @save="handleSave"
    />

    <ConfirmDialog
      :is-open="leaveOpen"
      title="Cambios sin guardar"
      message="Tienes cambios sin guardar. Si sales ahora, se pierden."
      confirm-text="Salir sin guardar"
      cancel-text="Seguir editando"
      @confirm="leave"
      @cancel="stay"
    />
    <ToastNotification ref="toastRef" />
  </div>
</template>

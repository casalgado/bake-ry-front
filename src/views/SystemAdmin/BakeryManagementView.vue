<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useSystemAdminStore } from '@/stores/systemAdminStore';
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChanges';
import { featuresToForm, ADMIN_FIELDS } from '@/utils/settingsForm';
import PageHeader from '@/components/ui/PageHeader.vue';
import BakeryModulesForm from '@/components/forms/BakeryModulesForm.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ToastNotification from '@/components/ToastNotification.vue';

const systemAdminStore = useSystemAdminStore();
const selectedBakeryId = ref('');
const isLoadingSettings = ref(false);
const isSaving = ref(false);
const formRef = ref(null);
const toastRef = ref(null);

const isDirty = computed(() => !!formRef.value?.isDirty);
const { isOpen: leaveOpen, leave, stay } = useUnsavedChangesGuard(isDirty);

onMounted(() => systemAdminStore.fetchBakeries());

const selectedBakery = computed(() =>
  systemAdminStore.bakeries.find(b => b.id === selectedBakeryId.value),
);

const formData = computed(() =>
  featuresToForm(selectedBakery.value?.settings?.features, ADMIN_FIELDS),
);

// Settings load for the one business being edited, not for all of them up front.
watch(selectedBakeryId, async (id) => {
  if (!id) return;
  isLoadingSettings.value = true;
  try {
    await systemAdminStore.fetchBakerySettings(id);
  } catch (error) {
    console.error('Error loading bakery settings:', error);
  } finally {
    isLoadingSettings.value = false;
  }
});

const handleSave = async (features) => {
  isSaving.value = true;
  try {
    await systemAdminStore.updateBakerySettings(selectedBakeryId.value, features);
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
    <PageHeader title="Configuración de negocios" subtitle="Punto de venta y módulos de cada negocio">
      <router-link
        v-if="selectedBakery"
        :to="{ name: 'system-admin-bakery-settings', params: { bakeryId: selectedBakery.id } }"
        class="ui-btn"
      >
        Ver configuración del negocio
      </router-link>
    </PageHeader>

    <div class="ui-field" data-ui-theme="light">
      <label class="ui-field-k" for="bakery-select">Negocio</label>
      <select
        id="bakery-select"
        v-model="selectedBakeryId"
        class="ui-input"
        :disabled="isDirty"
        :aria-describedby="isDirty ? 'bakery-select-h' : undefined"
      >
        <option value="">Selecciona un negocio</option>
        <option v-for="bakery in systemAdminStore.bakeries" :key="bakery.id" :value="bakery.id">
          {{ bakery.name }}
        </option>
      </select>
      <!-- Always laid out, only hidden: its line is reserved so showing it moves nothing. -->
      <span id="bakery-select-h" class="ui-field-hint" :class="{ invisible: !isDirty }">
        Guarda o cancela los cambios para cambiar de negocio.
      </span>
    </div>

    <p v-if="systemAdminStore.error" class="ui-field-error">{{ systemAdminStore.error }}</p>
    <p v-else-if="selectedBakery?.settingsError" class="ui-field-error">
      No se pudo cargar la configuración: {{ selectedBakery.settingsError }}
    </p>

    <BakeryModulesForm
      v-if="selectedBakery && formData && !isLoadingSettings"
      :key="selectedBakeryId"
      ref="formRef"
      :title="`Configuración de ${selectedBakery.name}`"
      :initial-data="formData"
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

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useSystemAdminStore } from '@/stores/systemAdminStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import BakeryFeaturesForm from '@/components/forms/BakeryFeaturesForm.vue';

const systemAdminStore = useSystemAdminStore();
const systemSettingsStore = useSystemSettingsStore();
const selectedBakeryId = ref('');
const isSaving = ref(false);
const formPreviewData = ref(null);

onMounted(async () => {
  await Promise.all([
    systemAdminStore.fetchAllBakeriesWithSettings(),
    systemSettingsStore.fetchSettings(),
  ]);
});

const selectedBakery = computed(() => {
  if (!selectedBakeryId.value || !systemAdminStore.bakeries) return null;
  return systemAdminStore.bakeries.find(b => b.id === selectedBakeryId.value);
});

const featuresFormData = computed(() => {
  // Use preview data if available, otherwise use original bakery data
  if (formPreviewData.value) {
    return formPreviewData.value;
  }

  if (!selectedBakery.value?.settings?.features) return null;

  const features = selectedBakery.value.settings.features;
  return {
    activePaymentMethods: features.order?.activePaymentMethods || [],
    allowPartialPayment: features.order?.allowPartialPayment || false,
    defaultDate: features.order?.defaultDate || 'production',
    timeOfDay: features.order?.timeOfDay || false,
    offlineMode: features.order?.offlineMode || false,
    defaultReportFilter: features.reports?.defaultReportFilter || 'dueDate',
    showMultipleReports: features.reports?.showMultipleReports || false,
    useProductCost: features.products?.useProductCost || false,
    defaultTermsAndConditions: features.invoicing?.defaultTermsAndConditions || '',
    taxMode: features.invoicing?.taxMode || 'inclusive',
    posEnabled: features.pos?.enabled || false,
    posAutoMarkPaid: features.pos?.autoMarkPaid || false,
    posDefaultToCurrentDate: features.pos?.defaultToCurrentDate || false,
    posHideDeliveryOptions: features.pos?.hideDeliveryOptions || false,
    posAutoSelectClient: features.pos?.autoSelectClient || false,
    posDefaultClientId: features.pos?.defaultClientId || null,
  };
});

const configurablePaymentMethods = computed(() => {
  const allMethods = systemSettingsStore.availablePaymentMethods || [];
  return allMethods.filter((method) => method.value !== 'complimentary');
});

// Handle form changes (just update preview, don't save)
const handleFormDataChanged = (formData) => {
  formPreviewData.value = { ...formData };
};

// Handle manual save button click (actually save to backend)
const handleSaveBakerySettings = async (formData) => {
  if (!selectedBakeryId.value) return;

  isSaving.value = true;
  try {
    await systemAdminStore.updateBakerySettings(selectedBakeryId.value, formData);
    // Clear preview data after successful save
    formPreviewData.value = null;
    // Success feedback could be added here
  } catch (error) {
    console.error('Error saving bakery settings:', error);
    // Error feedback could be added here
  } finally {
    isSaving.value = false;
  }
};

// Clear preview data when switching bakeries
watch(selectedBakeryId, () => {
  formPreviewData.value = null;
});
</script>

<template>
  <div class="form-container">
    <h2 >
      Configuraciones de Panaderías
    </h2>

    <div class="">
      <label>Seleccionar Panadería</label>
      <select v-model="selectedBakeryId">
        <option value="">-- Selecciona una panadería --</option>
        <option
          v-for="bakery in (systemAdminStore.bakeries || [])"
          :key="bakery.id"
          :value="bakery.id"
        >
          {{ bakery.name }}
        </option>
      </select>

    </div>
    </div>
    <div>
    <div v-if="systemAdminStore.loading" class="text-center py-8">
      <p class="text-neutral-600">Cargando panaderías...</p>
    </div>

    <div v-else-if="systemAdminStore.error" class="text-center py-8 text-red-600">
      <p>Error: {{ systemAdminStore.error }}</p>
    </div>

    <div v-else-if="selectedBakery && featuresFormData" class="mt-6">
      <BakeryFeaturesForm
        :title="`Configuración de ${selectedBakery.name}`"
        :initial-data="featuresFormData"
        :available-payment-methods="configurablePaymentMethods"
        :loading="isSaving"
        :system-admin-mode="true"
        :bakery-id="selectedBakeryId"
        class="w-full"
        @data-changed="handleFormDataChanged"
        @save="handleSaveBakerySettings"
      />
    </div>
  </div>
</template>

<style scoped>

</style>

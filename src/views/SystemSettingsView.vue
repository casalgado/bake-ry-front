<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ToastNotification from '@/components/ToastNotification.vue';

const systemSettingsStore = useSystemSettingsStore();
const toastRef = ref(null);

// Form data state
const formData = reactive({
  defaultVariationTemplates: {},
  availablePaymentMethods: [],
  orderStatuses: [],
  fulfillmentTypes: [],
  paymentMethods: [],
  unitOptions: [],
  storageTemperatures: [],
});

// Loading state
const isSaving = ref(false);

// Confirmation dialog state
const showConfirmDialog = ref(false);
const confirmTitle = ref('');
const confirmMessage = ref('');
const confirmAction = ref(null);
const confirmText = ref('Guardar');

// Load settings on mount
onMounted(async () => {
  try {
    await systemSettingsStore.fetchSettings();
    if (systemSettingsStore.settings) {
      Object.assign(formData, {
        defaultVariationTemplates: JSON.parse(JSON.stringify(systemSettingsStore.settings.defaultVariationTemplates || {})),
        availablePaymentMethods: JSON.parse(JSON.stringify(systemSettingsStore.settings.availablePaymentMethods || [])),
        orderStatuses: [...(systemSettingsStore.settings.orderStatuses || [])],
        fulfillmentTypes: [...(systemSettingsStore.settings.fulfillmentTypes || [])],
        paymentMethods: [...(systemSettingsStore.settings.paymentMethods || [])],
        unitOptions: [...(systemSettingsStore.settings.unitOptions || [])],
        storageTemperatures: [...(systemSettingsStore.settings.storageTemperatures || [])],
      });
    }
  } catch (error) {
    toastRef.value?.show('Error cargando configuraciones del sistema', 'error');
  }
});

// Computed property to check if there are changes
const hasChanges = computed(() => {
  if (!systemSettingsStore.settings) return false;

  return JSON.stringify(formData) !== JSON.stringify({
    defaultVariationTemplates: systemSettingsStore.settings.defaultVariationTemplates || {},
    availablePaymentMethods: systemSettingsStore.settings.availablePaymentMethods || [],
    orderStatuses: systemSettingsStore.settings.orderStatuses || [],
    fulfillmentTypes: systemSettingsStore.settings.fulfillmentTypes || [],
    paymentMethods: systemSettingsStore.settings.paymentMethods || [],
    unitOptions: systemSettingsStore.settings.unitOptions || [],
    storageTemperatures: systemSettingsStore.settings.storageTemperatures || [],
  });
});

// Confirmation dialog handlers
const openConfirmDialog = (title, message, action, confirmButtonText = 'Confirmar') => {
  confirmTitle.value = title;
  confirmMessage.value = message;
  confirmAction.value = action;
  confirmText.value = confirmButtonText;
  showConfirmDialog.value = true;
};

const handleConfirm = async () => {
  if (confirmAction.value) {
    await confirmAction.value();
  }
  showConfirmDialog.value = false;
  confirmAction.value = null;
};

const handleCancel = () => {
  showConfirmDialog.value = false;
  confirmAction.value = null;
};

// Save settings
const handleSave = () => {
  openConfirmDialog(
    'Guardar Configuraciones',
    '¿Estás seguro de que quieres guardar los cambios en las configuraciones del sistema?',
    async () => {
      isSaving.value = true;
      try {
        await systemSettingsStore.updateSettings(formData);
        toastRef.value?.show('Configuraciones guardadas exitosamente', 'success');
      } catch (error) {
        toastRef.value?.show('Error guardando configuraciones', 'error');
      } finally {
        isSaving.value = false;
      }
    },
    'Guardar',
  );
};

// Helper functions for array management
const addItem = (array, newItem = '') => {
  if (newItem.trim()) {
    array.push(newItem.trim());
  }
};

const removeItem = (array, index) => {
  array.splice(index, 1);
};

// Helper functions for payment methods
const addPaymentMethod = () => {
  formData.availablePaymentMethods.push({
    value: '',
    label: '',
    displayText: '',
  });
};

const removePaymentMethod = (index) => {
  formData.availablePaymentMethods.splice(index, 1);
};

// JSON editor state for variation templates
const showJsonEditor = ref(false);
const jsonEditorContent = ref('');
const jsonEditorError = ref('');

// Helper functions for JSON editor
const openJsonEditor = () => {
  jsonEditorContent.value = JSON.stringify(formData.defaultVariationTemplates, null, 2);
  jsonEditorError.value = '';
  showJsonEditor.value = true;
};

const saveJsonChanges = () => {
  try {
    const parsed = JSON.parse(jsonEditorContent.value);
    formData.defaultVariationTemplates = parsed;
    jsonEditorError.value = '';
    showJsonEditor.value = false;
    toastRef.value?.show('Plantillas de variaciones actualizadas', 'success');
  } catch (error) {
    jsonEditorError.value = 'JSON inválido: ' + error.message;
  }
};

const cancelJsonChanges = () => {
  showJsonEditor.value = false;
  jsonEditorError.value = '';
};
</script>

<template>
  <div class="form-container">
    <h1 class="text-2xl font-bold text-neutral-800 mb-6">Configuraciones del Sistema</h1>

    <form @submit.prevent="handleSave" class="space-y-6">
      <!-- Default Variation Templates -->
      <div class="base-card">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-neutral-800">Plantillas de Variaciones por Defecto</h3>
          <button
            type="button"
            @click="openJsonEditor"
            class="utility-btn"
          >
            Editar JSON
          </button>
        </div>

        <div class="bg-neutral-50 p-4 rounded-md border">
          <p class="text-sm text-neutral-600 mb-2">Vista previa de las plantillas configuradas:</p>
          <pre class="text-xs bg-white p-3 rounded border overflow-auto max-h-40">{{ JSON.stringify(formData.defaultVariationTemplates, null, 2) }}</pre>
        </div>
      </div>

      <!-- Available Payment Methods -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Métodos de Pago Disponibles</h3>

        <div class="space-y-2 mb-4">
          <div v-for="(method, index) in formData.availablePaymentMethods" :key="index" class="grid grid-cols-4 gap-2 items-end">
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1">Valor</label>
              <input
                v-model="method.value"
                type="text"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1">Etiqueta</label>
              <input
                v-model="method.label"
                type="text"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1">Texto de Pantalla</label>
              <input
                v-model="method.displayText"
                type="text"
                class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <button
                type="button"
                @click="removePaymentMethod(index)"
                class="cancel-btn"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="addPaymentMethod"
          class="utility-btn"
        >
          Agregar Método de Pago
        </button>
      </div>

      <!-- Order Statuses -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Estados de Pedidos</h3>

        <div class="space-y-2 mb-4">
          <div v-for="(status, index) in formData.orderStatuses" :key="index" class="flex gap-2 items-center">
            <input
              v-model="formData.orderStatuses[index]"
              type="text"
              class="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              @click="removeItem(formData.orderStatuses, index)"
              class="cancel-btn"
            >
              Eliminar
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <input
            ref="newOrderStatus"
            type="text"
            placeholder="Nuevo estado de pedido"
            class="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            @keyup.enter="addItem(formData.orderStatuses, $event.target.value); $event.target.value = ''"
          />
          <button
            type="button"
            @click="addItem(formData.orderStatuses, $refs.newOrderStatus.value); $refs.newOrderStatus.value = ''"
            class="utility-btn"
          >
            Agregar
          </button>
        </div>
      </div>

      <!-- Fulfillment Types -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Tipos de Entrega</h3>

        <div class="space-y-2 mb-4">
          <div v-for="(type, index) in formData.fulfillmentTypes" :key="index" class="flex gap-2 items-center">
            <input
              v-model="formData.fulfillmentTypes[index]"
              type="text"
              class="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              @click="removeItem(formData.fulfillmentTypes, index)"
              class="cancel-btn"
            >
              Eliminar
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <input
            ref="newFulfillmentType"
            type="text"
            placeholder="Nuevo tipo de entrega"
            class="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            @keyup.enter="addItem(formData.fulfillmentTypes, $event.target.value); $event.target.value = ''"
          />
          <button
            type="button"
            @click="addItem(formData.fulfillmentTypes, $refs.newFulfillmentType.value); $refs.newFulfillmentType.value = ''"
            class="utility-btn"
          >
            Agregar
          </button>
        </div>
      </div>

      <!-- Payment Methods -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Métodos de Pago</h3>

        <div class="space-y-2 mb-4">
          <div v-for="(method, index) in formData.paymentMethods" :key="index" class="flex gap-2 items-center">
            <input
              v-model="formData.paymentMethods[index]"
              type="text"
              class="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              @click="removeItem(formData.paymentMethods, index)"
              class="cancel-btn"
            >
              Eliminar
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <input
            ref="newPaymentMethod"
            type="text"
            placeholder="Nuevo método de pago"
            class="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            @keyup.enter="addItem(formData.paymentMethods, $event.target.value); $event.target.value = ''"
          />
          <button
            type="button"
            @click="addItem(formData.paymentMethods, $refs.newPaymentMethod.value); $refs.newPaymentMethod.value = ''"
            class="utility-btn"
          >
            Agregar
          </button>
        </div>
      </div>

      <!-- Unit Options -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Opciones de Unidades</h3>

        <div class="space-y-2 mb-4">
          <div v-for="(unit, index) in formData.unitOptions" :key="index" class="flex gap-2 items-center">
            <input
              v-model="formData.unitOptions[index]"
              type="text"
              class="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              @click="removeItem(formData.unitOptions, index)"
              class="cancel-btn"
            >
              Eliminar
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <input
            ref="newUnitOption"
            type="text"
            placeholder="Nueva unidad"
            class="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            @keyup.enter="addItem(formData.unitOptions, $event.target.value); $event.target.value = ''"
          />
          <button
            type="button"
            @click="addItem(formData.unitOptions, $refs.newUnitOption.value); $refs.newUnitOption.value = ''"
            class="utility-btn"
          >
            Agregar
          </button>
        </div>
      </div>

      <!-- Storage Temperatures -->
      <div class="base-card">
        <h3 class="text-lg font-semibold text-neutral-800 mb-4">Temperaturas de Almacenamiento</h3>

        <div class="space-y-2 mb-4">
          <div v-for="(temp, index) in formData.storageTemperatures" :key="index" class="flex gap-2 items-center">
            <input
              v-model="formData.storageTemperatures[index]"
              type="text"
              class="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              @click="removeItem(formData.storageTemperatures, index)"
              class="cancel-btn"
            >
              Eliminar
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <input
            ref="newStorageTemp"
            type="text"
            placeholder="Nueva temperatura"
            class="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            @keyup.enter="addItem(formData.storageTemperatures, $event.target.value); $event.target.value = ''"
          />
          <button
            type="button"
            @click="addItem(formData.storageTemperatures, $refs.newStorageTemp.value); $refs.newStorageTemp.value = ''"
            class="utility-btn"
          >
            Agregar
          </button>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-center pt-6">
        <button
          type="submit"
          :disabled="!hasChanges || isSaving || systemSettingsStore.loading"
          class="action-btn"
          :class="{ 'opacity-50 cursor-not-allowed': !hasChanges || isSaving || systemSettingsStore.loading }"
        >
          {{ isSaving ? 'Guardando...' : 'Guardar Configuraciones' }}
        </button>
      </div>
    </form>

    <!-- JSON Editor Dialog -->
    <Dialog :open="showJsonEditor" @close="cancelJsonChanges" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="bg-white rounded-lg p-6 max-w-4xl w-full h-[90vh] overflow-hidden flex flex-col">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">Editor JSON - Plantillas de Variaciones</h3>
            <button
              type="button"
              @click="cancelJsonChanges"
              class="text-neutral-500 hover:text-neutral-700"
            >
              ✕
            </button>
          </div>

          <div class="h-96 overflow-hidden flex flex-col">
            <div v-if="jsonEditorError" class="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
              {{ jsonEditorError }}
            </div>

            <textarea
              v-model="jsonEditorContent"
              class="w-full h-96 p-4 border border-neutral-300 rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Edita el JSON aquí..."
            ></textarea>
          </div>

          <div class="flex justify-end gap-2 mt-4">
            <button
              type="button"
              @click="cancelJsonChanges"
              class="utility-btn"
            >
              Cancelar
            </button>
            <button
              type="button"
              @click="saveJsonChanges"
              class="action-btn"
            >
              Guardar Cambios
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    <!-- Confirmation Dialog -->
    <ConfirmDialog
      :isOpen="showConfirmDialog"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirmText="confirmText"
      :loading="isSaving"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />

    <!-- Toast Notification -->
    <ToastNotification ref="toastRef" />
  </div>
</template>

<style scoped>
.form-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
</style>

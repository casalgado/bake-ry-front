<script setup>
import { ref, onMounted, computed } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import { PayUService } from '@/services/payuService';
import { useAuthenticationStore } from '@/stores/authentication';
import CreditCardForm from '@/components/forms/CreditCardForm.vue';
import ToastNotification from '@/components/ToastNotification.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const settingsStore = useBakerySettingsStore();
const bakeryUserStore = useBakeryUserStore();
const authStore = useAuthenticationStore();
const staffData = ref([]);
const b2bClientsData = ref([]);

// Features form state
const featuresForm = ref({
  activePaymentMethods: [],
  allowPartialPayment: false,
  timeOfDay: false,
});
const isFeaturesSaving = ref(false);

// Initialize PayU service
const payuService = new PayUService(authStore.getBakeryId);

// Form states - simplified to single form handling
const isFormOpen = ref(false);
const selectedUser = ref(null);

// Payment methods state
const paymentMethods = ref([]);
const newCardForm = ref({
  cardNumber: '',
  expiryDate: '',
  cvv: '',
  cardholderName: '',
  identificationNumber: '',
});
const isAddingCard = ref(false);

// Toast and confirmation dialog refs
const toastRef = ref(null);
const isConfirmOpen = ref(false);
const confirmAction = ref(null);
const creditCardFormRef = ref(null);

onMounted(async () => {
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
  b2bClientsData.value = await settingsStore.b2b_clients;
  console.log(b2bClientsData.value);

  // Initialize features form
  initializeFeaturesForm();

  // Load stored payment methods
  await loadPaymentMethods();
});

// Load stored payment methods
const loadPaymentMethods = async () => {
  try {
    const response = await payuService.getStoredCards();
    paymentMethods.value = response.data || [];
  } catch (error) {
    console.error('Error loading payment methods:', error);
    paymentMethods.value = [];
    toastRef.value?.showError(
      'Error al Cargar Tarjetas',
      'No se pudieron cargar las tarjetas guardadas',
    );
  }
};

// Unified form handlers
const handleEdit = async (user) => {
  selectedUser.value = await bakeryUserStore.fetchById(user.id);
  console.log(selectedUser.value);
  isFormOpen.value = true;
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
  b2bClientsData.value = await settingsStore.b2b_clients;
};

// Payment methods handlers
const addCard = async (cardData) => {
  isAddingCard.value = true;
  try {
    const response = await payuService.createToken({
      cardNumber: cardData.cardNumber, // Already cleaned by the form
      expiryDate: convertExpiryDate(cardData.expiryDate), // Convert MM/YY to YYYY/MM
      cvv: cardData.cvv,
      cardholderName: cardData.cardholderName,
      identificationNumber: cardData.identificationNumber,
    });

    // Refresh the payment methods list
    await loadPaymentMethods();

    // Reset the form only after successful server response
    creditCardFormRef.value?.resetForm();

    toastRef.value?.showSuccess(
      'Tarjeta Agregada',
      'La tarjeta de crédito ha sido guardada exitosamente',
    );

    console.log('Card added successfully:', response);
  } catch (error) {
    console.error('Error adding card:', error);
    toastRef.value?.showError(
      'Error al Agregar Tarjeta',
      error.message || 'No se pudo agregar la tarjeta. Verifica los datos e intenta nuevamente.',
    );
  } finally {
    isAddingCard.value = false;
  }
};

// Show confirmation dialog for card deletion
const confirmDeleteCard = (card) => {
  confirmAction.value = {
    type: 'delete-card',
    card: card,
    title: 'Eliminar Tarjeta',
    message: `¿Estás seguro que deseas eliminar la tarjeta terminada en ${card.maskedNumber}?`,
  };
  isConfirmOpen.value = true;
};

// Handle confirmation dialog actions
const handleConfirm = async () => {
  if (confirmAction.value?.type === 'delete-card') {
    await deleteCard(confirmAction.value.card.id);
  }
  isConfirmOpen.value = false;
  confirmAction.value = null;
};

const handleCancel = () => {
  console.log('Action cancelled');
  isConfirmOpen.value = false;
  confirmAction.value = null;
};

const deleteCard = async (cardId) => {
  try {
    await payuService.deleteToken(cardId);
    // Refresh the payment methods list
    await loadPaymentMethods();

    toastRef.value?.showSuccess(
      'Tarjeta Eliminada',
      'La tarjeta ha sido eliminada exitosamente',
    );

    console.log('Card deleted successfully');
  } catch (error) {
    console.error('Error deleting card:', error);
    toastRef.value?.showError(
      'Error al Eliminar Tarjeta',
      error.message || 'No se pudo eliminar la tarjeta. Intenta nuevamente.',
    );
  }
};

const resetForm = () => {
  console.log('Resetting form');
  newCardForm.value = {
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    identificationNumber: '',
  };
};

// Convert MM/YY to YYYY/MM format for backend
const convertExpiryDate = (mmyy) => {
  const [month, year] = mmyy.split('/');
  const fullYear = '20' + year; // Convert YY to YYYY
  return `${fullYear}/${month}`;
};

// convert YYYY/MM to MM/YY for display
const convertToDisplayFormat = (date) => {
  const [year, month] = date.split('/');
  return `${month}/${year.slice(2)}`; // Convert YYYY/MM to MM/YY
};

// Features form computed properties
const availablePaymentMethods = computed(() => {
  if (!settingsStore.items.length) return [];
  return settingsStore.items[0].availablePaymentMethods || [];
});

const currentActivePaymentMethods = computed(() => {
  if (!settingsStore.items.length) return [];
  return settingsStore.items[0].features?.order?.activePaymentMethods || [];
});

const currentOrderFeatures = computed(() => {
  if (!settingsStore.items.length) return {};
  return settingsStore.items[0].features?.order || {};
});

// Features form handlers
const initializeFeaturesForm = () => {
  const orderFeatures = currentOrderFeatures.value;
  featuresForm.value.activePaymentMethods = [...(orderFeatures.activePaymentMethods || [])];
  featuresForm.value.allowPartialPayment = orderFeatures.allowPartialPayment || false;
  featuresForm.value.timeOfDay = orderFeatures.timeOfDay || false;
};

const handleFeaturesSubmit = async () => {
  isFeaturesSaving.value = true;
  try {
    await settingsStore.patch('default', {
      features: {
        order: {
          activePaymentMethods: featuresForm.value.activePaymentMethods,
          allowPartialPayment: featuresForm.value.allowPartialPayment,
          timeOfDay: featuresForm.value.timeOfDay,
        },
      },
    });

    toastRef.value?.showSuccess(
      'Configuración Guardada',
      'Las configuraciones de pedidos han sido actualizadas',
    );
  } catch (error) {
    console.error('Error saving features:', error);
    toastRef.value?.showError(
      'Error al Guardar',
      'No se pudo guardar la configuración. Intenta nuevamente.',
    );
  } finally {
    isFeaturesSaving.value = false;
  }
};

const resetFeaturesForm = () => {
  initializeFeaturesForm();
};
</script>

<template>
  <!-- Payment Methods Features Form -->
  <div class="form-container">
    <h2>Métodos de Pago Activos</h2>
    <form @submit.prevent="handleFeaturesSubmit" class="base-card">
      <div class="mb-4">
        <label class="block text-sm font-medium text-neutral-700 mb-3">
          Selecciona los métodos de pago que estarán disponibles:
        </label>
        <div class="space-y-2">
          <div
            v-for="method in availablePaymentMethods"
            :key="method.value"
            class="flex items-center"
          >
            <input
              type="checkbox"
              :id="`payment-method-${method.value}`"
              :value="method.value"
              v-model="featuresForm.activePaymentMethods"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
            />
            <label
              :for="`payment-method-${method.value}`"
              class="ml-2 block text-sm text-neutral-900"
            >
              {{ method.label }}
              <span class="text-neutral-500 text-xs ml-1">({{ method.displayText }})</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Additional Order Features -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-neutral-700 mb-3">
          Características Adicionales:
        </label>
        <div class="space-y-3">
          <div class="flex items-center">
            <input
              type="checkbox"
              id="allow-partial-payment"
              v-model="featuresForm.allowPartialPayment"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
            />
            <label
              for="allow-partial-payment"
              class="ml-2 block text-sm text-neutral-900"
            >
              Permitir Pagos Parciales
              <span class="text-neutral-500 text-xs block">Los pedidos pueden tener pagos parciales antes del pago total</span>
            </label>
          </div>

          <div class="flex items-center">
            <input
              type="checkbox"
              id="time-of-day"
              v-model="featuresForm.timeOfDay"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
            />
            <label
              for="time-of-day"
              class="ml-2 block text-sm text-neutral-900"
            >
              Hora de Entrega
              <span class="text-neutral-500 text-xs block">Mostrar campo de hora específica para entregas</span>
            </label>
          </div>
        </div>
      </div>

      <div class="flex gap-2 justify-end">
        <button
          type="button"
          @click="resetFeaturesForm"
          :disabled="isFeaturesSaving"
          class="utility-btn"
        >
          Resetear
        </button>
        <button
          type="submit"
          :disabled="isFeaturesSaving"
          class="action-btn"
        >
          {{ isFeaturesSaving ? 'Guardando...' : 'Guardar Cambios' }}
        </button>
      </div>
    </form>
  </div>

  <!-- Add Credit Card Form -->
  <CreditCardForm
    ref="creditCardFormRef"
    :initial-data="newCardForm"
    :loading="isAddingCard"
    @submit="addCard"
  />

  <!-- Stored Cards List -->
  <div class="form-container">
    <h2>Tarjetas Guardadas</h2>
    <div class="base-card p-6" style="margin-bottom: 1rem;">

    <div
      v-if="paymentMethods.length === 0"
      class="text-center py-8 text-neutral-600"
    >
      No hay tarjetas guardadas
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="card in paymentMethods"
        :key="card.id"
        class="flex items-center justify-between p-4 border border-neutral-200 rounded-lg"
      >
        <div class="flex items-center space-x-4">
          <div
            class="w-12 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center"
          >
            <span class="text-white text-xs font-bold">💳</span>
          </div>
          <div>
            <div class="font-medium font-mono">
              {{ `****-****-****-${card.maskedNumber}` }}
            </div>
            <div class="text-sm text-neutral-600">
              {{ card.cardholderName }} • Exp:
              {{ convertToDisplayFormat(card.expirationDate) }}
            </div>
            <!-- <div class="text-xs text-neutral-500">Token: {{ card.token }}</div> -->
          </div>
        </div>
        <button
          @click="confirmDeleteCard(card)"
          class="text-red-600 hover:text-red-800 px-3 py-1 text-sm"
        >
          Eliminar
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Toast Notifications -->
<ToastNotification ref="toastRef" />

<!-- Confirmation Dialog -->
<ConfirmDialog
  :is-open="isConfirmOpen"
  :title="confirmAction?.title || ''"
  :message="confirmAction?.message || ''"
  confirm-text="Eliminar"
  cancel-text="Cancelar"
  @confirm="handleConfirm"
  @cancel="handleCancel"
/>
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

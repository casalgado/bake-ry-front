<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useBakeryStore } from '@/stores/bakeryStore';
import { useBakeryUserStore } from '@/stores/bakeryUserStore';
import { useSystemSettingsStore } from '@/stores/systemSettingsStore';
import { PayUService } from '@/services/payuService';
import { useAuthenticationStore } from '@/stores/authentication';
import api from '@/services/api';
import { auth } from '@/config/firebase';
import CreditCardForm from '@/components/forms/CreditCardForm.vue';
import BakeryFeaturesForm from '@/components/forms/BakeryFeaturesForm.vue';
import BakeryBrandingForm from '@/components/forms/BakeryBrandingForm.vue';
import ToastNotification from '@/components/ToastNotification.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const settingsStore = useBakerySettingsStore();
const bakeryStore = useBakeryStore();
const bakeryUserStore = useBakeryUserStore();
const authStore = useAuthenticationStore();
const systemSettingsStore = useSystemSettingsStore();
const staffData = ref([]);
const b2bClientsData = ref([]);

// Features form state
const featuresFormData = ref({
  activePaymentMethods: [],
  allowPartialPayment: false,
  timeOfDay: false,
  offlineMode: false,
  // Reports features
  defaultReportFilter: 'dueDate',
  showMultipleReports: false,
  // Invoicing features
  defaultTermsAndConditions: '',
  taxMode: 'inclusive',
});
const isFeaturesSaving = ref(false);

// Branding form state
const brandingFormData = ref({
  logos: {
    original: '',
    small: '',
    medium: '',
    large: '',
  },
  primaryColor: '',
  secondaryColor: '',
});
const isBrandingSaving = ref(false);

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

// Subscription state
const subscriptionData = ref(null);
const isLoadingSubscription = ref(false);
const jwtClaims = ref(null);
const subscriptionActions = ref({
  retryPayment: false,
  cancelSubscription: false,
  reactivateSubscription: false,
  createSubscription: false,
});
const selectedCardForReactivation = ref(null);
const selectedCardForCreation = ref(null);

// Toast and confirmation dialog refs
const toastRef = ref(null);
const isConfirmOpen = ref(false);
const confirmAction = ref(null);
const creditCardFormRef = ref(null);

onMounted(async () => {
  await settingsStore.fetchById('default');
  staffData.value = await settingsStore.staff;
  b2bClientsData.value = await settingsStore.b2b_clients;

  // Load bakery data
  await bakeryStore.fetchBakeryById(authStore.getBakeryId);

  // Load system settings
  await systemSettingsStore.fetchSettings();

  // Initialize features form
  initializeFeaturesForm();

  // Initialize branding form
  initializeBrandingForm();

  // Load stored payment methods
  await loadPaymentMethods();

  // Load subscription data
  await loadSubscriptionData();

  // Get JWT claims
  await loadJWTClaims();
});

// Load stored payment methods
const loadPaymentMethods = async () => {
  try {
    const response = await payuService.getStoredCards();
    paymentMethods.value = response.data || [];
  } catch (error) {
    console.warn('Error loading payment methods:', error);
    paymentMethods.value = [];
    // toastRef.value?.showError(
    //   'Error al Cargar Tarjetas',
    //   'No se pudieron cargar las tarjetas guardadas',
    // );
  }
};

// Load subscription data
const loadSubscriptionData = async () => {
  isLoadingSubscription.value = true;
  try {
    const response = await api.get(
      `/bakeries/${authStore.getBakeryId}/settings/default`,
    );
    subscriptionData.value = response.data?.subscription || null;
    console.log('Subscription data loaded:', subscriptionData.value);
  } catch (error) {
    console.error('Error loading subscription data:', error);
    subscriptionData.value = null;
    toastRef.value?.showError(
      'Error al Cargar Suscripción',
      'No se pudo cargar la información de suscripción',
    );
  } finally {
    isLoadingSubscription.value = false;
  }
};

// Load JWT claims
const loadJWTClaims = async () => {
  try {
    if (auth.currentUser) {
      const tokenResult = await auth.currentUser.getIdTokenResult();
      jwtClaims.value = tokenResult.claims;
      console.log('JWT claims loaded:', jwtClaims.value);
    }
  } catch (error) {
    console.error('Error loading JWT claims:', error);
    jwtClaims.value = null;
  }
};

// Subscription action handlers
const retryPayment = async () => {
  subscriptionActions.value.retryPayment = true;
  try {
    const response = await api.patch(
      `/bakeries/${authStore.getBakeryId}/settings/default`,
      {
        subscription: {
          _action: 'retry_payment',
          recurringPaymentId: subscriptionData.value?.recurringPaymentId,
        },
      },
    );

    await loadSubscriptionData();
    await loadJWTClaims();

    toastRef.value?.showSuccess(
      'Pago Reintentado',
      'El reintento de pago ha sido iniciado exitosamente',
    );

    console.log('Payment retry successful:', response);
  } catch (error) {
    console.error('Error retrying payment:', error);
    toastRef.value?.showError(
      'Error al Reintentar Pago',
      error.message || 'No se pudo reintentar el pago. Intenta nuevamente.',
    );
  } finally {
    subscriptionActions.value.retryPayment = false;
  }
};

const cancelSubscription = async () => {
  subscriptionActions.value.cancelSubscription = true;
  try {
    const response = await api.patch(
      `/bakeries/${authStore.getBakeryId}/settings/default`,
      {
        subscription: {
          _action: 'cancel_subscription',
        },
      },
    );

    await loadSubscriptionData();
    await loadJWTClaims();

    toastRef.value?.showSuccess(
      'Suscripción Cancelada',
      'La suscripción ha sido cancelada exitosamente',
    );

    console.log('Subscription cancelled:', response);
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    toastRef.value?.showError(
      'Error al Cancelar Suscripción',
      error.message || 'No se pudo cancelar la suscripción. Intenta nuevamente.',
    );
  } finally {
    subscriptionActions.value.cancelSubscription = false;
  }
};

const createSubscription = async (selectedCardId = null) => {
  // If no card selected and we have payment methods, show selection
  if (!selectedCardId && paymentMethods.value.length > 0) {
    // For now, auto-select the first available card
    selectedCardId = paymentMethods.value[0].id;
    console.log('Auto-selecting card for creation:', selectedCardId);
  }

  if (!selectedCardId) {
    toastRef.value?.showError(
      'Tarjeta Requerida',
      'Necesitas una tarjeta guardada para crear la suscripción',
    );
    return;
  }

  subscriptionActions.value.createSubscription = true;
  try {
    const response = await api.patch(
      `/bakeries/${authStore.getBakeryId}/settings/default`,
      {
        subscription: {
          _action: 'create_subscription',
          savedCardId: selectedCardId,
        },
      },
    );

    await loadSubscriptionData();
    await loadJWTClaims();

    toastRef.value?.showSuccess(
      'Suscripción Creada',
      'La suscripción ha sido creada exitosamente',
    );

    console.log('Subscription created with card:', selectedCardId, response);
  } catch (error) {
    console.error('Error creating subscription:', error);
    toastRef.value?.showError(
      'Error al Crear Suscripción',
      error.message || 'No se pudo crear la suscripción. Intenta nuevamente.',
    );
  } finally {
    subscriptionActions.value.createSubscription = false;
  }
};

const reactivateSubscription = async (selectedCardId = null) => {
  // If no card selected and we have payment methods, show selection
  if (!selectedCardId && paymentMethods.value.length > 0) {
    // For now, auto-select the first available card
    // In a full UI, this would show a selection dialog
    selectedCardId = paymentMethods.value[0].id;
    console.log('Auto-selecting card for reactivation:', selectedCardId);
  }

  if (!selectedCardId) {
    toastRef.value?.showError(
      'Tarjeta Requerida',
      'Necesitas una tarjeta guardada para reactivar la suscripción',
    );
    return;
  }

  subscriptionActions.value.reactivateSubscription = true;
  try {
    const response = await api.patch(
      `/bakeries/${authStore.getBakeryId}/settings/default`,
      {
        subscription: {
          _action: 'reactivate_subscription',
          savedCardId: selectedCardId,
        },
      },
    );

    await loadSubscriptionData();
    await loadJWTClaims();

    toastRef.value?.showSuccess(
      'Suscripción Reactivada',
      'La suscripción ha sido reactivada exitosamente',
    );

    console.log(
      'Subscription reactivated with card:',
      selectedCardId,
      response,
    );
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    toastRef.value?.showError(
      'Error al Reactivar Suscripción',
      error.message ||
        'No se pudo reactivar la suscripción. Intenta nuevamente.',
    );
  } finally {
    subscriptionActions.value.reactivateSubscription = false;
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
      error.message ||
        'No se pudo agregar la tarjeta. Verifica los datos e intenta nuevamente.',
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
const currentOrderFeatures = computed(() => {
  if (!settingsStore.items.length) return {};
  return settingsStore.items[0].features?.order || {};
});

const currentReportsFeatures = computed(() => {
  if (!settingsStore.items.length) return {};
  return settingsStore.items[0].features?.reports || {};
});

const currentUsersFeatures = computed(() => {
  if (!settingsStore.items.length) return {};
  return settingsStore.items[0].features?.users || {};
});

const currentProductsFeatures = computed(() => {
  if (!settingsStore.items.length) return {};
  return settingsStore.items[0].features?.products || {};
});

const currentInvoicingFeatures = computed(() => {
  if (!settingsStore.items.length) return {};
  return settingsStore.items[0].features?.invoicing || {};
});

const currentBranding = computed(() => {
  if (!settingsStore.items.length) return {};
  return settingsStore.items[0].branding || {};
});

// Filter available payment methods to exclude complimentary (always enabled by default)
const configurablePaymentMethods = computed(() => {
  const allMethods = systemSettingsStore.availablePaymentMethods || [];
  return allMethods.filter((method) => method.value !== 'complimentary');
});

// Features form handlers
const initializeFeaturesForm = () => {
  const orderFeatures = currentOrderFeatures.value;
  const reportsFeatures = currentReportsFeatures.value;
  const usersFeatures = currentUsersFeatures.value;
  const productsFeatures = currentProductsFeatures.value;
  const invoicingFeatures = currentInvoicingFeatures.value;

  // Only update if we have valid data and avoid overriding existing values
  const newFormData = { ...featuresFormData.value };

  // Order features
  if (orderFeatures && Object.keys(orderFeatures).length > 0) {
    if (orderFeatures.activePaymentMethods) {
      newFormData.activePaymentMethods = [...orderFeatures.activePaymentMethods];
    }
    if (Object.prototype.hasOwnProperty.call(orderFeatures, 'allowPartialPayment')) {
      newFormData.allowPartialPayment = orderFeatures.allowPartialPayment;
    }
    if (Object.prototype.hasOwnProperty.call(orderFeatures, 'timeOfDay')) {
      newFormData.timeOfDay = orderFeatures.timeOfDay;
    }
    if (Object.prototype.hasOwnProperty.call(orderFeatures, 'offlineMode')) {
      newFormData.offlineMode = orderFeatures.offlineMode;
    }
  }

  // Reports features
  if (reportsFeatures && Object.keys(reportsFeatures).length > 0) {
    if (Object.prototype.hasOwnProperty.call(reportsFeatures, 'defaultReportFilter')) {
      newFormData.defaultReportFilter = reportsFeatures.defaultReportFilter;
    }
    if (Object.prototype.hasOwnProperty.call(reportsFeatures, 'showMultipleReports')) {
      newFormData.showMultipleReports = reportsFeatures.showMultipleReports;
    }
  }

  // Products features
  if (productsFeatures && Object.keys(productsFeatures).length > 0) {
    if (Object.prototype.hasOwnProperty.call(productsFeatures, 'useProductCost')) {
      newFormData.useProductCost = productsFeatures.useProductCost;
    }
  }

  // Invoicing features
  if (invoicingFeatures && Object.keys(invoicingFeatures).length > 0) {
    if (Object.prototype.hasOwnProperty.call(invoicingFeatures, 'defaultTermsAndConditions')) {
      newFormData.defaultTermsAndConditions = invoicingFeatures.defaultTermsAndConditions;
    }
    if (Object.prototype.hasOwnProperty.call(invoicingFeatures, 'taxMode')) {
      newFormData.taxMode = invoicingFeatures.taxMode;
    }
  }

  featuresFormData.value = newFormData;
};

// Branding form initialization - merges bakery entity data with branding data
const initializeBrandingForm = () => {
  const branding = currentBranding.value;
  const bakery = bakeryStore.currentBakery;

  if (branding && Object.keys(branding).length > 0) {
    brandingFormData.value = {
      // Bakery entity fields
      email: bakery?.email || '',
      address: bakery?.address || '',
      phone: bakery?.phone || '',
      legalName: bakery?.legalName || '',
      nationalId: bakery?.nationalId || '',
      // Branding fields
      logos: branding.logos || {
        original: '',
        small: '',
        medium: '',
        large: '',
      },
      primaryColor: branding.primaryColor || '',
      secondaryColor: branding.secondaryColor || '',
    };
  } else if (bakery) {
    // Initialize with bakery data even if branding is not set
    brandingFormData.value = {
      email: bakery.email || '',
      address: bakery.address || '',
      phone: bakery.phone || '',
      legalName: bakery.legalName || '',
      nationalId: bakery.nationalId || '',
      logos: {
        original: '',
        small: '',
        medium: '',
        large: '',
      },
      primaryColor: '',
      secondaryColor: '',
    };
  }
};

// Watch for settings and bakery changes and reinitialize forms
watch(
  () => [settingsStore.items, bakeryStore.currentBakery],
  () => {
    if (settingsStore.items.length > 0 || bakeryStore.currentBakery) {
      initializeFeaturesForm();
      initializeBrandingForm();
    }
  },
  { immediate: true, deep: true },
);

const handleFeaturesSubmit = async (formData) => {
  isFeaturesSaving.value = true;
  try {
    // Preserve existing features and merge with new data
    const currentFeatures = settingsStore.items[0]?.features || {};

    await settingsStore.patch('default', {
      features: {
        ...currentFeatures,
        order: {
          ...(currentFeatures.order || {}),
          activePaymentMethods: formData.activePaymentMethods,
          allowPartialPayment: formData.allowPartialPayment,
          timeOfDay: formData.timeOfDay,
          offlineMode: formData.offlineMode,
        },
        reports: {
          ...(currentFeatures.reports || {}),
          defaultReportFilter: formData.defaultReportFilter,
          showMultipleReports: formData.showMultipleReports,
        },
        products: {
          ...(currentFeatures.products || {}),
          useProductCost: formData.useProductCost,
        },
        invoicing: {
          ...(currentFeatures.invoicing || {}),
          defaultTermsAndConditions: formData.defaultTermsAndConditions || '',
          showProductDescriptions: true,
          showTermsAndConditions: true,
          taxMode: formData.taxMode || 'inclusive',
        },
      },
    });

    // Update local form data after successful save
    featuresFormData.value = { ...formData };

    toastRef.value?.showSuccess(
      'Configuración Guardada',
      'Todas las configuraciones han sido actualizadas exitosamente',
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

const handleBrandingSubmit = async (formData) => {
  isBrandingSaving.value = true;
  let bakeryUpdateSuccess = false;
  let brandingUpdateSuccess = false;

  try {
    // Prepare partial update data (only the fields we're changing)
    const bakeryPatchData = {
      email: formData.email,
      address: formData.address,
      phone: formData.phone,
      legalName: formData.legalName,
      nationalId: formData.nationalId,
    };

    const brandingData = {
      logos: formData.logos,
      primaryColor: formData.primaryColor,
      secondaryColor: formData.secondaryColor,
    };

    // First, patch the bakery entity (partial update)
    try {
      await bakeryStore.patchBakery(authStore.getBakeryId, bakeryPatchData);
      bakeryUpdateSuccess = true;
    } catch (bakeryError) {
      console.error('Error saving bakery data:', bakeryError);
      throw new Error('No se pudo actualizar la información de contacto y legal');
    }

    // Then, update the branding settings
    try {
      await settingsStore.patch('default', {
        branding: brandingData,
      });
      brandingUpdateSuccess = true;
    } catch (brandingError) {
      console.error('Error saving branding data:', brandingError);
      throw new Error('No se pudo actualizar la marca (logos y colores)');
    }

    // Update local form data after successful save
    brandingFormData.value = { ...formData };

    toastRef.value?.showSuccess(
      'Guardado',
      'Toda la información de identidad ha sido actualizada exitosamente',
    );
  } catch (error) {
    console.error('Error saving identity data:', error);

    // Provide specific error message
    let errorMessage = error.message || 'No se pudo guardar la información. Intenta nuevamente.';

    if (bakeryUpdateSuccess && !brandingUpdateSuccess) {
      errorMessage = 'La información de contacto se guardó, pero hubo un error con la marca (logos y colores).';
    }

    toastRef.value?.showError(
      'Error al Guardar',
      errorMessage,
    );
  } finally {
    isBrandingSaving.value = false;
  }
};

const handleBrandingValidationError = (error) => {
  console.error('Branding validation error:', error);

  // Show toast notification based on error type
  if (error.type === 'file-too-large') {
    toastRef.value?.showError(
      'Archivo muy grande',
      `El archivo es muy grande (${error.fileSizeMB} MB). El tamaño máximo permitido es ${error.maxSizeMB} MB.`,
    );
  } else if (error.type === 'invalid-type') {
    toastRef.value?.showError(
      'Tipo de archivo no válido',
      'Por favor selecciona un archivo de imagen válido (JPG, PNG, GIF, WebP).',
    );
  } else {
    toastRef.value?.showError(
      'Error de validación',
      error.message || 'El archivo seleccionado no es válido.',
    );
  }
};
</script>

<template>
  <!-- Bakery Branding Form -->
  <BakeryBrandingForm
    title="Identidad"
    :initial-data="brandingFormData"
    :loading="isBrandingSaving"
    @submit="handleBrandingSubmit"
    @validation-error="handleBrandingValidationError"
  />

  <!-- Bakery Features Form -->
  <BakeryFeaturesForm
    title="Configuración de Características"
    :initial-data="featuresFormData"
    :available-payment-methods="configurablePaymentMethods"
    :loading="isFeaturesSaving"
    @submit="handleFeaturesSubmit"
  />
  <div class="hidden">
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
      <div class="base-card p-6" style="margin-bottom: 1rem">
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

    <!-- Subscription Management -->
    <div class="form-container">
      <h2>Gestión de Suscripción</h2>
      <div class="base-card p-6" style="margin-bottom: 1rem">
        <div v-if="isLoadingSubscription" class="text-center py-8">
          <div
            class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"
          ></div>
          <p class="text-neutral-600">Cargando información de suscripción...</p>
        </div>

        <div v-else class="space-y-6">
          <!-- JWT Claims Section -->
          <div class="border border-neutral-200 rounded-lg p-4 bg-gray-50">
            <h3 class="font-medium text-sm text-gray-800 mb-3">
              Información JWT (Token Claims)
            </h3>
            <div v-if="jwtClaims" class="space-y-2 text-sm">
              <div>
                <span class="font-medium">Role:</span>
                {{ jwtClaims.role || "N/A" }}
              </div>
              <div>
                <span class="font-medium">Bakery ID:</span>
                {{ jwtClaims.bakeryId || "N/A" }}
              </div>
              <div>
                <span class="font-medium">Subscription Status:</span>
                <span
                  :class="{
                    'text-green-600': jwtClaims.subscriptionStatus === 'ACTIVE',
                    'text-blue-600': jwtClaims.subscriptionStatus === 'TRIAL',
                    'text-orange-600':
                      jwtClaims.subscriptionStatus === 'PAYMENT_FAILED',
                    'text-red-600':
                      jwtClaims.subscriptionStatus === 'SUSPENDED',
                    'text-gray-600':
                      jwtClaims.subscriptionStatus === 'CANCELLED',
                  }"
                >
                  {{ jwtClaims.subscriptionStatus || "N/A" }}
                </span>
              </div>
              <div>
                <span class="font-medium">Subscription Tier:</span>
                {{ jwtClaims.subscriptionTier || "N/A" }}
              </div>
            </div>
            <div v-else class="text-sm text-gray-600">
              No se pudieron cargar los claims JWT
            </div>
          </div>

          <!-- No Subscription - Create Subscription Section -->
          <div
            v-if="
              subscriptionData?.status == 'TRIAL' && paymentMethods.length > 0
            "
            class="border border-blue-200 rounded-lg p-4 bg-blue-50"
          >
            <h3 class="font-medium text-sm text-blue-800 mb-3">
              Crear Suscripción
            </h3>
            <p class="text-sm text-blue-700 mb-4">
              No tienes una suscripción activa. Selecciona una tarjeta para
              crear tu suscripción:
            </p>

            <!-- Card Selection for Creation -->
            <div class="space-y-2 mb-4">
              <div
                v-for="card in paymentMethods"
                :key="card.id"
                @click="selectedCardForCreation = card.id"
                class="flex items-center p-3 border rounded-lg cursor-pointer transition-colors"
                :class="{
                  'border-blue-500 bg-blue-100':
                    selectedCardForCreation === card.id,
                  'border-gray-200 hover:border-gray-300':
                    selectedCardForCreation !== card.id,
                }"
              >
                <input
                  type="radio"
                  :value="card.id"
                  v-model="selectedCardForCreation"
                  class="mr-3 text-blue-600"
                />
                <div class="flex items-center space-x-3">
                  <div
                    class="w-8 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center"
                  >
                    <span class="text-white text-xs font-bold">💳</span>
                  </div>
                  <div>
                    <div class="font-medium text-sm">
                      {{ `****-****-****-${card.maskedNumber}` }}
                    </div>
                    <div class="text-xs text-gray-600">
                      {{ card.cardholderName }} • Exp:
                      {{ convertToDisplayFormat(card.expirationDate) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Create Subscription Button -->
            <button
              @click="createSubscription(selectedCardForCreation)"
              :disabled="
                subscriptionActions.createSubscription ||
                !selectedCardForCreation
              "
              class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              :title="
                !selectedCardForCreation
                  ? 'Selecciona una tarjeta para crear la suscripción'
                  : ''
              "
            >
              {{
                subscriptionActions.createSubscription
                  ? "Creando..."
                  : "Crear Suscripción"
              }}
            </button>
          </div>

          <!-- No Subscription - No Cards Available -->
          <div
            v-if="!subscriptionData && paymentMethods.length === 0"
            class="border border-orange-200 rounded-lg p-4 bg-orange-50"
          >
            <h3 class="font-medium text-sm text-orange-800 mb-3">
              Suscripción No Disponible
            </h3>
            <p class="text-sm text-orange-700 mb-2">
              Para crear una suscripción, primero necesitas agregar una tarjeta
              de pago.
            </p>
            <p class="text-sm text-orange-600">
              Usa el formulario de "Agregar Tarjeta de Crédito" arriba para
              continuar.
            </p>
          </div>

          <!-- Subscription Data Section -->
          <div class="border border-neutral-200 rounded-lg p-4">
            <h3 class="font-medium text-sm text-gray-800 mb-3">
              Datos de Suscripción (Backend)
            </h3>
            <div v-if="subscriptionData" class="space-y-2 text-sm">
              <div>
                <span class="font-medium">Status:</span>
                <span
                  :class="{
                    'text-green-600': subscriptionData.status === 'ACTIVE',
                    'text-blue-600': subscriptionData.status === 'TRIAL',
                    'text-orange-600':
                      subscriptionData.status === 'PAYMENT_FAILED',
                    'text-red-600': subscriptionData.status === 'SUSPENDED',
                    'text-gray-600': subscriptionData.status === 'CANCELLED',
                  }"
                >
                  {{ subscriptionData.status }}
                </span>
              </div>
              <div>
                <span class="font-medium">Tier:</span>
                {{ subscriptionData.tier }}
              </div>
              <div v-if="subscriptionData.amount">
                <span class="font-medium">Amount:</span>
                {{ (subscriptionData.amount / 100).toFixed(2) }}
                {{ subscriptionData.currency }}
              </div>
              <div v-if="subscriptionData.subscriptionStartDate">
                <span class="font-medium">Start Date:</span>
                {{
                  new Date(
                    subscriptionData.subscriptionStartDate
                  ).toLocaleDateString()
                }}
              </div>
              <div v-if="subscriptionData.savedCardId">
                <span class="font-medium">Saved Card ID:</span>
                {{ subscriptionData.savedCardId }}
              </div>
              <div v-if="subscriptionData.recurringPaymentId">
                <span class="font-medium">Recurring Payment ID:</span>
                {{ subscriptionData.recurringPaymentId }}
              </div>
              <div>
                <span class="font-medium">Consecutive Failures:</span>
                {{ subscriptionData.consecutiveFailures || 0 }}
              </div>
            </div>
            <div v-else class="text-sm text-gray-600">
              No se encontraron datos de suscripción
            </div>
          </div>

          <!-- Card Selection for Reactivation -->
          <div
            v-if="
              subscriptionData?.status === 'CANCELLED' &&
              paymentMethods.length > 0
            "
            class="border border-neutral-200 rounded-lg p-4 bg-yellow-50"
          >
            <h3 class="font-medium text-sm text-gray-800 mb-3">
              Seleccionar Tarjeta para Reactivación
            </h3>
            <div class="space-y-2">
              <div
                v-for="card in paymentMethods"
                :key="card.id"
                @click="selectedCardForReactivation = card.id"
                class="flex items-center p-3 border rounded-lg cursor-pointer transition-colors"
                :class="{
                  'border-green-500 bg-green-50':
                    selectedCardForReactivation === card.id,
                  'border-gray-200 hover:border-gray-300':
                    selectedCardForReactivation !== card.id,
                }"
              >
                <input
                  type="radio"
                  :value="card.id"
                  v-model="selectedCardForReactivation"
                  class="mr-3 text-green-600"
                />
                <div class="flex items-center space-x-3">
                  <div
                    class="w-8 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center"
                  >
                    <span class="text-white text-xs font-bold">💳</span>
                  </div>
                  <div>
                    <div class="font-medium text-sm">
                      {{ `****-****-****-${card.maskedNumber}` }}
                    </div>
                    <div class="text-xs text-gray-600">
                      {{ card.cardholderName }} • Exp:
                      {{ convertToDisplayFormat(card.expirationDate) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-wrap gap-3">
            <button
              @click="retryPayment"
              :disabled="subscriptionActions.retryPayment"
              class="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {{
                subscriptionActions.retryPayment
                  ? "Reintentando..."
                  : "Reintentar Pago"
              }}
            </button>

            <button
              @click="cancelSubscription"
              :disabled="subscriptionActions.cancelSubscription"
              class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {{
                subscriptionActions.cancelSubscription
                  ? "Cancelando..."
                  : "Cancelar Suscripción"
              }}
            </button>

            <button
              @click="reactivateSubscription(selectedCardForReactivation)"
              :disabled="
                subscriptionActions.reactivateSubscription ||
                (subscriptionData?.status === 'CANCELLED' &&
                  paymentMethods.length > 0 &&
                  !selectedCardForReactivation)
              "
              class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              :title="
                subscriptionData?.status === 'CANCELLED' &&
                paymentMethods.length > 0 &&
                !selectedCardForReactivation
                  ? 'Selecciona una tarjeta para reactivar'
                  : ''
              "
            >
              {{
                subscriptionActions.reactivateSubscription
                  ? "Reactivando..."
                  : "Reactivar Suscripción"
              }}
            </button>

            <button
              @click="loadSubscriptionData"
              :disabled="isLoadingSubscription"
              class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {{ isLoadingSubscription ? "Cargando..." : "Recargar Datos" }}
            </button>

            <button
              @click="loadJWTClaims"
              class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
            >
              Recargar JWT Claims
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Debug Section for Payment Methods Comparison -->
    <div class="form-container">
      <h2>🐛 Debug: Payment Methods Comparison</h2>
      <div class="base-card p-6" style="margin-bottom: 1rem">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Bakery Settings Payment Methods -->
          <div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <h3 class="font-medium text-sm text-blue-800 mb-3">
              Bakery Settings - availablePaymentMethods
            </h3>
            <div class="space-y-2 text-sm">
              <div>
                <strong>Source:</strong>
                settingsStore.items[0].availablePaymentMethods
              </div>
              <div>
                <strong>Length:</strong>
                {{
                  settingsStore.items[0]?.availablePaymentMethods?.length || 0
                }}
              </div>
              <div><strong>Loading:</strong> {{ settingsStore.loading }}</div>
              <div>
                <strong>Error:</strong> {{ settingsStore.error || "None" }}
              </div>
              <div class="mt-3">
                <pre
                  class="text-xs bg-white p-2 rounded border overflow-auto max-h-40"
                  >{{
                    JSON.stringify(
                      settingsStore.items[0]?.availablePaymentMethods || [],
                      null,
                      2
                    )
                  }}</pre
                >
              </div>
            </div>
          </div>

          <!-- System Settings Payment Methods -->
          <div class="border border-green-200 rounded-lg p-4 bg-green-50">
            <h3 class="font-medium text-sm text-green-800 mb-3">
              System Settings - availablePaymentMethods
            </h3>
            <div class="space-y-2 text-sm">
              <div>
                <strong>Source:</strong>
                systemSettingsStore.availablePaymentMethods
              </div>
              <div>
                <strong>Length:</strong>
                {{ systemSettingsStore.availablePaymentMethods?.length || 0 }}
              </div>
              <div>
                <strong>Loading:</strong> {{ systemSettingsStore.loading }}
              </div>
              <div>
                <strong>Error:</strong>
                {{ systemSettingsStore.error || "None" }}
              </div>
              <div class="mt-3">
                <pre
                  class="text-xs bg-white p-2 rounded border overflow-auto max-h-40"
                  >{{
                    JSON.stringify(
                      systemSettingsStore.availablePaymentMethods || [],
                      null,
                      2
                    )
                  }}</pre
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Comparison Result -->
        <div class="mt-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 class="font-medium text-sm text-gray-800 mb-3">
            🔍 Comparison Analysis
          </h3>
          <div class="space-y-2 text-sm">
            <div>
              <strong>Arrays are identical:</strong>
              <span
                :class="{
                  'text-green-600':
                    JSON.stringify(
                      settingsStore.items[0]?.availablePaymentMethods || []
                    ) ===
                    JSON.stringify(
                      systemSettingsStore.availablePaymentMethods || []
                    ),
                  'text-red-600':
                    JSON.stringify(
                      settingsStore.items[0]?.availablePaymentMethods || []
                    ) !==
                    JSON.stringify(
                      systemSettingsStore.availablePaymentMethods || []
                    ),
                }"
              >
                {{
                  JSON.stringify(
                    settingsStore.items[0]?.availablePaymentMethods || []
                  ) ===
                  JSON.stringify(
                    systemSettingsStore.availablePaymentMethods || []
                  )
                    ? "✅ YES"
                    : "❌ NO"
                }}
              </span>
            </div>
            <div>
              <strong>Lengths match:</strong>
              <span
                :class="{
                  'text-green-600':
                    (settingsStore.items[0]?.availablePaymentMethods?.length ||
                      0) ===
                    (systemSettingsStore.availablePaymentMethods?.length || 0),
                  'text-red-600':
                    (settingsStore.items[0]?.availablePaymentMethods?.length ||
                      0) !==
                    (systemSettingsStore.availablePaymentMethods?.length || 0),
                }"
              >
                {{
                  (settingsStore.items[0]?.availablePaymentMethods?.length ||
                    0) ===
                  (systemSettingsStore.availablePaymentMethods?.length || 0)
                    ? "✅ YES"
                    : "❌ NO"
                }}
              </span>
            </div>
            <div>
              <strong>Both loaded:</strong>
              <span
                :class="{
                  'text-green-600':
                    settingsStore.items.length > 0 &&
                    systemSettingsStore.isLoaded,
                  'text-orange-600':
                    settingsStore.items.length === 0 ||
                    !systemSettingsStore.isLoaded,
                }"
              >
                {{
                  settingsStore.items.length > 0 && systemSettingsStore.isLoaded
                    ? "✅ YES"
                    : "⚠️ NO"
                }}
              </span>
            </div>
          </div>
        </div>

        <!-- Refresh Buttons -->
        <div class="mt-4 flex gap-3">
          <button
            @click="settingsStore.fetchById('default')"
            :disabled="settingsStore.loading"
            class="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {{
              settingsStore.loading ? "Loading..." : "Refresh Bakery Settings"
            }}
          </button>
          <button
            @click="systemSettingsStore.fetchSettings()"
            :disabled="systemSettingsStore.loading"
            class="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {{
              systemSettingsStore.loading
                ? "Loading..."
                : "Refresh System Settings"
            }}
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

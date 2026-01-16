<script setup>
import { ref, computed, watch } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import FeatureCard from './FeatureCard.vue';
import RadioFeatureCard from './RadioFeatureCard.vue';
import {
  PhMoney,
  PhDeviceMobile,
  PhCreditCard,
  PhGift,
  PhClock,
  PhCurrencyDollar,
  PhWifiX,
  PhChartBar,
  PhUser,
  PhPackage,
  PhFile,
  PhCircleHalf,
} from '@phosphor-icons/vue';
import BancolombiaIcon from '@/assets/icons/bancolombia.svg';
import DaviviendaIcon from '@/assets/icons/outline_davivenda.svg';

const props = defineProps({
  title: {
    type: String,
    default: 'Configuración de Características',
  },
  initialData: {
    type: Object,
    default: () => ({
      activePaymentMethods: [],
      allowPartialPayment: false,
      timeOfDay: false,
      offlineMode: false,
      // Reports features
      defaultReportFilter: 'dueDate',
      showMultipleReports: false,
      // Products features
      useProductCost: false,
      // Invoicing features
      defaultTermsAndConditions: '',
      taxMode: 'inclusive',
    }),
  },
  availablePaymentMethods: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit']);

const settingsStore = useBakerySettingsStore();
const formData = ref({ ...props.initialData });

// Radio button options for reports
const reportFilterOptions = [
  { value: 'dueDate', label: 'Fecha de Pedido' },
  { value: 'paymentDate', label: 'Fecha de Pago' },
];

// Radio button options for tax mode
const taxModeOptions = [
  { value: 'inclusive', label: 'IVA Incluido' },
  { value: 'exclusive', label: 'IVA Adicional' },
];

// Payment method icon mapping
const paymentIconMap = {
  cash: PhMoney,
  transfer: PhDeviceMobile,
  card: PhCreditCard,
  bancolombia: BancolombiaIcon,
  davivienda: DaviviendaIcon,
  complimentary: PhGift,
  quote: PhFile,
};

// Use the passed available payment methods prop
const availablePaymentMethods = computed(() => {
  return props.availablePaymentMethods || [];
});

// Helper functions for payment method binding
const isPaymentMethodActive = (methodValue) => {
  return formData.value.activePaymentMethods.includes(methodValue);
};

const togglePaymentMethod = (methodValue, isActive) => {
  if (isActive) {
    if (!formData.value.activePaymentMethods.includes(methodValue)) {
      formData.value.activePaymentMethods.push(methodValue);
    }
  } else {
    const index = formData.value.activePaymentMethods.indexOf(methodValue);
    if (index > -1) {
      formData.value.activePaymentMethods.splice(index, 1);
    }
  }
};

// Watch for initialData changes and update form selectively
watch(() => props.initialData, (newData, oldData) => {
  if (newData && newData !== oldData) {
    // Only update fields that have actually changed to prevent overriding user input
    if (JSON.stringify(newData.activePaymentMethods) !== JSON.stringify(formData.value.activePaymentMethods)) {
      formData.value.activePaymentMethods = [...(newData.activePaymentMethods || [])];
    }

    if (Object.prototype.hasOwnProperty.call(newData, 'allowPartialPayment') && newData.allowPartialPayment !== formData.value.allowPartialPayment) {
      formData.value.allowPartialPayment = newData.allowPartialPayment;
    }

    if (Object.prototype.hasOwnProperty.call(newData, 'timeOfDay') && newData.timeOfDay !== formData.value.timeOfDay) {
      formData.value.timeOfDay = newData.timeOfDay;
    }

    if (Object.prototype.hasOwnProperty.call(newData, 'offlineMode') && newData.offlineMode !== formData.value.offlineMode) {
      formData.value.offlineMode = newData.offlineMode;
    }

    // Watch for new features changes
    if (Object.prototype.hasOwnProperty.call(newData, 'defaultReportFilter') && newData.defaultReportFilter !== formData.value.defaultReportFilter) {
      formData.value.defaultReportFilter = newData.defaultReportFilter;
    }

    if (Object.prototype.hasOwnProperty.call(newData, 'showMultipleReports') && newData.showMultipleReports !== formData.value.showMultipleReports) {
      formData.value.showMultipleReports = newData.showMultipleReports;
    }

    if (Object.prototype.hasOwnProperty.call(newData, 'useProductCost') && newData.useProductCost !== formData.value.useProductCost) {
      formData.value.useProductCost = newData.useProductCost;
    }

    if (Object.prototype.hasOwnProperty.call(newData, 'defaultTermsAndConditions') && newData.defaultTermsAndConditions !== formData.value.defaultTermsAndConditions) {
      formData.value.defaultTermsAndConditions = newData.defaultTermsAndConditions;
    }

    if (Object.prototype.hasOwnProperty.call(newData, 'taxMode') && newData.taxMode !== formData.value.taxMode) {
      formData.value.taxMode = newData.taxMode;
    }
  }
}, { deep: true, immediate: true });

// Auto-save with debouncing
let debounceTimer = null;
watch(formData, (newValue) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    emit('submit', newValue);
  }, 2000);
}, { deep: true });
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>

    <div class="base-card">
      <!-- Payment Methods Section -->
      <div class="mb-8">
        <h3 class="text-lg font-semibold text-neutral-900 mb-2">Métodos de Pago</h3>
        <p class="text-sm text-neutral-600 mb-4">
          Selecciona los métodos de pago que acepta tu negocio
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            v-for="method in availablePaymentMethods"
            :key="method.value"
            :model-value="isPaymentMethodActive(method.value)"
            @update:model-value="(value) => togglePaymentMethod(method.value, value)"
            :icon="paymentIconMap[method.value] || PhMoney"
            :title="method.label"
            :disabled="loading"
          />
        </div>
      </div>

      <!-- Additional Order Features -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-2">Características Adicionales</h3>
        <p class="text-sm text-neutral-600 mb-4">
          Configuraciones adicionales para el manejo de pedidos
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FeatureCard
            v-model="formData.allowPartialPayment"
            :icon="PhCircleHalf"
            title="Pagos Parciales"
            description="Permite a los clientes realizar pagos parciales."
            :disabled="loading"
          />

          <FeatureCard
            v-model="formData.timeOfDay"
            :icon="PhClock"
            title="Hora de Entrega"
            description="Mostrar campo para seleccionar hora específica de entrega"
            :disabled="loading"
          />

          <FeatureCard
            v-model="formData.offlineMode"
            :icon="PhWifiX"
            title="Modo Sin Conexión"
            description="Habilita formulario para crear pedidos sin conexión a internet"
            :disabled="loading"
          />
        </div>
      </div>

      <!-- Reports Features Section -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-2">Configuración de Reportes</h3>
        <p class="text-sm text-neutral-600 mb-4">
          Personaliza cómo se muestran y filtran los reportes
        </p>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RadioFeatureCard
            v-model="formData.defaultReportFilter"
            :icon="PhChartBar"
            title="Reporte de Ventas"
            description="Elige qué fecha se usará en los reportes: la fecha en que se tomó el pedido o la fecha en que se recibió el pago."
            :options="reportFilterOptions"
            name="default-report-filter"
            :disabled="loading"
          />

          <FeatureCard
            v-model="formData.showMultipleReports"
            :icon="PhChartBar"
            title="Múltiples Reportes"
            description="Permite alternar entre diferentes reportes desde el panel de ventas"
            :disabled="loading"
          />
        </div>
      </div>

      <!-- Products Features Section -->
      <div class="mb-6 hidden">
        <h3 class="text-lg font-semibold text-neutral-900 mb-2">Configuración de Productos</h3>
        <p class="text-sm text-neutral-600 mb-4">
          Opciones avanzadas para el manejo de productos
        </p>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FeatureCard
            v-model="formData.useProductCost"
            :icon="PhPackage"
            title="Usar Costo de Productos"
            description="Habilita el seguimiento y cálculo de costos de producción"
            :disabled="loading"
          />
        </div>
      </div>

      <!-- Invoice Features Section -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-2">
          Configuración de Facturas / Cotizaciones
        </h3>
        <p class="text-sm text-neutral-600 mb-4">
          Personaliza la información que aparece en tus facturas
        </p>
        <div class="space-y-4">
          <RadioFeatureCard
            v-model="formData.taxMode"
            :icon="PhCurrencyDollar"
            title="Modo de IVA"
            description="Define cómo se calcula el IVA en los pedidos. 'IVA Incluido' significa que el precio ya incluye el impuesto. 'IVA Adicional' significa que el impuesto se suma al precio base."
            :options="taxModeOptions"
            name="tax-mode"
            :disabled="loading"
          />
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1">
              Términos y Condiciones
            </label>
            <textarea
              v-model="formData.defaultTermsAndConditions"
              rows="4"
              class="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ingresa los términos y condiciones que aparecerán en todas las facturas..."
              :disabled="loading"
            />
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

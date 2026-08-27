<script setup>
import { ref, computed, watch } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import FeatureCard from './FeatureCard.vue';
import RadioFeatureCard from './RadioFeatureCard.vue';
import {
  PhMoney,
  PhClock,
  PhCurrencyDollar,
  PhWifiX,
  PhChartBar,
  PhPackage,
  PhCircleHalf,
  PhGpsSlash,
  PhUser,
  PhCalendarBlank,
  PhWarehouse,
  PhCalculator,
} from '@phosphor-icons/vue';
import { paymentIconMap } from '@/utils/paymentIcons';

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
      defaultDate: 'production',
      timeOfDay: false,
      offlineMode: false,
      loadHistoricalOnUserSelection: false,
      // Reports features
      defaultReportFilter: 'dueDate',
      showMultipleReports: false,
      // Products features
      useProductCost: false,
      // Invoicing features
      defaultTermsAndConditions: '',
      taxMode: 'inclusive',
      // POS features
      posAutoMarkPaid: false,
      posDefaultToCurrentDate: false,
      posHideDeliveryOptions: false,
      posAutoSelectClient: false,
      posDefaultClientId: null,
      // Opt-in modules
      inventoryEnabled: false,
      accountingEnabled: false,
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
  systemAdminMode: {
    type: Boolean,
    default: false,
  },
  bakeryId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['dataChanged', 'save']);

const handleSave = () => {
  emit('save', formData.value);
};

const settingsStore = useBakerySettingsStore();
const formData = ref({ ...props.initialData });

// Radio button options for reports
const reportFilterOptions = [
  { value: 'dueDate', label: 'Fecha de Pedido' },
  { value: 'paymentDate', label: 'Fecha de Pago' },
];

// Radio button options for default date
const defaultDateOptions = [
  { value: 'production', label: 'Preparación' },
  { value: 'delivery', label: 'Entrega' },
];

// Radio button options for tax mode
const taxModeOptions = [
  { value: 'inclusive', label: 'IVA Incluido' },
  { value: 'exclusive', label: 'IVA Adicional' },
];

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
  if (!newData || newData === oldData) return;

  // Update only fields that have actually changed to prevent overriding user input
  Object.keys(newData).forEach(key => {
    const newValue = newData[key];
    const currentValue = formData.value[key];

    // Handle arrays specially (like activePaymentMethods)
    if (Array.isArray(newValue)) {
      if (JSON.stringify(newValue) !== JSON.stringify(currentValue)) {
        formData.value[key] = [...newValue];
      }
    }
    // Handle primitives
    else if (newValue !== currentValue) {
      formData.value[key] = newValue;
    }
  });
}, { deep: true, immediate: true });

// Emit data changes - let parent decide what to do
watch(formData, (newValue) => {
  emit('dataChanged', newValue);
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
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FeatureCard
            v-model="formData.allowPartialPayment"
            :icon="PhCircleHalf"
            title="Pagos Parciales"
            description="Permite a los clientes realizar pagos parciales."
            :disabled="loading"
          />

          <RadioFeatureCard
            v-model="formData.defaultDate"
            :icon="PhCalendarBlank"
            title="Tipo de Fecha por Defecto"
            description="En tu flujo de trabajo, ¿te organizas mejor por cuándo produces o cuándo entregas?"
            :options="defaultDateOptions"
            name="default-date"
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

          <FeatureCard
            v-if="systemAdminMode"
            v-model="formData.loadHistoricalOnUserSelection"
            :icon="PhUser"
            title="Cargar Históricos al Seleccionar Usuario"
            description="Carga automáticamente objetos históricos cuando se selecciona un usuario"
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
          Configuración de Recibos / Cotizaciones
        </h3>
        <p class="text-sm text-neutral-600 mb-4">
          Personaliza la información que aparece en tus recibos y cotizaciones.
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
              placeholder="Ingresa los términos y condiciones que aparecerán en todos los recibos y cotizaciones."
              :disabled="loading"
            />
          </div>
        </div>
      </div>

      <!-- POS Configuration Section -->
      <div v-if="systemAdminMode" class="mb-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-2">
          Configuración POS (Punto de Venta)
        </h3>
        <p class="text-sm text-neutral-600 mb-4">
          Configura el modo POS para operaciones de venta directa.
        </p>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FeatureCard
            v-model="formData.posAutoMarkPaid"
            :icon="PhMoney"
            title="Auto-marcar como Pagado"
            description="Marca automáticamente los pedidos como pagados al crearlos"
            :disabled="loading"
          />

          <FeatureCard
            v-model="formData.posDefaultToCurrentDate"
            :icon="PhClock"
            title="Fecha Actual por Defecto"
            description="Usa la fecha actual automáticamente en lugar del selector de fecha"
            :disabled="loading"
          />

          <FeatureCard
            v-model="formData.posHideDeliveryOptions"
            :icon="PhGpsSlash"
            title="Ocultar Opciones de Delivery"
            description="Oculta las secciones de delivery en formularios y navegación"
            :disabled="loading"
          />

          <FeatureCard
            v-model="formData.posAutoSelectClient"
            :icon="PhUser"
            title="Auto-seleccionar Cliente POS"
            description="Crea y selecciona automáticamente el cliente 'Punto de Venta'"
            :disabled="loading"
          />
        </div>
      </div>

      <!-- Modules Section -->
      <div v-if="systemAdminMode" class="mb-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-2">Módulos</h3>
        <p class="text-sm text-neutral-600 mb-4">
          Activa módulos opcionales para este negocio. Desactivados, no aparecen en ninguna parte
          de la aplicación.
        </p>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FeatureCard
            v-model="formData.inventoryEnabled"
            :icon="PhWarehouse"
            title="Inventario"
            description="Recetas, control de stock, conteos y compras"
            :disabled="loading"
          />

          <FeatureCard
            v-model="formData.accountingEnabled"
            :icon="PhCalculator"
            title="Contabilidad"
            description="Costos fijos, gastos, otros ingresos y estado de resultados"
            :disabled="loading"
          />
        </div>
      </div>

      <!-- System Admin Save Button -->
      <div v-if="systemAdminMode" class="mt-6 flex justify-end">
        <button
          @click="handleSave"
          :disabled="loading"
          class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loading ? 'Guardando...' : 'Guardar Configuración' }}
        </button>
      </div>

    </div>
  </div>
</template>

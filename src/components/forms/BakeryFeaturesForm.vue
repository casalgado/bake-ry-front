<script setup>
import { ref, computed, watch } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import FeatureCard from './FeatureCard.vue';
import {
  PhMoney,
  PhDeviceMobile,
  PhCreditCard,
  PhGift,
  PhClock,
  PhCurrencyDollar,
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
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

const settingsStore = useBakerySettingsStore();
const formData = ref({ ...props.initialData });

// Payment method icon mapping
const paymentIconMap = {
  cash: PhMoney,
  transfer: PhDeviceMobile,
  card: PhCreditCard,
  bancolombia: BancolombiaIcon,
  davivienda: DaviviendaIcon,
  complimentary: PhGift,
};

// Computed properties
const availablePaymentMethods = computed(() => {
  if (!settingsStore.items.length) return [];
  return settingsStore.items[0].availablePaymentMethods || [];
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

// Computed properties for button text
const submitButtonText = computed(() => {
  return 'Guardar Cambios';
});

const loadingText = computed(() => {
  return 'Guardando...';
});

const handleSubmit = () => {
  emit('submit', formData.value);
};

const handleCancel = () => {
  // Reset form to initial state
  formData.value = { ...props.initialData };
  // Emit cancel event
  emit('cancel');
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
  }
}, { deep: true, immediate: true });
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>

    <form @submit.prevent="handleSubmit" class="base-card">
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
            :icon="PhCurrencyDollar"
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
        </div>
      </div>

      <!-- Form Buttons -->
      <div class="flex gap-2 justify-end">
        <button type="submit" :disabled="loading" class="action-btn">
          {{ loading ? loadingText : submitButtonText }}
        </button>
        <button
          type="button"
          @click="handleCancel"
          :disabled="loading"
          class="danger-btn"
        >
          Cancelar
        </button>
      </div>
    </form>
  </div>
</template>

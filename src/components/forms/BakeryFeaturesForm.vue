<script setup>
import { ref, computed } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';

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

// Computed properties
const availablePaymentMethods = computed(() => {
  if (!settingsStore.items.length) return [];
  return settingsStore.items[0].availablePaymentMethods || [];
});

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

const handleReset = () => {
  formData.value = { ...props.initialData };
};
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>

    <form @submit.prevent="handleSubmit" class="base-card">
      <!-- Payment Methods Section -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-neutral-700 mb-3">
          Selecciona los métodos de pago que acepta tu negocio:
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
              v-model="formData.activePaymentMethods"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
            />
            <label
              :for="`payment-method-${method.value}`"
              class="ml-2 block text-sm text-neutral-900"
            >
              {{ method.label }}
              <span class="text-neutral-500 text-xs ml-1"
                >({{ method.displayText }})</span
              >
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
              v-model="formData.allowPartialPayment"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
            />
            <label
              for="allow-partial-payment"
              class="ml-2 block text-sm text-neutral-900"
            >
              Permitir Pagos Parciales
              <span class="text-neutral-500 text-xs block"
                >Los pedidos pueden tener pagos parciales antes del pago
                total</span
              >
            </label>
          </div>

          <div class="flex items-center">
            <input
              type="checkbox"
              id="time-of-day"
              v-model="formData.timeOfDay"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
            />
            <label
              for="time-of-day"
              class="ml-2 block text-sm text-neutral-900"
            >
              Hora de Entrega
              <span class="text-neutral-500 text-xs block"
                >Mostrar opción para elegir la hora de entrega
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Form Buttons -->
      <div class="flex gap-2 justify-end">
        <button
          type="button"
          @click="handleReset"
          :disabled="loading"
          class="utility-btn"
        >
          Resetear
        </button>
        <button type="submit" :disabled="loading" class="action-btn">
          {{ loading ? loadingText : submitButtonText }}
        </button>
        <button
          type="button"
          @click="$emit('cancel')"
          :disabled="loading"
          class="utility-btn"
        >
          Cancelar
        </button>
      </div>
    </form>
  </div>
</template>

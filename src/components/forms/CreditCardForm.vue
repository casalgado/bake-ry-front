<script setup>
import { ref, computed, defineProps, defineEmits } from 'vue';
import ToastNotification from '@/components/ToastNotification.vue';

const props = defineProps({
  title: {
    type: String,
    default: 'Agregar Tarjeta de Crédito',
  },
  initialData: {
    type: Object,
    default: () => ({
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      cardholderName: '',
      identificationNumber: '',
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit', 'cancel']);

const formData = ref({ ...props.initialData });
const errors = ref({});
const toastRef = ref(null);

// Format card number input
const formatCardNumber = (event) => {
  const value = event.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
  const formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
  formData.value.cardNumber = formattedValue;
};

// Handle expiry date keydown for backspace behavior
const handleExpiryKeydown = (event) => {
  const input = event.target;
  const cursorPos = input.selectionStart;
  const value = input.value;

  // If backspace is pressed and cursor is right after the slash
  if (event.key === 'Backspace' && cursorPos === 3 && value[2] === '/') {
    event.preventDefault();
    // Remove the last digit (before the slash)
    formData.value.expiryDate = value.slice(0, 1);
  }
};

// Format expiry date input
const formatExpiryDate = (event) => {
  const value = event.target.value.replace(/\D/g, '');

  if (value.length >= 2) {
    formData.value.expiryDate = value.slice(0, 2) + '/' + value.slice(2, 4);
  } else {
    formData.value.expiryDate = value;
  }
};

// Format CVV input (numbers only)
const formatCVV = (event) => {
  const value = event.target.value.replace(/[^0-9]/gi, '');
  formData.value.cvv = value;
};

// Format identification number (numbers only)
const formatIdentification = (event) => {
  const value = event.target.value.replace(/[^0-9]/gi, '');
  formData.value.identificationNumber = value;
};

const validate = () => {
  errors.value = {};

  // Card number validation
  const cleanCardNumber = formData.value.cardNumber.replace(/\s/g, '');
  if (!cleanCardNumber) {
    errors.value.cardNumber = 'El número de tarjeta es requerido';
  } else if (cleanCardNumber.length < 15) {
    errors.value.cardNumber = 'El número de tarjeta debe tener al menos 15 dígitos';
  }

  // Expiry date validation
  if (!formData.value.expiryDate) {
    errors.value.expiryDate = 'La fecha de expiración es requerida';
  } else if (formData.value.expiryDate.length !== 5) {
    errors.value.expiryDate = 'Formato inválido (MM/YY)';
  }

  // CVV validation
  if (!formData.value.cvv) {
    errors.value.cvv = 'El CVV es requerido';
  } else if (formData.value.cvv.length < 3) {
    errors.value.cvv = 'El CVV debe tener al menos 3 dígitos';
  }

  // Cardholder name validation
  if (!formData.value.cardholderName) {
    errors.value.cardholderName = 'El nombre del titular es requerido';
  }

  // Identification number validation
  if (!formData.value.identificationNumber) {
    errors.value.identificationNumber = 'El número de identificación es requerido';
  }

  return Object.keys(errors.value).length === 0;
};

const isValidCard = computed(() => {
  const cleanCardNumber = formData.value.cardNumber.replace(/\s/g, '');
  return cleanCardNumber.length >= 15 &&
         formData.value.expiryDate.length === 5 &&
         formData.value.cvv.length >= 3 &&
         formData.value.cardholderName.length > 0 &&
         formData.value.identificationNumber.length > 0;
});

const handleSubmit = () => {
  if (!validate()) {
    // Show validation error toast
    console.log('Validation errors:', errors.value);
    const firstError = Object.values(errors.value)[0];
    toastRef.value?.showError(
      'Error de Validación',
      firstError || 'Por favor, corrige los errores del formulario',
    );
    return;
  }

  // Clean card number for submission
  const submitData = {
    ...formData.value,
    cardNumber: formData.value.cardNumber.replace(/\s/g, ''),
  };

  emit('submit', submitData);
};

const resetForm = () => {
  // Reset form data
  formData.value = {
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    identificationNumber: '',
  };
  // Clear any validation errors
  errors.value = {};
};

const handleCancel = () => {
  resetForm();
};

// Expose methods to parent component
defineExpose({
  resetForm,
});

// Computed property for submit button text
const submitButtonText = computed(() => {
  return props.loading ? 'Agregando...' : 'Agregar Tarjeta';
});
</script>

<template>
  <div class="form-container">
    <h2>{{ title }}</h2>

    <form @submit.prevent="handleSubmit" class="base-card">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label>Número de Tarjeta</label>
          <input
            v-model="formData.cardNumber"
            @input="formatCardNumber"
            type="text"
            placeholder="1234 5678 9012 3456"
            maxlength="19"
            required
            class="w-full"
          />
          <span v-if="errors.cardNumber" class="text-danger text-sm">{{ errors.cardNumber }}</span>
        </div>

        <div>
          <label>Fecha de Expiración</label>
          <input
            v-model="formData.expiryDate"
            @input="formatExpiryDate"
            @keydown="handleExpiryKeydown"
            type="text"
            placeholder="MM/YY"
            maxlength="5"
            required
            class="w-full"
          />
          <span v-if="errors.expiryDate" class="text-danger text-sm">{{ errors.expiryDate }}</span>
        </div>

        <div>
          <label>CVV</label>
          <input
            v-model="formData.cvv"
            @input="formatCVV"
            type="text"
            placeholder="123"
            maxlength="4"
            required
            class="w-full"
          />
          <span v-if="errors.cvv" class="text-danger text-sm">{{ errors.cvv }}</span>
        </div>

        <div>
          <label>Nombre del Titular</label>
          <input
            v-model="formData.cardholderName"
            type="text"
            placeholder="Juan Pérez"
            required
            class="w-full"
          />
          <span v-if="errors.cardholderName" class="text-danger text-sm">{{ errors.cardholderName }}</span>
        </div>
      </div>

      <div class="mt-4">
        <label>Número de Identificación</label>
        <input
          v-model="formData.identificationNumber"
          @input="formatIdentification"
          type="text"
          placeholder="12345678"
          required
          class="w-full"
        />
        <span v-if="errors.identificationNumber" class="text-danger text-sm">{{ errors.identificationNumber }}</span>
      </div>

      <div class="flex gap-2 justify-end mt-6">
        <button
          type="submit"
          :disabled="loading"
          class="action-btn"
        >
          {{ submitButtonText }}
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

  <!-- Toast Notifications -->
  <ToastNotification ref="toastRef" />
</template>

<style scoped>

</style>

<script setup>
/* Signup: who you are, your business, and how you work. Only the names are
 * required; legal data and contact are optional and editable later in business
 * settings, which also holds the logo and colors (they need a signed-in user to
 * upload).
 *
 * `submit` carries the payload POST /bakeries expects. */
import { ref } from 'vue';
import { formToFeatures, hasChosenPaymentMethod, SIGNUP_FIELDS } from '@/utils/settingsForm';
import OrdersSection from '@/components/settings/OrdersSection.vue';

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit']);

// The catalog behind /system-settings needs a signed-in user, so signup keeps its own list.
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'davivienda', label: 'Davivienda' },
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'bbva', label: 'BBVA' },
  { value: 'nequi', label: 'Nequi' },
];

const MIN_PASSWORD_LENGTH = 6;

const form = ref({
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  bakeryName: '',
  legalName: '',
  nationalId: '',
  address: '',
  bakeryPhone: '',
  activePaymentMethods: ['cash', 'transfer'],
  defaultDate: 'delivery',
  allowPartialPayment: false,
  timeOfDay: false,
});

const errors = ref({});

const validate = () => {
  errors.value = {};
  if (form.value.password.length < MIN_PASSWORD_LENGTH) {
    errors.value.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  if (form.value.password !== form.value.confirmPassword) {
    errors.value.confirmPassword = 'Las contraseñas no coinciden';
  }
  return Object.keys(errors.value).length === 0 && hasChosenPaymentMethod(form.value);
};

const handleSubmit = () => {
  if (!validate()) return;

  const { name, email, phone, password, bakeryName, legalName, nationalId, address, bakeryPhone } = form.value;
  const features = formToFeatures(form.value, SIGNUP_FIELDS);
  // Complimentary is not a choice; the settings screens hide it and keep it on.
  features.order.activePaymentMethods = [...features.order.activePaymentMethods, 'complimentary'];

  // Optional fields are sent only when filled, so an empty box never overwrites a default.
  const optional = { legalName, nationalId, address, phone: bakeryPhone };
  const filled = Object.fromEntries(
    Object.entries(optional).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]),
  );

  emit('submit', {
    user: { name: name.trim(), email: email.trim(), password, ...(phone.trim() && { phone: phone.trim() }) },
    bakery: { name: bakeryName.trim(), ...filled },
    settings: { features },
  });
};
</script>

<template>
  <form
    class="flex flex-col gap-4"
    data-ui-theme="light"
    @submit.prevent="handleSubmit"
  >
    <div class="ui-card flex flex-col gap-3">
      <h2 class="ui-panehead-title">Datos del Emprendedor</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="ui-field">
          <label class="ui-field-k" for="user-name" data-required>Nombre completo</label>
          <input
            id="user-name"
            v-model="form.name"
            type="text"
            class="ui-input"
            autocomplete="name"
            required
            :disabled="loading"
          >
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="user-email" data-required>Email</label>
          <input
            id="user-email"
            v-model="form.email"
            type="email"
            class="ui-input"
            autocomplete="email"
            required
            :disabled="loading"
          >
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="user-password" data-required>Contraseña</label>
          <input
            id="user-password"
            v-model="form.password"
            type="password"
            class="ui-input"
            autocomplete="new-password"
            required
            :aria-invalid="!!errors.password"
            :aria-describedby="errors.password ? 'user-password-e' : undefined"
            :disabled="loading"
          >
          <span v-if="errors.password" id="user-password-e" class="ui-field-error">
            {{ errors.password }}
          </span>
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="user-confirm-password" data-required>Confirmar contraseña</label>
          <input
            id="user-confirm-password"
            v-model="form.confirmPassword"
            type="password"
            class="ui-input"
            autocomplete="new-password"
            required
            :aria-invalid="!!errors.confirmPassword"
            :aria-describedby="errors.confirmPassword ? 'user-confirm-password-e' : undefined"
            :disabled="loading"
          >
          <span v-if="errors.confirmPassword" id="user-confirm-password-e" class="ui-field-error">
            {{ errors.confirmPassword }}
          </span>
        </div>

        <div class="ui-field md:col-span-2">
          <label class="ui-field-k" for="user-phone">Teléfono (opcional)</label>
          <input
            id="user-phone"
            v-model="form.phone"
            type="tel"
            class="ui-input"
            autocomplete="tel"
            placeholder="3001234567"
            :disabled="loading"
          >
        </div>
      </div>
    </div>

    <div class="ui-card flex flex-col gap-3">
      <h2 class="ui-panehead-title">Información del Emprendimiento</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="ui-field">
          <label class="ui-field-k" for="bakery-name" data-required>Nombre</label>
          <input
            id="bakery-name"
            v-model="form.bakeryName"
            type="text"
            class="ui-input"
            autocomplete="organization"
            required
            :disabled="loading"
          >
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="bakery-legal-name">Razón social (opcional)</label>
          <input
            id="bakery-legal-name"
            v-model="form.legalName"
            type="text"
            class="ui-input"
            aria-describedby="bakery-legal-name-h"
            :disabled="loading"
          >
          <span id="bakery-legal-name-h" class="ui-field-hint">
            Si eres persona natural, tu nombre completo.
          </span>
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="bakery-national-id">NIT (opcional)</label>
          <input
            id="bakery-national-id"
            v-model="form.nationalId"
            type="text"
            class="ui-input"
            :disabled="loading"
          >
        </div>

        <div class="ui-field">
          <label class="ui-field-k" for="bakery-phone">Teléfono del negocio (opcional)</label>
          <input
            id="bakery-phone"
            v-model="form.bakeryPhone"
            type="tel"
            class="ui-input"
            autocomplete="off"
            placeholder="3001234567"
            :disabled="loading"
          >
        </div>

        <div class="ui-field md:col-span-2">
          <label class="ui-field-k" for="bakery-address">Dirección (opcional)</label>
          <input
            id="bakery-address"
            v-model="form.address"
            type="text"
            class="ui-input"
            autocomplete="street-address"
            placeholder="Calle 123 #45-67, Bogotá"
            :disabled="loading"
          >
        </div>
      </div>
    </div>

    <div class="ui-card flex flex-col gap-3">
      <h2 class="ui-panehead-title">Cómo trabajas</h2>

      <OrdersSection v-model="form" :payment-methods="PAYMENT_METHODS" :disabled="loading" />

      <p class="ui-field-hint">Puedes cambiar esto después en Configuración.</p>
    </div>

    <div class="flex justify-center">
      <button
        type="submit"
        class="ui-btn ui-btn-solid px-8"
        :disabled="loading || !hasChosenPaymentMethod(form)"
      >
        {{ loading ? 'Comenzando...' : 'Comenzar' }}
      </button>
    </div>
  </form>
</template>

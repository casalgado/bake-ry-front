<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { PhMoney, PhDeviceMobile, PhCreditCard, PhGift, PhClock, PhCurrencyDollar } from '@phosphor-icons/vue';
import BancolombiaIcon from '@/assets/icons/bancolombia.svg';
import DaviviendaIcon from '@/assets/icons/outline_davivenda.svg';
import FeatureCard from '@/components/forms/FeatureCard.vue';
import RadioButtonGroup from '@/components/forms/RadioButtonGroup.vue';

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      user: {
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
      },
      bakery: {
        name: '',
        address: '',
        socialMedia: {
          instagram: '',
          facebook: '',
          whatsapp: '',
          website: '',
        },
      },
      settings: {
        features: {
          order: {
            activePaymentMethods: ['cash', 'transfer', 'complimentary'],
            allowPartialPayment: false,
            defaultDate: 'production',
            timeOfDay: false,
          },
        },
      },
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit']);

// Form state
const formData = ref({ ...props.initialData });
const errors = ref({});

// Payment methods configuration
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'davivienda', label: 'Davivienda' },
  { value: 'bancolombia', label: 'Bancolombia' },
];

const paymentIconMap = {
  cash: PhMoney,
  transfer: PhDeviceMobile,
  card: PhCreditCard,
  bancolombia: BancolombiaIcon,
  davivienda: DaviviendaIcon,
  complimentary: PhGift,
};

const defaultDateOptions = [
  { value: 'production', label: 'Fecha de Producción' },
  { value: 'delivery', label: 'Fecha de Entrega' },
];

// Payment method helpers
const isPaymentMethodActive = (methodValue) => {
  return formData.value.settings.features.order.activePaymentMethods.includes(methodValue);
};

const togglePaymentMethod = (methodValue, isActive) => {
  const activePaymentMethods = formData.value.settings.features.order.activePaymentMethods;
  if (isActive) {
    if (!activePaymentMethods.includes(methodValue)) {
      activePaymentMethods.push(methodValue);
    }
  } else {
    const index = activePaymentMethods.indexOf(methodValue);
    if (index > -1) {
      activePaymentMethods.splice(index, 1);
    }
  }
};

// Validation
const validateUserSection = () => {
  const userErrors = {};
  const user = formData.value.user;

  if (!user.name.trim()) {
    userErrors.name = 'El nombre es requerido';
  }

  if (!user.email.trim()) {
    userErrors.email = 'El email es requerido';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    userErrors.email = 'El formato del email no es válido';
  }

  if (!user.password) {
    userErrors.password = 'La contraseña es requerida';
  } else if (user.password.length < 6) {
    userErrors.password = 'La contraseña debe tener al menos 6 caracteres';
  }

  if (user.password !== user.confirmPassword) {
    userErrors.confirmPassword = 'Las contraseñas no coinciden';
  }

  return userErrors;
};

const validateBakerySection = () => {
  const bakeryErrors = {};
  const bakery = formData.value.bakery;

  if (!bakery.name.trim()) {
    bakeryErrors.name = 'El nombre de la panadería es requerido';
  }

  // Validate social media URLs if provided
  if (bakery.socialMedia.website && !isValidUrl(bakery.socialMedia.website)) {
    bakeryErrors.website = 'El formato de la URL no es válido';
  }

  return bakeryErrors;
};

const validateFeaturesSection = () => {
  const featuresErrors = {};
  const features = formData.value.settings.features.order;

  if (features.activePaymentMethods.length === 0) {
    featuresErrors.activePaymentMethods = 'Debe seleccionar al menos un método de pago';
  }

  return featuresErrors;
};

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

const validate = () => {
  errors.value = {
    ...validateUserSection(),
    ...validateBakerySection(),
    ...validateFeaturesSection(),
  };

  return Object.keys(errors.value).length === 0;
};

const scrollToError = async () => {
  await nextTick(); // Wait for the DOM to update
  console.log('Scrolling to error');
  // Add a small delay to ensure error elements are rendered
  setTimeout(() => {
    const firstErrorElement = document.querySelector('.text-danger');
    if (firstErrorElement) {
      firstErrorElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, 50);
};

// Form submission
const handleSubmit = async (event) => {
  event.preventDefault(); // Prevent default browser validation

  if (!validate()) {
    scrollToError();
    return;
  }

  emit('submit', formData.value);
};

// Clear errors when user types
const clearFieldError = (fieldName) => {
  if (errors.value[fieldName]) {
    delete errors.value[fieldName];
  }
};

onMounted(() => {
  // Focus on first input
  const firstInput = document.querySelector('input[type="text"]');
  if (firstInput) {
    firstInput.focus();
  }
});
</script>

<template>
  <form @submit="handleSubmit" class="space-y-6 flex flex-col items-center">
    <!-- User Information Section -->
    <div class="form-container">
      <h2>Datos del Gerente</h2>
      <div class="base-card flex flex-col gap-2">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label for="user-name">Nombre Completo</label>
            <input
              id="user-name"
              type="text"
              v-model="formData.user.name"
              @input="clearFieldError('name')"
              :disabled="loading"
              class="w-full focus:border-primary focus:ring-1 focus:ring-primary"

            />
            <span v-if="errors.name" class="text-danger text-[10px]">{{ errors.name }}</span>
          </div>

          <div>
            <label for="user-email">Email</label>
            <input
              id="user-email"
              type="email"
              v-model="formData.user.email"
              @input="clearFieldError('email')"
              :disabled="loading"
              class="w-full focus:border-primary focus:ring-1 focus:ring-primary"

            />
            <span v-if="errors.email" class="text-danger text-[10px]">{{ errors.email }}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label for="user-password">Contraseña</label>
            <input
              id="user-password"
              type="password"
              v-model="formData.user.password"
              @input="clearFieldError('password')"
              :disabled="loading"
              class="w-full focus:border-primary focus:ring-1 focus:ring-primary"

            />
            <span v-if="errors.password" class="text-danger text-[10px]">{{ errors.password }}</span>
          </div>

          <div>
            <label for="user-confirm-password">Confirmar Contraseña</label>
            <input
              id="user-confirm-password"
              type="password"
              v-model="formData.user.confirmPassword"
              @input="clearFieldError('confirmPassword')"
              :disabled="loading"
              class="w-full focus:border-primary focus:ring-1 focus:ring-primary"

            />
            <span v-if="errors.confirmPassword" class="text-danger text-[10px]">{{ errors.confirmPassword }}</span>
          </div>
        </div>

        <div>
          <label for="user-phone">Teléfono (opcional)</label>
          <input
            id="user-phone"
            type="tel"
            v-model="formData.user.phone"
            :disabled="loading"
            class="w-full focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="3001234567"
          />
        </div>
      </div>
    </div>

    <!-- Bakery Information Section -->
    <div class="form-container">
      <h2>Información del Emprendimiento</h2>
      <div class="base-card flex flex-col gap-2">
        <div>
          <label for="bakery-name">Nombre</label>
          <input
            id="bakery-name"
            type="text"
            v-model="formData.bakery.name"
            @input="clearFieldError('name')"
            :disabled="loading"
            class="w-full focus:border-primary focus:ring-1 focus:ring-primary"

          />
          <span v-if="errors.name && errors.name.includes('panadería')" class="text-danger text-[10px]">{{ errors.name }}</span>
        </div>

        <div>
          <label for="bakery-address">Dirección (opcional)</label>
          <input
            id="bakery-address"
            type="text"
            v-model="formData.bakery.address"
            :disabled="loading"
            class="w-full focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Calle 123 #45-67, Bogotá"
          />
        </div>

        <!-- Social Media Section -->
        <div class="mt-4">
          <h3 class="text-lg font-semibold text-neutral-900 mb-4">Redes Sociales (opcional)</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label for="instagram">Instagram</label>
              <input
                id="instagram"
                type="text"
                v-model="formData.bakery.socialMedia.instagram"
                :disabled="loading"
                class="w-full focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="@mipanaderia"
              />
            </div>

            <div>
              <label for="facebook">Facebook</label>
              <input
                id="facebook"
                type="text"
                v-model="formData.bakery.socialMedia.facebook"
                :disabled="loading"
                class="w-full focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Mi Panadería"
              />
            </div>

            <div>
              <label for="whatsapp">WhatsApp</label>
              <input
                id="whatsapp"
                type="tel"
                v-model="formData.bakery.socialMedia.whatsapp"
                :disabled="loading"
                class="w-full focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="3001234567"
              />
            </div>

            <div>
              <label for="website">Sitio Web</label>
              <input
                id="website"
                type="url"
                v-model="formData.bakery.socialMedia.website"
                @input="clearFieldError('website')"
                :disabled="loading"
                class="w-full focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="https://mipanaderia.com"
              />
              <span v-if="errors.website" class="text-danger text-[10px]">{{ errors.website }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Features Configuration Section -->
    <div class="form-container">
      <h2>Personaliza la Experiencia</h2>
      <div class="base-card">
        <!-- Payment Methods Section -->
        <div class="mb-8">
          <h3 class="text-lg font-semibold text-neutral-900 mb-2">Métodos de Pago</h3>
          <p class="text-sm text-neutral-600 mb-4">
            Selecciona los métodos de pago que acepta tu negocio
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              v-for="method in PAYMENT_METHODS"
              :key="method.value"
              :model-value="isPaymentMethodActive(method.value)"
              @update:model-value="(value) => togglePaymentMethod(method.value, value)"
              :icon="paymentIconMap[method.value] || PhMoney"
              :title="method.label"
              :disabled="loading"
            />
          </div>
          <span v-if="errors.activePaymentMethods" class="text-danger text-[10px] block mt-2">
            {{ errors.activePaymentMethods }}
          </span>
        </div>

        <!-- Additional Order Features -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-neutral-900 mb-2">Características Adicionales</h3>
          <p class="text-sm text-neutral-600 mb-4">
            Configuraciones adicionales para el manejo de pedidos
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <FeatureCard
              v-model="formData.settings.features.order.allowPartialPayment"
              :icon="PhCurrencyDollar"
              title="Pagos Parciales"
              description="Permite a los clientes realizar pagos parciales."
              :disabled="loading"
            />

            <FeatureCard
              v-model="formData.settings.features.order.timeOfDay"
              :icon="PhClock"
              title="Hora de Entrega"
              description="Mostrar campo para seleccionar hora específica de entrega"
              :disabled="loading"
            />
          </div>

          <!-- Default Date Type -->
          <div class="mt-6">
            <RadioButtonGroup
              v-model="formData.settings.features.order.defaultDate"
              :options="defaultDateOptions"
              name="default-date"
              label="Tipo de Fecha por Defecto"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Submit Button -->
    <div class="flex justify-center">
      <button
        type="submit"
        :disabled="loading"
        class="action-btn px-8 py-3 text-lg"
      >
        {{ loading ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>
  </form>
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

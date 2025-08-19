<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { PhGraph, PhPackage, PhUser, PhUsers } from '@phosphor-icons/vue';
import { BakeryService } from '@/services/bakeryService';
import { useAuthenticationStore } from '@/stores/authentication';
import { auth } from '@/config/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import BakeryForm from '@/components/forms/BakeryForm.vue';
import ToastNotification from '@/components/ToastNotification.vue';

const router = useRouter();
const authStore = useAuthenticationStore();

const loading = ref(false);
const globalError = ref('');
const toastRef = ref(null);
const showOverlay = ref(false);
const overlayOpacity = ref(0);
const showWelcome = ref(false);

// Success animation sequence
const handleSuccessAnimation = async () => {
  // 1. Show overlay as transparent
  showOverlay.value = true;
  overlayOpacity.value = 0;

  // 2. Scroll to top smoothly within the main content container
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 3. Wait a moment for scroll, then make overlay opaque
  setTimeout(() => {
    overlayOpacity.value = 1;

    // 4. Show success toast
    toastRef.value?.showSuccess('Emprendimiento Creado con Éxito');

    // 5. After overlay is fully opaque, show welcome screen
    setTimeout(() => {
      showWelcome.value = true;
    }, 1000);
  }, 500); // Wait 500ms for smooth scroll to complete
};

// Form submission
const handleFormSubmit = async (formData) => {
  globalError.value = '';
  loading.value = true;

  try {
    // Build payload
    const payload = {
      user: {
        name: formData.user.name,
        email: formData.user.email,
        password: formData.user.password,
      },
      bakery: {
        name: formData.bakery.name,
      },
      settings: {
        features: {
          order: {
            activePaymentMethods: formData.settings.features.order.activePaymentMethods,
            allowPartialPayment: formData.settings.features.order.allowPartialPayment,
            defaultDate: formData.settings.features.order.defaultDate,
            timeOfDay: formData.settings.features.order.timeOfDay,
          },
        },
      },
    };

    // Add optional user fields
    if (formData.user.phone.trim()) {
      payload.user.phone = formData.user.phone;
    }

    // Add optional bakery fields
    if (formData.bakery.address.trim()) {
      payload.bakery.address = formData.bakery.address;
    }

    // Add social media if any provided
    const socialMedia = {};
    if (formData.bakery.socialMedia.instagram.trim()) {
      socialMedia.instagram = formData.bakery.socialMedia.instagram;
    }
    if (formData.bakery.socialMedia.facebook.trim()) {
      socialMedia.facebook = formData.bakery.socialMedia.facebook;
    }
    if (formData.bakery.socialMedia.whatsapp.trim()) {
      socialMedia.whatsapp = formData.bakery.socialMedia.whatsapp;
    }
    if (formData.bakery.socialMedia.website.trim()) {
      socialMedia.website = formData.bakery.socialMedia.website;
    }

    if (Object.keys(socialMedia).length > 0) {
      payload.bakery.socialMedia = socialMedia;
    }

    // Call API
    const result = await BakeryService.createBakeryWithUser(payload);

    console.log('Bakery created successfully:', result);

    // Log in user with custom token
    const userCredential = await signInWithCustomToken(auth, result.customToken);

    console.log(userCredential);
    // Update auth store state

    // Trigger success animation sequence
    await handleSuccessAnimation();

  } catch (error) {
    console.error('Failed to create bakery:', error);
    globalError.value = error.message || 'Error al crear la panadería. Intenta nuevamente.';

    // Scroll to top to show error within the main content container
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }

    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-[90vh] flex items-center justify-center px-4 py-8 relative">
    <div class="w-full max-w-4xl">
      <!-- Logo and Header -->
      <div class="text-center mb-8">
        <PhGraph class="mx-auto w-16 h-16 text-neutral-800 mb-4" weight="light" />
        <h1 class="text-3xl font-bold text-neutral-800">Un Nuevo Comienzo</h1>
        <p class="text-neutral-600 mt-2">Registra y configura tu negocio</p>
      </div>

      <!-- Global Error Alert -->
      <div
        v-if="globalError"
        class="bg-danger/10 border border-danger/20 text-danger p-4 rounded-md text-sm mb-6"
      >
        {{ globalError }}
      </div>

      <!-- Bakery Form Component -->
      <div class="form-wrapper">
        <BakeryForm
          :loading="loading"
          @submit="handleFormSubmit"
        />
      </div>

      <!-- Login Link -->
      <div class="text-center text-sm text-neutral-600 mt-6">
        ¿Ya tienes una cuenta?
        <router-link to="/login" class="text-primary hover:text-primary-600 font-medium">
          Inicia sesión
        </router-link>
      </div>
    </div>

    <!-- Success Overlay - covers entire view -->
    <div
      v-if="showOverlay"
      class="fixed inset-0 bg-neutral-100 transition-opacity duration-1000 ease-in-out flex items-center justify-center z-50"
      :style="{ opacity: overlayOpacity }"
    >
      <!-- Loading State -->
      <div v-if="!showWelcome" class="text-center">
        <PhGraph class="hidden mx-auto w-16 h-16 text-primary mb-4 animate-pulse" weight="light" />
        <p class="hidden text-neutral-600">Creando tu emprendimiento...</p>
      </div>

      <!-- Welcome Screen -->
      <div v-else class="w-full max-w-4xl px-4">
        <div class="text-center mb-8">
          <PhGraph class="mx-auto w-20 h-20 text-primary mb-6" weight="light" />
          <h1 class="text-3xl font-bold text-neutral-800 mb-4">¡Bienvenido!</h1>
          <p class="text-lg text-neutral-600 mb-2">Tu emprendimiento ha sido creado con éxito</p>
          <p class="text-neutral-500">¿Qué te gustaría hacer primero?</p>
        </div>

        <!-- Action Cards -->
        <div class="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <!-- Create Product Card -->
          <router-link
            to="/dashboard/products/create"
            class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6 hover:shadow-md transition-shadow duration-200 group text-center"
          >
            <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhPackage class="w-6 h-6 text-primary" weight="bold" />
            </div>
            <h3 class="text-lg font-semibold text-neutral-800 mb-2">Crear Producto</h3>
            <p class="text-sm text-neutral-600">Comienza agregando tus primeros productos al catálogo</p>
          </router-link>

          <!-- Create Client Card -->
          <router-link
            to="/dashboard/users/create-client"
            class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6 hover:shadow-md transition-shadow duration-200 group text-center"
          >
            <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhUser class="w-6 h-6 text-primary" weight="bold" />
            </div>
            <h3 class="text-lg font-semibold text-neutral-800 mb-2">Agregar Cliente</h3>
            <p class="text-sm text-neutral-600">Registra tu primer cliente para comenzar a recibir pedidos</p>
          </router-link>

          <!-- Create Staff Card -->
          <router-link
            to="/dashboard/users/create-staff"
            class="bg-white rounded-lg shadow-sm border border-neutral-200 p-6 hover:shadow-md transition-shadow duration-200 group text-center"
          >
            <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhUsers class="w-6 h-6 text-primary" weight="bold" />
            </div>
            <h3 class="text-lg font-semibold text-neutral-800 mb-2">Invitar Equipo</h3>
            <p class="text-sm text-neutral-600">Invita miembros de tu equipo para colaborar</p>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <ToastNotification ref="toastRef" />
  </div>
</template>

<style scoped lang="scss">
* {
  &::-webkit-scrollbar {
    display: none;
  }

  -ms-overflow-style: none;
  scrollbar-width: none;
}

.animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}
</style>

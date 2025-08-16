<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { PhGraph } from '@phosphor-icons/vue';
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
const formOpacity = ref(1);
const isFormVisible = ref(true);

// Success animation sequence
const handleSuccessAnimation = async () => {
  // 1. Immediately reduce form opacity to 80%
  formOpacity.value = 0.8;

  // 2. Scroll to top smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 3. Wait a moment for scroll, then fade out form completely
  setTimeout(() => {
    formOpacity.value = 0;

    // 4. Show success toast
    toastRef.value?.showSuccess('Emprendimiento Creado con Éxito');

    // 5. After 1 second fade duration, redirect to dashboard
    setTimeout(() => {
      router.push('/dashboard/orders');
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
    await authStore.checkAuth();

    // Trigger success animation sequence
    await handleSuccessAnimation();

  } catch (error) {
    console.error('Failed to create bakery:', error);
    globalError.value = error.message || 'Error al crear la panadería. Intenta nuevamente.';

    // Scroll to top to show error
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-[90vh] flex items-center justify-center px-4 py-8">
    <div class="w-full max-w-4xl">
      <!-- Logo and Header -->
      <div class="text-center mb-8">
        <PhGraph class="mx-auto w-16 h-16 text-neutral-800 mb-4" weight="light" />
        <h1 class="text-3xl font-bold text-neutral-800">Un Nuevo Comienzo.</h1>
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
      <div
        class="form-wrapper"
        :style="{ opacity: formOpacity }"
      >
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

.form-wrapper {
  transition: opacity 0.5s ease-in-out;
}
</style>

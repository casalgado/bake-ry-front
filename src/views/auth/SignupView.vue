<script setup>
/**
 * This method is currently used only to create bakery_admin users.
 * Customer and staff accounts will be created by the bakery_admin user.
 */

import { ref } from 'vue';
import { useAuthenticationStore } from '../../stores/authentication';
import { useRouter } from 'vue-router';
import { PhGraph } from '@phosphor-icons/vue';

const router = useRouter();
const authStore = useAuthenticationStore();

const form = ref({
  email: '',
  password: '',
  confirmPassword: '',
  name: '',
});

const error = ref('');

const validateForm = () => {
  error.value = '';

  if (!form.value.email || !form.value.password || !form.value.name) {
    error.value = 'Por favor completa todos los campos';
    return false;
  }

  if (form.value.password !== form.value.confirmPassword) {
    error.value = 'Las contraseñas no coinciden';
    return false;
  }

  if (form.value.password.length < 6) {
    error.value = 'La contraseña debe tener al menos 6 caracteres';
    return false;
  }

  return true;
};

const handleRegister = async () => {
  if (!validateForm()) return;

  try {
    await authStore.register({
      email: form.value.email,
      password: form.value.password,
      name: form.value.name,
      role: 'bakery_admin',
    });
    router.push('/dashboard/orders');
  } catch (err) {
    error.value = err.message;
  }
};
</script>

<template>
  <div class="min-h-[90vh] flex items-center justify-center px-4">
    <div class="base-card w-full max-w-md p-8">
      <!-- Logo and Header -->
      <div class="text-center mb-8">
        <PhGraph class="mx-auto w-16 h-16 text-neutral-800 mb-4" weight="light" />
        <h1 class="text-3xl font-bold text-neutral-800">Crear cuenta</h1>
        <p class="text-neutral-600 mt-2">Registra tu panadería</p>
      </div>

      <form @submit.prevent="handleRegister" class="space-y-2 form-container w-full">
        <!-- Error Alerts -->
        <div
          v-if="error || authStore.error"
          class="bg-danger/10 border border-danger/20 text-danger p-3 rounded-md text-sm"
        >
          {{ error || authStore.error }}
        </div>

        <!-- Name Field -->
        <div>
          <label for="name" class="block mb-1">Nombre</label>
          <input
            type="text"
            v-model="form.name"
            id="name"
            required
            autocomplete="name"
            :disabled="authStore.loading"
            class="focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <!-- Email Field -->
        <div>
          <label for="email" class="block mb-1">Email</label>
          <input
            type="email"
            v-model="form.email"
            id="email"
            required
            autocomplete="email"
            :disabled="authStore.loading"
            class="focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <!-- Password Field -->
        <div>
          <label for="password" class="block mb-1">Contraseña</label>
          <input
            type="password"
            v-model="form.password"
            id="password"
            required
            :disabled="authStore.loading"
            class="focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <!-- Confirm Password Field -->
        <div>
          <label for="confirmPassword" class="block mb-1">Confirmar contraseña</label>
          <input
            type="password"
            v-model="form.confirmPassword"
            id="confirmPassword"
            required
            :disabled="authStore.loading"
            class="focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="action-btn w-full py-2.5 text-base transition-colors"
          :disabled="authStore.loading"
        >
          {{ authStore.loading ? "Creando cuenta..." : "Crear cuenta" }}
        </button>

        <!-- Login Link -->
        <div class="text-center text-sm text-neutral-600">
          ¿Ya tienes una cuenta?
          <router-link to="/login" class="text-primary hover:text-primary-600 font-medium">
            Inicia sesión
          </router-link>
        </div>
      </form>
    </div>
  </div>
</template>

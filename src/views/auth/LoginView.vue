<script setup>
import { ref } from 'vue';
import { useAuthenticationStore } from '../../stores/authentication';
import { useRouter } from 'vue-router';
import { PhGraph } from '@phosphor-icons/vue';

const authStore = useAuthenticationStore();
const router = useRouter();
const loading = ref(false);

const email = ref('');
const password = ref('');

const handleLogin = async () => {
  loading.value = true;
  try {
    await authStore.login({
      email: email.value,
      password: password.value,
    });

    // Get user role and route accordingly
    const userData = authStore.getUserData;
    if (userData?.role === 'delivery_assistant') {
      router.push('/driver/orders');
    } else {
      router.push('/dashboard/orders');
    }
  } catch (error) {
    console.error('Login failed:', error);
  } finally {
    loading.value = false;
  }

};
</script>

<template>
  <div class="min-h-[90vh] flex items-center justify-center px-4" :class="{ 'opacity-50': loading }">
    <div class="base-card w-full max-w-md p-8">
      <!-- Logo and Header -->
      <div class="text-center mb-8">
        <PhGraph class="mx-auto w-16 h-16 text-neutral-800 mb-4" weight="light" />
        <h1 class="text-3xl font-bold text-neutral-800">Bienvenido de nuevo</h1>
        <p class="text-neutral-600 mt-2">Inicia sesión en tu cuenta</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6 form-container w-full">
        <!-- Error Alert -->
        <div
          v-if="authStore.error"
          class="bg-danger/10 border border-danger/20 text-danger p-3 rounded-md text-sm"
        >
          {{ authStore.error }}
        </div>

        <!-- Email Field -->
        <div >
          <label for="email" class="block mb-1">Email</label>
          <input
            v-model="email"
            type="email"
            id="email"
            required
            autocomplete="email"
            :disabled="authStore.loading"
            class="focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <!-- Password Field -->
        <div >
          <label for="password" class="block mb-1">Contraseña</label>
          <input
            v-model="password"
            type="password"
            id="password"
            required
            autocomplete="current-password"
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
          {{ authStore.loading || loading ? 'Iniciando sesión...' : 'Iniciar sesión' }}
        </button>
      </form>
    </div>
  </div>
</template>

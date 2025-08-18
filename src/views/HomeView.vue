<script setup>
import { ref } from 'vue';
import { useAuthenticationStore } from '../stores/authentication';
import { useBakeryStore } from '../stores/bakeryStore';
import { PhGraph } from '@phosphor-icons/vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const authStore = useAuthenticationStore();
const bakeryStore = useBakeryStore();

const handleLogin = () => {
  router.push('/login');
};
</script>

<template>
  <div class="min-h-[90vh] flex items-center justify-center px-4">
    <div class="base-card w-full max-w-2xl p-8">
      <!-- Logo and Header -->
      <div class="text-center mb-8">
        <PhGraph class="mx-auto w-16 h-16 text-neutral-800 mb-4" weight="light" />
        <h1 class="text-3xl font-bold text-neutral-800">M.A.D.</h1>
        <p class="text-neutral-600 mt-2">Mente Administrativa Digital</p>
      </div>

      <!-- Info Cards Container -->
      <div class="space-y-6">
        <!-- Authentication Status Card -->

        <div class="space-y-2">
          <!-- Login Button -->
          <button
            v-if="!authStore.isLoggedIn"
            @click="handleLogin"
            class="action-btn w-full text-base transition-colors"
          >
            Iniciar sesión
          </button>
          <button
            v-if="authStore.isLoggedIn"
            @click="router.push('/dashboard/orders')"
            class="action-btn w-full text-base transition-colors"
          >
            Entrar
          </button>
        </div>

        <!-- <div v-if="!authStore.isLoggedIn" class="text-sm text-center text-neutral-600">
          ¿No tienes una cuenta?
          <RouterLink to="/signup" class="text-primary hover:text-primary-600 font-medium">
            Regístrate aquí
          </RouterLink>
        </div> -->
      </div>
    </div>
  </div>
</template>

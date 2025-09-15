<script setup>
import { RouterLink } from 'vue-router';
import { useAuthenticationStore } from '@/stores/authentication';
import { PhGraph, PhGear } from '@phosphor-icons/vue';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const authStore = useAuthenticationStore();

const isUsingEmulator = import.meta.env.VITE_USE_AUTH_EMULATOR === 'true';

const headerBackgroundClass = computed(() => {
  return isUsingEmulator ? 'bg-blue-400 border-blue-500' : 'bg-white border-neutral-200';
});

const homeRoute = computed(() => {
  if (!authStore.isLoggedIn) return '/';
  return authStore.getUserData?.role === 'delivery_assistant'
    ? '/driver/orders'
    : '/dashboard/orders';
});

const showSettingsIcon = computed(() => {
  return false;
  // return authStore.isLoggedIn && (authStore.isSystemAdmin || authStore.isBakeryAdmin);
});

const handleAuthClick = () => {
  if (authStore.isLoggedIn) {
    router.push('/');
    authStore.logout();

  } else {
    router.push('/login');
  }
};
</script>

<template>
  <header :class="`border-b ${headerBackgroundClass}`">
    <nav class="flex items-center justify-between px-4 max-w-8xl mx-auto">
      <!-- Home/Logo Button -->
      <RouterLink
        :to="homeRoute"
        class="flex items-center gap-2 text-neutral-800 hover:text-neutral-700 transition-colors"
      >
        <PhGraph class="w-6 h-6" weight="light" />
        <span class="font-bold text-lg">MAD</span>
      </RouterLink>

      <div class="flex items-center gap-2">
        <!-- Settings Button (Admin Only) -->
        <RouterLink
          v-if="showSettingsIcon"
          to="/dashboard/settings"
          class="flex items-center text-neutral-600 hover:text-neutral-800 transition-colors"
        >
          <PhGear class="w-5 h-5" weight="regular" />
        </RouterLink>

        <!-- Login/Logout Button -->
        <button
          @click="handleAuthClick"
          class="utility-btn px-4 my-1"
        >
          {{ authStore.isLoggedIn ? 'Cerrar sesión' : 'Iniciar sesión' }}
        </button>
      </div>
    </nav>
  </header>
</template>

<style lang="scss" scoped>

</style>

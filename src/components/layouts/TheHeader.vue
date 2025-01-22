<script setup>
import { RouterLink } from 'vue-router';
import { useAuthenticationStore } from '@/stores/authentication';
import { PhGraph } from '@phosphor-icons/vue';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const authStore = useAuthenticationStore();

const homeRoute = computed(() => {
  if (!authStore.isLoggedIn) return '/';
  return authStore.getUserData?.role === 'delivery_assistant'
    ? '/driver/orders'
    : '/dashboard/orders';
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
  <header class="bg-white border-b border-neutral-200">
    <nav class="flex items-center justify-between px-4 max-w-8xl mx-auto">
      <!-- Home/Logo Button -->
      <RouterLink
        :to="homeRoute"
        class="flex items-center gap-2 text-neutral-800 hover:text-neutral-700 transition-colors"
      >
        <PhGraph class="w-6 h-6" weight="light" />
        <span class="font-bold text-lg">MAD</span>
      </RouterLink>

      <!-- Login/Logout Button -->
      <button
        @click="handleAuthClick"
        class="utility-btn px-4 my-1"
      >
        {{ authStore.isLoggedIn ? 'Cerrar sesión' : 'Iniciar sesión' }}
      </button>
    </nav>
  </header>
</template>

<style lang="scss" scoped>

</style>

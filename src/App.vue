<script setup>
import { computed, onMounted } from 'vue';
import { RouterView } from 'vue-router';
import TheHeader from './components/layouts/TheHeader.vue';
import { useAuthenticationStore } from '@/stores/authentication';
import { PhGraph } from '@phosphor-icons/vue';

const authStore = useAuthenticationStore();
const isLoading = computed(() => authStore.isLoading);

onMounted(() => {
  console.log('isLoading', isLoading.value);
});
</script>

<template>
  <div class="app-container">
    <TheHeader class="app-header" />
    <main :key="`main-${isLoading}`" class="main-content">
      <div v-if="isLoading" class="loading-overlay absolute inset-0 z-50">
        <div class="flex justify-center flex-col items-center h-full bg-neutral-50">
          <PhGraph class="animate-pulse h-20 w-20" weight="light" />
          <span class="text-xs pt-4 hidden">cargando...</span>
        </div>
      </div>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr;
}

.main-content {
  overflow: auto;
}

@media print {
.app-header {
  display:none
}
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

.animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}

.loading-overlay {
  opacity: 0;
  animation: showLoader 0s ease-in-out 2s forwards;
}

@keyframes showLoader {
  to {
    opacity: 1;
  }
}
</style>

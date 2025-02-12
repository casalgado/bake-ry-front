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
  <TheHeader />
  <main :key="`main-${isLoading}`">
    <div v-if="isLoading">
      <div class="flex justify-center flex-col items-center h-screen absolute inset-0">
        <PhGraph class="animate-pulse h-20 w-20" weight="light" />
        <span class="text-xs">cargando...</span>
      </div>
    </div>
    <RouterView />
  </main>
  <footer></footer>
</template>

<style scoped>
@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}
</style>

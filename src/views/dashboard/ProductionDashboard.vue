<script setup>
import { onMounted } from 'vue';
import { useAuthenticationStore } from '@/stores/authentication';
import ProductionSidebar from '@/components/layouts/ProductionSidebar.vue';

const authStore = useAuthenticationStore();

onMounted(async () => {
  await authStore.refreshToken();
});
</script>

<template>
  <section class="relative grid lg:grid-cols-[200px_1fr] transition-all">
    <ProductionSidebar />
    <!-- Added relative positioning and proper z-index -->
    <div class="relative grid justify-items-center grid-cols-1 bg-neutral-150 py-5 pb-20 lg:pb-5 min-h-screen">
      <RouterView />
    </div>
  </section>
</template>

<style scoped lang="scss">
section {
  min-height: 100vh;
  min-height: 100dvh;
}
</style>

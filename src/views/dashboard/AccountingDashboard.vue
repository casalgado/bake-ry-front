<script setup>
import { onMounted } from 'vue';
import { useAuthenticationStore } from '@/stores/authentication';
import AccountingSidebar from '@/components/layouts/AccountingSidebar.vue';

const authStore = useAuthenticationStore();

onMounted(async () => {

  await authStore.refreshToken();
});
</script>

<template>

  <section class="relative grid lg:grid-cols-[200px_1fr] transition-all h-full">
    <AccountingSidebar />
    <!-- Added relative positioning and proper z-index -->
    <div class="relative grid justify-items-center grid-cols-1 bg-neutral-150 pb-20 lg:pb-5 h-full overflow-auto">
      <RouterView />
    </div>
  </section>
</template>

<style scoped lang="scss">
section {
  height: 100%;
}
</style>

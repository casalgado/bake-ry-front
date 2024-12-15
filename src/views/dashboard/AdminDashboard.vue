<script setup>
import { onMounted } from 'vue';
import { useAuthenticationStore } from '@/stores/authentication';
import CreateBakery from '@/views/bakeries/CreateBakery.vue';
import AdminSidebar from '@/components/layouts/AdminSidebar.vue';

const authStore = useAuthenticationStore();

const handleSuccess = () => {

};

onMounted(async () => {
  await authStore.refreshToken();
});
</script>

<template>
  <section v-if="!authStore.hasAssignedBakery">
    <h2>Welcome! Get Started with Your Bakery</h2>
    <CreateBakery @success="handleSuccess" />
  </section>
  <section v-else class="relative grid lg:grid-cols-[200px_1fr] transition-all">
    <AdminSidebar />
    <!-- Added relative positioning and proper z-index -->
    <div class="relative grid justify-items-center grid-cols-1 bg-neutral-150 py-5 pb-20 lg:pb-5 min-h-screen">
      <RouterView />
    </div>
  </section>
</template>

<style scoped lang="scss">
section {
  min-height: 100vh;
}
</style>

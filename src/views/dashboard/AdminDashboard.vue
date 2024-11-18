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
  <section class="grid grid-cols-[200px_1fr] transition-all" v-else>
    <AdminSidebar />
    <div class="flex justify-center bg-neutral-150 p-5">
      <RouterView class="w-full" />
    </div>

  </section>
</template>

<style scoped lang="scss">

</style>

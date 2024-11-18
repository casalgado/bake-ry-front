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
  <section v-else class="grid grid-cols-[200px_1fr] transition-all" >
    <AdminSidebar />
    <div class="grid justify-items-center grid-cols-1 bg-neutral-150 py-5">

    </div>

  </section>
</template>

<style scoped lang="scss">

</style>

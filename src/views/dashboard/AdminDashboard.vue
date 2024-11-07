<script setup>
import { onMounted } from 'vue';
import { useAuthenticationStore } from '@/stores/authentication';
import CreateBakery from '@/views/bakeries/CreateBakery.vue';

const authStore = useAuthenticationStore();

const handleSuccess = () => {};

onMounted(async () => {
  await authStore.refreshToken();
});
</script>

<template>
  <section v-if="!authStore.hasAssignedBakery">
    <h2>Welcome! Get Started with Your Bakery</h2>
    <CreateBakery @success="handleSuccess" />
  </section>
  <section v-else>
    <h1>Dashboard</h1>
    <nav></nav>
    <RouterView />
  </section>
</template>

<style scoped lang="scss"></style>

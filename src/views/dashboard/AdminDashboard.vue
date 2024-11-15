<script setup>
import { onMounted } from 'vue';
import { useAuthenticationStore } from '@/stores/authentication';
import CreateBakery from '@/views/bakeries/CreateBakery.vue';

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
  <section class="grid grid-cols-custom-200-1fr  transition-all" v-else>
    <aside class="bg-neutral-200"></aside>
    <RouterView class="bg-neutral-100" />
  </section>
</template>

<style scoped lang="scss">

</style>

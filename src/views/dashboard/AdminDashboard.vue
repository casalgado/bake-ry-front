<script setup>
import { onMounted } from "vue";
import { useAuthenticationStore } from "@/stores/authentication";
import BakeryForm from "@/components/bakeries/BakeryForm.vue";

const authStore = useAuthenticationStore();

const handleSuccess = () => {};

onMounted(async () => {
  await authStore.refreshToken();
});
</script>

<template>
  <section v-if="!authStore.hasAssignedBakery">
    <h2>Welcome! Get Started with Your Bakery</h2>
    <BakeryForm @success="handleSuccess" />
  </section>
  <section v-else>
    <h1>Dashboard</h1>
    <nav></nav>
    <RouterView />
  </section>
</template>

<style scoped lang="scss"></style>

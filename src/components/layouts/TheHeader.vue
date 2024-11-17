<script setup>
import { RouterLink } from 'vue-router';
import { useAuthenticationStore } from '@/stores/authentication';

const authStore = useAuthenticationStore();
</script>

<template>
  <div>
    <nav class="bg-white border-b border-primary-dark">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/login">Login</RouterLink>
      <RouterLink to="/signup">Signup</RouterLink>
      <RouterLink to="/dashboard/show-bakery">Show Bakery</RouterLink>
      <RouterLink to="/dashboard/update-bakery">Update Bakery</RouterLink>
      <RouterLink to="/dashboard/settings">Settings</RouterLink>
      <button @click="authStore.logout" class="py-0 my-0.5">Logout</button>
    </nav>
  </div>
</template>

<style lang="scss" scoped>
nav {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>

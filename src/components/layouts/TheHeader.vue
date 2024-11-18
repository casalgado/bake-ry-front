<script setup>
import { RouterLink } from 'vue-router';
import { useAuthenticationStore } from '@/stores/authentication';

const authStore = useAuthenticationStore();
</script>

<template>
  <header>
    <nav class="flex items-center gap-2 mx-4">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/login">Login</RouterLink>
      <RouterLink to="/signup">Signup</RouterLink>
      <RouterLink to="/dashboard/show-bakery">Show Bakery</RouterLink>
      <RouterLink to="/dashboard/update-bakery">Update Bakery</RouterLink>
      <RouterLink to="/dashboard/settings">Settings</RouterLink>
      <button @click="authStore.logout" class="py-0 my-0.5">Logout</button>
    </nav>
  </header>
</template>

<style lang="scss" scoped>

</style>

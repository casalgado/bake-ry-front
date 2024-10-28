<script setup>
import { useAuthenticationStore } from "@/stores/authentication";

const authStore = useAuthenticationStore();
</script>

<template>
  <div>
    <nav>
      <router-link to="/">Home</router-link>
      <router-link to="/login">Login</router-link>
      <router-link to="/signup">Signup</router-link>
      <router-link to="/dashboard">Dashboard</router-link>
      <router-link to="/dashboard/show-bakery">Show Bakery</router-link>
      <router-link to="/dashboard/update-bakery">Update Bakery</router-link>
      <button @click="authStore.logout">Logout</button>
    </nav>
  </div>
</template>

<style lang="scss" scoped>
nav {
  display: flex;
  gap: 0.5rem;
}
</style>

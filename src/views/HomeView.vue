<script setup>
import { useAuthenticationStore } from "../stores/authentication";

const authStore = useAuthenticationStore();
</script>

<template>
  <section>
    <h1>Hello World</h1>
    <div>Logged in: {{ authStore.isLoggedIn }}</div>
  </section>
</template>

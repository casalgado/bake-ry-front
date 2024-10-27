<script setup>
import { useAuthenticationStore } from "../stores/authentication";
import { useBakeryStore } from "../stores/bakery";

const authStore = useAuthenticationStore();
const bakeryStore = useBakeryStore();
</script>

<template>
  <section>
    <h1>Hello World</h1>
    <div>Logged in: {{ authStore.isLoggedIn }}</div>
    <div>User data: {{ authStore.getUserData }}</div>
    <div>Bakery: {{ bakeryStore.currentBakery }}</div>
  </section>
</template>

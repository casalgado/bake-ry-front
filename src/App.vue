<script setup>
import { RouterView } from 'vue-router';
import TheHeader from './components/layouts/TheHeader.vue';
console.log('App component initialization');
</script>

<template>
  <TheHeader />
  <main>
    <RouterView />
  </main>
  <footer></footer>
</template>

<style scoped></style>

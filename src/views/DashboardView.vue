<script setup>
import { onMounted } from "vue";
import { useAuthenticationStore } from "@/stores/authentication";

const authStore = useAuthenticationStore();

onMounted(async () => {
  await authStore.refreshToken();
});

let user = {
  uid: "73TnKdede6tbRHLMwnIC0C1Bn1on",
  email: "casalgado86@gmail.com",
  emailVerified: false,
  isAnonymous: false,
  providerData: [
    {
      providerId: "password",
      uid: "casalgado86@gmail.com",
      displayName: null,
      email: "casalgado86@gmail.com",
      phoneNumber: null,
      photoURL: null,
    },
  ],
  stsTokenManager: {
    refreshToken:
      "eyJfQXV0aEVtdWxhdG9yUmVmcmVzaFRva2VuIjoiRE8gTk9UIE1PRElGWSIsImxvY2FsSWQiOiI3M1RuS2RlZGU2dGJSSExNd25JQzBDMUJuMW9uIiwicHJvdmlkZXIiOiJwYXNzd29yZCIsImV4dHJhQ2xhaW1zIjp7fSwicHJvamVjdElkIjoiYmFrZS1yeSJ9",
    accessToken:
      "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJyb2xlIjoiYmFrZXJ5X2FkbWluIiwiZW1haWwiOiJjYXNhbGdhZG84NkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImF1dGhfdGltZSI6MTcyOTg1ODA5OSwidXNlcl9pZCI6IjczVG5LZGVkZTZ0YlJITE13bklDMEMxQm4xb24iLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImNhc2FsZ2Fkbzg2QGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn0sImlhdCI6MTcyOTg1ODEwMiwiZXhwIjoxNzI5ODYxNzAyLCJhdWQiOiJiYWtlLXJ5IiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL2Jha2UtcnkiLCJzdWIiOiI3M1RuS2RlZGU2dGJSSExNd25JQzBDMUJuMW9uIn0.",
    expirationTime: 1729861702162,
  },
  createdAt: "1729855696334",
  lastLoginAt: "1729858099482",
  apiKey: "AIzaSyCbOdRkeISteFBmDvMnK7qCL-7RMWARDIk",
  appName: "[DEFAULT]",
};
</script>

<template>
  <section v-if="authStore.hasAssignedBakery">
    <h2>Welcome! Get Started with Your Bakery</h2>
    bakery form
  </section>
  <section v-else>
    <h1>Dashboard</h1>
    <nav></nav>
    <RouterView />
  </section>
</template>

<style scoped lang="scss"></style>

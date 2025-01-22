<script setup>
import { useAuthenticationStore } from '@/stores/authentication';
import ShowDeliverySummary from './ShowDeliverySummary.vue';
const authStore = useAuthenticationStore();
</script>

<template>
  <ShowDeliverySummary
    :single-driver-mode="true"
    :driver-id="authStore.getUserData?.uid"
  />
</template>

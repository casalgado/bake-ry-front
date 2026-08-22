<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ProductReportCard from '@/components/reports/ProductReportCard.vue';

const route = useRoute();
const clientPersistencyRouteName = computed(() =>
  route.path.startsWith('/accounting') ? 'accounting-client-persistency' : 'admin-client-persistency',
);
</script>

<template>
  <div class="container p-2 sm:p-4 px-2 lg:px-4">
    <h2 class="text-lg sm:text-2xl font-bold text-neutral-800 mb-4">
      Reportes
    </h2>

    <div class="grid gap-4">
      <ProductReportCard />
      <router-link
        :to="{ name: clientPersistencyRouteName }"
        class="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
      >
        <h3 class="text-lg font-semibold">Persistencia de Clientes</h3>
        <p class="text-sm text-neutral-500 mt-1">
          Clientes nuevos, recurrentes y en riesgo de dejar de pedir.
        </p>
      </router-link>
    </div>
  </div>
</template>

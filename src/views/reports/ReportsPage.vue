<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  PhChartLineUp,
  PhCalendarCheck,
  PhCalculator,
  PhTag,
  PhUsersThree,
} from '@phosphor-icons/vue';

const route = useRoute();

const reports = [
  {
    title: 'Venta',
    icon: PhChartLineUp,
    desc: 'Ventas por periodo, cliente y forma de pago.',
    admin: 'salesReport',
    accounting: 'accountingSalesReport',
  },
  {
    title: 'Fechas de Pago',
    icon: PhCalendarCheck,
    desc: 'Pedidos agrupados por fecha de pago.',
    admin: 'paymentDates',
    accounting: 'accountingPaymentDates',
  },
  {
    title: 'Rentabilidad',
    icon: PhCalculator,
    desc: 'Ingresos menos costo de productos, mes a mes.',
    admin: 'admin-income-statement',
    accounting: 'accounting-income-statement',
  },
  {
    title: 'Ventas por Producto',
    icon: PhTag,
    desc: 'Descarga de ingresos y cantidades por producto.',
    admin: 'admin-product-report',
    accounting: 'accounting-product-report',
  },
  {
    title: 'Comportamiento Clientes',
    icon: PhUsersThree,
    desc: 'Clientes nuevos y recurrentes.',
    admin: 'admin-client-persistency',
    accounting: 'accounting-client-persistency',
  },
];

const isAccounting = computed(() => route.path.startsWith('/accounting'));

const availableReports = computed(() =>
  reports.map(r => ({ ...r, name: isAccounting.value ? r.accounting : r.admin })),
);
</script>

<template>
  <div class="container p-2 sm:p-4 px-2 lg:px-4">
    <h2 class="text-lg sm:text-2xl font-bold text-neutral-800 mb-4">
      Reportes
    </h2>

    <div class="grid gap-4 md:grid-cols-3">
      <router-link
        v-for="report in availableReports"
        :key="report.name"
        :to="{ name: report.name }"
        class="base-card block hover:shadow-md transition-shadow"
      >
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <component :is="report.icon" :size="20" class="shrink-0" />
          {{ report.title }}
        </h3>
        <p class="text-sm text-neutral-500 mt-1">{{ report.desc }}</p>
      </router-link>
    </div>
  </div>
</template>

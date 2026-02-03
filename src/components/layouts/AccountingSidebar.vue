<!-- Sidebar.vue -->
<script setup>
import { useRouter, useRoute } from 'vue-router';
import {
  PhChartLineUp,
  PhChartBar,
  PhCalculator,
  PhDresser,
  PhTag,
  PhArrowsLeftRight,
  PhCalendarCheck,
} from '@phosphor-icons/vue';
import SidebarLink from '@/components/common/SidebarLink.vue';
import SidebarDivider from '@/components/common/SidebarDivider.vue';
import MobileNavigation from './MobileNavigation.vue';

const router = useRouter();
const route = useRoute();

const navigationSections = [
  {
    title: 'Analisis',
    items: [
      {
        id: 'venta',
        icon: PhChartLineUp,
        text: 'Venta',
        path: '/accounting/salesReport',
      },
      {
        id: 'fecha_de_pagos',
        icon: PhCalendarCheck,
        text: 'Fechas de Pago',
        path: '/accounting/paymentDates',
      },
      {
        id: 'income_statement',
        icon: PhCalculator,
        text: 'Rentabilidad',
        path: '/accounting/income-statement',
      },
      {
        id: 'reportes',
        icon: PhChartBar,
        text: 'Reportes',
        path: '/accounting/reports',
      },
    ],
  },
  {
    title: 'Productos',
    items: [
      {
        id: 'categorias',
        icon: PhDresser,
        text: 'Categorías',
        path: '/accounting/product-collections',
      },
      {
        id: 'productos',
        icon: PhTag,
        text: 'Productos',
        path: '/accounting/products',
      },
      {
        id: 'import-export',
        icon: PhArrowsLeftRight,
        text: 'Importar/Exportar',
        path: '/accounting/products/import-export',
      },
    ],
  },
];

const handleLinkClick = (link) => {
  router.push(link.path);
};
</script>

<template>
  <!-- Desktop Sidebar -->
  <nav class="p-4 hidden lg:block overflow-y-auto max-h-full overflow-x-hidden scrollbar-hide">
    <template v-for="section in navigationSections" :key="section.title">
      <SidebarDivider :text="section.title" />
      <SidebarLink
        v-for="link in section.items"
        :key="link.id"
        :icon="link.icon"
        :text="link.text"
        :to="link.path"
        :isActive="route.path === link.path"
        @click="handleLinkClick(link)"
      />
    </template>
  </nav>

  <!-- Mobile Navigation -->
  <MobileNavigation
    :sections="navigationSections"
    :active-route="route.path"
    @navigate="handleLinkClick"
  />
</template>

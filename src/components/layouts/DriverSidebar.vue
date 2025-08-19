<script setup>
import { useRouter, useRoute } from 'vue-router';
import {
  PhChartDonut,
  PhOven,
  PhPersonArmsSpread,
  PhCashRegister,
  PhDresser,
  PhChefHat,
  PhBasket,
  PhBarcode,
  PhShoppingBagOpen,
  PhMopedFront,
  PhUsersThree,
  PhHandshake,
  PhGear,
} from '@phosphor-icons/vue';
import SidebarLink from '@/components/common/SidebarLink.vue';
import SidebarDivider from '@/components/common/SidebarDivider.vue';
import MobileNavigation from './MobileNavigation.vue';

const router = useRouter();
const route = useRoute();

const navigationSections = [
  {
    title: 'Entregas',
    items: [
      {
        id: 'resumen',
        icon: PhShoppingBagOpen,
        text: 'Resumen',
        path: '/driver/summary',
      },
      {
        id: 'pedidos',
        icon: PhMopedFront,
        text: 'Pedidos',
        path: '/driver/orders',
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

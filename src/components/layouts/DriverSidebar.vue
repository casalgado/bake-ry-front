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
import MobileNavigation from './MobileNavigation.vue';

const router = useRouter();
const route = useRoute();

const links = [
  {
    id: 'nuevo_pedido',
    icon: PhShoppingBagOpen,
    text: 'Resumen',
    path: '/driver/summary',
  },
  {
    id: 'pedidos',
    icon: PhCashRegister,
    text: 'Entregas',
    path: '/driver/orders',
  },

];

const handleLinkClick = (link) => {
  router.push(link.path);
};
</script>

<template>
  <!-- Desktop Sidebar -->
  <nav class="p-4 hidden lg:block">
    <SidebarLink
      v-for="link in links"
      :key="link.id"
      :icon="link.icon"
      :text="link.text"
      :isActive="route.path === link.path"
      @click="handleLinkClick(link)"
    />
  </nav>

  <!-- Mobile Navigation -->
  <MobileNavigation
    :links="links"
    :active-route="route.path"
    @navigate="handleLinkClick"
  />
</template>

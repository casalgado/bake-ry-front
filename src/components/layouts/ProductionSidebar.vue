<script setup>
import { useRouter, useRoute } from 'vue-router';
import {
  PhShoppingBagOpen,
  PhOven,
} from '@phosphor-icons/vue';
import SidebarLink from '@/components/common/SidebarLink.vue';
import MobileNavigation from './MobileNavigation.vue';

const router = useRouter();
const route = useRoute();

const links = [
  {
    id: 'resumen',
    icon: PhShoppingBagOpen,
    text: 'Resumen',
    path: '/production/summary',
  },
  {
    id: 'produccion',
    icon: PhOven,
    text: 'Producción',
    path: '/production/orders',
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

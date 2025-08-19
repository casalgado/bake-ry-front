<script setup>
import { useRouter, useRoute } from 'vue-router';
import {
  PhShoppingBagOpen,
  PhOven,
  PhBread,
  PhMopedFront,
  PhCalendar,
} from '@phosphor-icons/vue';
import SidebarLink from '@/components/common/SidebarLink.vue';
import SidebarDivider from '@/components/common/SidebarDivider.vue';
import MobileNavigation from './MobileNavigation.vue';

const router = useRouter();
const route = useRoute();

const navigationSections = [
  {
    title: 'Producción',
    items: [
      {
        id: 'produccion-por-producto',
        icon: PhBread,
        text: 'Por Producto',
        path: '/production/single',
      },
      {
        id: 'produccion-agrupado',
        icon: PhOven,
        text: 'Agrupado',
        path: '/production/grouped',
      },
    ],
  },
  {
    title: 'Entrega',
    items: [
      {
        id: 'entrega',
        icon: PhMopedFront,
        text: 'Entrega',
        path: '/production/delivery',
      },
      {
        id: 'entrega-calendario',
        icon: PhCalendar,
        text: 'Calendario',
        path: '/production/delivery-calendar',
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

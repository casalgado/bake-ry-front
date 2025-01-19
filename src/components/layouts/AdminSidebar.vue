<!-- Sidebar.vue -->
<script setup>
import { useRouter, useRoute } from 'vue-router';
import {
  PhChartDonut,
  PhOven,
  PhPersonArmsSpread,
  PhCashRegister,
  PhDresser,
  PhChefHat,
  PhShoppingBagOpen,
  PhMopedFront,
  PhUsersThree,
  PhHandshake,
  PhStorefront,
  PhTreeStructure,
  PhHandCoins,
  PhBread,
} from '@phosphor-icons/vue';
import SidebarLink from '@/components/common/SidebarLink.vue';
import SidebarDivider from '@/components/common/SidebarDivider.vue';
import MobileNavigation from './MobileNavigation.vue';

const router = useRouter();
const route = useRoute();

const navigationSections = [
  {
    title: 'Pedidos',
    items: [
      {
        id: 'pedidos',
        icon: PhCashRegister,
        text: 'Pedidos',
        path: '/dashboard/orders',
      },
      {
        id: 'nuevo_pedido',
        icon: PhShoppingBagOpen,
        text: 'Crear Pedido',
        path: '/dashboard/orders/create',
      },
      {
        id: 'venta',
        icon: PhChartDonut,
        text: 'Venta',
        path: '/dashboard/salesReport',
      },
      {
        id: 'por_cobrar',
        icon: PhHandCoins,
        text: 'Por Cobrar',
        path: '/dashboard/orders/unpaid',
      },
    ],
  },
  {
    title: 'Producción',
    items: [
      {
        id: 'produccion',
        icon: PhBread,
        text: 'Por Producto',
        path: '/dashboard/orders/production/single',
      },
      {
        id: 'produccion',
        icon: PhOven,
        text: 'Agrupado',
        path: '/dashboard/orders/production/grouped',
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
        path: '/dashboard/orders/delivery',
      },
    ],
  },
  {
    title: 'Usuarios',
    items: [
      {
        id: 'clientes',
        icon: PhUsersThree,
        text: 'Clientes',
        path: '/dashboard/users',
      },
      {
        id: 'usuarios_activos',
        icon: PhHandshake,
        text: 'Clientes Activos',
        path: '/dashboard/users/active',
      },
      {
        id: 'nuevo_cliente',
        icon: PhPersonArmsSpread,
        text: 'Crear Usuario',
        path: '/dashboard/users/create',
      },
      {
        id: 'b2b-clients',
        icon: PhStorefront,
        text: 'Clientes B2B',
        path: '/dashboard/b2b-clients',
      },
      {
        id: 'staff',
        icon: PhTreeStructure,
        text: 'Equipo',
        path: '/dashboard/staff',
      },
    ],
  },
  {
    title: 'Productos',
    items: [
      {
        id: 'colecciones',
        icon: PhDresser,
        text: 'Collecciones',
        path: '/dashboard/product-collections',
      },
      {
        id: 'productos',
        icon: PhChefHat,
        text: 'Productos',
        path: '/dashboard/products',
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
  <nav class="p-4 hidden lg:block">
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

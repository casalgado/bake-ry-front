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
  PhStorefront,
  PhTreeStructure,
  PhHandCoins,

} from '@phosphor-icons/vue';
import SidebarLink from '@/components/common/SidebarLink.vue';
import MobileNavigation from './MobileNavigation.vue';

const router = useRouter();
const route = useRoute();

const links = [
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
  {
    id: 'produccion',
    icon: PhOven,
    text: 'Produccion',
    path: '/dashboard/orders/production',
  },
  {
    id: 'entrega',
    icon: PhMopedFront,
    text: 'Entrega',
    path: '/dashboard/orders/delivery',
  },
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
  // {
  //   id: 'recetas',
  //   icon: PhBasket,
  //   text: 'Recetas',
  //   path: '/dashboard/recipes',
  // },
  // {
  //   id: 'ingredientes',
  //   icon: PhBarcode,
  //   text: 'Ingredientes',
  //   path: '/dashboard/ingredients',
  // },
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

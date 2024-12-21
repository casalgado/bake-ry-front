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
    id: 'pedidos',
    icon: PhCashRegister,
    text: 'Pedidos',
    path: '/dashboard/orders',
  },
  {
    id: 'nuevo_pedido',
    icon: PhShoppingBagOpen,
    text: 'Nuevo Pedido',
    path: '/dashboard/orders/create',
  },
  {
    id: 'venta',
    icon: PhChartDonut,
    text: 'Venta',
    path: '/dashboard',
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
    id: 'clientes',
    icon: PhUsersThree,
    text: 'Usuarios',
    path: '/dashboard/users',
  },

  {
    id: 'crear_coleccion',
    icon: PhDresser,
    text: 'Crear Colección',
    path: '/dashboard/product-collections/create',
  },
  {
    id: 'productos',
    icon: PhChefHat,
    text: 'Productos',
    path: '/dashboard/products',
  },
  {
    id: 'recetas',
    icon: PhBasket,
    text: 'Recetas',
    path: '/dashboard/recipes',
  },
  {
    id: 'ingredientes',
    icon: PhBarcode,
    text: 'Ingredientes',
    path: '/dashboard/ingredients',
  },
  {
    id: 'configuracion',
    icon: PhGear,
    text: 'Configuración',
    path: '/dashboard/settings',
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

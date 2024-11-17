<script setup>

import { useRouter, useRoute } from 'vue-router';
import { PhChartDonut, PhOven, PhPersonArmsSpread, PhCashRegister, PhDresser, PhChefHat, PhBasket, PhBarcode, PhShoppingBagOpen } from '@phosphor-icons/vue';
import SidebarLink from '@/components/common/SidebarLink.vue';

const router = useRouter();
const route = useRoute();

const links = [
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
    path: '/dashboard/update-bakery',
  },
  {
    id: 'clientes',
    icon: PhPersonArmsSpread,
    text: 'Clientes',
    path: '/dashboard/users',
  },
  {
    id: 'nuevo_pedido',
    icon: PhShoppingBagOpen,
    text: 'Nuevo Pedido',
    path: '/dashboard/orders/create',
  },
  {
    id: 'pedidos',
    icon: PhCashRegister,
    text: 'Pedidos',
    path: '/dashboard/orders',
  },

  {
    id: 'colecciones',
    icon: PhDresser,
    text: 'Colecciones',
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
];

const handleLinkClick = (link) => {
  router.push(link.path);
};
</script>

<template>
  <nav class="p-4">
    <SidebarLink
      v-for="link in links"
      :key="link.id"
      :icon="link.icon"
      :text="link.text"
      :isActive="route.path === link.path"
      @click="handleLinkClick(link)"
    />
  </nav>
</template>

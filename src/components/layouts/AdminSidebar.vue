<!-- Sidebar.vue -->
<script setup>
import { useRouter, useRoute } from 'vue-router';
import { computed, onMounted } from 'vue';
import {
  PhChartLineUp,
  PhChartBar,
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
  PhCalculator,
  PhCalendar,
  PhCalendarCheck,
  PhListChecks,
  PhMinus,
  PhTag,
  PhUserPlus,
  PhUserCirclePlus,
  PhWifiX,
  PhGear,
  PhArrowsLeftRight,
  PhBuildings,
  PhWarehouse,
  PhArrowDown,
  PhSparkle,
  PhPalette,
  PhTextbox,
} from '@phosphor-icons/vue';
import SidebarLink from '@/components/common/SidebarLink.vue';
import SidebarDivider from '@/components/common/SidebarDivider.vue';
import MobileNavigation from './MobileNavigation.vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useAuthenticationStore } from '@/stores/authentication';

const router = useRouter();
const route = useRoute();
const settingsStore = useBakerySettingsStore();
const authStore = useAuthenticationStore();

// Load bakery settings when component mounts
onMounted(async () => {
  if (!settingsStore.items.length) {
    await settingsStore.fetchById('default');
  }
});

// Check if offline mode is enabled
const isOfflineModeEnabled = computed(() => {
  if (!settingsStore.items.length) return false;
  const settings = settingsStore.items[0];
  return settings?.features?.order?.offlineMode === true;
});

const navigationSections = computed(() => {
  const baseSections = [
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
        ...(isOfflineModeEnabled.value ? [{
          id: 'crear_pedido_offline',
          icon: PhWifiX,
          text: 'Crear Offline',
          path: '/dashboard/orders/create-offline',
        }] : []),
        {
          id: 'por_cobrar',
          icon: PhHandCoins,
          text: 'Por Cobrar',
          path: '/dashboard/orders/unpaid',
        },
      ],
    },
    {
      title: 'Analisis',
      items: [
        {
          id: 'venta',
          icon: PhChartLineUp,
          text: 'Venta',
          path: '/dashboard/salesReport',
        },
        {
          id: 'fecha_de_pagos',
          icon: PhCalendarCheck,
          text: 'Fechas de Pago',
          path: '/dashboard/paymentDates',
        },
        {
          id: 'reportes',
          icon: PhChartBar,
          text: 'Reportes',
          path: '/dashboard/reports',
        },
      ],
    },
    {
      title: 'Producción',
      items: [
        {
          id: 'produccion',
          icon: PhMinus,
          text: 'Por Producto',
          path: '/dashboard/orders/production/single',
        },
        {
          id: 'produccion',
          icon: PhListChecks,
          text: 'Agrupado',
          path: '/dashboard/orders/production/grouped',
        },
      ],
    },
    // Opt-in module: off by default, activated per business by a system admin (§14).
    ...(settingsStore.isInventoryEnabled ? [{
      title: 'Inventario',
      items: [
        {
          id: 'inventario',
          icon: PhWarehouse,
          text: 'Existencias',
          path: '/dashboard/inventory',
        },
        // The three jobs are their own screens, not tabs inside Existencias:
        // isActive is an exact path match, so each highlights on its own.
        {
          id: 'inventario-ingreso',
          icon: PhArrowDown,
          text: 'Ingreso',
          path: '/dashboard/inventory/ingreso',
        },
        {
          id: 'inventario-produccion',
          icon: PhSparkle,
          text: 'Producción',
          path: '/dashboard/inventory/produccion',
        },
        {
          id: 'inventario-conteo',
          icon: PhListChecks,
          text: 'Conteo',
          path: '/dashboard/inventory/conteos',
        },
        {
          id: 'recipe-book',
          icon: PhChefHat,
          text: 'Recetario',
          path: '/dashboard/recipe-book',
        },
      ],
    }] : []),
    ...(!settingsStore.shouldHideDeliveryOptions ? [{
      title: 'Entrega',
      items: [
        {
          id: 'entrega',
          icon: PhMopedFront,
          text: 'Entrega',
          path: '/dashboard/orders/delivery',
        },
        {
          id: 'entrega-resumen',
          icon: PhCalculator,
          text: 'Resumen',
          path: '/dashboard/orders/delivery/summary',
        },
        {
          id: 'entrega-calendario',
          icon: PhCalendar,
          text: 'Calendario',
          path: '/dashboard/orders/delivery-calendar',
        },
      ],
    }] : []),
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
          id: 'nuevo_cliente',
          icon: PhUserPlus,
          text: 'Crear Cliente',
          path: '/dashboard/users/create-client',
        },
        {
          id: 'usuarios_activos',
          icon: PhHandshake,
          text: 'Clientes Activos',
          path: '/dashboard/users/active',
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
        {
          id: 'nuevo_empleado',
          icon: PhUserCirclePlus,
          text: 'Agrandar Equipo',
          path: '/dashboard/users/create-staff',
        },
      ],
    },
    {
      title: 'Productos',
      items: [
        {
          id: 'colecciones',
          icon: PhDresser,
          text: 'Categorias',
          path: '/dashboard/product-collections',
        },
        {
          id: 'productos',
          icon: PhTag,
          text: 'Productos',
          path: '/dashboard/products',
        },
        {
          id: 'import-export',
          icon: PhArrowsLeftRight,
          text: 'Importar/Exportar',
          path: '/dashboard/products/import-export',
        },
      ],
    },
    {
      title: 'Mi Cuenta',
      items: [
        {
          id: 'configuracion',
          icon: PhGear,
          text: 'Configuración',
          path: '/dashboard/settings',
        },
        ...(authStore.isSystemAdmin ? [{
          id: 'negocios',
          icon: PhBuildings,
          text: 'Negocios',
          path: '/system-admin/bakeries',
        }, {
          id: 'ux',
          icon: PhPalette,
          text: 'UX',
          path: '/system-admin/ux',
        }, {
          id: 'ux-forms',
          icon: PhTextbox,
          text: 'UX Formularios',
          path: '/system-admin/ux/forms',
        }] : []),
      ],
    },
  ];

  return baseSections;
});

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

console.log('Router initialization');

import { createRouter, createWebHistory } from 'vue-router';
import { useAuthenticationStore } from '@/stores/authentication';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/privacy-policy',
      name: 'privacy-policy',
      component: () => import('../views/PrivacyPolicy.vue'),
    },
    {
      path: '/roadmap',
      name: 'roadmap',
      component: () => import('../views/RoadmapView.vue'),
    },
    {
      path: '/competition',
      name: 'competition',
      component: () => import('../views/CompetitionView.vue'),
    },
    {
      path: '/test-image-upload',
      name: 'test-image-upload',
      component: () => import('../views/TestImageUpload.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/auth/CreateBakeryView.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/createBakery',
      name: 'create-bakery',
      component: () => import('../views/bakeries/CreateBakery.vue'),
    },
    {
      path: '/export-orders',
      name: 'export-orders',
      component: () => import('../views/orders/ExportOrders.vue'),
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/print-delivery',
      name: 'print-delivery',
      component: () => import('../views/orders/PrintDeliverySheet.vue'),
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/dashboard/AdminDashboard.vue'),
      redirect: { name: 'orders' },
      meta: {
        requiresAuth: true,
        allowedRoles: ['bakery_admin', 'bakery_staff'],
      },
      children: [
        {
          /* Inventario is four screens, not four tabs: Bodega is a place you
           * look at, the other three are jobs you do, and each is worth its own
           * URL and its own sidebar link. The layout holds only the chrome and
           * the catalog fetches — open Ingreso and Producción documents live in
           * inventoryDocsStore and counts live on the server, so both survive
           * leaving the section entirely.
           *
           * `meta` merges across matched records in vue-router 4, so the
           * feature flag on the parent covers every child route. */
          path: 'inventory',
          component: () => import('../views/inventory/InventoryLayout.vue'),
          // Opt-in module: unreachable by URL while the flag is off (§14).
          meta: { requiresFeature: 'inventory' },
          children: [
            {
              path: '',
              name: 'inventory',
              component: () => import('../views/inventory/ShowStock.vue'),
            },
            {
              // Two components, not one behind a `kind` prop. They used to
              // share EntryDoc; five things now separate them — the shelves,
              // el proveedor, whether a line carries a unit cost, creating an
              // ingredient inline, and the consumption preview — and the map
              // that held them together had stopped paying for itself.
              path: 'ingreso',
              name: 'inventory-ingreso',
              component: () => import('../views/inventory/PurchaseDoc.vue'),
            },
            {
              path: 'produccion',
              name: 'inventory-produccion',
              component: () => import('../views/inventory/ProductionDoc.vue'),
            },
            {
              // A count is a server resource with an id, so a link joins it.
              path: 'conteos',
              name: 'inventory-conteos',
              component: () => import('../views/inventory/CountList.vue'),
            },
            {
              path: 'conteos/:id',
              name: 'inventory-conteo',
              component: () => import('../views/inventory/CountDoc.vue'),
            },
            {
              path: 'conteos/:id/revisar',
              name: 'inventory-conteo-revisar',
              component: () => import('../views/inventory/CountReview.vue'),
            },
          ],
        },
        {
          path: 'show-bakery',
          name: 'show-bakery',
          component: () => import('../views/bakeries/ShowBakery.vue'),
        },
        {
          path: 'update-bakery',
          name: 'update-bakery',
          component: () => import('../views/bakeries/UpdateBakery.vue'),
        },
        {
          path: 'salesReport',
          name: 'salesReport',
          component: () => import('../views/orders/ShowSalesReport.vue'),
        },
        {
          path: 'paymentDates',
          name: 'paymentDates',
          component: () => import('../views/orders/ShowPaymentDates.vue'),
        },
        {
          path: 'ingredients',
          name: 'ingredients',
          component: () => import('../views/ingredients/ShowIngredients.vue'),
        },
        {
          path: 'recipe-book',
          name: 'recipe-book',
          component: () => import('../views/recipes/RecipeBookView.vue'),
          // Same opt-in module as Existencias, so the URL can't outlive the link.
          meta: { requiresFeature: 'inventory' },
        },
        {
          path: 'products',
          name: 'products',
          component: () => import('../views/products/ShowProducts.vue'),
        },
        {
          path: 'products/create',
          name: 'create-product',
          component: () => import('../views/products/CreateProduct.vue'),
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('../views/bakeryUsers/ShowBakeryUsers.vue'),
        },
        {
          path: 'users/create-client',
          name: 'create-client',
          component: () => import('../views/bakeryUsers/CreateClient.vue'),
        },
        {
          path: 'users/create-staff',
          name: 'create-staff',
          component: () => import('../views/bakeryUsers/CreateStaffMember.vue'),
        },
        {
          path: 'users/active',
          name: 'active-users',
          component: () => import('../views/bakeryUsers/ShowActiveBakeryUsers.vue'),
        },
        {
          path: 'orders',
          name: 'orders',
          component: () => import('../views/orders/ShowOrders.vue'),
        },
        {
          path: 'orders/create',
          name: 'create-order',
          component: () => import('../views/orders/CreateOrder.vue'),
        },
        {
          path: 'orders/create-offline',
          name: 'create-offline-order',
          component: () => import('../views/orders/CreateOfflineOrder.vue'),
        },
        {
          path: 'orders/production/single',
          name: 'show-production-single',
          component: () => import('../views/orders/ShowProductionSingleItems.vue'),
        },
        {
          path: 'orders/production/grouped',
          name: 'show-production-grouped',
          component: () => import('../views/orders/ShowProductionGroupedItems.vue'),
        },
        {
          path: 'orders/delivery',
          name: 'show-delivery',
          component: () => import('../views/orders/ShowDelivery.vue'),
        },
        {
          path: 'orders/delivery-calendar',
          name: 'show-delivery-calendar',
          component: () => import('../views/orders/ShowDeliveryCalendar.vue'),
        },
        {
          path: 'orders/delivery/summary',
          name: 'deliverySummary',
          component: () => import('../views/orders/ShowDeliverySummary.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/bakerySettings/ShowBakerySettings.vue'),
        },
        {
          path: 'staff',
          name: 'staff',
          component: () => import('../views/bakerySettings/ShowStaff.vue'),
        },
        {
          path: 'b2b-clients',
          name: 'b2b-clients',
          component: () => import('../views/bakerySettings/ShowB2BClients.vue'),
        },
        {
          path: 'product-collections',
          name: 'product-collections',
          component: () => import('../views/products/ShowProductCollections.vue'),
        },
        {
          path: 'product-collections/create',
          name: 'create-product-collections',
          component: () => import('../views/products/CreateProductCollection.vue'),
        },
        {
          path: 'products/import-export',
          name: 'product-import-export',
          component: () => import('../views/products/ProductImportExport.vue'),
        },
        {
          path: 'orders/unpaid',
          name: 'unpaidOrders',
          component: () => import('../views/orders/ShowUnpaidOrders.vue'),
        },
        {
          path: 'console',
          name: 'showConsole',
          component: () => import('../views/Console.vue'),
        },
        {
          path: 'reports',
          name: 'admin-reports',
          component: () => import('../views/reports/ReportsPage.vue'),
        },
        {
          path: 'income-statement',
          name: 'admin-income-statement',
          component: () => import('../views/reports/IncomeStatement.vue'),
        },
        {
          path: 'client-persistency',
          name: 'admin-client-persistency',
          component: () => import('../views/reports/ClientPersistencyReport.vue'),
        },
        {
          path: 'product-report',
          name: 'admin-product-report',
          component: () => import('../views/reports/ProductReport.vue'),
        },
      ],
    },
    {
      path: '/accounting',
      name: 'accounting',
      component: () => import('../views/dashboard/AccountingDashboard.vue'),
      redirect: { name: 'accountingSalesReport' },
      meta: {
        requiresAuth: true,
        allowedRoles: ['bakery_admin', 'bakery_staff', 'accounting_assistant'],
      },
      children: [
        {
          path: 'salesReport',
          name: 'accountingSalesReport',
          component: () => import('../views/orders/ShowSalesReport.vue'),
        },
        {
          path: 'paymentDates',
          name: 'accountingPaymentDates',
          component: () => import('../views/orders/ShowPaymentDates.vue'),
        },
        {
          path: 'reports',
          name: 'accounting-reports',
          component: () => import('../views/reports/ReportsPage.vue'),
        },
        {
          path: 'income-statement',
          name: 'accounting-income-statement',
          component: () => import('../views/reports/IncomeStatement.vue'),
        },
        {
          path: 'client-persistency',
          name: 'accounting-client-persistency',
          component: () => import('../views/reports/ClientPersistencyReport.vue'),
        },
        {
          path: 'product-report',
          name: 'accounting-product-report',
          component: () => import('../views/reports/ProductReport.vue'),
        },
        {
          path: 'product-collections',
          name: 'accounting-product-collections',
          component: () => import('../views/products/ShowProductCollections.vue'),
        },
        {
          path: 'products',
          name: 'accounting-products',
          component: () => import('../views/products/ShowProducts.vue'),
        },
        {
          path: 'products/import-export',
          name: 'accounting-product-import-export',
          component: () => import('../views/products/ProductImportExport.vue'),
        },
      ],
    },
    {
      path: '/driver',
      name: 'driver',
      component: () => import('../views/dashboard/DriverDashboard.vue'),
      redirect: { name: 'driverOrders' },
      meta: {
        requiresAuth: true,
        allowedRoles: ['bakery_admin', 'bakery_staff', 'delivery_assistant'],
      },
      children: [
        {
          path: 'orders',
          name: 'driverOrders',
          component: () => import('../views/orders/ShowDriverOrders.vue'),
        },
        {
          path: 'summary',
          name: 'driverSummary',
          component: () => import('../views/orders/ShowDriverSummary.vue'),
        },
      ],
    },
    {
      path: '/production',
      name: 'production',
      component: () => import('../views/dashboard/ProductionDashboard.vue'),
      redirect: { name: 'productionOrders' },
      meta: {
        requiresAuth: true,
        allowedRoles: ['bakery_admin', 'bakery_staff', 'production_assistant'],
      },
      children: [
        {
          path: 'orders',
          name: 'productionOrders',
          component: () => import('../views/orders/ShowProductionAssistantOrders.vue'),
        },
        {
          path: 'summary',
          name: 'productionSummary',
          component: () => import('../views/orders/ShowProductionAssistantSummary.vue'),
        },
        {
          path: 'single',
          name: 'production-single',
          component: () => import('../views/orders/ShowProductionSingleItems.vue'),
        },
        {
          path: 'grouped',
          name: 'production-grouped',
          component: () => import('../views/orders/ShowProductionGroupedItems.vue'),
        },
        {
          path: 'delivery',
          name: 'production-delivery',
          component: () => import('../views/orders/ShowDelivery.vue'),
        },
        {
          path: 'delivery-calendar',
          name: 'production-delivery-calendar',
          component: () => import('../views/orders/ShowDeliveryCalendar.vue'),
        },
      ],
    },
    {
      path: '/system-admin',
      name: 'system-admin',
      component: () => import('../views/dashboard/SystemAdminDashboard.vue'),
      redirect: { name: 'system-admin-bakeries' },
      meta: {
        requiresAuth: true,
        allowedRoles: ['system_admin'],
      },
      children: [
        {
          path: 'bakeries',
          name: 'system-admin-bakeries',
          component: () => import('../views/SystemAdmin/BakeryManagementView.vue'),
        },
        {
          path: 'settings',
          name: 'system-settings',
          component: () => import('../views/SystemSettingsView.vue'),
        },
        {
          path: 'ux',
          name: 'system-admin-ux',
          component: () => import('../views/SystemAdmin/UxView.vue'),
        },
        {
          path: 'ux/forms',
          name: 'system-admin-ux-forms',
          component: () => import('../views/SystemAdmin/UxFormsView.vue'),
        },
      ],
    },
  ],
});

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthenticationStore();

  // Check if the user's authentication state is loaded
  if (!authStore.user) {
    await authStore.checkAuth();
  }

  const isAuthenticated = authStore.isLoggedIn;
  const userRole = authStore.user?.role;

  console.log('Route guard check:', {
    path: to.path,
    isAuthenticated,
    userRole,
    meta: to.meta,
  });

  // Handle guest-only routes (login, signup)
  if (to.meta.requiresGuest && isAuthenticated) {
    next({ name: 'dashboard' });
    return;
  }

  // Handle protected routes
  if (to.meta.requiresAuth) {
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      next({
        name: 'login',
        query: { redirect: to.fullPath },
      });
      return;
    }

    // System admin has access to all routes
    if (userRole === 'system_admin') {
      next();
      return;
    }

    // Check role-based access
    if (to.meta.allowedRoles && !to.meta.allowedRoles.includes(userRole)) {
      console.warn('Access denied: User role not authorized');
      // Redirect based on role
      switch (userRole) {
      case 'bakery_customer':
        next({ name: 'home' }); // or customer dashboard when implemented
        break;
      case 'delivery_assistant':
        next({ name: 'driver' });
        break;
      case 'production_assistant':
        next({ name: 'production' });
        break;
      case 'accounting_assistant':
        next({ name: 'accounting' });
        break;
      default:
        next({ name: 'home' }); // fallback
      }
      return;
    }

    // Opt-in modules: a disabled module's routes are not reachable, even by URL.
    // Frontend visibility only — see zplanning/inventory/INVENTORY.md §4.4.
    if (to.meta.requiresFeature) {
      // Imported lazily: bakerySettingsStore touches pinia at module scope.
      const { useBakerySettingsStore } = await import('@/stores/bakerySettingsStore');
      const settingsStore = useBakerySettingsStore();

      if (!settingsStore.items.length) {
        try {
          await settingsStore.fetchById('default');
        } catch (err) {
          console.error('Could not load settings for feature guard:', err);
        }
      }

      const isEnabled = settingsStore.items[0]
        ?.features?.[to.meta.requiresFeature]?.enabled === true;

      if (!isEnabled) {
        console.warn(`Access denied: module "${to.meta.requiresFeature}" is not enabled`);
        next({ name: 'dashboard' });
        return;
      }
    }
  }

  // If none of the above conditions are met, proceed normally
  next();
});

export default router;

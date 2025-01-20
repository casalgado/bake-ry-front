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
      path: '/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/auth/SignupView.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/createBakery',
      name: 'create-bakery',
      component: () => import('../views/bakeries/CreateBakery.vue'),
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
          path: 'ingredients',
          name: 'ingredients',
          component: () => import('../views/ingredients/ShowIngredients.vue'),
        },
        {
          path: 'ingredients/create',
          name: 'create-ingredient',
          component: () => import('../views/ingredients/CreateIngredient.vue'),
        },
        {
          path: 'recipes',
          name: 'recipes',
          component: () => import('../views/recipes/ShowRecipes.vue'),
        },
        {
          path: 'recipes/create',
          name: 'create-recipe',
          component: () => import('../views/recipes/CreateRecipe.vue'),
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
          path: 'users/create',
          name: 'create-user',
          component: () => import('../views/bakeryUsers/CreateBakeryUser.vue'),
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
          path: 'orders/unpaid',
          name: 'unpaidOrders',
          component: () => import('../views/orders/ShowUnpaidOrders.vue'),
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
      default:
        next({ name: 'home' }); // fallback
      }
      return;
    }
  }

  // If none of the above conditions are met, proceed normally
  next();
});

export default router;

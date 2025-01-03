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
      meta: { requiresAuth: true },
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
        { path: 'users',
          name: 'users',
          component: () => import('../views/bakeryUsers/ShowBakeryUsers.vue'),
        },
        { path: 'users/create',
          name: 'create-user',
          component: () => import('../views/bakeryUsers/CreateBakeryUser.vue'),
        },
        { path: 'users/active',
          name: 'active-users',
          component: () => import('../views/bakeryUsers/ShowActiveBakeryUsers.vue'),
        },
        { path: 'orders',
          name: 'orders',
          component: () => import('../views/orders/ShowOrders.vue'),
        },
        {
          path: 'orders/create',
          name: 'create-order',
          component: () => import('../views/orders/CreateOrder.vue'),
        },
        {
          path: 'orders/production',
          name: 'show-production',
          component: () => import('../views/orders/ShowProduction.vue'),
        },
        { path: 'orders/delivery',
          name: 'show-delivery',
          component: () => import('../views/orders/ShowDelivery.vue'),
        },
        { path: 'settings',
          name: 'settings',
          component: () => import('../views/bakerySettings/ShowBakerySettings.vue'),
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
      ],
    },
    {
      path: '/driver',
      name: 'driver',
      component: () => import('../views/dashboard/DriverDashboard.vue'),
      meta: { requiresAuth: true },
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

  // Handle protected routes
  if (to.meta.requiresAuth && !isAuthenticated) {
    // Redirect to login if trying to access protected route while not authenticated
    next({
      name: 'login',
      query: { redirect: to.fullPath }, // Save the intended destination
    });
    return;
  }

  // Handle guest-only routes (login, signup)
  if (to.meta.requiresGuest && isAuthenticated) {
    // Redirect to dashboard if trying to access login/signup while authenticated
    next({ name: 'dashboard' });
    return;
  }

  // If none of the above conditions are met, proceed normally
  next();
});

export default router;

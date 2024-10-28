console.log("Router initialization");

import { createRouter, createWebHistory } from "vue-router";
import { useAuthenticationStore } from "@/stores/authentication";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("../views/HomeView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("../views/auth/LoginView.vue"),
      meta: { requiresGuest: true },
    },
    {
      path: "/signup",
      name: "signup",
      component: () => import("../views/auth/SignupView.vue"),
      meta: { requiresGuest: true },
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: () => import("../views/dashboard/AdminDashboard.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "show-bakery",
          name: "show-bakery",
          component: () => import("../views/bakeries/ShowBakery.vue"),
        },
        {
          path: "update-bakery",
          name: "update-bakery",
          component: () => import("../views/bakeries/UpdateBakery.vue"),
        },
        {
          path: "ingredients",
          name: "ingredients",
          component: () => import("../views/ingredients/ShowIngredients.vue"),
        },
        {
          path: "ingredients/create",
          name: "create-ingredient",
          component: () => import("../views/ingredients/CreateIngredient.vue"),
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
      name: "login",
      query: { redirect: to.fullPath }, // Save the intended destination
    });
    return;
  }

  // Handle guest-only routes (login, signup)
  if (to.meta.requiresGuest && isAuthenticated) {
    // Redirect to dashboard if trying to access login/signup while authenticated
    next({ name: "dashboard" });
    return;
  }

  // If none of the above conditions are met, proceed normally
  next();
});

export default router;

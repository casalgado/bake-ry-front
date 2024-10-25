<script setup>
/**
 * This method is currently used only to create bakery_admin users.
 * Customer and staff accounts will be created by the bakery_admin user.
 */

import { ref } from "vue";
import { useAuthenticationStore } from "../stores/authentication";
import { useRouter } from "vue-router";

const router = useRouter();
const authStore = useAuthenticationStore();

const form = ref({
  email: "",
  password: "",
  confirmPassword: "",
  name: "",
});

const error = ref("");

const validateForm = () => {
  error.value = "";

  if (!form.value.email || !form.value.password || !form.value.name) {
    error.value = "Please fill in all fields";
    return false;
  }

  if (form.value.password !== form.value.confirmPassword) {
    error.value = "Passwords do not match";
    return false;
  }

  if (form.value.password.length < 6) {
    error.value = "Password must be at least 6 characters";
    return false;
  }

  return true;
};

const handleRegister = async () => {
  if (!validateForm()) return;

  try {
    await authStore.register({
      email: form.value.email,
      password: form.value.password,
      name: form.value.name,
      role: "bakery_admin",
    });
  } catch (err) {
    error.value = err.message;
  }
};
</script>

<template>
  <div>
    <h2>Create Account</h2>

    <div v-if="error">{{ error }}</div>
    <div v-if="authStore.error">{{ authStore.error }}</div>

    <form @submit.prevent="handleRegister">
      <div>
        <label for="name">Name:</label>
        <input
          type="text"
          v-model="form.name"
          id="name"
          required
          autocomplete="name"
        />
      </div>
      <div>
        <label for="email">Email:</label>
        <input
          type="email"
          v-model="form.email"
          id="email"
          required
          autocomplete="email"
        />
      </div>

      <div>
        <label for="password">Password:</label>
        <input type="password" v-model="form.password" id="password" required />
      </div>

      <div>
        <label for="confirmPassword">Confirm Password:</label>
        <input
          type="password"
          v-model="form.confirmPassword"
          id="confirmPassword"
          required
        />
      </div>

      <button type="submit" :disabled="authStore.loading">
        {{ authStore.loading ? "Creating Account..." : "Sign Up" }}
      </button>
    </form>

    <div>
      Already have an account?
      <router-link to="/login">Login</router-link>
    </div>
  </div>
</template>

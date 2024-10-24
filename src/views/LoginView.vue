<script setup>
import { ref } from "vue";
import { useAuthenticationStore } from "../stores/authentication";
import { useRouter } from "vue-router";

const authStore = useAuthenticationStore();
const router = useRouter();

const email = ref("");
const password = ref("");

const handleLogin = async () => {
  try {
    await authStore.login({
      email: email.value,
      password: password.value,
    });
  } catch (error) {
    console.error("Login failed:", error);
  }
};
</script>

<template>
  <div class="login">
    <h2>Login</h2>
    <form @submit.prevent="handleLogin">
      <div v-if="authStore.error" class="error">
        {{ authStore.error }}
      </div>
      <div>
        <label for="email">Email:</label>
        <input
          v-model="email"
          type="email"
          id="email"
          required
          autocomplete="email"
        />
      </div>
      <div>
        <label for="password">Password:</label>
        <input
          v-model="password"
          type="password"
          id="password"
          required
          autocomplete="current-password"
        />
      </div>
      <button type="submit" :disabled="authStore.loading">Login</button>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useBakeryStore } from "@/stores/bakery";
import { useAuthenticationStore } from "@/stores/authentication";

const authStore = useAuthenticationStore();

const bakeryStore = useBakeryStore();
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    console.log("onMounted fetchBakeryById", authStore.getBakeryId);
    await bakeryStore.fetchBakeryById(authStore.getBakeryId);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});

const formatTime = (time) => {
  if (!time) return "";
  return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};
</script>

<template>
  <article v-if="!loading && bakeryStore.currentBakery">
    <header>
      <h1>{{ bakeryStore.currentBakery.name }}</h1>
      <address>
        {{ bakeryStore.currentBakery.address }}<br />
        <a :href="`tel:${bakeryStore.currentBakery.phone}`">{{
          bakeryStore.currentBakery.phone
        }}</a
        ><br />
        <a :href="`mailto:${bakeryStore.currentBakery.email}`">{{
          bakeryStore.currentBakery.email
        }}</a>
      </address>
    </header>

    <section v-if="bakeryStore.currentBakery.description">
      <h2>About</h2>
      <p>{{ bakeryStore.currentBakery.description }}</p>
    </section>

    <section>
      <h2>Operating Hours</h2>
      <dl>
        <template
          v-for="(hours, day) in bakeryStore.currentBakery.operatingHours"
          :key="day"
        >
          <dt>{{ day.charAt(0).toUpperCase() + day.slice(1) }}</dt>
          <dd>
            {{
              hours.isOpen
                ? `${formatTime(hours.open)} - ${formatTime(hours.close)}`
                : "Closed"
            }}
          </dd>
        </template>
      </dl>
    </section>

    <section v-if="bakeryStore.currentBakery.socialMedia">
      <h2>Social Media</h2>
      <ul>
        <li
          v-for="(url, platform) in bakeryStore.currentBakery.socialMedia"
          :key="platform"
        >
          <a v-if="url" :href="url" target="_blank" rel="noopener noreferrer">
            {{ platform.charAt(0).toUpperCase() + platform.slice(1) }}
          </a>
        </li>
      </ul>
    </section>
  </article>

  <p v-else-if="error">{{ error }}</p>
  <p v-else-if="loading">Loading...</p>
</template>

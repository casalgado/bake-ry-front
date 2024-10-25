<script setup>
import { ref } from "vue";
import { useBakeryStore } from "@/stores/bakery";

const bakeryStore = useBakeryStore();
const loading = ref(false);
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const socialPlatforms = [
  {
    name: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/yourbakery",
  },
  {
    name: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/yourbakery",
  },
  {
    name: "tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@yourbakery",
  },
  {
    name: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@yourbakery",
  },
  {
    name: "twitter",
    label: "Twitter/X",
    placeholder: "https://twitter.com/yourbakery",
  },
  {
    name: "pinterest",
    label: "Pinterest",
    placeholder: "https://pinterest.com/yourbakery",
  },
];

// Initialize operating hours with proper structure
const defaultHours = {
  isOpen: true,
  open: "09:00",
  close: "17:00",
};

const initialOperatingHours = days.reduce((acc, day) => {
  // Set Sunday to closed by default
  acc[day.toLowerCase()] =
    day === "Sunday"
      ? { ...defaultHours, isOpen: false, open: "", close: "" }
      : { ...defaultHours };
  return acc;
}, {});

const formData = ref({
  name: "a",
  email: "a@a.com",
  phone: "1234567890",
  address: "a",
  description: "a",
  socialMedia: {
    facebook: "https://facebook.com/a",
    instagram: "https://instagram.com/a",
  },
  operatingHours: initialOperatingHours,
});

const errors = ref({});

const validate = () => {
  errors.value = {};

  if (!formData.value.name) errors.value.name = "Name is required";
  if (!formData.value.email) errors.value.email = "Email is required";
  if (!formData.value.phone) errors.value.phone = "Phone is required";
  if (!formData.value.address) errors.value.address = "Address is required";

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = async () => {
  if (!validate()) return;

  try {
    loading.value = true;
    await bakeryStore.createBakery(formData.value);
    emit("success");
  } catch (error) {
    console.error("Failed to create bakery:", error);
  } finally {
    loading.value = false;
  }
};

const emit = defineEmits(["success"]);
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div>
      <label>Name</label>
      <input type="text" v-model="formData.name" />
      <span v-if="errors.name">{{ errors.name }}</span>
    </div>

    <div>
      <label>Email</label>
      <input type="email" v-model="formData.email" />
      <span v-if="errors.email">{{ errors.email }}</span>
    </div>

    <div>
      <label>Phone</label>
      <input type="tel" v-model="formData.phone" />
      <span v-if="errors.phone">{{ errors.phone }}</span>
    </div>

    <div>
      <label>Address</label>
      <input type="text" v-model="formData.address" />
      <span v-if="errors.address">{{ errors.address }}</span>
    </div>

    <div>
      <label>Description</label>
      <textarea v-model="formData.description" rows="3"></textarea>
    </div>

    <!-- Social Media -->
    <div v-for="platform in socialPlatforms" :key="platform.name">
      <label>{{ platform.label }}</label>
      <input
        type="url"
        v-model="formData.socialMedia[platform.name]"
        :placeholder="`${platform.placeholder}`"
      />
    </div>

    <!-- Operating hours -->
    <div v-for="day in days" :key="day">
      <label>{{ day }}</label>
      <div>
        <input
          type="checkbox"
          v-model="formData.operatingHours[day.toLowerCase()].isOpen"
        />
        <label>Open</label>

        <div v-if="formData.operatingHours[day.toLowerCase()].isOpen">
          <input
            type="time"
            v-model="formData.operatingHours[day.toLowerCase()].open"
          />
          to
          <input
            type="time"
            v-model="formData.operatingHours[day.toLowerCase()].close"
          />
        </div>
        <div v-else>Closed</div>
      </div>
    </div>

    <button type="submit" :disabled="loading">
      {{ loading ? "Creating..." : "Create Bakery" }}
    </button>
  </form>
</template>

<style scoped lang="scss">
form {
  margin-bottom: 2rem;
}
</style>

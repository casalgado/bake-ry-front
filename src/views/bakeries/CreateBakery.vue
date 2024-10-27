<script setup>
import { ref } from "vue";
import { useBakeryStore } from "@/stores/bakery";
import BakeryForm from "@/components/bakeries/BakeryForm.vue";
import { useRouter } from "vue-router";

const router = useRouter();
const bakeryStore = useBakeryStore();
const loading = ref(false);

const handleSubmit = async (bakeryData) => {
  try {
    console.log("handleSubmit", bakeryData);
    await bakeryStore.createBakery(bakeryData);
    // Success - redirect or show success message
    router.push("/bakeries");
  } catch (error) {
    if (error.message.includes("log in")) {
      // Redirect to login
      router.push("/login");
    } else {
      // Handle other errors
      console.error("Failed to create bakery:", error);
    }
  }
};

const emit = defineEmits(["success", "cancel"]);
</script>

<template>
  <div class="create-bakery">
    <h2>Create New Bakery</h2>
    <BakeryForm
      :loading="loading"
      @submit="handleSubmit"
      @cancel="$emit('cancel')"
    />
  </div>
</template>

<style scoped lang="scss"></style>

<script setup>
import { ref, onMounted } from "vue";
import { useBakeryStore } from "@/stores/bakery";
import BakeryForm from "@/components/bakeries/BakeryForm.vue";

const props = defineProps({
  bakeryId: {
    type: String,
    required: true,
  },
});

const bakeryStore = useBakeryStore();
const loading = ref(false);
const initialData = ref(null);
const isLoading = ref(true);

onMounted(async () => {
  try {
    await bakeryStore.fetchBakeryById(props.bakeryId);
    initialData.value = { ...bakeryStore.currentBakery };
  } catch (error) {
    console.error("Failed to fetch bakery:", error);
  } finally {
    isLoading.value = false;
  }
});

const handleSubmit = async (formData) => {
  try {
    loading.value = true;
    await bakeryStore.updateBakery(props.bakeryId, formData);
    emit("success");
  } catch (error) {
    console.error("Failed to update bakery:", error);
  } finally {
    loading.value = false;
  }
};

const emit = defineEmits(["success", "cancel"]);
</script>

<template>
  <div class="update-bakery">
    <h2>Update Bakery</h2>
    <div v-if="isLoading" class="loading">Loading...</div>
    <BakeryForm
      v-else
      :initial-data="initialData"
      :loading="loading"
      @submit="handleSubmit"
      @cancel="$emit('cancel')"
    />
  </div>
</template>

<style scoped lang="scss"></style>

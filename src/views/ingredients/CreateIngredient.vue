<script setup>
import { useIngredientStore } from "@/stores/ingredientStore";
import IngredientForm from "@/components/ingredients/IngredientForm.vue";
import { useRouter } from "vue-router";

const router = useRouter();
const ingredientStore = useIngredientStore();
console.log("ingredientStore contents:", ingredientStore);

const handleSubmit = async (formData) => {
  try {
    await ingredientStore.create(formData);
    router.push("/dashboard/ingredients"); // Navigate to ingredients list after creation
  } catch (error) {
    console.error("Failed to create ingredient:", error);
  }
};

const handleCancel = () => {
  router.push("/ingredients");
};
</script>

<template>
  <div>
    <h2>Create New Ingredient</h2>
    <IngredientForm
      :loading="ingredientStore.loading"
      @submit="handleSubmit"
      @cancel="handleCancel"
    />
    <div v-if="ingredientStore.error" class="error">
      {{ ingredientStore.error }}
    </div>
  </div>
</template>

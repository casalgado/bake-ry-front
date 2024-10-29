<script setup>
import { useRecipeStore } from "@/stores/recipeStore";
import RecipeForm from "@/components/recipes/RecipeForm.vue";
import { useRouter } from "vue-router";

const router = useRouter();
const recipeStore = useRecipeStore();

const handleSubmit = async (formData) => {
  try {
    await recipeStore.create(formData);
    router.push("/dashboard/recipes");
  } catch (error) {
    console.error("Failed to create recipe:", error);
  }
};

const handleCancel = () => {
  router.push("/recipes");
};
</script>

<template>
  <div>
    <h2>Create New Recipe</h2>
    <RecipeForm
      :loading="recipeStore.loading"
      @submit="handleSubmit"
      @cancel="handleCancel"
    />
    <div v-if="recipeStore.error" class="error">
      {{ recipeStore.error }}
    </div>
  </div>
</template>

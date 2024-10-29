// components/recipes/ShowRecipes.vue
<script setup>
import { ref, onMounted, computed } from "vue";
import { useRecipeStore } from "@/stores/recipeStore";
import { useRouter } from "vue-router";
import RecipeForm from "@/components/recipes/RecipeForm.vue";

const router = useRouter();
const recipeStore = useRecipeStore();

const showForm = ref(false);
const selectedRecipe = ref(null);
const searchQuery = ref("");
const selectedCategory = ref("");

// Category options matching RecipeForm
const categoryOptions = [
  "Bread",
  "Cake",
  "Pastry",
  "Cookie",
  "Muffin",
  "Other",
];

onMounted(async () => {
  await recipeStore.fetchAll();
});

const filteredRecipes = computed(() => {
  return recipeStore.items.filter((recipe) => {
    const matchesSearch =
      recipe.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      recipe.description
        ?.toLowerCase()
        .includes(searchQuery.value.toLowerCase());

    const matchesCategory =
      !selectedCategory.value || recipe.category === selectedCategory.value;

    return matchesSearch && matchesCategory;
  });
});

const handleEdit = (recipe) => {
  selectedRecipe.value = recipe;
  showForm.value = true;
};

const handleDelete = async (recipeId) => {
  if (confirm("Are you sure you want to delete this recipe?")) {
    try {
      await recipeStore.remove(recipeId);
    } catch (error) {
      console.error("Failed to delete recipe:", error);
    }
  }
};

const handleSubmit = async (formData) => {
  try {
    if (selectedRecipe.value) {
      await recipeStore.update(selectedRecipe.value.id, formData);
    }
    showForm.value = false;
    selectedRecipe.value = null;
  } catch (error) {
    console.error("Failed to update recipe:", error);
  }
};

const handleCancel = () => {
  showForm.value = false;
  selectedRecipe.value = null;
};

const navigateToCreate = () => {
  router.push("/dashboard/recipes/create");
};
</script>

<template>
  <div>
    <h2>Recipe Management</h2>

    <!-- Search and Filter Controls -->
    <div>
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Search recipes..."
      />

      <select v-model="selectedCategory">
        <option value="">All categories</option>
        <option
          v-for="category in categoryOptions"
          :key="category"
          :value="category"
        >
          {{ category }}
        </option>
      </select>

      <button @click="navigateToCreate">New Recipe</button>
    </div>

    <!-- Loading State -->
    <div v-if="recipeStore.loading">Loading recipes...</div>

    <!-- Error State -->
    <div v-if="recipeStore.error">
      {{ recipeStore.error }}
    </div>

    <!-- Edit Form Modal -->
    <div v-if="showForm">
      <div>
        <h3>Edit Recipe</h3>
        <RecipeForm
          :key="selectedRecipe.id"
          :initial-data="selectedRecipe"
          :loading="recipeStore.loading"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>

    <!-- Recipes Table -->
    <div v-if="!recipeStore.loading && filteredRecipes.length > 0">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Ingredients</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="recipe in filteredRecipes" :key="recipe.id">
            <td>
              <div>{{ recipe.name }}</div>
              <div v-if="recipe.description">
                {{ recipe.description }}
              </div>
            </td>
            <td>{{ recipe.category }}</td>
            <td>
              <div
                v-for="(ingredient, index) in recipe.ingredients"
                :key="index"
              >
                {{ ingredient.name }} - {{ ingredient.quantity }}
                {{ ingredient.unit }}
              </div>
            </td>
            <td>{{ recipe.isActive ? "Active" : "Inactive" }}</td>
            <td>
              <button @click="handleEdit(recipe)">Edit</button>
              <button @click="handleDelete(recipe.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No Results State -->
    <div v-else-if="!recipeStore.loading && filteredRecipes.length === 0">
      No recipes found.
    </div>
  </div>
</template>

<style scoped lang="scss">
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

th,
td {
  padding: 0.5rem;
  text-align: left;
  border: 1px solid #ddd;
}

button + button {
  margin-left: 0.5rem;
}
</style>

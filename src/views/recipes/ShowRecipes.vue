<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRecipeStore } from '@/stores/recipeStore';
import { useRouter } from 'vue-router';
import RecipeForm from '@/components/forms/RecipeForm.vue';
import DataTable from '@/components/DataTable/index.vue';

const router = useRouter();
const recipeStore = useRecipeStore();
const showForm = ref(false);
const selectedRecipe = ref(null);
const searchQuery = ref('');
const selectedCategory = ref('');

const categoryOptions = [
  'Bread',
  'Cake',
  'Pastry',
  'Cookie',
  'Muffin',
  'Other',
];

onMounted(async () => {
  await recipeStore.fetchAll();
});

const tableData = computed(() => {
  return recipeStore.items.filter((recipe) => {
    const matchesSearch =
      recipe.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      recipe.description?.toLowerCase().includes(searchQuery.value.toLowerCase());

    const matchesCategory =
      !selectedCategory.value || recipe.category === selectedCategory.value;

    return matchesSearch && matchesCategory;
  });
});

const columns = [
  {
    id: 'name',
    label: 'Name',
    field: 'name',
    sortable: true,
    customRender: (value, row) => {
      if (row.description) {
        return `<div>${value}</div><div class="text-sm text-gray-500">${row.description}</div>`;
      }
      return value;
    },
  },
  {
    id: 'category',
    label: 'Category',
    field: 'category',
    sortable: true,
  },
  {
    id: 'version',
    label: 'Version',
    field: 'version',
    sortable: true,
    customRender: (value) => `v${value || '1.0'}`,
  },
  {
    id: 'ingredients',
    label: 'Ingredients',
    field: 'ingredients',
    sortable: false,
    customRender: (ingredients) => {
      if (!ingredients || ingredients.length === 0) return '-';
      return ingredients.map(ing =>
        `${ing.name} - ${ing.quantity} ${ing.unit}`,
      ).join(', ');
    },
  },
  {
    id: 'isActive',
    label: 'Status',
    field: 'isActive',
    sortable: true,
    customRender: (value) => value ? 'Active' : 'Inactive',
  },
];

const handleRowClick = ({ row }) => {
  selectedRecipe.value = row;
  showForm.value = true;
};

const handleSubmit = async (formData) => {
  try {
    if (selectedRecipe.value) {
      await recipeStore.update(selectedRecipe.value.id, formData);
    }
    showForm.value = false;
    selectedRecipe.value = null;
  } catch (error) {
    console.error('Failed to update recipe:', error);
  }
};

const handleCancel = () => {
  showForm.value = false;
  selectedRecipe.value = null;
};

const handleDelete = async (recipeId) => {
  if (confirm('Are you sure you want to delete this recipe?')) {
    try {
      await recipeStore.remove(recipeId);
    } catch (error) {
      console.error('Failed to delete recipe:', error);
    }
  }
};

const navigateToCreate = () => {
  router.push('/dashboard/recipes/create');
};
</script>

<template>
  <div class="container p-4">
    <h2 class="text-2xl font-bold mb-4">Recipe Management</h2>

    <!-- Search and Filter Controls -->
    <div class="flex gap-4 mb-4">
      <input
        type="text"
        v-model="searchQuery"
        placeholder="Search recipes..."
        class="px-4 py-2 border rounded"
      />

      <select
        v-model="selectedCategory"
        class="px-4 py-2 border rounded"
      >
        <option value="">All categories</option>
        <option
          v-for="category in categoryOptions"
          :key="category"
          :value="category"
        >
          {{ category }}
        </option>
      </select>

      <button
        @click="navigateToCreate"
        class="px-4 py-2 action-btn"
      >
        New Recipe
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="recipeStore.loading" class="text-neutral-600 text-center py-4">
      Loading recipes...
    </div>

    <!-- Error State -->
    <div v-if="recipeStore.error" class="text-red-500 text-center py-4">
      {{ recipeStore.error }}
    </div>

    <!-- Edit Form Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h3 class="text-xl font-bold mb-4">Edit Recipe</h3>
        <RecipeForm
          :key="selectedRecipe.id"
          :initial-data="selectedRecipe"
          :loading="recipeStore.loading"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>

    <!-- Table -->
    <div v-if="!recipeStore.loading">
      <DataTable
        :data="tableData"
        :columns="columns"
        @row-click="handleRowClick"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

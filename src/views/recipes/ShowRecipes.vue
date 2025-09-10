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

onMounted(async () => {
  await recipeStore.fetchAll();
});

const columns = [
  {
    id: 'name',
    label: 'Name',
    field: 'name',
    sortable: true,
    renderer: (row) => {
      if (row.description) {
        return {
          content: `
            <div>${row.name}</div>
            <div class="text-sm text-neutral-500">${row.description}</div>
          `,
        };
      }
      return row.name;
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
    renderer: (row) => `v${row.version || '1.0'}`,
  },
  {
    id: 'ingredients',
    label: 'Ingredients',
    field: 'ingredients',
    sortable: false,
    renderer: (row) => {
      if (!row.ingredients || row.ingredients.length === 0) return '-';
      return row.ingredients
        .map(ing => `${ing.name} - ${ing.quantity} ${ing.unit}`)
        .join(', ');
    },
  },
  {
    id: 'isActive',
    label: 'Status',
    field: 'isActive',
    sortable: true,
    type: 'toggle',
    options: [true, false],
    renderer: (row) => row.isActive ? 'Active' : 'Inactive',
  },
];

// Selection handler
const handleSelectionChange = (selectedIds) => {
  // If only one recipe is selected, we can show the edit form
  if (selectedIds.length === 1) {
    selectedRecipe.value = recipeStore.items.find(r => r.id === selectedIds[0]);

  } else {
    selectedRecipe.value = null;

  }
};

// Toggle handler
const handleToggleUpdate = async ({ rowIds, field, value }) => {
  try {
    // Update each selected recipe
    for (const id of rowIds) {
      await recipeStore.update(id, { [field]: value });
    }
  } catch (error) {
    console.error('Failed to update recipes:', error);
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
    console.error('Failed to update recipe:', error);
  }
};

const handleCancel = () => {
  showForm.value = false;
  selectedRecipe.value = null;
};

const navigateToCreate = () => {
  router.push('/dashboard/recipes/create');
};
</script>

<template>
  <div class="container p-4 px-0 lg:px-4">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-bold">Recipe Management</h2>
      <button
        @click="navigateToCreate"
        class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
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
    <div
      v-if="showForm"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
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
        :data="recipeStore.items"
        :columns="columns"
        @selection-change="handleSelectionChange"
        @toggle-update="handleToggleUpdate"
        class="bg-white shadow-lg rounded-lg"
      />
    </div>
  </div>
</template>

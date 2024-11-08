<script setup>
import { ref, onMounted } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useRouter } from 'vue-router';
import ProductCategoryForm from '@/components/forms/ProductCategoryForm.vue';

const router = useRouter();
void router;
const settingsStore = useBakerySettingsStore();

// Track which sections are being edited
const editingSections = ref({
  creatingProductCategory: false, // Changed from productCategories
  editingProductCategory: false,  // New property to track which category is being edited
  ingredientCategories: false,
  orderStatuses: false,
  theme: false,
});

onMounted(async () => {
  await settingsStore.fetchById('default');
});

const toggleEdit = (section) => {
  editingSections.value[section] = !editingSections.value[section];
};

const handleSubmit = async (formData, section) => {
  try {
    await settingsStore.patch('default', { [section]: formData });
    editingSections.value[section] = false;
  } catch (error) {
    console.error(`Failed to update ${section}:`, error);
  }
};

const handleCancel = (section) => {
  editingSections.value[section] = false;
};
</script>

<template>
  <div>
    <h2>Bakery Settings Management</h2>

    <!-- Loading State -->
    <div v-if="settingsStore.loading">Loading settings...</div>

    <!-- Error State -->
    <div v-if="settingsStore.error">
      {{ settingsStore.error }}
    </div>

    {{ editingSections }}
    <!-- Settings Sections -->
    <div v-if="!settingsStore.loading && settingsStore.currentItem">
      <!-- Product Categories Section -->
      <section>
        <div class="section-header">
          <h3>Product Categories</h3>
          <button @click="() => editingSections.creatingProductCategory = !editingSections.creatingProductCategory">
            {{ editingSections.creatingProductCategory ? 'Cancel' : 'Create' }}
          </button>
        </div>

        <div v-if="editingSections.creatingProductCategory">
          <ProductCategoryForm
            @submit="formData => handleSubmit(formData, 'productCategories')"
            @cancel="() => handleCancel('creatingProductCategory')"/>
        </div>

        <div v-if="editingSections.editingProductCategory">
          <ProductCategoryForm
            :initial-data="settingsStore.currentItem.productCategories.find(
              cat => cat.id === editingSections.editingProductCategory
            )"
            @submit="formData => handleSubmit(formData, 'productCategories')"
            @cancel="() => handleCancel('creatingProductCategory')"/>
        </div>

        <table v-if="!editingSections.creatingProductCategory && !editingSections.editingProductCategory">
          <thead>
            <tr>
              <th>Name</th>
              <th>Display Type</th>
              <th>Variations</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="category in settingsStore.currentItem.productCategories" :key="category.id">
              <td>
                <div>{{ category.name }}</div>
                <div v-if="category.description">{{ category.description }}</div>
              </td>
              <td>{{ category.displayType || 'None' }}</td>
              <td>
                <div v-if="category.suggestedVariations?.length">
                  <div v-for="variation in category.suggestedVariations" :key="variation.name">
                    {{ variation.name }}
                    ({{ category.displayType === 'weight' ? `${variation.value}g` : `x${variation.value}` }})
                    - {{ variation.recipeMultiplier }}x
                  </div>
                </div>
                <div v-else>No variations</div>
              </td>
              <td>{{ category.isActive ? 'Active' : 'Inactive' }}</td>
              <td>
                <button @click="() => editingSections.editingProductCategory = category.id">
                  Edit
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Ingredient Categories Section -->
      <section>
        <div class="section-header">
          <h3>Ingredient Categories</h3>
          <button @click="toggleEdit('ingredientCategories')">
            {{ editingSections.ingredientCategories ? 'Cancel' : 'Edit' }}
          </button>
        </div>

        <table v-if="!editingSections.ingredientCategories">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="category in settingsStore.currentItem.ingredientCategories" :key="category.name">
              <td>
                <div>{{ category.name }}</div>
                <div v-if="category.description">{{ category.description }}</div>
              </td>
              <td>{{ category.isActive ? 'Active' : 'Inactive' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Order Statuses Section -->
      <section>
        <div class="section-header">
          <h3>Order Statuses</h3>
          <button @click="toggleEdit('orderStatuses')">
            {{ editingSections.orderStatuses ? 'Cancel' : 'Edit' }}
          </button>
        </div>

        <ul v-if="!editingSections.orderStatuses">
          <li v-for="status in settingsStore.currentItem.orderStatuses" :key="status">
            {{ status }}
          </li>
        </ul>
      </section>

      <!-- Theme Settings -->
      <section>
        <div class="section-header">
          <h3>Theme Settings</h3>
          <button @click="toggleEdit('theme')">
            {{ editingSections.theme ? 'Cancel' : 'Edit' }}
          </button>
        </div>

        <pre v-if="!editingSections.theme">{{ JSON.stringify(settingsStore.currentItem.theme, null, 2) }}</pre>
      </section>
    </div>

    <div v-else-if="!settingsStore.loading && !settingsStore.currentItem">
      No settings found.
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

section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: start;
  align-items: center;
}

button + button {
  margin-left: 0.5rem;
}
</style>

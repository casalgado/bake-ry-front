<script setup>
import { ref, onMounted } from 'vue';
import { useBakerySettingsStore } from '@/stores/bakerySettingsStore';
import { useRouter } from 'vue-router';
import ProductCategoryForm from '@/components/forms/ProductCategoryForm.vue';

const router = useRouter();
void router;
const settingsStore = useBakerySettingsStore();

const showForm = ref(false);
const selectedSection = ref(null);

onMounted(async () => {
  await settingsStore.fetchById('default');
});

const handleEdit = (section) => {
  selectedSection.value = section;
  showForm.value = true;
};

const handleSubmit = async (formData) => {
  try {
    await settingsStore.patch('default', formData);
    showForm.value = false;
    selectedSection.value = null;
  } catch (error) {
    console.error('Failed to update settings:', error);
  }
};

const handleCancel = () => {
  showForm.value = false;
  selectedSection.value = null;
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

    <!-- Edit Form Modal -->
    <div v-if="showForm">
      <div>
        <h3>Edit Settings</h3>
        <ProductCategoryForm
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>
    </div>

    <!-- Settings Sections -->
    <div v-if="!settingsStore.loading && settingsStore.currentItem">
      <!-- Product Categories Section -->
      <section>
        <h3>Product Categories</h3>
        <button @click="handleEdit('productCategories')">Edit</button>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Display Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="category in settingsStore.currentItem.productCategories" :key="category.name">
              <td>
                <div>{{ category.name }}</div>
                <div v-if="category.description">{{ category.description }}</div>
              </td>
              <td>{{ category.displayType || 'None' }}</td>
              <td>{{ category.isActive ? 'Active' : 'Inactive' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Ingredient Categories Section -->
      <section>
        <h3>Ingredient Categories</h3>
        <button @click="handleEdit('ingredientCategories')">Edit</button>
        <table>
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
        <h3>Order Statuses</h3>
        <button @click="handleEdit('orderStatuses')">Edit</button>
        <ul>
          <li v-for="status in settingsStore.currentItem.orderStatuses" :key="status">
            {{ status }}
          </li>
        </ul>
      </section>

      <!-- Theme Settings -->
      <section>
        <h3>Theme Settings</h3>
        <button @click="handleEdit('theme')">Edit</button>
        <pre>{{ JSON.stringify(settingsStore.currentItem.theme, null, 2) }}</pre>
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

button + button {
  margin-left: 0.5rem;
}
</style>
